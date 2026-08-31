// Mirrors the Admin Portal's core/domain/payment.model.ts.
export type PaymentMethod = 'Bank Transfer' | 'Onsite';
export type PaymentTransactionStatus = 'Pending Verification' | 'Verified' | 'Rejected' | 'Voided';
export type CollectingAgency = 'OBO/LGU' | 'BFP';

/**
 * While `orNumber` is null, any receipt referencing this transaction must
 * display "Payment Acknowledgment", never "Official Receipt" — an OR
 * number is only ever entered by the collecting office's cashier, never
 * fabricated client-side. See master command Section 10.4.
 */
export interface PaymentTransaction {
  id: string;
  assessmentId: string;
  applicationId: string;
  amountCentavos: number;
  method: PaymentMethod;
  agency: CollectingAgency;
  transactionReference: string;
  proofFileName: string | null;
  status: PaymentTransactionStatus;
  submittedAt: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
  orNumber: string | null;
  orDate: string | null;
}

export interface BankTransferInfo {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
}

/**
 * The LGU's deposit account, once the Municipality supplies it.
 *
 * `null` means "not supplied", and the payment screen must render an honest
 * "not yet available" state rather than anything an applicant could copy.
 *
 * This was previously a fabricated literal — a real bank ("Land Bank of the
 * Philippines"), a real branch ("Castilla, Sorsogon Branch") and an invented
 * account number ("1234-5678-90"), unmarked, presented as the account to send
 * permit fees to. Every other invented value in this build is either seeded
 * demo data behind a login or explicitly labelled; that one was an instruction
 * to move money, which is why it is null and not a marked placeholder: a
 * labelled fake account number can still be copied, and a partially-real one
 * (right bank, wrong number) is the most dangerous form of all.
 *
 * Checked before filing as blocked, per standing rule: no bundled LGU document
 * carries these details. `docs/08-Reusable-Stitch/10-Payment-Stitch.md` names
 * the FIELDS only. This genuinely awaits the Municipality.
 */
export const DEFAULT_BANK_INFO: BankTransferInfo | null = null;
