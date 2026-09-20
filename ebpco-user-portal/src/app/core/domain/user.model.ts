// Reconciles Admin's Applicant (core/domain/applicant.model.ts) with
// mobile's UserModel (ebpco-mobile/lib/core/models/user_model.dart) into
// the one account shape this portal owns and authenticates directly —
// unlike the Admin Portal, this app IS the applicant's real login surface.
// Email only. The LGU records a mobile number and does not verify it — there
// is no SMS provider and no intention to add one — so a "Mobile OTP" method
// and a mobile verification state were removed (2026-09-20) rather than left
// as badges nothing could ever change.
export type VerificationMethod = 'Email Verification Link';
export type VerificationStatus = 'Unverified' | 'Pending Verification' | 'Verified' | 'Verification Failed';

export interface ContactVerification {
  status: VerificationStatus;
  method: VerificationMethod | null;
  verifiedAt: string | null;
}

export function unverifiedContact(): ContactVerification {
  return { status: 'Unverified', method: null, verifiedAt: null };
}

export type ApplicantType = 'Individual' | 'Authorized Representative' | 'Corporate Officer';
export type AccountStatus = 'verified' | 'pending' | 'suspended';
export type CivilStatus = 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Divorced';
export type Sex = 'Male' | 'Female' | 'Prefer not to say';

export interface UserAccount {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string | null;
  sex: Sex | null;
  civilStatus: CivilStatus | null;
  nationality: string;
  email: string;
  mobileNumber: string;
  landlineNumber: string | null;
  applicantType: ApplicantType | null;
  street: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
  /** Whether `GET /me/photo` has bytes — never the bytes/URL themselves. See `AuthService.photoUrl` for the real, fetched image. */
  hasPhoto: boolean;
  accountStatus: AccountStatus;
  emailVerification: ContactVerification;
  registeredSince: string;
}

export function fullName(user: Pick<UserAccount, 'firstName' | 'middleName' | 'lastName'>): string {
  return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
}

// Notification preferences moved to `citizen-api.models.ts`'s
// `NotificationPreferencesResponse` — the real `GET`/`PUT
// /notification-preferences` shape (six named categories plus quiet hours),
// not this eight-checkbox local model. That model never matched what the
// server actually stores (`emailNotifications`/`smsNotifications`/
// `pushNotifications` were CHANNEL preferences no route has ever accepted),
// and `AuthService.updateNotificationPreferences()` only ever wrote to an
// in-memory signal nothing persisted past a reload.
