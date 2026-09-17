import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { BusinessStore } from '../../core/stores/business.store';
import { AuthService } from '../../core/session/auth.service';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { PaymentHistoryEntry, ApplicationSummary } from '../../core/api/citizen-api.models';
import { PaymentTransaction } from '../../core/domain/payment.model';
import { requirementsFor } from '../../core/domain/requirements-catalog';
import { agencyHeaderFor } from '../../core/domain/generated-document.helpers';
import { fullName } from '../../core/domain/user.model';
import { pesos } from '../../core/domain/assessment.model';
import { formatDate, formatDateTime } from '../../core/utils/ids';

type WatermarkText = 'SAMPLE — NOT AN OFFICIAL RECEIPT';

/** The fields the template actually reads off a payment, real or demo alike — not the full `PaymentTransaction`, which the real path has no honest way to fill in completely (no `assessmentId`, no `proofFileName` on the wire). */
interface ReceiptPayment {
  id: string;
  amountCentavos: number;
  method: string;
  agency: string;
  transactionReference: string;
  status: string;
  submittedAt: string;
  orNumber: string | null;
  orDate: string | null;
  /** Set only when this real submission was rejected. Always null on the demo path — the old mock had no durable rejection record either. */
  rejectionReason: string | null;
}

/** What the "Amount" section needs — a subset of the old local `Assessment`, real or demo. */
interface ReceiptAmount {
  lineItems: ReadonlyArray<{ code: string; name: string; amountCentavos: number | null }>;
  balanceCentavos: number;
}

const FEE_LINES: ReadonlyArray<{ code: keyof NonNullable<ApplicationSummary['payment']['orderOfPayment']>['fees']; name: string }> = [
  { code: 'filing', name: 'Filing Fee' },
  { code: 'processing', name: 'Processing Fee' },
  { code: 'architectural', name: 'Architectural Fee' },
  { code: 'structural', name: 'Structural Fee' },
  { code: 'electrical', name: 'Electrical Fee' },
  { code: 'others', name: 'Other Fees' },
];

/**
 * The applicant's own generated receipt for a submitted payment — mirrors
 * permit-document.page.ts's approach (real data, restrained printable
 * layout), not a redirect back to the application page.
 *
 * The watermark is permanent, not a gate: an electronically reprinted
 * receipt is never a substitute for the stamped paper original no matter
 * how thoroughly the payment behind it has been verified, matching the
 * Admin Portal's own always-on `receiptWatermarkText` (document-preview.ts).
 * `gateCleared` is the fact that USED to double as "clear the watermark" —
 * a genuinely verified, non-rejected payment with a real OR number — kept
 * as its own check because the signature block and the footer's "this is
 * a system-generated Official Receipt" line still need to know that, even
 * though the watermark itself no longer does.
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
            <div class="doc-generated-watermark" aria-hidden="true">{{ watermarkText }}</div>

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
                @if (tx.rejectionReason) {
                  <div>
                    <dt>Reason</dt>
                    <dd>{{ tx.rejectionReason }}</dd>
                  </div>
                }
              </dl>
            </section>

            <section class="doc-generated-section">
              <h2>Amount</h2>
              @if (amount(); as amt) {
                <table class="doc-generated-table">
                  <thead>
                    <tr><th>Fee</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    @for (line of amt.lineItems; track line.code) {
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
                      <td>{{ pesos(amt.balanceCentavos) }}</td>
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
  private readonly api = inject(CitizenApiClient);

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

  /**
   * `realChecked` separates "confirmed — nothing real here" from "the
   * request hasn't come back yet", same reasoning as `payment-flow.page.ts`'s
   * `realChecked` for the Order of Payment. Both real calls are fired
   * together; either can legitimately 404 on its own (an application with no
   * Order of Payment yet has no payments either) without the other failing.
   */
  private readonly realChecked = signal(false);
  private readonly realOrderOfPayment = signal<ApplicationSummary['payment']['orderOfPayment'] | null>(null);
  private readonly realPayments = signal<PaymentHistoryEntry[]>([]);

  constructor() {
    if (this.api.configured) {
      this.api.getApplication(this.id()).subscribe({
        next: (summary) => {
          this.realOrderOfPayment.set(summary.payment.orderOfPayment ?? null);
          this.realChecked.set(true);
        },
        error: () => { this.realChecked.set(true); },
      });
      this.api.getPayments(this.id()).subscribe({
        next: (payments) => this.realPayments.set(payments),
        // A local demo application id 404s against the real backend, or a
        // real one simply has none submitted yet — both leave this empty,
        // which is what "no payment yet" already means below.
        error: () => {},
      });
    }
  }

  private id(): string {
    return this.route.snapshot.paramMap.get('applicationId')!;
  }

  protected readonly app = computed(() => this.store.applicationById(this.id()));

  protected readonly amount = computed<ReceiptAmount | undefined>(() => {
    if (this.api.configured) {
      if (!this.realChecked()) return undefined;
      const real = this.realOrderOfPayment();
      if (!real) return undefined;
      return {
        lineItems: FEE_LINES.map((line) => ({
          code: line.code, name: line.name, amountCentavos: real.fees[line.code],
        })),
        // Pay-in-full, not instalments — the real backend has no partial-payment
        // concept (PaymentService.checkSettles is a binary "does this amount
        // clear the Order", never a running balance). Paid means zero owed;
        // anything else means the whole total is still owed.
        balanceCentavos: this.payment()?.status === 'Paid' ? 0 : real.totalCentavos,
      };
    }
    const a = this.store.assessmentFor(this.id());
    return a ? { lineItems: a.lineItems, balanceCentavos: a.balanceCentavos } : undefined;
  });

  protected readonly applicantName = computed(() => {
    const u = this.auth.currentUser();
    return u ? fullName(u) : 'Not on file';
  });
  protected readonly business = computed(() => {
    const a = this.app();
    return a ? this.businessStore.businessById(a.businessId) : undefined;
  });

  /**
   * The most recent payment on file. Real data prefers the latest real
   * submission (each is its own row server-side, oldest first — the last one
   * is the current state of the world); the demo fallback keeps its old
   * "one payment per assessment" assumption.
   */
  protected readonly payment = computed<ReceiptPayment | undefined>(() => {
    if (this.api.configured) {
      if (!this.realChecked()) return undefined;
      const payments = this.realPayments();
      const latest = payments[payments.length - 1];
      if (!latest) return undefined;
      return {
        id: latest.id,
        amountCentavos: latest.amountCentavos,
        method: latest.method,
        agency: 'OBO/LGU',
        transactionReference: latest.referenceNumber,
        status: latest.status,
        submittedAt: latest.submittedAt,
        orNumber: latest.officialReceiptNumber,
        orDate: latest.verifiedAt,
        rejectionReason: latest.rejectionReason,
      };
    }
    const demo = this.demoPayment();
    return demo && {
      id: demo.id,
      amountCentavos: demo.amountCentavos,
      method: demo.method,
      agency: demo.agency,
      transactionReference: demo.transactionReference,
      status: demo.status,
      submittedAt: demo.submittedAt,
      orNumber: demo.orNumber,
      orDate: demo.orDate,
      rejectionReason: demo.rejectionReason,
    };
  });

  /** This demo records one payment per assessment, so the latest is the one this receipt describes. */
  private demoPayment(): PaymentTransaction | undefined {
    const payments = this.store.paymentsFor(this.id());
    return payments[payments.length - 1];
  }

  protected readonly isOfficial = computed(() => !!this.payment()?.orNumber);

  protected readonly header = computed(() => {
    const a = this.app();
    const reviewingOffice =
      a && a.permitType !== 'Business Permit' ? requirementsFor(a.permitType).reviewingOffice : 'Office of the Building Official (OBO)';
    return agencyHeaderFor(reviewingOffice);
  });

  protected readonly watermarkText: WatermarkText = 'SAMPLE — NOT AN OFFICIAL RECEIPT';

  /**
   * Earned the same way `watermarkText` used to gate itself: a genuinely
   * verified payment has a real OR number AND a real 'Paid' status, both
   * set only by `POST /staff/payments/:id/verify` — never true on the demo
   * path, where an OR number is assigned only by "Simulate Office Update",
   * never a real cashier.
   */
  protected readonly gateCleared = computed(() => {
    const tx = this.payment();
    return this.api.configured && !!tx && tx.status === 'Paid' && !!tx.orNumber && !tx.rejectionReason;
  });

  protected print(): void {
    window.print();
  }
}
