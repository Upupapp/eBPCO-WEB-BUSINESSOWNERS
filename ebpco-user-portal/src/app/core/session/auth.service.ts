import { Injectable, computed, signal } from '@angular/core';
import {
  AccountStatus,
  ApplicantType,
  CivilStatus,
  Sex,
  NotificationPreferences,
  UserAccount,
  defaultNotificationPreferences,
  unverifiedContact,
} from '../domain/user.model';
import { nextId, todayIso } from '../utils/ids';

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
  address: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: string;
}

export interface RegisterSecurityInfo {
  password: string;
}

/**
 * Mock authentication: a real, working UI flow against an in-memory store,
 * structured so a genuine HTTP-backed AuthService can replace this one without
 * touching call sites. It mirrors the convention in the citizen mobile app's
 * MockAuthRepository.
 *
 * Deliberately in-memory only, never persisted to localStorage — a page refresh
 * always logs out, by design, rather than silently keeping a "signed in" state
 * alive across reloads.
 *
 * WHY IT IS STILL A MOCK, as of 2026-08-31. This comment used to justify itself
 * with "there is no backend anywhere in the eBPCO system yet (see master command
 * Section 15, Open Decision #3)". That premise has EXPIRED: Upupapp/eBPCOBackend
 * exists and carries a branch, and the admin portal already calls it over HTTP.
 * What remains true is narrower — no backend is wired to THIS portal, and its
 * auth contract has not been settled for citizens.
 *
 * The distinction matters because this comment is the load-bearing justification
 * for the whole in-memory design, and a stale premise quietly converts a
 * deliberate decision into an unexamined one. Re-date it or replace it; do not
 * leave it asserting something that has stopped being true.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /**
   * Accounts, held in a SIGNAL rather than a bare Map.
   *
   * F-26. This was a plain `new Map()`, and `currentUser` below is a computed
   * whose only reactive dependency is `currentUserId`. So every write here —
   * updateProfile, changePassword, applicantTypeSet, preferences — mutated the
   * map and the computed NEVER RECOMPUTED, because no signal it read had
   * changed. `currentUser()` went on returning the account as it stood at
   * sign-in, for the life of the session.
   *
   * A citizen who changed their address was shown "Profile updated", and the
   * shell's name, the permit document's Address line and the payment receipt's
   * payor all carried on showing the old values. The profile FORM looked
   * correct only because it holds its own field variables — nothing that read
   * the account ever saw the change.
   *
   * Writes replace the map rather than mutating it, so the signal actually
   * changes identity. Mutating the map held inside a signal would leave exactly
   * the same bug with a signal wrapped round it.
   */
  private readonly accounts = signal(
    new Map<string, { account: UserAccount; password: string; preferences: NotificationPreferences }>(),
  );

  /** Replace one entry, producing a NEW map so dependent computeds recompute. */
  private writeAccount(
    id: string,
    entry: { account: UserAccount; password: string; preferences: NotificationPreferences },
  ): void {
    this.accounts.update((m) => new Map(m).set(id, entry));
  }
  private readonly currentUserId = signal<string | null>(null);

  readonly currentUser = computed<UserAccount | null>(() => {
    const id = this.currentUserId();
    if (!id) return null;
    return this.accounts().get(id)?.account ?? null;
  });

  readonly isAuthenticated = computed(() => this.currentUserId() !== null);

  constructor() {
    this.seedDemoAccount();
  }

  private seedDemoAccount(): void {
    const id = 'user-demo';
    this.writeAccount(id, {
      password: 'Password1',
      preferences: defaultNotificationPreferences(),
      account: {
        id,
        firstName: 'Juan',
        middleName: 'Santos',
        lastName: 'Dela Cruz',
        dateOfBirth: '1988-04-12',
        sex: 'Male',
        civilStatus: 'Married',
        nationality: 'Filipino',
        email: 'juan.delacruz@example.com',
        mobileNumber: '09171234567',
        landlineNumber: null,
        applicantType: 'Individual',
        address: 'Purok 3, Zone 2',
        barangay: 'Poblacion',
        city: 'Castilla',
        province: 'Sorsogon',
        zipCode: '4712',
        photoPath: null,
        accountStatus: 'verified',
        emailVerification: { status: 'Verified', method: 'Email Verification Link', verifiedAt: todayIso() },
        mobileVerification: { status: 'Verified', method: 'Mobile OTP', verifiedAt: todayIso() },
        registeredSince: '2026-01-15T00:00:00.000Z',
      },
    });
  }

  login(emailOrMobile: string, password: string): { ok: true } | { ok: false; error: string } {
    const match = [...this.accounts().values()].find(
      (entry) =>
        entry.account.email.toLowerCase() === emailOrMobile.toLowerCase() ||
        entry.account.mobileNumber === emailOrMobile,
    );
    if (!match) return { ok: false, error: 'No account found with that email or mobile number.' };
    if (match.password !== password) return { ok: false, error: 'Incorrect password. Please try again.' };
    this.currentUserId.set(match.account.id);
    return { ok: true };
  }

  register(
    personal: RegisterPersonalInfo,
    contact: RegisterContactInfo,
    security: RegisterSecurityInfo,
  ): { ok: true; id: string } | { ok: false; error: string } {
    const exists = [...this.accounts().values()].some(
      (entry) => entry.account.email.toLowerCase() === contact.email.toLowerCase(),
    );
    if (exists) return { ok: false, error: 'An account with this email already exists.' };

    const id = nextId('user');
    const account: UserAccount = {
      id,
      firstName: personal.firstName,
      middleName: personal.middleName,
      lastName: personal.lastName,
      dateOfBirth: personal.dateOfBirth,
      sex: personal.sex,
      civilStatus: personal.civilStatus,
      nationality: personal.nationality,
      email: contact.email,
      mobileNumber: contact.mobileNumber,
      landlineNumber: null,
      applicantType: null,
      address: contact.address,
      barangay: contact.barangay,
      city: contact.city,
      province: contact.province,
      zipCode: contact.zipCode,
      photoPath: null,
      accountStatus: 'pending' as AccountStatus,
      emailVerification: unverifiedContact(),
      mobileVerification: unverifiedContact(),
      registeredSince: todayIso(),
    };
    this.writeAccount(id, { account, password: security.password, preferences: defaultNotificationPreferences() });
    return { ok: true, id };
  }

  logout(): void {
    this.currentUserId.set(null);
  }

  updateProfile(patch: Partial<Pick<UserAccount, 'firstName' | 'middleName' | 'lastName' | 'mobileNumber' | 'address' | 'barangay' | 'city' | 'province' | 'zipCode' | 'photoPath'>>): void {
    const id = this.currentUserId();
    if (!id) return;
    const entry = this.accounts().get(id);
    if (!entry) return;
    entry.account = { ...entry.account, ...patch };
    this.writeAccount(id, entry);
  }

  changePassword(currentPassword: string, newPassword: string): { ok: true } | { ok: false; error: string } {
    const id = this.currentUserId();
    if (!id) return { ok: false, error: 'Not signed in.' };
    const entry = this.accounts().get(id)!;
    if (entry.password !== currentPassword) return { ok: false, error: 'Current password is incorrect.' };
    entry.password = newPassword;
    this.writeAccount(id, entry);
    return { ok: true };
  }

  applicantTypeSet(type: ApplicantType): void {
    const id = this.currentUserId();
    if (!id) return;
    const entry = this.accounts().get(id);
    if (!entry) return;
    entry.account = { ...entry.account, applicantType: type };
    this.writeAccount(id, entry);
  }

  /**
   * F-15: this used to return a FRESH default object on every call, and nothing
   * called it. The Profile screen bound its eight preference checkboxes to a
   * local `defaultNotificationPreferences()` instead, so toggling one changed an
   * object that was discarded on navigation — a settings panel that looked
   * functional and configured nothing.
   *
   * Bound is not persisted. The controls all had bindings, which is why a
   * dead-control scan (looking for handler-less buttons and unbound selects)
   * reported this screen clean.
   *
   * Preferences now live on the account, like every other profile field, so the
   * panel works end-to-end within the demo's own world — the same standard the
   * mocked login already meets. They are still in-memory only.
   */
  notificationPreferencesFor(): NotificationPreferences {
    const id = this.currentUserId();
    if (!id) return defaultNotificationPreferences();
    return { ...(this.accounts().get(id)?.preferences ?? defaultNotificationPreferences()) };
  }

  updateNotificationPreferences(next: NotificationPreferences): void {
    const id = this.currentUserId();
    if (!id) return;
    const entry = this.accounts().get(id);
    if (!entry) return;
    entry.preferences = { ...next };
    this.writeAccount(id, entry);
  }
}
