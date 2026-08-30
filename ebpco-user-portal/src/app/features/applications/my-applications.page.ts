import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { ApplicantStatus, applicantStatusOf } from '../../core/domain/status.model';
import { formatDate } from '../../core/utils/ids';

const FILTERS: (ApplicantStatus | 'All')[] = ['All', 'Draft', 'Submitted', 'Under Review', 'Payment Verification', 'Approved', 'Ready for Release', 'Rejected'];

@Component({
  selector: 'app-my-applications',
  imports: [RouterLink, StatusPillComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>My Applications</h1>
          <div class="subtitle">Track and manage every permit application you've filed.</div>
        </div>
        <a routerLink="/permits" class="btn btn-primary">+ New Application</a>
      </div>

      <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        @for (f of filters; track f) {
          <button class="btn btn-sm" [class.btn-primary]="filter() === f" [class.btn-secondary]="filter() !== f" (click)="filter.set(f)">{{ f }}</button>
        }
      </div>

      @if (filtered().length === 0) {
        <div class="card empty-state">No applications match this filter.</div>
      } @else {
        <div class="card" style="padding:0;">
          <table class="table">
            <thead><tr><th>Application No.</th><th>Permit Type</th><th>Business</th><th>Status</th><th>Submitted</th><th></th></tr></thead>
            <tbody>
              @for (app of filtered(); track app.id) {
                <tr>
                  <td>{{ app.applicationNumber }}</td>
                  <td>{{ app.permitType }}</td>
                  <td>{{ app.businessName }}</td>
                  <td><app-status-pill [label]="applicantStatusOf(app.lifecycleStatus)" /></td>
                  <td>{{ formatDate(app.dateSubmitted) }}</td>
                  <td><a [routerLink]="['/applications', app.id]" class="btn btn-secondary btn-sm">View</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class MyApplicationsPage {
  private readonly store = inject(ApplicationStore);
  protected readonly formatDate = formatDate;
  protected readonly applicantStatusOf = applicantStatusOf;
  protected readonly filters = FILTERS;
  readonly filter = signal<ApplicantStatus | 'All'>('All');

  filtered() {
    const f = this.filter();
    const all = this.store.myApplications();
    if (f === 'All') return all;
    return all.filter((a) => applicantStatusOf(a.lifecycleStatus) === f);
  }
}
