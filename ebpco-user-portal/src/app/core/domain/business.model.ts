// Was identical to the Admin Portal's core/domain/business.model.ts — that
// mock category list ('Wholesale' included) predates any real backend to
// check it against. `businesses.controller.ts`'s `businessShape` is the
// real, enforced enum (re-verified 2026-09-15 by reading it directly), and
// it is NOT the same set: 'Wholesale' has no server equivalent (a real
// submission with it is refused 400), and the server has three categories
// this list never had — 'Construction', 'Transport', 'Agriculture'. Fixed
// to match, now that this portal actually sends this value to the server.
export type BusinessCategory =
  | 'Retail' | 'Food Service' | 'Services' | 'Manufacturing'
  | 'Construction' | 'Transport' | 'Agriculture' | 'Other';
export type BusinessStatus = 'Active' | 'Inactive';

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  'Retail',
  'Food Service',
  'Services',
  'Manufacturing',
  'Construction',
  'Transport',
  'Agriculture',
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
