import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ApplicantType,
  CivilStatus,
  Sex,
  UserAccount,
  unverifiedContact,
} from '../domain/user.model';
import { CitizenIdentityApi } from '../api/citizen-identity.api';
import { CitizenApiClient } from '../api/citizen-api.client';
import { CitizenTokenStore } from '../api/citizen-token-store';
import { MeResponse } from '../api/citizen-profile';
import { ApiError } from '../api/problem';

export interface RegisterPersonalInfo {
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string;
  sex: Sex;
  civilStatus: CivilStatus;
  nationality: string;
}

export interface RegisterContactInfo {
  email: string;
  mobileNumber: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface RegisterSecurityInfo {
  password: string;
}

/**
 * Real, HTTP-backed authentication against `eBPCOBackend`.
 *
 * Replaces the in-memory mock this file used to hold (a `Map<string,
 * account>` seeded with a demo account, matching the citizen mobile app's
 * MockAuthRepository convention). The mock's own doc comment said this
 * service was "structured so a genuine HTTP-backed AuthService can replace
 * this one without touching call sites" — true for every consumer except
 * `login.page.ts` and `register.page.ts`, which called `login()`/`register()`
 * expecting a synchronous result. A real network call cannot be synchronous;
 * both call sites were updated to `await` these methods, which is the one
 * unavoidable ripple from going from a Map to HTTP.
 *
 * ── One remaining gap: dateOfBirth/sex/civilStatus/nationality are not
 * correctable after registration ──────────────────────────────────────────
 *
 * Migration 038 gave `POST /auth/register` four more optional fields —
 * dateOfBirth, sex, civilStatus, nationality — alongside the original five
 * (`.strict()`, see auth.controller.ts), and `GET`/`PATCH /me` both return
 * them now. So registration genuinely stores and returns these four; what
 * is still missing is a way to CORRECT one after the fact — `PATCH /me`'s
 * schema only accepts firstName/middleName/lastName/mobileNumber/street/
 * barangay/city/province/postalCode. `buildRectification` in
 * `citizen-profile.ts` does not offer these four for editing for that
 * reason, not an oversight — flag it if a screen needs to correct one.
 *
 * `CitizenTokenStore` is injected directly only for `restore()`'s fast
 * path — every write to it still happens inside `CitizenIdentityApi`
 * (`signIn`/`signOut`), never here.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly identity = inject(CitizenIdentityApi);
  private readonly api = inject(CitizenApiClient);
  private readonly tokens = inject(CitizenTokenStore);
  private readonly router = inject(Router);

  private readonly _profile = signal<UserAccount | null>(null);

  /**
   * The profile photo, fetched and cached as an object URL — never the raw
   * server bytes held directly in a signal, and never `currentUser()
   * .hasPhoto` treated as though it were the image. `GET /me/photo` takes a
   * bearer token an `<img src>` cannot attach, so this is the one place that
   * fetches it (via `CitizenApiClient.getPhotoBlob()`) and turns the result
   * into something the DOM can render — shared by the Profile screen and the
   * app shell's own avatar, so both show the same photo without either
   * fetching it twice.
   */
  private readonly _photoUrl = signal<string | null>(null);
  readonly photoUrl = this._photoUrl.asReadonly();

  // Proactive background refresh, matching the Admin Portal's
  // `SessionService` — see `scheduleRefresh` below for why. Only an explicit
  // "Log Out", or the refresh token itself finally being refused (30 days
  // unused, or revoked), ends the session while a tab stays open.
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * `applicantType` has no server field either (see class doc). Kept as a
   * local-only override layered onto the real profile, the same shape the
   * old mock had, so the applicant-type picker screen keeps working within
   * this session — it is never sent anywhere and does not survive a reload.
   */
  private readonly _applicantTypeOverride = signal<ApplicantType | null>(null);

  readonly currentUser = computed<UserAccount | null>(() => {
    const profile = this._profile();
    if (!profile) return null;
    const override = this._applicantTypeOverride();
    return override === null ? profile : { ...profile, applicantType: override };
  });

  /**
   * True once a real profile has been loaded — NOT merely "a token exists".
   * A token can survive in localStorage from a previous visit while this
   * signal is still null on a fresh page load; that gap is closed by the
   * session-restore step (Stage 3), not by this flag.
   */
  readonly isAuthenticated = computed(() => this._profile() !== null);

  async login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const me = await this.identity.signIn(email, password);
      if (me.kind !== 'applicant') {
        // Defensive only — this portal has no path to a staff account, but a
        // wrong answer here must not be shown as a normal profile.
        await this.identity.signOut();
        return { ok: false, error: 'This is a staff account. Staff sign in through the Admin Portal.' };
      }
      this._profile.set(meResponseToAccount(me));
      this.scheduleRefresh();
      void this.refreshPhoto();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: describeError(error) };
    }
  }

  async register(
    personal: RegisterPersonalInfo,
    contact: RegisterContactInfo,
    security: RegisterSecurityInfo,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await this.identity.register({
        firstName: personal.firstName,
        lastName: personal.lastName,
        email: contact.email,
        mobileNumber: contact.mobileNumber,
        password: security.password,
        dateOfBirth: personal.dateOfBirth,
        sex: personal.sex,
        civilStatus: personal.civilStatus,
        nationality: personal.nationality,
        // Migration 036, sent here since 2026-09-19. `register.page.ts`'s
        // Step 1/2 has required all six of these for longer than the server
        // had a field for them — this was the gap where a citizen filled in
        // a real address, watched the form accept it, and found it blank on
        // their own Profile screen afterward with nothing telling them why.
        // `personal.middleName` is nullable on this type (an optional field
        // on the form itself); `undefined`, not `null`, is what a Zod
        // `.optional()` field on the wire actually means "omit this".
        ...(personal.middleName ? { middleName: personal.middleName } : {}),
        street: contact.street,
        barangay: contact.barangay,
        city: contact.city,
        province: contact.province,
        postalCode: contact.postalCode,
      });
      // The server does not return an id (202, no body) and does not say
      // whether the address was already registered — identical either way,
      // by design (enumeration).
      return { ok: true };
    } catch (error) {
      // A weak/breached/repetitive password comes back as a 400 with a field
      // error pointing at `/password` — the server's own explanation
      // (password-policy.ts), not a generic "request did not validate".
      // `describeError`'s `citizenMessage` reads `title` as its last resort,
      // which is that generic line, not the specific one this endpoint
      // actually sends.
      if (error instanceof ApiError) {
        const passwordErrors = (error.problem?.fieldErrors ?? []).filter((e) => e.pointer === '/password');
        if (passwordErrors.length > 0) {
          return { ok: false, error: passwordErrors.map((e) => e.message).join(' ') };
        }
      }
      return { ok: false, error: describeError(error) };
    }
  }

  async logout(): Promise<void> {
    await this.identity.signOut();
    this.dropSession();
  }

  /**
   * Drops the local session without calling the API.
   *
   * For when the server has already said the token is no good (a 401 on an
   * authenticated request — see `citizen-auth.interceptor.ts`) rather than
   * the citizen choosing to sign out. Calling `logout()` there would try to
   * revoke a token that is, by definition, already refused, and — more
   * importantly — `citizen-auth.interceptor.ts` cannot call an async
   * `logout()` mid-request and wait for it.
   *
   * The interceptor clearing `CitizenTokenStore` alone is not enough: this
   * class's `isAuthenticated` reads its own `_profile` signal, which the
   * interceptor cannot reach. Without this, a citizen whose token expired
   * mid-session stayed `isAuthenticated() === true` on stale, cached profile
   * data — invisible until they tried an action and got a 401, and even
   * then: `citizen-auth.interceptor.ts` redirects to `/login`, but
   * `guestGuard` there reads the same stale `isAuthenticated()` and bounced
   * them straight back to `/dashboard`, as if signing out did nothing.
   * Caught live, filing a real application, when the access token expired
   * mid-wizard.
   */
  dropSession(): void {
    this._profile.set(null);
    this._applicantTypeOverride.set(null);
    this.clearRefreshTimer();
    // Revoked, not just cleared: an object URL keeps its Blob alive in memory
    // until this is called, and the next citizen to sign in on this device
    // (a shared counter machine, or just a second account in the same tab)
    // must not have the previous one's photo linger in memory or, worse,
    // flash on screen for a moment before the new one loads.
    const current = this._photoUrl();
    if (current !== null) URL.revokeObjectURL(current);
    this._photoUrl.set(null);
  }

  /**
   * Re-establishes a session from a token that survived a reload.
   *
   * Without this, refreshing the page (or reopening a tab — this portal
   * deliberately keeps citizens signed in across a browser close, see
   * `CitizenTokenStore`'s own doc comment) would sign the citizen out even
   * though the token in localStorage is still valid, which defeats the
   * whole point of using localStorage instead of sessionStorage here.
   *
   * Called once, at app bootstrap, via `provideAppInitializer` in
   * `app.config.ts` — so by the time the router activates the first route,
   * `isAuthenticated()` already reflects reality and the guard never has to
   * redirect a citizen who was already signed in.
   */
  async restore(): Promise<void> {
    if (!this.tokens.hasSession() || this._profile() !== null) return;
    try {
      // Spends the refresh token first, when one is stored, rather than
      // trusting whatever access token survived the reload: the access
      // token is real but short-lived (15 minutes server-side), and a tab
      // left open past that window is the ordinary case, not an edge one —
      // going straight to `/me` on an expired access token 401s and reads
      // exactly like a session that never existed, even though a valid
      // refresh token was sitting right there in localStorage. Caught live:
      // reloading a real, still-signed-in citizen session after normal
      // browsing sent them to /login.
      const refreshToken = this.tokens.refreshToken();
      if (refreshToken !== null) await this.identity.refresh(refreshToken);
      const me = await this.identity.me();
      if (me.kind === 'applicant') {
        this._profile.set(meResponseToAccount(me));
        this.scheduleRefresh();
        void this.refreshPhoto();
      }
    } catch {
      // An expired or revoked token is not an error worth showing on load —
      // the guard sends the citizen to sign in, same as if they had never
      // had a session.
    }
  }

  /**
   * Arms the background refresh for whatever time is actually left on the
   * access token, per `CitizenTokenStore.expiresInSeconds()`. Fires at 80%
   * of the remaining life (capped to a 90-second-before-expiry floor) so it
   * lands comfortably before the token dies even under a slow network, and
   * reschedules itself from the fresh `expiresIn` each time it succeeds —
   * so the session renews indefinitely while the tab stays open, the same
   * as the Admin Portal's `SessionService.scheduleRefresh()`. Without this,
   * an applicant filling in a long wizard hit the 15-minute access-token
   * wall mid-task and was bounced to `/login` with the in-progress form
   * lost — `restore()`'s one-time refresh at bootstrap only ever covered a
   * reload, never a tab that had simply stayed open past that window.
   *
   * No refresh token, or no recorded expiry (an older stored session),
   * means nothing to schedule; the existing reactive 401 handling in
   * `citizen-auth.interceptor.ts` remains the fallback for that case.
   */
  private scheduleRefresh(): void {
    this.clearRefreshTimer();
    if (this.tokens.refreshToken() === null) return;
    const remaining = this.tokens.expiresInSeconds();
    if (remaining === null) return;
    const buffer = Math.min(90, Math.floor(remaining * 0.2));
    const delaySeconds = Math.max(5, remaining - buffer);
    this.refreshTimer = setTimeout(() => void this.performRefresh(), delaySeconds * 1000);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * The refresh timer's own callback. A failure here means the refresh token
   * itself was refused — expired past its life, or revoked — a genuine end
   * of session, not a bug, so it ends the session the same way
   * `citizen-auth.interceptor.ts` does on a 401.
   */
  private async performRefresh(): Promise<void> {
    try {
      const refreshToken = this.tokens.refreshToken();
      if (refreshToken === null) return;
      await this.identity.refresh(refreshToken);
      this.scheduleRefresh();
    } catch {
      this.tokens.clear();
      this.dropSession();
      if (!this.router.url.startsWith('/login')) {
        void this.router.navigate(['/login'], { queryParams: { reason: 'session-expired' } });
      }
    }
  }

  /**
   * Not yet wired to `PATCH /me` — that is Stage 10 of the connection plan.
   * For now this updates the local copy only, same as before wiring began,
   * so the Profile screen's own `saveProfile()` (which calls `PATCH /me`
   * directly through `CitizenApiClient` when `canReachTheOffice()`) is what
   * actually reaches the server; this keeps the in-memory account in sync
   * with what that screen just showed as saved.
   */
  updateProfile(
    patch: Partial<
      Pick<UserAccount, 'firstName' | 'middleName' | 'lastName' | 'mobileNumber' | 'street' | 'barangay' | 'city' | 'province' | 'postalCode'>
    >,
  ): void {
    const current = this._profile();
    if (!current) return;
    this._profile.set({ ...current, ...patch });
  }

  /**
   * Called by the Profile screen right after `PUT`/`DELETE /me/photo`
   * succeeds — flips the local flag `GET /me` will confirm on the next
   * fetch anyway, so the avatar updates on THIS screen and in the app
   * shell without waiting for one, then re-fetches the actual bytes.
   */
  async setHasPhoto(value: boolean): Promise<void> {
    const current = this._profile();
    if (current) this._profile.set({ ...current, hasPhoto: value });
    await this.refreshPhoto();
  }

  /** Re-fetches the photo blob (or clears it) to match `currentUser()?.hasPhoto`. See `photoUrl`'s own doc comment for why this exists at all. */
  private async refreshPhoto(): Promise<void> {
    const previous = this._photoUrl();
    const hasPhoto = this._profile()?.hasPhoto ?? false;

    if (!hasPhoto) {
      this._photoUrl.set(null);
    } else {
      try {
        const blob = await firstValueFrom(this.api.getPhotoBlob());
        this._photoUrl.set(URL.createObjectURL(blob));
      } catch {
        // The server said `hasPhoto: true` and the fetch failed anyway --
        // treated as no photo rather than surfaced as an error. An avatar
        // is decoration, not a fact the citizen came to this screen to
        // learn, and a transient network blip should not toast over it.
        this._photoUrl.set(null);
      }
    }

    // Revoked last, after the new one (if any) is already live -- revoking
    // first would leave a moment where an `<img>` bound to the old URL fails
    // to load before the new one is ready.
    if (previous !== null) URL.revokeObjectURL(previous);
  }

  /**
   * `POST /auth/password/change`, real since this account gained one.
   * Ending every other session is the SERVER's doing
   * (`IdentityService.changePassword`), not this method's — by the time this
   * resolves `ok: true`, every refresh token on this account, including this
   * tab's own, has already been revoked. The caller (`profile.page.ts`) is
   * expected to sign out locally and send the citizen back through `/login`
   * rather than let this tab keep acting as though its session survived.
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const result = await this.identity.changePassword(currentPassword, newPassword);
    if (result.kind === 'done') return { ok: true };
    if (result.kind === 'wrong-current-password') {
      return { ok: false, error: 'That is not your current password.' };
    }
    return { ok: false, error: result.message };
  }

  applicantTypeSet(type: ApplicantType): void {
    if (!this._profile()) return;
    this._applicantTypeOverride.set(type);
  }
}

/**
 * `MeResponse` (the server's shape) → `UserAccount` (this portal's shape).
 *
 * Every server field the applicant `/me` route sends is nullable, and null
 * means NOT RECORDED — see `citizen-profile.ts`. `UserAccount`'s address
 * fields predate that distinction and are typed as plain strings, so a null
 * becomes '' here; that loses the "never asked" vs "answered blank" fact
 * `MeResponse` itself preserves, which is a real narrowing, not a neutral
 * default. Screens that need the distinction should read `CitizenApiClient
 * .getMe()` directly (as `profile.page.ts` already does for `heldProfile()`)
 * rather than trust this mapping.
 */
function meResponseToAccount(me: MeResponse): UserAccount {
  return {
    id: me.id,
    firstName: me.firstName ?? '',
    middleName: me.middleName,
    lastName: me.lastName ?? '',
    // Migration 038 (see class doc on AuthService). Null genuinely means NOT
    // RECORDED here, the same as the address fields below — not "never asked".
    dateOfBirth: me.dateOfBirth,
    // The server's check constraint is the real guarantee behind this cast —
    // same reasoning as `postgres-account.repository.ts`'s own cast on read.
    sex: me.sex as Sex | null,
    civilStatus: me.civilStatus as CivilStatus | null,
    nationality: me.nationality ?? '',
    email: me.email,
    mobileNumber: me.mobileNumber ?? '',
    landlineNumber: null,
    applicantType: null,
    street: me.street ?? '',
    barangay: me.barangay ?? '',
    city: me.city ?? '',
    province: me.province ?? '',
    postalCode: me.postalCode ?? '',
    hasPhoto: me.hasPhoto,
    // No server field for this either. Derived from email verification as
    // the closest real signal, rather than invented: an unverified email
    // reads as "pending", a verified one as "verified". This is an
    // approximation, not a server-stated fact — do not treat it as one.
    accountStatus: me.emailVerifiedAt ? 'verified' : 'pending',
    emailVerification: me.emailVerifiedAt
      ? { status: 'Verified', method: 'Email Verification Link', verifiedAt: me.emailVerifiedAt }
      : unverifiedContact(),
    mobileVerification: me.mobileVerifiedAt
      ? { status: 'Verified', method: 'Mobile OTP', verifiedAt: me.mobileVerifiedAt }
      : unverifiedContact(),
    // No server field for account-creation time either — not returned by
    // `/me`. '' rather than a guessed date.
    registeredSince: '',
  };
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.citizenMessage;
  return 'We could not reach the Municipality’s system. Check your connection and try again.';
}
