import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ApplicantType,
  CivilStatus,
  NotificationPreferences,
  Sex,
  UserAccount,
  defaultNotificationPreferences,
  unverifiedContact,
} from '../domain/user.model';
import { CitizenIdentityApi } from '../api/citizen-identity.api';
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
 * ── A genuine gap this file does NOT paper over ──────────────────────────
 *
 * `POST /auth/register` accepts exactly five fields — firstName, lastName,
 * email, mobileNumber, password (`.strict()`, see auth.controller.ts) — and
 * `PATCH /me` accepts firstName/middleName/lastName/mobileNumber/street/
 * barangay/city/province/postalCode. Neither has a field for dateOfBirth,
 * sex, civilStatus or nationality — the register screen still collects them
 * (age-gating 18+ depends on dateOfBirth), but nothing sends them anywhere.
 * `meResponseToAccount` below always returns null/'' for these four fields,
 * on every account, because the server has no column for them to come back
 * from. This is a real, unclosed gap in the backend's applicant model, not
 * an oversight in this wiring — flag it if it matters for a screen, do not
 * invent a server field to fix it here.
 *
 * `CitizenTokenStore` is injected directly only for `restore()`'s fast
 * path — every write to it still happens inside `CitizenIdentityApi`
 * (`signIn`/`signOut`), never here.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly identity = inject(CitizenIdentityApi);
  private readonly tokens = inject(CitizenTokenStore);

  private readonly _profile = signal<UserAccount | null>(null);

  /**
   * `applicantType` has no server field either (see class doc). Kept as a
   * local-only override layered onto the real profile, the same shape the
   * old mock had, so the applicant-type picker screen keeps working within
   * this session — it is never sent anywhere and does not survive a reload.
   */
  private readonly _applicantTypeOverride = signal<ApplicantType | null>(null);

  private readonly _preferences = signal<NotificationPreferences>(defaultNotificationPreferences());

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
      });
      // The server does not return an id (202, no body) and does not say
      // whether the address was already registered — identical either way,
      // by design (enumeration). middleName/street/barangay/city/province/
      // postalCode were collected on this form and are NOT sent: no field
      // exists for them at registration (see class doc).
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
      const me = await this.identity.me();
      if (me.kind === 'applicant') this._profile.set(meResponseToAccount(me));
    } catch {
      // An expired or revoked token is not an error worth showing on load —
      // the guard sends the citizen to sign in, same as if they had never
      // had a session.
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
      Pick<UserAccount, 'firstName' | 'middleName' | 'lastName' | 'mobileNumber' | 'street' | 'barangay' | 'city' | 'province' | 'postalCode' | 'photoPath'>
    >,
  ): void {
    const current = this._profile();
    if (!current) return;
    this._profile.set({ ...current, ...patch });
  }

  /**
   * No backend route exists for "change my password while signed in" — only
   * the forgot/reset-by-email flow (`POST /auth/password/forgot` →
   * `POST /auth/password/reset`, wired in `CitizenIdentityApi`). This method
   * stays a local-only stand-in and refuses honestly rather than claim a
   * change that was never sent anywhere.
   */
  changePassword(): { ok: false; error: string } {
    return {
      ok: false,
      error: 'Changing your password here isn’t connected yet — use "Forgot password?" on the sign-in screen instead.',
    };
  }

  applicantTypeSet(type: ApplicantType): void {
    if (!this._profile()) return;
    this._applicantTypeOverride.set(type);
  }

  notificationPreferencesFor(): NotificationPreferences {
    return { ...this._preferences() };
  }

  updateNotificationPreferences(next: NotificationPreferences): void {
    this._preferences.set({ ...next });
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
    // No server field exists for any of these four (see class doc on
    // AuthService) — null/empty here is not "not recorded", it is "this
    // account has never been asked", which is a real, standing gap.
    dateOfBirth: null,
    sex: null,
    civilStatus: null,
    nationality: '',
    email: me.email,
    mobileNumber: me.mobileNumber ?? '',
    landlineNumber: null,
    applicantType: null,
    street: me.street ?? '',
    barangay: me.barangay ?? '',
    city: me.city ?? '',
    province: me.province ?? '',
    postalCode: me.postalCode ?? '',
    photoPath: null,
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
