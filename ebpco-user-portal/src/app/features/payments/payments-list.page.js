import { __decorate } from "tslib";
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { pesos } from '../../core/domain/assessment.model';
/**
 * Real data, unlike the demo store this page used to read (`assessmentFor`/
 * `paymentsFor`, populated only by local seed data — a real payment
 * submission never appeared here at all). `ApplicationStore.myApplications()`
 * is already real once the backend is configured, and `paymentStatus`/
 * `assessedAmountCentavos` on each row are ALREADY faithful to the server —
 * see `fromServerSummary()`'s own doc comment in `application.store.ts` — so
 * this needed no new API call, only reading fields that were already there.
 */
const TONE = {
    'Paid': 'green',
    'Not Yet Available': 'amber',
    'Pending Verification': 'amber',
    'Partially Paid': 'amber',
    'Overdue': 'red',
};
let PaymentsListPage = class PaymentsListPage {
    store = inject(ApplicationStore);
    pesos = pesos;
    rows() {
        return this.store
            .myApplications()
            .filter((a) => a.assessedAmountCentavos !== null)
            .map((a) => ({
            applicationId: a.id,
            applicationNumber: a.applicationNumber,
            totalCentavos: a.assessedAmountCentavos,
            label: a.paymentStatus,
            tone: TONE[a.paymentStatus],
            // The only state that offers to take a payment is one the Municipality
            // is still owed for. 'Pending Verification' does not offer it again —
            // a citizen who has already sent proof must not be invited to send it
            // twice while an officer is still looking at the first one.
            canPay: a.paymentStatus === 'Not Yet Available' || a.paymentStatus === 'Overdue',
        }));
    }
};
PaymentsListPage = __decorate([
    Component({
        selector: 'app-payments-list',
        imports: [RouterLink],
        template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Payments</h1>
          <div class="subtitle">Applications with an issued assessment or payment history.</div>
        </div>
      </div>

      @if (rows().length === 0) {
        <div class="card empty-state">No assessments issued yet. Once your application is evaluated, its Order of Payment will appear here.</div>
      } @else {
        <div class="card" style="padding:0;">
          <table class="table">
            <thead><tr><th>Application</th><th>Total</th><th>Status</th><th></th></tr></thead>
            <tbody>
              @for (row of rows(); track row.applicationId) {
                <tr>
                  <td>{{ row.applicationNumber }}</td>
                  <td>{{ pesos(row.totalCentavos) }}</td>
                  <td>
                    <span class="badge" [class]="'badge-' + row.tone">{{ row.label }}</span>
                  </td>
                  <td>
                    @if (row.canPay) {
                      <a [routerLink]="['/payments', row.applicationId]" class="btn btn-primary btn-sm">Pay Now</a>
                    } @else {
                      <a [routerLink]="['/payments', row.applicationId, 'receipt']" class="btn btn-secondary btn-sm">View Receipt</a>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
    })
], PaymentsListPage);
export { PaymentsListPage };
