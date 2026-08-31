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
  private readonly accounts = new Map<
    string,
    { account: UserAccount; password: string; preferences: NotificationPreferences }
  >();
  private readonly currentUserId = signal<string | null>(null);

  readonly currentUser = computed<UserAccount | null>(() => {
    const id = this.currentUserId();
    if (!id) return null;
    return this.accounts.get(id)?.account ?? null;
  });

  readonly isAuthenticated = computed(() => this.currentUserId() !== null);

  constructor() {
    this.seedDemoAccount();
  }

  private seedDemoAccount(): void {
    const id = 'user-demo';
    this.accounts.set(id, {
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
    const match = [...this.accounts.values()].find(
      (entry) =>
        (entry.account.email.toLowerCase() === emailOrMobile.toLowerCase() ||
          entry.account.mobileNumber === emailOrMobile) &&
        entry.password === password,
    );
    if (!match) return { ok: false, error: 'Incorrect email/mobile number or password.' };
    this.currentUserId.set(match.account.id);
    return { ok: true };
  }

  register(
    personal: RegisterPersonalInfo,
    contact: RegisterContactInfo,
    security: RegisterSecurityInfo,
  ): { ok: true; id: string } | { ok: false; error: string } {
    const exists = [...this.accounts.values()].some(
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
    this.accounts.set(id, { account, password: security.password, preferences: defaultNotificationPreferences() });
    return { ok: true, id };
  }

  logout(): void {
    this.currentUserId.set(null);
  }

  updateProfile(patch: Partial<Pick<UserAccount, 'firstName' | 'middleName' | 'lastName' | 'mobileNumber' | 'address' | 'barangay' | 'city' | 'province' | 'zipCode'>>): void {
    const id = this.currentUserId();
    if (!id) return;
    const entry = this.accounts.get(id);
    if (!entry) return;
    entry.account = { ...entry.account, ...patch };
    this.accounts.set(id, entry);
  }

  changePassword(currentPassword: string, newPassword: string): { ok: true } | { ok: false; error: string } {
    const id = this.currentUserId();
    if (!id) return { ok: false, error: 'Not signed in.' };
    const entry = this.accounts.get(id)!;
    if (entry.password !== currentPassword) return { ok: false, error: 'Current password is incorrect.' };
    entry.password = newPassword;
    this.accounts.set(id, entry);
    return { ok: true };
  }

  applicantTypeSet(type: ApplicantType): void {
    const id = this.currentUserId();
    if (!id) return;
    const entry = this.accounts.get(id);
    if (!entry) return;
    entry.account = { ...entry.account, applicantType: type };
    this.accounts.set(id, entry);
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
    return { ...(this.accounts.get(id)?.preferences ?? defaultNotificationPreferences()) };
  }

  updateNotificationPreferences(next: NotificationPreferences): void {
    const id = this.currentUserId();
    if (!id) return;
    const entry = this.accounts.get(id);
    if (!entry) return;
    entry.preferences = { ...next };
    this.accounts.set(id, entry);
  }
}
