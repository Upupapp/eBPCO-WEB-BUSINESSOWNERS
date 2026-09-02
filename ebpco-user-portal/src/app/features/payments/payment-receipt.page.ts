import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { BusinessStore } from '../../core/stores/business.store';
import { AuthService } from '../../core/session/auth.service';
import { PaymentTransaction } from '../../core/domain/payment.model';
import { requirementsFor } from '../../core/domain/requirements-catalog';
import { agencyHeaderFor } from '../../core/domain/generated-document.helpers';
import { fullName } from '../../core/domain/user.model';
import { pesos } from '../../core/domain/assessment.model';
import { formatDate, formatDateTime } from '../../core/utils/ids';

type WatermarkText = 'REJECTED' | 'PENDING VERIFICATION' | 'NOT VALID AS AN OFFICIAL RECEIPT' | null;

/**
 * The applicant's own generated receipt for a submitted payment — mirrors
 * permit-document.page.ts's approach (real data from this portal's own
 * stores, an honest watermark gate, restrained printable layout), not a
 * redirect back to the application page.
 *
 * Per payment.model.ts, an OR number is entered only by the collecting
 * office's cashier once a payment is actually verified — but the ONLY way
 * `orNumber` ever gets set in this build is advanceForDemo()'s "Simulate
 * Office Update" button, never a real cashier (no backend exists to be
 * one). So an assigned `orNumber` here is exactly as untrustworthy as the
 * generated permit's `provenance: 'demo'` — permit-document.page.ts never
 * clears its own watermark for that case, and this page must not either.
 * `isOfficial` only decides which LABEL/heading fits the record's shape
 * (OR No. vs Reference No.); `watermarkText` alone decides visible trust,
 * and is non-null for every payment this build can produce.
 */
@Component({
  selector: 'app-payment-receipt',
  imports: [RouterLink],
  template: `
    @if (app(); as a) {
      <div class="page" style="max-width:900px;">
        <div class="no-print" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <a [routerLink]="['/payments']" class="small">&larr; Back to Payments</a>
          @if (payment()) {
            <button class="btn btn-primary btn-sm" (click)="print()">Print / Download</button>
          }
        </div>

        @if (payment(); as tx) {
          <article class="doc-generated-page">
            @if (watermarkText()) {
              <div class="doc-generated-watermark" aria-hidden="true">{{ watermarkText() }}</div>
            }

            <div class="doc-generated-header">
              <img src="logo.png" alt="" aria-hidden="true" />
              <div class="lines">
                <span>{{ header().line1 }}</span>
                <span>{{ header().line2 }}</span>
                @if (header().line3) {
                  <strong>{{ header().line3 }}</strong>
                }
                <span class="office-line">{{ header().officeLine }}</span>
              </div>
            </div>

            <div class="doc-generated-title">
              <h1>{{ isOfficial() ? 'Official Receipt' : 'Payment Acknowledgment' }}</h1>
              <p class="subtitle">{{ a.permitType }}</p>
            </div>

            <div class="doc-generated-numberblock">
              <div class="num-main">
                <span class="num-label">{{ isOfficial() ? 'OR No.' : 'Reference No.' }}</span>
                <span class="num-value" [class.doc-generated-placeholder]="!tx.orNumber">
                  {{ tx.orNumber ?? 'Not yet assigned' }}
                </span>
              </div>
              <div class="num-dates">
                <span>Application No.: <strong>{{ a.applicationNumber }}</strong></span>
                <span>Date Submitted: <strong>{{ formatDate(tx.submittedAt) }}</strong></span>
                <span>Date Verified: <strong>{{ tx.orDate ? formatDate(tx.orDate) : 'Pending' }}</strong></span>
              </div>
            </div>

            <section class="doc-generated-section">
              <h2>Payor</h2>
              <dl class="doc-generated-fields">
                <div>
                  <dt>Name</dt>
                  <dd>{{ applicantName() }}</dd>
                </div>
                <div>
                  <dt>Business / Project</dt>
                  <dd>{{ a.businessName || 'Not provided' }}</dd>
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
              <h2>Payment Details</h2>
              <dl class="doc-generated-fields">
                <div>
                  <dt>Collecting Agency</dt>
                  <dd>{{ tx.agency }}</dd>
                </div>
                <div>
                  <dt>Payment Method</dt>
                  <dd>{{ tx.method }}</dd>
                </div>
                <div>
                  <dt>Reference / Proof</dt>
                  <dd>{{ tx.transactionReference }}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{{ tx.status }}</dd>
                </div>
              </dl>
            </section>

            <section class="doc-generated-section">
              <h2>Amount</h2>
              @if (assessment(); as asmt) {
                <table class="doc-generated-table">
                  <thead>
                    <tr><th>Fee</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    @for (line of asmt.lineItems; track line.code) {
                      <tr>
                        <td>{{ line.name }}</td>
                        <td>{{ line.amountCentavos !== null ? pesos(line.amountCentavos) : 'Pending' }}</td>
                      </tr>
                    }
                    <tr>
                      <td><strong>Amount Paid (this transaction)</strong></td>
                      <td><strong>{{ pesos(tx.amountCentavos) }}</strong></td>
                    </tr>
                    <tr>
                      <td>Remaining Balance</td>
                      <td>{{ pesos(asmt.balanceCentavos) }}</td>
                    </tr>
                  </tbody>
                </table>
              } @else {
                <p class="doc-generated-note">Amount Paid: {{ pesos(tx.amountCentavos) }}</p>
              }
            </section>

            <section class="doc-generated-section doc-generated-signature">
              <h2 style="text-align:left; border:none;">Received By</h2>
              @if (gateCleared()) {
                <div class="sig-line"></div>
                <div class="sig-name">Municipal Treasurer's Office Cashier</div>
                <div class="sig-position">{{ header().officeLine }}</div>
              } @else {
                <div class="sig-pending">Pending Cashier Verification</div>
                <div class="sig-line"></div>
                <div class="sig-name">Municipal Treasurer's Office Cashier</div>
              }
            </section>

            <footer class="doc-generated-footer">
              @if (gateCleared()) {
                <p>This is a system-generated Official Receipt issued by the Municipality of Castilla, Sorsogon.</p>
              } @else {
                <p>
                  This is a system-generated <strong>preview</strong> produced by the eBPCO portal. It is not an
                  issued Official Receipt and has no legal effect. Only the Municipality of Castilla's Treasurer's
                  Office issues an Official Receipt, upon verifying a payment it actually received.
                </p>
              }
              <p>Document Ref. {{ tx.id }} &middot; Generated {{ generatedOn }} &middot; Page 1 of 1</p>
            </footer>
          </article>
        } @else {
          <div class="card empty-state">No payment has been submitted for this application yet.</div>
        }
      </div>
    } @else {
      <div class="page">
        <div class="card empty-state">
          <p>We couldn't find that application.</p>
          <a routerLink="/payments" class="btn btn-primary">Back to Payments</a>
        </div>
      </div>
    }
  `,
})
export class PaymentReceiptPage {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(ApplicationStore);
  private readonly businessStore = inject(BusinessStore);
  private readonly auth = inject(AuthService);

  protected readonly formatDate = formatDate;
  protected readonly formatDateTime = formatDateTime;
  protected readonly pesos = pesos;
  protected readonly generatedOn = new Date().toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  private id(): string {
    return this.route.snapshot.paramMap.get('applicationId')!;
  }

  protected readonly app = computed(() => this.store.applicationById(this.id()));
  protected readonly assessment = computed(() => this.store.assessmentFor(this.id()));
  protected readonly applicantName = computed(() => {
    const u = this.auth.currentUser();
    return u ? fullName(u) : 'Not on file';
  });
  protected readonly business = computed(() => {
    const a = this.app();
    return a ? this.businessStore.businessById(a.businessId) : undefined;
  });

  /** The most recent payment transaction on file — this demo records one payment per assessment, so the latest is the one this receipt describes. */
  protected readonly payment = computed<PaymentTransaction | undefined>(() => {
    const payments = this.store.paymentsFor(this.id());
    return payments[payments.length - 1];
  });

  protected readonly isOfficial = computed(() => !!this.payment()?.orNumber);

  protected readonly header = computed(() => {
    const a = this.app();
    const reviewingOffice =
      a && a.permitType !== 'Business Permit' ? requirementsFor(a.permitType).reviewingOffice : 'Office of the Building Official (OBO)';
    return agencyHeaderFor(reviewingOffice);
  });

  protected readonly watermarkText = computed<WatermarkText>(() => {
    const tx = this.payment();
    // No payment is not a cleared receipt. This returned null — the same value
    // that means "genuine, no watermark" — so `gateCleared` was true whenever
    // the data was ABSENT. Dead today, because the document renders inside
    // @if (payment(); as tx), but it is the same latent fail-open the
    // verification page carried: one refactor from a receipt with no payment
    // behind it claiming to be a system-generated Official Receipt issued by
    // the Municipality.
    //
    // Cleared must be EARNED, never inherited from missing data.
    if (!tx) return 'NOT VALID AS AN OFFICIAL RECEIPT';
    if (tx.status === 'Rejected') return 'REJECTED';
    if (!tx.orNumber) return 'PENDING VERIFICATION';
    // An OR number here was assigned by the demo "Simulate Office Update"
    // button, never a real cashier — no less demo than the generated
    // permit's provenance: 'demo', which permit-document.page.ts always
    // watermarks. This must too.
    return 'NOT VALID AS AN OFFICIAL RECEIPT';
  });

  /**
   * Clearing requires a positive answer, not the absence of a negative one.
   * Today nothing can satisfy it: an OR number is only ever assigned by the
   * demo advance, never a cashier, so `isOfficial()` is never trustworthy — the
   * same reasoning as PermitProvenance on the generated permit.
   */
  protected readonly gateCleared = computed(() => this.watermarkText() === null && !!this.payment());

  protected print(): void {
    window.print();
  }
}
