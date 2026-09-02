import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { BusinessStore } from '../../core/stores/business.store';
import { requirementsFor } from '../../core/domain/requirements-catalog';
import { PermitStanding, isPermitStanding } from '../../core/domain/permit.model';
import { formatDate } from '../../core/utils/ids';

/**
 * 'Unverified' is the default for anything this page cannot positively confirm.
 * A verification surface must fail CLOSED: the cost of showing "Valid" for a
 * permit that is not is far higher than the cost of showing "Unverified" for
 * one that is. Do not add a branch that returns 'Valid' by fallthrough.
 */
type PublicStatus = PermitStanding | 'Expired' | 'Unverified';

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
          <div class="badge" [class]="badgeClass()" style="margin-bottom:16px; font-size:14px; padding:6px 16px;">
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
          @if (status() === 'Unverified') {
            <p class="small" style="margin-top:16px; text-align:left; font-weight:600;">
              This record is demonstration data, not an issued permit. It does not confirm that any
              permit exists.
            </p>
          }
        } @else {
          <p class="muted" style="font-weight:600;">No record for this permit number.</p>
          <p class="small muted" style="margin-top:8px; text-align:left;">
            <strong>This does not mean the permit is invalid.</strong> A genuine permit issued by the
            Municipality will not be found here either — see the notice below.
          </p>
        }

        <!--
          F-3: this is the only screen a member of the public reaches without an
          account, and it is the destination of the QR printed on every permit.
          It must therefore carry the demo disclosure the four signed-in screens
          already carry, on BOTH the found and not-found paths. Without it, a
          bank or barangay official checking a real permit number reads "not
          found" as "this permit is forged".
        -->
        <div
          class="card"
          style="margin-top:20px; text-align:left; background:var(--warning-100, #fff4e5); border:1px solid var(--warning-text, #a15c00);"
        >
          <div class="card-title" style="margin-bottom:6px;">This portal cannot yet verify permits</div>
          <p class="small" style="margin:0 0 8px;">
            eBPCO is a demonstration build. It holds no real permit records, so
            <strong>no permit issued by the Municipality of Castilla can be confirmed here</strong> —
            whether or not this page found a match.
          </p>
          <p class="small" style="margin:0;">
            To verify a permit, contact the Office of the Municipal Engineer, Municipality of Castilla,
            Sorsogon — <strong>09054818572</strong> or
            <a href="mailto:meocastilla&#64;gmail.com">meocastilla&#64;gmail.com</a>.
          </p>
        </div>
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
    if (!a || a.permitType === 'Business Permit') return a?.permitType ?? '';
    return requirementsFor(a.permitType).requiredForm;
  });

  protected readonly status = computed<PublicStatus>(() => {
    const p = this.permit();

    // Fail closed, in three steps, and note that NONE of them derives 'Valid'.
    //
    // This page used to end `return 'Valid'` — if a permit was issued and had
    // not expired, it said Valid. That derivation has no term for revocation,
    // so a permit the Municipality had REVOKED would have been reported to the
    // public as Valid the moment a backend set provenance: 'issued'. Nobody
    // would have had to make a mistake; it was the default.
    //
    // A verification surface cannot COMPUTE validity. It can only relay what
    // the issuing office says, and say so plainly when the office has not said
    // anything. See PermitStanding.
    if (!p) return 'Unverified';
    if (p.provenance !== 'issued') return 'Unverified';
    if (!isPermitStanding(p.standing)) return 'Unverified';

    // Expiry is applied ON TOP of the office's answer, never instead of it: a
    // permit can be both current in the register and out of date.
    if (p.expiryDateValue && p.expiryDateValue.getTime() < Date.now()) return 'Expired';
    return p.standing;
  });

  protected readonly badgeClass = computed(() => {
    switch (this.status()) {
      case 'Valid':
        return 'badge-green';
      case 'Expired':
        return 'badge-amber';
      case 'Revoked':
      case 'Suspended':
      case 'Cancelled':
        // Withdrawn standings read as a REFUSAL, not a caution. Someone is
        // being shown this permit by its holder.
        return 'badge-red';
      default:
        return 'badge-gray';
    }
  });
}
