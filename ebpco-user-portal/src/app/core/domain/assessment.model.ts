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


/**
 * F-19: what the permit document prints in its AUTHORITY column.
 *
 * Every fee amount in this build is invented — ₱5,250 filing, ₱850 zoning,
 * ₱3,200 renewal, ₱1,500 amendment. They used to be labelled
 * "LGU Fee Schedule": a named legal basis, printed in an AUTHORITY column on a
 * document carrying the Republic of the Philippines letterhead and the
 * municipal seal. A citizen would budget on that, and the ATTRIBUTION is
 * precisely what made an invented number credible — an unsourced figure invites
 * a phone call, a sourced one does not.
 *
 * The amounts stay, because the assessment and payment flow needs numbers to
 * demonstrate anything at all. The false attribution does not.
 *
 * Checked before filing as blocked: no bundled LGU document carries Castilla's
 * fee schedule. The peso figures under docs/ are formatting examples in a
 * microcopy style guide, not rates. Replace this with the real basis — the
 * ordinance title and number — when the Municipality supplies the schedule.
 */
export const ILLUSTRATIVE_FEE_BASIS = 'Illustrative amount — not a Castilla rate';
