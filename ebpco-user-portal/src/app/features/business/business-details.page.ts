import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BusinessStore } from '../../core/stores/business.store';
import { ApplicationStore } from '../../core/stores/application.store';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { applicantStatusLabel, applicantStatusOf } from '../../core/domain/status.model';
import { formatDate } from '../../core/utils/ids';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-business-details',
  imports: [RouterLink, StatusPillComponent],
  template: `
    @if (business(); as b) {
      <div class="page">
        <div class="page-header">
          <div>
            <h1>{{ b.name }}</h1>
            <div class="subtitle">{{ b.category }} · Reg. No. {{ b.registrationNumber }} · Registered {{ formatDate(b.dateRegistered) }}</div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <a [routerLink]="['/businesses', b.id, 'edit']" class="btn btn-secondary">Edit Business</a>
            @if (b.status === 'Active') {
              <button
                class="btn btn-secondary"
                type="button"
                [disabled]="changingStatus()"
                (click)="deactivate(b.id)"
              >{{ changingStatus() ? 'Deactivating…' : 'Deactivate' }}</button>
            } @else {
              <button
                class="btn btn-secondary"
                type="button"
                [disabled]="changingStatus()"
                (click)="reactivate(b.id)"
              >{{ changingStatus() ? 'Reactivating…' : 'Reactivate' }}</button>
            }
            @if (b.status === 'Active') {
              <a [routerLink]="['/permits']" [queryParams]="{ businessId: b.id }" class="btn btn-primary">Apply for Permit</a>
            } @else {
              <button type="button" class="btn btn-primary" (click)="applyForInactive()">Apply for Permit</button>
            }
          </div>
        </div>

        @if (statusError(); as err) {
          <div class="card" style="background:var(--danger-50, #fff5f5); border:1px solid var(--danger-200, #f5c2c7); margin-bottom:16px;">
            {{ err }}
          </div>
        }

        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">Business Address</div>
          <p>{{ b.street }}, Barangay {{ b.barangay }}, {{ b.city }}, {{ b.province }}</p>
          <span class="badge" [class]="b.status === 'Active' ? 'badge-green' : 'badge-gray'">{{ b.status }}</span>
        </div>

        <div class="card">
          <div class="card-title">Applications for this Business</div>
          @if (appsForBusiness().length === 0) {
            <div class="empty-state">No applications filed yet for this business.</div>
          } @else {
            <table class="table">
              <thead><tr><th>Application No.</th><th>Permit Type</th><th>Status</th><th>Submitted</th></tr></thead>
              <tbody>
                @for (app of appsForBusiness(); track app.id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/applications', app.id]" class="table-cell-clip" [title]="app.applicationNumber">{{ app.applicationNumber }}</a>
                    </td>
                    <td><span class="table-cell-clip" [title]="app.permitType">{{ app.permitType }}</span></td>
                    <td><app-status-pill [label]="applicantStatusLabel(app.lifecycleStatus)" /></td>
                    <td>{{ formatDate(app.dateSubmitted) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>
    } @else {
      <div class="page">
        <div class="card empty-state">
          <p>We couldn't find that business. It may not be registered under your account, or the link may be out of date.</p>
          <a routerLink="/businesses" class="btn btn-primary">Back to My Businesses</a>
        </div>
      </div>
    }
  `,
})
export class BusinessDetailsPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly businessStore = inject(BusinessStore);
  private readonly applicationStore = inject(ApplicationStore);
  private readonly toast = inject(ToastService);

  protected readonly formatDate = formatDate;
  protected readonly applicantStatusOf = applicantStatusOf;
  protected readonly applicantStatusLabel = applicantStatusLabel;

  protected readonly changingStatus = signal(false);
  protected readonly statusError = signal<string | null>(null);

  business() {
    const id = this.route.snapshot.paramMap.get('id')!;
    return this.businessStore.businessById(id);
  }

  appsForBusiness() {
    const id = this.route.snapshot.paramMap.get('id')!;
    return this.applicationStore.myApplications().filter((a) => a.businessId === id);
  }

  /** Kept as a real button rather than hidden outright, so an inactive business still explains itself rather than the option just vanishing. */
  protected applyForInactive(): void {
    this.toast.error('This business is inactive. Reactivate it before applying for a permit.');
  }

  protected async deactivate(id: string): Promise<void> {
    this.statusError.set(null);
    if (!this.businessStore.usingReal()) {
      try {
        this.businessStore.setStatus(id, 'Inactive');
        this.toast.success('Business deactivated.');
      } catch (e) {
        this.statusError.set(e instanceof Error ? e.message : 'That change could not be saved.');
      }
      return;
    }
    this.changingStatus.set(true);
    const result = await this.businessStore.deactivateReal(id);
    this.changingStatus.set(false);
    if (!result.ok) {
      this.statusError.set(result.error);
      return;
    }
    this.toast.success('Business deactivated. Reactivate it any time from this page.');
  }

  protected async reactivate(id: string): Promise<void> {
    this.statusError.set(null);
    if (!this.businessStore.usingReal()) {
      try {
        this.businessStore.setStatus(id, 'Active');
        this.toast.success('Business reactivated.');
      } catch (e) {
        this.statusError.set(e instanceof Error ? e.message : 'That change could not be saved.');
      }
      return;
    }
    this.changingStatus.set(true);
    const result = await this.businessStore.reactivateReal(id);
    this.changingStatus.set(false);
    if (!result.ok) {
      this.statusError.set(result.error);
      return;
    }
    this.toast.success('Business reactivated.');
  }
}
