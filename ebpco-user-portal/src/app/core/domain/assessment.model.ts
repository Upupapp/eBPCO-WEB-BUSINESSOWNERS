// Simplified read/pay-facing projection of the Admin Portal's Assessment
// model (core/domain/assessment.model.ts) — this portal only needs to
// display an issued Order of Payment and accept a payment against it, not
// the full versioning/adjustment machinery the assessor's office owns.
export type AssessmentStatus =
  | 'Draft'
  | 'For Approval'
  | 'Issued'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Superseded'
  | 'Voided';

export type FeeAuthority = 'DPWH' | 'BFP' | 'LGU';

export interface AssessmentLineItem {
  code: string;
  name: string;
  family: string;
  authority: FeeAuthority;
  amountCentavos: number | null;
  legalBasisTitle: string;
}

export interface Assessment {
  id: string;
  applicationId: string;
  status: AssessmentStatus;
  lineItems: AssessmentLineItem[];
  totalCentavos: number;
  amountPaidCentavos: number;
  balanceCentavos: number;
  /** Order of Payment Slip number — assigned only once issued. */
  opsNumber: string | null;
  dueDate: string | null;
  issuedAt: string | null;
}

export function pesos(centavos: number): string {
  return (centavos / 100).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
}
