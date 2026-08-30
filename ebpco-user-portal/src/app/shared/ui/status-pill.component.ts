import { Component, Input } from '@angular/core';
import { ApplicantStatus } from '../../core/domain/status.model';
import { DocumentStatus } from '../../core/domain/document.model';

const APPLICANT_STATUS_CLASS: Record<ApplicantStatus, string> = {
  Draft: 'badge-gray',
  Submitted: 'badge-blue',
  'Under Review': 'badge-primary',
  'Payment Verification': 'badge-amber',
  Approved: 'badge-green',
  'Ready for Release': 'badge-green',
  Rejected: 'badge-red',
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
    return APPLICANT_STATUS_CLASS[this.label as ApplicantStatus] ?? 'badge-gray';
  }
}
