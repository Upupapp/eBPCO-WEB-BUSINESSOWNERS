import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BusinessStore } from '../../core/stores/business.store';
import { BusinessCategory } from '../../core/domain/business.model';
import { formatDate } from '../../core/utils/ids';

/** Small outline-icon path set, drawn in the Lucide visual style (24x24, round caps/joins) — same convention as the dashboard's ICONS, so this page doesn't need an extra icon-library dependency (lucide-angular doesn't support this app's Angular version yet). */
const ICONS = {
  store: [
    'M4 9 5 4h14l1 5',
    'M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0',
    'M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9',
    'M9 20v-5h6v5',
  ],
  utensils: [
    'M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2',
    'M7 2v20',
    'M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7',
  ],
  wrench: ['M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4L15 12l-3-3 2.7-2.7Z'],
  factory: [
    'M3 19a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-2.34a1 1 0 0 0-.4-.8L18 14V9a1 1 0 0 0-1.6-.8L13 11V5.5a1 1 0 0 0-1.6-.8L2.4 11.2a1 1 0 0 0-.4.8Z',
    'M8 16h.01',
    'M12 16h.01',
    'M16 16h.01',
  ],
  package: ['M12 3 3 8v8l9 5 9-5V8Z', 'M3 8l9 5 9-5', 'M12 13v8'],
  mapPin: ['M12 18.5S5 13 5 8.5a7 7 0 0 1 14 0c0 4.5-7 10-7 10Z', 'M12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  calendarDays: [
    'M4 5h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
    'M3 9h18',
    'M8 3v4',
    'M16 3v4',
    'M8 13h.01',
    'M12 13h.01',
    'M16 13h.01',
    'M8 17h.01',
    'M12 17h.01',
  ],
} as const;

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
        <div class="business-grid">
          @for (b of store.myBusinesses(); track b.id) {
            <a [routerLink]="['/businesses', b.id]" class="business-card-link">
              <article class="business-card">
                <div class="business-card__header">
                  <div class="business-card__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      @for (d of businessIcon(b.category); track d) { <path [attr.d]="d" /> }
                    </svg>
                  </div>
                  <div class="business-card__identity">
                    <h3 class="business-card__name">{{ b.name }}</h3>
                    <div class="muted small business-card__type">{{ b.category }}</div>
                  </div>
                  <span class="badge business-status" [class]="b.status === 'Active' ? 'badge-green' : 'badge-gray'">{{ b.status }}</span>
                </div>

                <hr class="business-card__divider" />

                <div class="business-card__meta">
                  <div class="business-meta-row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      @for (d of icons.mapPin; track d) { <path [attr.d]="d" /> }
                    </svg>
                    <span class="small muted">{{ b.street }}, Brgy. {{ b.barangay }}, {{ b.city }}, {{ b.province }}</span>
                  </div>
                  <div class="business-meta-row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      @for (d of icons.calendarDays; track d) { <path [attr.d]="d" /> }
                    </svg>
                    <span class="small muted">Reg. No. {{ b.registrationNumber }} <span class="meta-separator">&bull;</span> Registered {{ formatDate(b.dateRegistered) }}</span>
                  </div>
                </div>
              </article>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
    .business-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 18px;
      row-gap: 18px;
      width: 100%;
    }
    @media (max-width: 900px) {
      .business-grid { grid-template-columns: 1fr; }
    }

    .business-card-link {
      display: block;
      color: inherit;
      text-decoration: none;
    }
    .business-card-link:hover { text-decoration: none; }

    .business-card {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 190px;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border: 1px solid #e4e8ed;
      border-radius: 9px;
      padding: 23px 20px 21px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02), 0 5px 14px rgba(15, 23, 42, 0.045);
      transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
    }
    .business-card:hover {
      border-color: #d9dee5;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.025), 0 7px 16px rgba(15, 23, 42, 0.055);
      transform: translateY(-1px);
    }

    .business-card__header {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto;
      align-items: start;
      column-gap: 15px;
      width: 100%;
      min-height: 72px;
    }

    .business-card__icon {
      width: 44px;
      height: 44px;
      min-width: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      background: #fff0f2;
      color: #e5162b;
    }
    .business-card__icon svg { width: 21px; height: 21px; }

    .business-card__identity {
      min-width: 0;
      padding-top: 1px;
    }
    .business-card__name {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .business-card__type {
      margin: 5px 0 0;
    }

    .badge.business-status {
      padding: 3px 11px;
      border-radius: 6px;
      min-height: 23px;
      margin-left: 12px;
      flex-shrink: 0;
      white-space: nowrap;
    }

    .business-card__divider {
      width: 100%;
      height: 1px;
      background: #e9ecf0;
      margin: 17px 0 16px;
      border: none;
    }

    .business-card__meta {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .business-meta-row {
      display: grid;
      grid-template-columns: 14px minmax(0, 1fr);
      align-items: center;
      column-gap: 10px;
      min-width: 0;
      color: #526176;
    }
    .business-meta-row svg { width: 14px; height: 14px; }
    .business-meta-row > span { min-width: 0; overflow-wrap: anywhere; }

    .meta-separator {
      display: inline-block;
      margin: 0 7px;
      color: #9aa5b4;
    }

    @media (max-width: 520px) {
      .business-card { padding: 18px; }
      .business-card__header { grid-template-columns: 40px minmax(0, 1fr); row-gap: 8px; }
      .business-card__icon { width: 40px; height: 40px; min-width: 40px; }
      .badge.business-status { grid-column: 1 / -1; margin-left: 0; justify-self: start; }
    }
    `,
  ],
})
export class BusinessListPage {
  protected readonly store = inject(BusinessStore);
  protected readonly formatDate = formatDate;
  protected readonly icons = ICONS;

  businessIcon(category: BusinessCategory): readonly string[] {
    switch (category) {
      case 'Food Service':
        return ICONS.utensils;
      case 'Services':
        return ICONS.wrench;
      case 'Manufacturing':
        return ICONS.factory;
      case 'Wholesale':
        return ICONS.package;
      default:
        return ICONS.store;
    }
  }
}
