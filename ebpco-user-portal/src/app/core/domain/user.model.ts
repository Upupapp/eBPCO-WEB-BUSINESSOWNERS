// Reconciles Admin's Applicant (core/domain/applicant.model.ts) with
// mobile's UserModel (ebpco-mobile/lib/core/models/user_model.dart) into
// the one account shape this portal owns and authenticates directly —
// unlike the Admin Portal, this app IS the applicant's real login surface.
export type VerificationMethod = 'Email Verification Link' | 'Mobile OTP';
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
export type Sex = 'Male' | 'Female';

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
  address: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: string;
  photoPath: string | null;
  accountStatus: AccountStatus;
  emailVerification: ContactVerification;
  mobileVerification: ContactVerification;
  registeredSince: string;
}

export function fullName(user: Pick<UserAccount, 'firstName' | 'middleName' | 'lastName'>): string {
  return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
}

export interface NotificationPreferences {
  applicationUpdates: boolean;
  paymentNotifications: boolean;
  permitStatusUpdates: boolean;
  documentReminders: boolean;
  systemAnnouncements: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
}

export function defaultNotificationPreferences(): NotificationPreferences {
  return {
    applicationUpdates: true,
    paymentNotifications: true,
    permitStatusUpdates: true,
    documentReminders: true,
    systemAnnouncements: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
  };
}
