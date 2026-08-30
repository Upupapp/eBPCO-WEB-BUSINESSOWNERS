// Identical shape to the Admin Portal's core/domain/business.model.ts,
// which itself mirrors ebpco-mobile's BusinessModel — this is a genuinely
// shared entity across all three surfaces.
export type BusinessCategory = 'Retail' | 'Food Service' | 'Services' | 'Manufacturing' | 'Wholesale' | 'Other';
export type BusinessStatus = 'Active' | 'Inactive';

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  'Retail',
  'Food Service',
  'Services',
  'Manufacturing',
  'Wholesale',
  'Other',
];

/** One applicant may own several businesses — ownerApplicantId is many-to-one, never assumed 1:1. */
export interface Business {
  id: string;
  name: string;
  category: BusinessCategory;
  ownerApplicantId: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  registrationNumber: string;
  dateRegistered: string;
  status: BusinessStatus;
}
