import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { BusinessStore } from '../../core/stores/business.store';
import { requirementsFor } from '../../core/domain/requirements-catalog';
import { formatDate } from '../../core/utils/ids';

type PublicStatus = 'Valid' | 'Expired';

/** Public, no-login verification page — the destination the QR block on every generated permit points to. The token is simply the permit's own real, system-generated number. */
@Component({
  selector: 'app-verify-permit',
  template: `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:var(--bg);">
      <div class="card" style="width:100%; max-width:440px; text-align:center;">
        <img src="logo.png" alt="" style="width:56px; height:56px; object-fit:contain; margin-bottom:12px;" />
        <h2 style="margin-bottom:4px;">Permit Verification</h2>
        <p class="muted small" style="margin-bottom:20px;">
          Municipality of Castilla, Sorsogon — Electronic Building Permit and Certificate of Occupancy
        </p>

        @if (permit(); as p) {
          <div class="badge" [class]="status() === 'Valid' ? 'badge-green' : 'badge-amber'" style="margin-bottom:16px; font-size:14px; padding:6px 16px;">
            {{ status() }}
          </div>
          <dl style="text-align:left; display:flex; flex-direction:column; gap:8px; margin:0;">
            <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border-light); padding-bottom:6px;">
              <dt class="small muted">Permit Type</dt>
              <dd style="margin:0; font-weight:700; font-size:14px;">{{ app()?.permitType }}</dd>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border-light); padding-bottom:6px;">
              <dt class="small muted">Document</dt>
              <dd style="margin:0; font-weight:700; font-size:14px;">{{ documentTitle() }}</dd>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border-light); padding-bottom:6px;">
              <dt class="small muted">Permit No.</dt>
              <dd style="margin:0; font-weight:700; font-size:14px;">{{ p.permitNumber }}</dd>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border-light); padding-bottom:6px;">
              <dt class="small muted">Project / Establishment</dt>
              <dd style="margin:0; font-weight:700; font-size:14px;">{{ businessLabel() }}</dd>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border-light); padding-bottom:6px;">
              <dt class="small muted">Issue Date</dt>
              <dd style="margin:0; font-weight:700; font-size:14px;">{{ formatDate(p.issuedDate) }}</dd>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px;">
              <dt class="small muted">Issuing Office</dt>
              <dd style="margin:0; font-weight:700; font-size:14px; text-align:right;">{{ p.approvingOffice }}</dd>
            </div>
          </dl>
        } @else {
          <p class="muted" style="font-weight:600;">No permit found for this number.</p>
        }
      </div>
    </div>
  `,
})
export class VerifyPermitPage {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(ApplicationStore);
  private readonly businessStore = inject(BusinessStore);

  protected readonly formatDate = formatDate;

  protected readonly permit = computed(() => {
    const number = this.route.snapshot.paramMap.get('permitNumber');
    return number ? this.store.permitByNumber(number) : undefined;
  });

  protected readonly app = computed(() => {
    const p = this.permit();
    return p ? this.store.applicationById(p.applicationId) : undefined;
  });

  protected readonly business = computed(() => {
    const a = this.app();
    return a ? this.businessStore.businessById(a.businessId) : undefined;
  });

  protected readonly businessLabel = computed(() => this.business()?.name || this.app()?.businessName || 'Not provided');

  protected readonly documentTitle = computed(() => {
    const a = this.app();
    if (!a || a.permitType === 'General Business Permit') return a?.permitType ?? '';
    return requirementsFor(a.permitType).requiredForm;
  });

  protected readonly status = computed<PublicStatus>(() => {
    const p = this.permit();
    if (!p) return 'Valid';
    if (p.expiryDateValue && p.expiryDateValue.getTime() < Date.now()) return 'Expired';
    return 'Valid';
  });
}
