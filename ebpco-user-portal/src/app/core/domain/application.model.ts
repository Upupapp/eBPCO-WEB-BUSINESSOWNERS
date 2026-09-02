import { ApplicationLifecycleStatus, EvaluationResult, EvaluationStage, PaymentStatus, PermitReleaseStatus } from './status.model';
import { ApplicationAction, PermitType, PublishedPermitType } from './permit.model';

// Mirrors the Admin Portal's core/domain/application.model.ts ApplicationRecord.
export interface ApplicationRecord {
  id: string;
  applicationNumber: string;
  businessId: string;
  businessName: string;
  applicantId: string;
  /** 'Business Permit' is the mobile app's generic New/Renewal/Amendment flow, which is NOT anchored to one of the 19 catalog permit types — kept as its own literal rather than forced into PermitType, per master command Section 8's generic-checklist callout. */
  permitType: PublishedPermitType;
  applicationAction: ApplicationAction;
  /**
   * The permit this application renews or amends.
   *
   * REQUIRED whenever `applicationAction` is 'Renewal' or 'Amendment', and null
   * for 'New'. Without it a renewal reaches the office saying "this is a
   * renewal" and nothing about WHAT it renews — the office would have to guess
   * which of the applicant's permits was meant, and the citizen would have no
   * way to say. The Screen Inventory's REN-001 "Select Existing Permit" and
   * AMD-001 "Select Permit" exist to capture exactly this.
   *
   * Held as the permit NUMBER rather than an internal id: it is what the office
   * and the citizen both recognise, and it is what appears on the permit.
   */
  relatedPermitNumber: string | null;
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

/**
 * Does this application say what it acts on?
 *
 * A 'New' application acts on nothing and must carry no related permit — a
 * stray one there would assert a relationship the citizen never claimed. A
 * 'Renewal' or 'Amendment' acts on exactly one existing permit and is
 * incomplete without it: the office receives "this is a renewal" and has no
 * way to tell which of the applicant's permits was meant.
 *
 * Written as a predicate rather than left to the wizard's template so the
 * store can refuse the same record the form refuses. A rule enforced in only
 * one of the two places is enforced by whichever path the caller happens to
 * take.
 */
export function actionReferenceIsComplete(
  action: ApplicationAction,
  relatedPermitNumber: string | null,
): boolean {
  return action === 'New' ? relatedPermitNumber === null : !!relatedPermitNumber;
}

/** Whether this action must name an existing permit. Drives the wizard's extra step. */
export function actionNeedsExistingPermit(action: ApplicationAction): boolean {
  return action === 'Renewal' || action === 'Amendment';
}

/** What the citizen is asked to pick, in their words. REN-001 and AMD-001 label this differently. */
export function existingPermitPrompt(action: ApplicationAction): string {
  return action === 'Renewal' ? 'Permit being renewed' : 'Permit being amended';
}
