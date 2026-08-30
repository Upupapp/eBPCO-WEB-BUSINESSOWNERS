import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { Assessment, pesos } from '../../core/domain/assessment.model';

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
                    <span class="badge" [class]="row.assessment.balanceCentavos > 0 ? 'badge-amber' : 'badge-green'">
                      {{ row.assessment.balanceCentavos > 0 ? 'Awaiting Payment' : 'Paid' }}
                    </span>
                  </td>
                  <td>
                    @if (row.assessment.balanceCentavos > 0) {
                      <a [routerLink]="['/payments', row.applicationId]" class="btn btn-primary btn-sm">Pay Now</a>
                    } @else {
                      <a [routerLink]="['/applications', row.applicationId]" class="btn btn-secondary btn-sm">View Receipt</a>
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

  rows(): { applicationId: string; applicationNumber: string; assessment: Assessment }[] {
    return this.store
      .myApplications()
      .map((a) => ({ applicationId: a.id, applicationNumber: a.applicationNumber, assessment: this.store.assessmentFor(a.id) }))
      .filter((r): r is { applicationId: string; applicationNumber: string; assessment: Assessment } => !!r.assessment);
  }
}
