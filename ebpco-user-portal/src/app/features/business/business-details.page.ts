import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BusinessStore } from '../../core/stores/business.store';
import { ApplicationStore } from '../../core/stores/application.store';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { applicantStatusOf } from '../../core/domain/status.model';
import { formatDate } from '../../core/utils/ids';

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
          <a [routerLink]="['/permits']" [queryParams]="{ businessId: b.id }" class="btn btn-primary">Apply for Permit</a>
        </div>

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
                    <td><a [routerLink]="['/applications', app.id]">{{ app.applicationNumber }}</a></td>
                    <td>{{ app.permitType }}</td>
                    <td><app-status-pill [label]="applicantStatusOf(app.lifecycleStatus)" /></td>
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
          <p>We couldn't find that business. This can happen after a page refresh, since this demo build keeps data in memory only (no backend yet — see the project README).</p>
          <a routerLink="/businesses" class="btn btn-primary">Back to My Businesses</a>
        </div>
      </div>
    }
  `,
})
export class BusinessDetailsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly businessStore = inject(BusinessStore);
  private readonly applicationStore = inject(ApplicationStore);

  protected readonly formatDate = formatDate;
  protected readonly applicantStatusOf = applicantStatusOf;

  business() {
    const id = this.route.snapshot.paramMap.get('id')!;
    return this.businessStore.businessById(id);
  }

  appsForBusiness() {
    const id = this.route.snapshot.paramMap.get('id')!;
    return this.applicationStore.myApplications().filter((a) => a.businessId === id);
  }
}
