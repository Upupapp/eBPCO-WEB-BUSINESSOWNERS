export const LIFECYCLE_SEQUENCE = [
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
const TERMINAL_STATUSES = new Set([
    'Rejected',
    'Cancelled',
    'Expired',
    'Completed',
]);
export function isTerminalStatus(status) {
    return TERMINAL_STATUSES.has(status);
}
export const LIFECYCLE_TO_APPLICANT_STATUS = {
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
export function applicantStatusOf(status) {
    return LIFECYCLE_TO_APPLICANT_STATUS[status];
}
/** Plain-language "what happens next" line for the Application Details screen, keyed by the internal lifecycle status. */
export const NEXT_STEP_TEXT = {
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
