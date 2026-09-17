import { __decorate } from "tslib";
import { Component, Input } from '@angular/core';
const APPLICANT_STATUS_CLASS = {
    Draft: 'badge-gray',
    Submitted: 'badge-blue',
    'Under Review': 'badge-primary',
    'Payment Verification': 'badge-amber',
    Approved: 'badge-green',
    'Ready for Release': 'badge-green',
    Rejected: 'badge-red',
};
const DOCUMENT_STATUS_CLASS = {
    Missing: 'badge-gray',
    Uploaded: 'badge-blue',
    Submitted: 'badge-blue',
    'Under Review': 'badge-primary',
    Accepted: 'badge-green',
    Rejected: 'badge-red',
    'Revision Required': 'badge-amber',
    Expired: 'badge-red',
};
let StatusPillComponent = class StatusPillComponent {
    label;
    kind = 'applicant';
    get cssClass() {
        if (this.kind === 'document')
            return DOCUMENT_STATUS_CLASS[this.label] ?? 'badge-gray';
        return APPLICANT_STATUS_CLASS[this.label] ?? 'badge-gray';
    }
};
__decorate([
    Input({ required: true })
], StatusPillComponent.prototype, "label", void 0);
__decorate([
    Input()
], StatusPillComponent.prototype, "kind", void 0);
StatusPillComponent = __decorate([
    Component({
        selector: 'app-status-pill',
        template: `<span class="badge" [class]="cssClass">{{ label }}</span>`,
    })
], StatusPillComponent);
export { StatusPillComponent };
