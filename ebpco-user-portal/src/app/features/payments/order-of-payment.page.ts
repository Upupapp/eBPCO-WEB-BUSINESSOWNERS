import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { BusinessStore } from '../../core/stores/business.store';
import { AuthService } from '../../core/session/auth.service';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { ApplicationSummary } from '../../core/api/citizen-api.models';
import { requirementsFor } from '../../core/domain/requirements-catalog';
import { agencyHeaderFor } from '../../core/domain/generated-document.helpers';
import { fullName } from '../../core/domain/user.model';
import { pesos } from '../../core/domain/assessment.model';
import { formatDate } from '../../core/utils/ids';
import { BackLinkComponent } from '../../shared/ui/back-link.component';

type Order = NonNullable<ApplicationSummary['payment']['orderOfPayment']>;

const FEE_LINES: ReadonlyArray<{ code: keyof Order['fees']; name: string }> = [
  { code: 'filing', name: 'Filing Fee' },
  { code: 'processing', name: 'Processing Fee' },
  { code: 'architectural', name: 'Architectural Fee' },
  { code: 'structural', name: 'Structural Fee' },
  { code: 'electrical', name: 'Electrical Fee' },
  { code: 'others', name: 'Other Fees' },
];

/**
 * The applicant's printable copy of their Order of Payment (QA finding TC-26,
 * 2026-10-03): Onsite Payment says "bring a copy of your Order of Payment",
 * and nothing offered one to print. Built from the Order the office issued
 * (`GET /applications/:id`'s `payment.orderOfPayment`): its number, issue and
 * due dates, and only the fees that apply.
 */
@Component({
  selector: 'app-order-of-payment',
  imports: [RouterLink, BackLinkComponent],
  template: `
    @if (app(); as a) {
      <div class="page" style="max-width:900px;">
        <div class="no-print" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <app-back-link fallback="/payments" fallbackLabel="Payments" />
          @if (order()) {
            <button class="btn btn-primary btn-sm" (click)="print()">Print / Download</button>
          }
        </div>

        @if (order(); as o) {
          <article class="doc-generated-page">
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
              <h1>Order of Payment</h1>
              <p class="subtitle">{{ a.permitType }}</p>
            </div>

            <div class="doc-generated-numberblock">
              <div class="num-main">
                <span class="num-label">Order No.</span>
                <span class="num-value">{{ o.number }}</span>
              </div>
              <div class="num-dates">
                <span>Application No.: <strong>{{ a.applicationNumber }}</strong></span>
                <span>Date Issued: <strong>{{ formatDate(o.assessedAt) }}</strong></span>
                <span>Pay On or Before: <strong>{{ o.dueDate ? formatDate(o.dueDate) : 'Not set by the office' }}</strong></span>
              </div>
            </div>

            <section class="doc-generated-section">
              <h2>Payor</h2>
              <dl class="doc-generated-fields">
                <div><dt>Name</dt><dd>{{ applicantName() }}</dd></div>
                <div><dt>Business / Project</dt><dd>{{ a.businessName || 'Not provided' }}</dd></div>
                <div><dt>Transaction</dt><dd>{{ a.applicationAction }}</dd></div>
                <div>
                  <dt>Property</dt>
                  <dd>{{ business() ? (business()!.street + ', ' + business()!.barangay + ', ' + business()!.city) : 'Not on file' }}</dd>
                </div>
              </dl>
            </section>

            <section class="doc-generated-section">
              <h2>Fees</h2>
              <table class="doc-generated-table">
                <thead><tr><th>Fee</th><th>Amount</th></tr></thead>
                <tbody>
                  @for (line of lines(); track line.code) {
                    <tr><td>{{ line.name }}</td><td>{{ pesos(line.amountCentavos) }}</td></tr>
                  }
                  <tr><td><strong>Total Amount Due</strong></td><td><strong>{{ pesos(o.totalCentavos) }}</strong></td></tr>
                </tbody>
              </table>
              <p class="doc-generated-note">
                Fee schedule {{ o.feeScheduleVersion }}. Pay the full amount at the Municipal Treasurer's Office and
                keep the Official Receipt it gives you.
              </p>
            </section>

            <footer class="doc-generated-footer">
              <p>
                A copy of the Order of Payment issued through eBPCO by the Municipality of Castilla, Sorsogon.
                Present it at the Municipal Treasurer's Office when you pay.
              </p>
              <p>Generated {{ generatedOn }} &middot; Page 1 of 1</p>
            </footer>
          </article>
        } @else if (checked()) {
          <div class="card empty-state">No Order of Payment has been issued for this application yet.</div>
        } @else {
          <div class="card empty-state">Loading the Order of Payment…</div>
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
export class OrderOfPaymentPage {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(ApplicationStore);
  private readonly businessStore = inject(BusinessStore);
  private readonly auth = inject(AuthService);
  private readonly api = inject(CitizenApiClient);

  protected readonly formatDate = formatDate;
  protected readonly pesos = pesos;
  protected readonly generatedOn = new Date().toLocaleString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  private readonly fetched = signal<Order | null>(null);
  protected readonly checked = signal(false);

  constructor() {
    if (this.api.configured) {
      this.api.getApplication(this.id()).subscribe({
        next: (summary) => { this.fetched.set(summary.payment.orderOfPayment ?? null); this.checked.set(true); },
        error: () => this.checked.set(true),
      });
    } else {
      this.checked.set(true);
    }
  }

  private id(): string {
    return this.route.snapshot.paramMap.get('applicationId')!;
  }

  protected readonly app = computed(() => this.store.applicationById(this.id()));
  protected readonly order = computed<Order | null>(() => this.fetched() ?? this.store.orderOfPaymentFor(this.id()) ?? null);

  /** Only the fees that apply: a ₱0.00 line beside the real ones read as a charge (QA TC-05). */
  protected readonly lines = computed(() => {
    const o = this.order();
    if (!o) return [];
    return FEE_LINES
      .map((line) => ({ code: line.code, name: line.name, amountCentavos: o.fees[line.code] }))
      .filter((line) => line.amountCentavos > 0);
  });

  protected readonly applicantName = computed(() => {
    const u = this.auth.currentUser();
    return u ? fullName(u) : 'Not on file';
  });
  protected readonly business = computed(() => {
    const a = this.app();
    return a ? this.businessStore.businessById(a.businessId) : undefined;
  });

  protected readonly header = computed(() => {
    const a = this.app();
    const reviewingOffice =
      a && a.permitType !== 'Business Permit' ? requirementsFor(a.permitType).reviewingOffice : 'Office of the Building Official (OBO)';
    return agencyHeaderFor(reviewingOffice);
  });

  protected print(): void {
    window.print();
  }
}
