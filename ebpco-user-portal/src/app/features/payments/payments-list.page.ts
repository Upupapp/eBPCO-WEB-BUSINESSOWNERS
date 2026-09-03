import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { Assessment, pesos } from '../../core/domain/assessment.model';

interface PaymentRow {
  applicationId: string;
  applicationNumber: string;
  assessment: Assessment;
  label: string;
  tone: 'green' | 'amber' | 'red';
  canPay: boolean;
}

@Component({
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
            <thead><tr><th>Application</th><th>Total</th><th>Balance</th><th>Status</th><th></th></tr></thead>
            <tbody>
              @for (row of rows(); track row.applicationId) {
                <tr>
                  <td>{{ row.applicationNumber }}</td>
                  <td>{{ pesos(row.assessment.totalCentavos) }}</td>
                  <td>{{ pesos(row.assessment.balanceCentavos) }}</td>
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
export class PaymentsListPage {
  private readonly store = inject(ApplicationStore);
  protected readonly pesos = pesos;

  /**
   * A row's state, from the assessment AND the payments actually submitted.
   *
   * This used to be derived from `balanceCentavos > 0` alone, which was wrong in
   * the one direction that costs a citizen money. A submitted payment sits at
   * 'Pending Verification' and the balance correctly does NOT move until the
   * Treasurer's cashier verifies it — so a citizen who had just paid was shown
   * "Awaiting Payment" and a "Pay Now" button. The screen invited them to
   * transfer the fee a second time.
   *
   * Balance answers "does the Municipality still expect money". It does not
   * answer "has this citizen already sent it", and only the second question
   * decides whether to offer Pay Now.
   */
  rows(): PaymentRow[] {
    return this.store
      .myApplications()
      .map((a) => {
        const assessment = this.store.assessmentFor(a.id);
        if (!assessment) return null;
        const payments = this.store.paymentsFor(a.id);
        const latest = payments[payments.length - 1];
        const settled = assessment.balanceCentavos <= 0;
        const pending = !settled && latest?.status === 'Pending Verification';
        const rejected = !settled && latest?.status === 'Rejected';
        return {
          applicationId: a.id,
          applicationNumber: a.applicationNumber,
          assessment,
          label: settled
            ? 'Paid'
            : pending
              ? 'Awaiting Verification'
              : rejected
                ? 'Payment Rejected'
                : 'Awaiting Payment',
          tone: settled ? 'green' : rejected ? 'red' : 'amber',
          // The only state that offers to take a payment is one where the
          // citizen has not already made one that is still being looked at.
          // A rejected payment DOES offer it again — that is the one case
          // where paying a second time is what the office is asking for.
          canPay: !settled && !pending,
        } satisfies PaymentRow;
      })
      .filter((r): r is PaymentRow => r !== null);
  }
}
