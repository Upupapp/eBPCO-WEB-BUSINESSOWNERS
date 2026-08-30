import { ApplicationLifecycleStatus, EvaluationResult, EvaluationStage, PaymentStatus, PermitReleaseStatus } from './status.model';
import { ApplicationAction, PermitType } from './permit.model';

// Mirrors the Admin Portal's core/domain/application.model.ts ApplicationRecord.
export interface ApplicationRecord {
  id: string;
  applicationNumber: string;
  businessId: string;
  businessName: string;
  applicantId: string;
  /** 'General Business Permit' is the mobile app's generic New/Renewal/Amendment flow, which is NOT anchored to one of the 19 catalog permit types — kept as its own literal rather than forced into PermitType, per master command Section 8's generic-checklist callout. */
  permitType: PermitType | 'General Business Permit';
  applicationAction: ApplicationAction;
  dateSubmitted: string | null;
  lifecycleStatus: ApplicationLifecycleStatus;
  evaluationStage: EvaluationStage;
  evaluationResult: EvaluationResult;
  paymentStatus: PaymentStatus;
  permitReleaseStatus: PermitReleaseStatus;
  assessedAmountCentavos: number | null;
  permitNumber: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
}

export interface StatusTimelineEntry {
  status: ApplicationLifecycleStatus;
  timestamp: string;
  remarks: string | null;
}
