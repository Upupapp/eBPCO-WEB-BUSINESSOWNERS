import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { PublicPermitRecord } from '../../core/api/citizen-api.models';
import { requirementsFor, REQUIREMENTS_CATALOG } from '../../core/domain/requirements-catalog';
import { PermitType } from '../../core/domain/permit.model';
import { MUNICIPAL_ENGINEER } from '../../core/domain/lgu-contact';
import { formatDate } from '../../core/utils/ids';

type LookupState = 'loading' | 'found' | 'not-found' | 'unavailable';

/**
 * Public, no-login verification page — the destination the QR block on every
 * generated permit points to. The token is the permit's own number.
 *
 * Asks the Municipality's server (`GET /public/permits/{number}`). It used to
 * look the number up in the VISITOR's own browser data, so a stranger scanning
 * a genuine permit was told "No record for this permit number" (found live
 * 2026-09-27).
 *
 * FAILS CLOSED, and never says "Valid": the system records no revocation or
 * suspension, so it cannot know a permit is still in force. It says only what
 * is true — the Municipality issued this number, on this date, for this
 * project — and sends the reader to the office for standing.
 */
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

        @switch (state()) {
          @case ('loading') {
            <p class="muted">Checking the Municipality’s records…</p>
          }
          @case ('found') {
            @if (record(); as r) {
              <div class="badge badge-green" style="margin-bottom:16px; font-size:14px; padding:6px 16px;">
                On record — issued by the Municipality
              </div>
              <dl style="text-align:left; display:flex; flex-direction:column; gap:8px; margin:0;">
                <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border-light); padding-bottom:6px;">
                  <dt class="small muted">Permit Type</dt>
                  <dd style="margin:0; font-weight:700; font-size:14px; text-align:right;">{{ r.permitType }}</dd>
                </div>
                <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border-light); padding-bottom:6px;">
                  <dt class="small muted">Permit No.</dt>
                  <dd style="margin:0; font-weight:700; font-size:14px;">{{ r.permitNumber }}</dd>
                </div>
                <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border-light); padding-bottom:6px;">
                  <dt class="small muted">Project / Establishment</dt>
                  <dd style="margin:0; font-weight:700; font-size:14px; text-align:right;">{{ r.businessName ?? 'Not on file' }}</dd>
                </div>
                <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border-light); padding-bottom:6px;">
                  <dt class="small muted">Issue Date</dt>
                  <dd style="margin:0; font-weight:700; font-size:14px;">{{ formatDate(r.issuedDate) }}</dd>
                </div>
                <div style="display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid var(--border-light); padding-bottom:6px;">
                  <dt class="small muted">Issuing Office</dt>
                  <dd style="margin:0; font-weight:700; font-size:14px; text-align:right;">{{ issuingOffice() }}</dd>
                </div>
                <div style="display:flex; justify-content:space-between; gap:12px;">
                  <dt class="small muted">Released to the holder</dt>
                  <dd style="margin:0; font-weight:700; font-size:14px;">{{ r.released ? (r.releasedAt ? formatDate(r.releasedAt) : 'Yes') : 'Not yet' }}</dd>
                </div>
              </dl>
            }
          }
          @case ('not-found') {
            <p class="muted" style="font-weight:600;">No permit with this number is on record.</p>
            <p class="small muted" style="margin-top:8px; text-align:left;">
              <strong>This does not by itself mean the permit is invalid.</strong> Check the number against the
              paper permit, and confirm with the office below — permits issued on paper before eBPCO are not in
              this system.
            </p>
          }
          @case ('unavailable') {
            <p class="muted" style="font-weight:600;">The Municipality’s records could not be reached just now.</p>
            <p class="small muted" style="margin-top:8px; text-align:left;">Try again in a moment, or confirm with the office below.</p>
          }
        }

        <div class="card" style="margin-top:20px; text-align:left; background:var(--warning-100, #fff4e5); border:1px solid var(--warning-text, #a15c00);">
          <div class="card-title" style="margin-bottom:6px;">What this page can and cannot tell you</div>
          <p class="small" style="margin:0 0 8px;">
            It confirms only that the Municipality issued a permit with this number. It does not show whether the
            permit is still in force, or who holds it.
          </p>
          <p class="small" style="margin:0;">
            To confirm a permit’s standing, contact the {{ engineer.name }}, Municipality of Castilla,
            Sorsogon — <strong>{{ engineer.mobile }}</strong> or <strong>{{ engineer.email }}</strong>.
          </p>
        </div>
      </div>
    </div>
  `,
})
export class VerifyPermitPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CitizenApiClient);

  protected readonly formatDate = formatDate;
  protected readonly engineer = MUNICIPAL_ENGINEER;

  protected readonly state = signal<LookupState>('loading');
  protected readonly record = signal<PublicPermitRecord | null>(null);

  /** From this portal's own catalogue of which office issues which permit type; generic when the type is unknown here. */
  protected readonly issuingOffice = computed(() => {
    const type = this.record()?.permitType;
    if (type && type in REQUIREMENTS_CATALOG) return requirementsFor(type as PermitType).reviewingOffice;
    return 'Municipality of Castilla, Sorsogon';
  });

  constructor() {
    const number = this.route.snapshot.paramMap.get('permitNumber')?.trim();
    if (!number || !this.api.configured) {
      this.state.set(number ? 'unavailable' : 'not-found');
      return;
    }
    this.api.verifyPermit(number).subscribe({
      next: (r) => { this.record.set(r); this.state.set('found'); },
      error: (e: { status?: number }) => this.state.set(e?.status === 404 ? 'not-found' : 'unavailable'),
    });
  }
}
