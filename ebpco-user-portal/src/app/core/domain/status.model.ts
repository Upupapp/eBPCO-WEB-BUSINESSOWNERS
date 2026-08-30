// Canonical application status model — ported from the Admin Portal's
// core/domain/status.model.ts so the two apps describe the same record.
// This User Portal only ever DISPLAYS the coarser applicant-facing label
// (see LIFECYCLE_TO_MOBILE_LABEL / applicantStatusOf below); the full
// 19-value lifecycle exists here so a future shared backend has one
// definition to implement, not two.
export type ApplicationLifecycleStatus =
  | 'Draft'
  | 'Submitted'
  | 'Received'
  | 'Document Verification'
  | 'Under Evaluation'
  | 'Revision Required'
  | 'Assessed'
  | 'Payment Submitted'
  | 'Payment Under Verification'
  | 'Payment Verified'
  | 'For Approval'
  | 'Approved'
  | 'Permit Generated'
  | 'Ready for Release'
  | 'Released'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled'
  | 'Expired';

export const LIFECYCLE_SEQUENCE: ApplicationLifecycleStatus[] = [
  'Draft',
  'Submitted',
  'Received',
  'Document Verification',
  'Under Evaluation',
  'Assessed',
  'Payment Submitted',
  'Payment Under Verification',
  'Payment Verified',
  'For Approval',
  'Approved',
  'Permit Generated',
  'Ready for Release',
  'Released',
  'Completed',
];

const TERMINAL_STATUSES: ReadonlySet<ApplicationLifecycleStatus> = new Set([
  'Rejected',
  'Cancelled',
  'Expired',
  'Completed',
]);

export function isTerminalStatus(status: ApplicationLifecycleStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** The applicant-facing vocabulary — identical to ebpco-mobile's ApplicationStatus. Every screen in this portal renders this, never the raw 19-value lifecycle. */
export type ApplicantStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Payment Verification'
  | 'Approved'
  | 'Ready for Release'
  | 'Rejected';

export const LIFECYCLE_TO_APPLICANT_STATUS: Record<ApplicationLifecycleStatus, ApplicantStatus> = {
  Draft: 'Draft',
  Submitted: 'Submitted',
  Received: 'Submitted',
  'Document Verification': 'Under Review',
  'Under Evaluation': 'Under Review',
  'Revision Required': 'Under Review',
  Assessed: 'Payment Verification',
  'Payment Submitted': 'Payment Verification',
  'Payment Under Verification': 'Payment Verification',
  'Payment Verified': 'Payment Verification',
  'For Approval': 'Payment Verification',
  Approved: 'Approved',
  'Permit Generated': 'Approved',
  'Ready for Release': 'Ready for Release',
  Released: 'Ready for Release',
  Completed: 'Ready for Release',
  Rejected: 'Rejected',
  Cancelled: 'Rejected',
  Expired: 'Rejected',
};

export function applicantStatusOf(status: ApplicationLifecycleStatus): ApplicantStatus {
  return LIFECYCLE_TO_APPLICANT_STATUS[status];
}

/** Plain-language "what happens next" line for the Application Details screen, keyed by the internal lifecycle status. */
export const NEXT_STEP_TEXT: Record<ApplicationLifecycleStatus, string> = {
  Draft: 'Finish your application and submit it when ready.',
  Submitted: 'Your application has been received and is queued for review.',
  Received: 'Your application has been received and is queued for review.',
  'Document Verification': 'Your submitted documents are being checked for completeness.',
  'Under Evaluation': 'Your application is under technical evaluation by the reviewing office.',
  'Revision Required': 'Please review the remarks on your application and resubmit the requested items.',
  Assessed: 'An Order of Payment has been issued. Please view your assessment and proceed to payment.',
  'Payment Submitted': 'Your payment has been submitted and is awaiting verification.',
  'Payment Under Verification': 'Your payment is being verified by the collecting office.',
  'Payment Verified': 'Your payment has been verified. Your application is proceeding to final approval.',
  'For Approval': 'Your application is awaiting final approval.',
  Approved: 'Your application has been approved. Your permit is being generated.',
  'Permit Generated': 'Your permit has been generated and is being prepared for release.',
  'Ready for Release': 'Your permit is ready for release. Visit the issuing office or check for pickup instructions.',
  Released: 'Your permit has been released.',
  Completed: 'This application is complete.',
  Rejected: 'Your application was rejected. See remarks for details.',
  Cancelled: 'This application was cancelled.',
  Expired: 'This application has expired.',
};

export type EvaluationStage = 'Initial' | 'Zoning' | 'Fire Safety' | 'OBO' | 'Final Approval';
export type EvaluationResult = 'Pending' | 'Passed' | 'Revision Required' | 'Rejected';

export type PaymentStatus = 'Not Yet Available' | 'Pending Verification' | 'Partially Paid' | 'Paid' | 'Overdue';

export type PermitReleaseStatus = 'Not Ready' | 'Ready for Release' | 'Released';
