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

export const DEFAULT_BANK_INFO: BankTransferInfo = {
  bankName: 'Land Bank of the Philippines',
  accountName: 'eBPCO Business Permits — Municipality of Castilla',
  accountNumber: '1234-5678-90',
  branch: 'Castilla, Sorsogon Branch',
};
