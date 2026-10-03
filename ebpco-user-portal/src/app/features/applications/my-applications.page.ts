import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { ApplicationLifecycleStatus, applicantStatusLabel, applicantStatusOf } from '../../core/domain/status.model';
import { ApplicationRecord } from '../../core/domain/application.model';
import { formatDate } from '../../core/utils/ids';

interface ApplicationFilter {
  label: string;
  /** null: every application. */
  statuses: readonly ApplicationLifecycleStatus[] | null;
  /** Shown only while some application is in it. */
  onlyWhenUsed?: boolean;
}

/**
 * One tab for every status a citizen can see on a row (QA TC-35, 2026-10-03:
 * Completed, Cancelled and Revision Required had none, so a returned,
 * withdrawn or finished application could not be listed on its own). Each
 * tab names the words on the pills it lists.
 */
const FILTERS: readonly ApplicationFilter[] = [
  { label: 'All', statuses: null },
  { label: 'Draft', statuses: ['Draft'] },
  { label: 'Submitted', statuses: ['Submitted', 'Received'] },
  { label: 'Under Review', statuses: ['Document Verification', 'Under Evaluation'] },
  { label: 'Revision Required', statuses: ['Revision Required'] },
  { label: 'Payment', statuses: ['Assessed', 'Payment Submitted', 'Payment Under Verification', 'Payment Verified', 'For Approval'] },
  { label: 'Approved', statuses: ['Approved', 'Permit Generated'] },
  { label: 'Ready for Release', statuses: ['Ready for Release'] },
  { label: 'Released', statuses: ['Released'] },
  { label: 'Completed', statuses: ['Completed'] },
  { label: 'Rejected', statuses: ['Rejected'] },
  { label: 'Cancelled', statuses: ['Cancelled'] },
  { label: 'Expired', statuses: ['Expired'], onlyWhenUsed: true },
];

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
        @for (f of visibleFilters(); track f.label) {
          <button class="btn btn-sm" [class.btn-primary]="filter() === f.label" [class.btn-secondary]="filter() !== f.label"
                  [attr.aria-pressed]="filter() === f.label" (click)="filter.set(f.label)">
            {{ f.label }} <span style="opacity:.75;">({{ countIn(f) }})</span>
          </button>
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
                  <td><app-status-pill [label]="applicantStatusLabel(app.lifecycleStatus)" /></td>
                  <td>
                    @if (app.lifecycleStatus === 'Draft') {
                      Started {{ formatDate(app.updatedAt) }}
                    } @else {
                      {{ formatDate(app.dateSubmitted) }}
                    }
                  </td>
                  <td>
                    @if (app.lifecycleStatus === 'Draft') {
                      <a [routerLink]="['/permits/apply']" [queryParams]="{ draft: app.id }" class="btn btn-secondary btn-sm">Continue</a>
                    } @else {
                      <a [routerLink]="['/applications', app.id]" class="btn btn-secondary btn-sm">View</a>
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
export class MyApplicationsPage {
  private readonly store = inject(ApplicationStore);
  protected readonly formatDate = formatDate;
  protected readonly applicantStatusOf = applicantStatusOf;
  protected readonly applicantStatusLabel = applicantStatusLabel;
  readonly filter = signal<string>('All');

  protected visibleFilters(): readonly ApplicationFilter[] {
    return FILTERS.filter((f) => !f.onlyWhenUsed || this.countIn(f) > 0 || this.filter() === f.label);
  }

  protected countIn(f: ApplicationFilter): number {
    return this.store.myApplications().filter((a) => this.inFilter(a, f)).length;
  }

  filtered(): ApplicationRecord[] {
    const f = FILTERS.find((candidate) => candidate.label === this.filter()) ?? FILTERS[0];
    return this.store.myApplications().filter((a) => this.inFilter(a, f));
  }

  private inFilter(a: ApplicationRecord, f: ApplicationFilter): boolean {
    return f.statuses === null || f.statuses.includes(a.lifecycleStatus);
  }
}
