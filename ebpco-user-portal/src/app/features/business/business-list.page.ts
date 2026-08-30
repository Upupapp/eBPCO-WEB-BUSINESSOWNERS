import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BusinessStore } from '../../core/stores/business.store';
import { formatDate } from '../../core/utils/ids';

@Component({
  selector: 'app-business-list',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>My Businesses</h1>
          <div class="subtitle">Manage the businesses registered under your account.</div>
        </div>
        <a routerLink="/businesses/register" class="btn btn-primary">+ Register Business</a>
      </div>

      @if (store.myBusinesses().length === 0) {
        <div class="card empty-state">
          You haven't registered a business yet.
          <div style="margin-top:12px;"><a routerLink="/businesses/register" class="btn btn-primary">Register Your First Business</a></div>
        </div>
      } @else {
        <div class="grid grid-2">
          @for (b of store.myBusinesses(); track b.id) {
            <a [routerLink]="['/businesses', b.id]" class="card-link">
              <div class="card card-fill">
                <div style="display:flex; justify-content:space-between; align-items:start; gap:10px;">
                  <div>
                    <h3 style="margin-bottom:2px;">{{ b.name }}</h3>
                    <div class="muted small">{{ b.category }}</div>
                  </div>
                  <span class="badge" style="flex-shrink:0;" [class]="b.status === 'Active' ? 'badge-green' : 'badge-gray'">{{ b.status }}</span>
                </div>
                <div style="margin-top:auto;">
                  <hr class="divider" />
                  <div class="small muted">{{ b.street }}, Brgy. {{ b.barangay }}, {{ b.city }}, {{ b.province }}</div>
                  <div class="small muted">Reg. No. {{ b.registrationNumber }} · Registered {{ formatDate(b.dateRegistered) }}</div>
                </div>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class BusinessListPage {
  protected readonly store = inject(BusinessStore);
  protected readonly formatDate = formatDate;
}
