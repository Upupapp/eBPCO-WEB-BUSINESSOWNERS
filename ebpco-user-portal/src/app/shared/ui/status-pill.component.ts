import { Component, Input } from '@angular/core';
import { ApplicantStatus } from '../../core/domain/status.model';
import { DocumentStatus } from '../../core/domain/document.model';

/**
 * Keyed by the label TEXT, not the `ApplicantStatus` categorization —
 * `applicantStatusLabel()` (status.model.ts) shows "Cancelled" for a
 * citizen's own withdrawal even though it categorizes as `ApplicantStatus`
 * `'Rejected'` for filtering, so this needs its own entry rather than
 * falling through to the `?? 'badge-gray'` default below (which would have
 * been the right color by accident, not by a decision recorded anywhere).
 */
const APPLICANT_STATUS_CLASS: Record<ApplicantStatus | 'Cancelled', string> = {
  Draft: 'badge-gray',
  Submitted: 'badge-blue',
  'Under Review': 'badge-primary',
  'Payment Verification': 'badge-amber',
  Approved: 'badge-green',
  'Ready for Release': 'badge-green',
  Rejected: 'badge-red',
  Cancelled: 'badge-gray',
};

const DOCUMENT_STATUS_CLASS: Record<DocumentStatus, string> = {
  Missing: 'badge-gray',
  Uploaded: 'badge-blue',
  Submitted: 'badge-blue',
  'Under Review': 'badge-primary',
  Accepted: 'badge-green',
  Rejected: 'badge-red',
  'Revision Required': 'badge-amber',
  Expired: 'badge-red',
};

@Component({
  selector: 'app-status-pill',
  template: `<span class="badge" [class]="cssClass">{{ label }}</span>`,
})
export class StatusPillComponent {
  @Input({ required: true }) label!: string;
  @Input() kind: 'applicant' | 'document' = 'applicant';

  get cssClass(): string {
    if (this.kind === 'document') return DOCUMENT_STATUS_CLASS[this.label as DocumentStatus] ?? 'badge-gray';
    return APPLICANT_STATUS_CLASS[this.label as ApplicantStatus | 'Cancelled'] ?? 'badge-gray';
  }
}
