import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import qrcodegen from 'qrcode-generator';
import { ApplicationStore } from '../../core/stores/application.store';
import { BusinessStore } from '../../core/stores/business.store';
import { AuthService } from '../../core/session/auth.service';
import { requirementsFor } from '../../core/domain/requirements-catalog';
import { agencyHeaderFor, documentTitleFor } from '../../core/domain/generated-document.helpers';
import { fullName } from '../../core/domain/user.model';
import { pesos } from '../../core/domain/assessment.model';
import { formatDate } from '../../core/utils/ids';
import { MUNICIPAL_ENGINEER } from '../../core/domain/lgu-contact';

type WatermarkText = 'DRAFT' | 'FOR REVIEW' | 'NOT VALID AS AN OFFICIAL PERMIT' | null;

interface QrCell {
  x: number;
  y: number;
}

/**
 * The applicant's own real, dynamic generated permit document — replaces
 * the old "Preview Permit Form" link, which just opened the blank official
 * PDF form (kept below as a separate "Blank Reference Form" link, since an
 * applicant may still want the empty form). Every value here comes from
 * this portal's own real stores (AuthService, ApplicationStore,
 * BusinessStore) — never invented. Fields this portal genuinely has no
 * source for (professionals, technical specs, equipment schedules — those
 * are staff-verified data that lives on the Admin Portal side only, and
 * these two apps share no backend) are simply not shown, rather than
 * padded out with a wall of permanent "Pending" placeholders.
 */
@Component({
  selector: 'app-permit-document',
  imports: [RouterLink],
  template: `
    @if (app(); as a) {
      <div class="page" style="max-width:900px;">
        <div class="no-print" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <a [routerLink]="['/applications', a.id]" class="small">&larr; Back to Application</a>
          <button class="btn btn-primary btn-sm" (click)="print()">Print / Download</button>
        </div>

        @if (config(); as cfg) {
          <article class="doc-generated-page">
            @if (watermarkText()) {
              <div class="doc-generated-watermark" aria-hidden="true">{{ watermarkText() }}</div>
            }

            <div class="doc-generated-header">
              <img src="logo.png" alt="" aria-hidden="true" />
              <div class="lines">
                <span>{{ cfg.header.line1 }}</span>
                <span>{{ cfg.header.line2 }}</span>
                @if (cfg.header.line3) {
                  <strong>{{ cfg.header.line3 }}</strong>
                }
                <span class="office-line">{{ cfg.header.officeLine }}</span>
              </div>
            </div>

            <div class="doc-generated-title">
              <h1>{{ cfg.title.title }}</h1>
              @if (cfg.title.subtitle) {
                <p class="subtitle">{{ cfg.title.subtitle }}</p>
              }
            </div>

            <div class="doc-generated-numberblock">
              <div class="num-main">
                <span class="num-label">Permit No.</span>
                <span class="num-value" [class.doc-generated-placeholder]="!permit()">
                  {{ permit()?.permitNumber ?? 'Not yet assigned' }}
                </span>
              </div>
              <div class="num-dates">
                <span>Application No.: <strong>{{ a.applicationNumber }}</strong></span>
                <span>Date Issued: <strong>{{ permit()?.issuedDate ? formatDate(permit()!.issuedDate) : 'Not yet assigned' }}</strong></span>
                <span>Valid Until: <strong>{{ permit()?.expiryDate ? formatDate(permit()!.expiryDate!) : (permit() ? 'No fixed expiry' : 'Not yet assigned') }}</strong></span>
              </div>
            </div>

            <section class="doc-generated-section">
              <!--
                "Owner / Applicant" STAYS, and is not swept into the CITIZEN
                vocabulary ruling. This heading mirrors BOX 1 of the LGU's own
                Unified Application Form for Building Permit, which reads
                "OWNER/APPLICANT" and treats Applicant, Owner and Licensed
                Architect / Civil Engineer as three distinct signing roles
                (BOX 3, BOX 4, BOX 5). "Citizen" names WHO uses this portal;
                "Applicant" names WHICH ROLE they signed a statutory form in,
                and one citizen may be the applicant without being the lot
                owner — see the "Owner's Written Consent (if applicant is not
                the lot owner)" requirement. Renaming this would misstate a
                legal document. Guarded by permit-document.page.spec.ts.
              -->
              <h2>Owner / Applicant</h2>
              <dl class="doc-generated-fields">
                <div>
                  <dt>Owner / Permittee Name</dt>
                  <dd>{{ applicantName() }}</dd>
                </div>
                <div>
                  <dt>Business / Project</dt>
                  <dd>{{ a.businessName || 'Not provided' }}</dd>
                </div>
                <div>
                  <dt>Contact Number</dt>
                  <dd>{{ user()?.mobileNumber ?? 'Not on file' }}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{{ user()?.address ?? 'Not on file' }}</dd>
                </div>
              </dl>
            </section>

            <section class="doc-generated-section">
              <h2>Property</h2>
              <dl class="doc-generated-fields">
                <div>
                  <dt>Barangay</dt>
                  <dd>{{ business()?.barangay ?? 'Not on file' }}</dd>
                </div>
                <div>
                  <dt>City / Municipality</dt>
                  <dd>{{ business()?.city ?? 'Not on file' }}</dd>
                </div>
                <div>
                  <dt>Street / Location</dt>
                  <dd>{{ business()?.street ?? 'Not on file' }}</dd>
                </div>
                <div>
                  <dt>Province</dt>
                  <dd>{{ business()?.province ?? 'Not on file' }}</dd>
                </div>
              </dl>
            </section>

            <section class="doc-generated-section">
              <h2>Project</h2>
              <dl class="doc-generated-fields">
                <div>
                  <dt>Transaction</dt>
                  <dd>{{ a.applicationAction }}</dd>
                </div>
                <div>
                  <dt>Date Applied</dt>
                  <dd>{{ a.dateSubmitted ? formatDate(a.dateSubmitted) : 'Pending' }}</dd>
                </div>
              </dl>
            </section>

            <section class="doc-generated-section">
              <h2>Assessment / Payment</h2>
              @if (assessment(); as asmt) {
                <table class="doc-generated-table">
                  <thead>
                    <tr><th>Fee</th><th>Authority</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    @for (line of asmt.lineItems; track line.code) {
                      <tr>
                        <td>{{ line.name }}</td>
                        <td>{{ line.legalBasisTitle || line.authority }}</td>
                        <td>{{ line.amountCentavos !== null ? pesos(line.amountCentavos) : 'Pending' }}</td>
                      </tr>
                    }
                    <tr>
                      <td colspan="2"><strong>Total Amount Due</strong></td>
                      <td><strong>{{ pesos(asmt.totalCentavos) }}</strong></td>
                    </tr>
                    <tr>
                      <td colspan="2">Outstanding Balance</td>
                      <td>{{ pesos(asmt.balanceCentavos) }}</td>
                    </tr>
                  </tbody>
                </table>
                <p class="doc-generated-note">Order of Payment No.: {{ asmt.opsNumber ?? 'Not yet issued (' + asmt.status + ')' }}</p>
              } @else {
                <p class="doc-generated-note doc-generated-placeholder">No assessment has been issued yet for this application.</p>
              }
            </section>

            <!--
              The office's conditions, in full and verbatim.
              This used to render requirements()?.validityRules — a single
              sentence from the CLIENT's own catalogue, one of which reads "per
              standard LGU clearance practice", an inference we wrote. Under a
              heading reading "Conditions", that told a citizen their
              obligations were a validity note. The real list — cash bond,
              setbacks, notice before excavation — comes from the office via
              GET /applications/{id}/permit.
              Render every item. Do not summarise, and never substitute our own.
            -->
            <section class="doc-generated-section">
              <h2>Conditions</h2>
              @if (conditions().length) {
                <ol class="doc-generated-conditions">
                  @for (c of conditions(); track c) {
                    <li>{{ c }}</li>
                  }
                </ol>
              } @else {
                <p class="doc-generated-placeholder">
                  The Municipality has not supplied the conditions for this permit.
                  <strong>This does not mean there are none</strong> — ask the
                  {{ engineerName }} before relying on this document.
                </p>
              }
            </section>

            <!--
              Validity is a separate fact from the conditions, and is labelled as
              what it is: our reading of the permit's validity period, not the
              office's conditions.
            -->
            @if (requirements()?.validityRules; as validity) {
              <section class="doc-generated-section">
                <h2>Validity</h2>
                <p>{{ validity }}</p>
              </section>
            }

            <section class="doc-generated-section doc-generated-signature">
              <h2 style="text-align:left; border:none;">Approval</h2>
              <div class="sig-pending">Pending Authorized Signature</div>
              <div class="sig-line"></div>
              <div class="sig-name">{{ permit()?.approvingOfficial ?? 'Pending' }}</div>
              <div class="sig-position">{{ permit()?.approvingOffice ?? requirements()?.reviewingOffice ?? 'Pending' }}</div>
            </section>

            <div class="doc-generated-qr">
              @if (qr(); as q) {
                <svg [attr.viewBox]="'0 0 ' + q.count + ' ' + q.count" shape-rendering="crispEdges">
                  <rect width="100%" height="100%" fill="#ffffff" />
                  @for (cell of q.cells; track cell.x + '-' + cell.y) {
                    <rect [attr.x]="cell.x" [attr.y]="cell.y" width="1" height="1" fill="#000000" />
                  }
                </svg>
                <p class="qr-caption">Scan to verify this document at<br />{{ verificationUrl() }}</p>
              } @else {
                <p class="qr-caption qr-unavailable">QR verification not yet available — this permit has not been issued.</p>
              }
            </div>

            <footer class="doc-generated-footer">
              @if (gateCleared()) {
                <p>This is a system-generated document issued by the Municipality of Castilla, Sorsogon.</p>
              } @else {
                <p>
                  This is a system-generated <strong>preview</strong> produced by the eBPCO portal. It is
                  not an issued permit and has no legal effect. Only the Municipality of Castilla,
                  Sorsogon issues permits.
                </p>
              }
              <p>Document Ref. {{ a.id }} &middot; Generated {{ generatedOn }} &middot; Page 1 of 1</p>
            </footer>
          </article>
        }

        <div class="no-print" style="text-align:center; margin-top:16px;">
          <a [href]="'assets/permit-forms/unified-application-form.pdf'" target="_blank" rel="noopener" class="small">
            View the blank reference application form (not your personalized permit)
          </a>
        </div>
      </div>
    } @else {
      <div class="page">
        <div class="card empty-state">
          <p>We couldn't find that application.</p>
          <a routerLink="/applications" class="btn btn-primary">Back to My Applications</a>
        </div>
      </div>
    }
  `,
})
export class PermitDocumentPage {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(ApplicationStore);
  private readonly businessStore = inject(BusinessStore);
  private readonly auth = inject(AuthService);

  protected readonly formatDate = formatDate;
  protected readonly pesos = pesos;
  protected readonly generatedOn = new Date().toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  private id(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  protected readonly app = computed(() => this.store.applicationById(this.id()));
  protected readonly user = computed(() => this.auth.currentUser());
  protected readonly applicantName = computed(() => {
    const u = this.user();
    return u ? fullName(u) : 'Not on file';
  });
  protected readonly business = computed(() => {
    const a = this.app();
    return a ? this.businessStore.businessById(a.businessId) : undefined;
  });
  protected readonly permit = computed(() => this.store.permitFor(this.id()));
  protected readonly assessment = computed(() => this.store.assessmentFor(this.id()));
  protected readonly requirements = computed(() => {
    const a = this.app();
    return a && a.permitType !== 'Business Permit' ? requirementsFor(a.permitType) : null;
  });

  protected readonly config = computed(() => {
    const a = this.app();
    if (!a) return null;
    const reviewingOffice = this.requirements()?.reviewingOffice ?? 'Office of the Building Official (OBO)';
    return {
      header: agencyHeaderFor(reviewingOffice),
      title: documentTitleFor(a.permitType),
    };
  });

  private readonly gate = computed(() => {
    const a = this.app();
    if (!a) return { cleared: false, watermarkText: 'DRAFT' as WatermarkText };

    // An ISSUED permit record is the authoritative "this is genuinely issued"
    // signal — the office only ever creates one after its own review/payment
    // gate already passed, so its mere existence outranks re-deriving those
    // same preconditions here. (Re-checking them independently is also fragile
    // against seed rows whose document checklist wasn't fully backfilled for a
    // later lifecycle stage — trusting the permit record avoids that false
    // negative.)
    //
    // The provenance check is load-bearing and must not be dropped. The mere
    // EXISTENCE of a permit record is not evidence of issuance while the demo
    // lifecycle advance can mint one: 'Demo: Simulate Office Update' on the
    // Application Details screen walks any application to 'Permit Generated',
    // so without this check any signed-in user could print an unwatermarked
    // document carrying the Republic of the Philippines letterhead, the
    // municipal seal and a verification QR. Nothing sets 'issued' until a
    // backend does, so today every document is watermarked — by design.
    const p = this.permit();
    if (p?.provenance === 'issued') return { cleared: true, watermarkText: null as WatermarkText };
    if (p) return { cleared: false, watermarkText: 'NOT VALID AS AN OFFICIAL PERMIT' as WatermarkText };

    if (!this.store.documentsResolvedFor(a.id)) {
      return { cleared: false, watermarkText: 'DRAFT' as WatermarkText };
    }
    const asmt = this.assessment();
    const paymentFinal = !!asmt && asmt.balanceCentavos <= 0 && asmt.status !== 'Voided';
    if (!paymentFinal) return { cleared: false, watermarkText: 'FOR REVIEW' as WatermarkText };

    return { cleared: false, watermarkText: 'NOT VALID AS AN OFFICIAL PERMIT' as WatermarkText };
  });

  protected readonly watermarkText = computed(() => this.gate().watermarkText);
  protected readonly gateCleared = computed(() => this.gate().cleared);

  /** The office's conditions for this permit. Empty until the office supplies them. */
  protected readonly conditions = computed<readonly string[]>(() => this.permit()?.conditions ?? []);
  protected readonly engineerName = MUNICIPAL_ENGINEER.name;

  protected readonly verificationUrl = computed(() => {
    const p = this.permit();
    if (!p || !this.gate().cleared) return null;
    return `${window.location.origin}/verify/${p.permitNumber}`;
  });

  protected readonly qr = computed<{ count: number; cells: QrCell[] } | null>(() => {
    const url = this.verificationUrl();
    if (!url) return null;
    const qr = qrcodegen(0, 'M');
    qr.addData(url);
    qr.make();
    const count = qr.getModuleCount();
    const cells: QrCell[] = [];
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) cells.push({ x: col, y: row });
      }
    }
    return { count, cells };
  });

  protected print(): void {
    window.print();
  }
}
