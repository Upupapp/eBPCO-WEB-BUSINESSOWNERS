import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PERMIT_TYPE_GROUPS, PermitType } from '../../core/domain/permit.model';
import { REQUIREMENTS_CATALOG } from '../../core/domain/requirements-catalog';
import { BusinessStore } from '../../core/stores/business.store';
import { permitFormAssetFor } from '../../core/domain/permit-form-assets';
import { permitVisual } from '../../core/domain/permit-visual';

@Component({
  selector: 'app-permit-catalog',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Permit Services</h1>
          <div class="subtitle">Browse requirements before you start, or begin a new application.</div>
        </div>
        <a routerLink="/permits/apply" [queryParams]="{ type: 'generic' }" class="btn btn-secondary">Start Generic Application</a>
      </div>

      @if (businesses.myBusinesses().length === 0) {
        <div class="card" style="background:var(--warning-100); border:none; margin-bottom:16px;">
          <p class="small" style="color:var(--warning-text); margin:0;">
            You need to <a routerLink="/businesses/register">register a business</a> before you can apply for a permit.
          </p>
        </div>
      }

      @for (group of groups; track group.label) {
        <h3 class="permit-group-heading">{{ group.label }}</h3>
        <div class="permit-grid">
          @for (type of group.types; track type) {
            @let visual = permitVisual(type);
            <div class="card card-fill permit-card">
              <div class="permit-card__header">
                <div class="permit-card__icon" [style.background]="visual.bg" [style.color]="visual.fg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    @for (d of visual.icon; track d) { <path [attr.d]="d" /> }
                  </svg>
                </div>
                <span class="badge permit-status" [class]="verified(type) ? 'badge-green' : 'badge-amber'">
                  {{ verified(type) ? 'Verified Checklist' : 'Pending Verification' }}
                </span>
              </div>
              <div class="permit-card__identity">
                <h4 class="permit-card__name">{{ type }}</h4>
                <p class="small muted permit-card__subtitle">{{ office(type) }} &middot; {{ documentCount(type) }} documents</p>
              </div>

              <hr class="permit-card__divider" />

              @if (expanded() === type) {
                <ul class="permit-requirements">
                  @for (d of catalog[type].documents; track d.id) {
                    <li class="small">
                      <span class="badge" [class]="d.required ? 'badge-req' : 'badge-opt'">{{ d.required ? 'Required' : 'Optional' }}</span>
                      {{ d.label }}
                    </li>
                  }
                </ul>

                <!--
                  F-13: this is what makes the bundled LGU forms reachable.
                  permit-form-assets.ts mapped all 19 permit types to the
                  Municipality's own blank forms in public/assets/permit-forms/,
                  and NOTHING imported it — 13 of the 14 bundled PDFs could not
                  be opened from any screen. The files existed; the feature did
                  not. Guarded by permit-catalog.page.spec.ts.
                -->
                <a
                  class="small permit-form-link"
                  [href]="formAsset(type).fileName"
                  target="_blank"
                  rel="noopener"
                >
                  Download the official blank form — {{ formAsset(type).label }}
                </a>
                @if (formAsset(type).isFallback) {
                  <p class="small muted" style="margin:-6px 0 16px;">
                    Castilla has no dedicated form for this permit; the generic Unified Application
                    Form is used.
                  </p>
                }
              }

              <div class="card-footer permit-card__footer" style="display:flex; flex-direction:column; gap:8px;">
                <button class="btn btn-secondary btn-sm btn-block" (click)="toggle(type)">
                  {{ expanded() === type ? 'Hide Requirements' : 'View Requirements' }}
                </button>
                <a class="btn btn-primary btn-sm btn-block" [routerLink]="['/permits/apply']" [queryParams]="{ type }">Start Application</a>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
    .permit-group-heading { margin-top: 24px; }

    .permit-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      align-items: stretch;
    }
    // The shared .card + .card { margin-top: 16px } rule (styles.scss) is
    // meant for cards stacked in normal block flow; its grid override
    // (.grid > .card + .card) only targets the shared .grid class, so
    // .permit-grid needs its own — otherwise every card but the first in a
    // row gets an extra 16px pushing it down within its cell, throwing the
    // row out of alignment even though each card's own height matches.
    .permit-grid > .card + .card {
      margin-top: 0;
    }

    .permit-card {
      position: relative;
      border: 1px solid #e4e8ed;
      border-radius: 9px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02), 0 5px 14px rgba(15, 23, 42, 0.045);
    }

    .permit-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .permit-card__icon {
      width: 44px;
      height: 44px;
      min-width: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
    }
    .permit-card__icon svg { width: 22px; height: 22px; }

    .permit-card__identity { min-width: 0; }
    .permit-card__name { margin: 0; }
    .permit-card__subtitle { margin: 5px 0 0; }

    .badge.permit-status {
      padding: 3px 11px;
      border-radius: 6px;
      min-height: 23px;
      flex-shrink: 0;
      white-space: nowrap;
    }

    .permit-card__divider {
      width: 100%;
      height: 1px;
      background: #e9ecf0;
      margin: 17px 0 16px;
      border: none;
    }

    .permit-requirements {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-left: 0;
      margin: 0 0 16px;
    }
    .permit-requirements li { display: flex; align-items: center; gap: 8px; }
    .permit-requirements .badge { border-radius: 6px; flex-shrink: 0; }

    .permit-form-link { display: inline-block; margin: 0 0 16px; }

    .permit-card__footer { margin-top: auto; padding-top: 16px; }

    @media (max-width: 480px) {
      .permit-card__icon { width: 40px; height: 40px; min-width: 40px; }
    }
    `,
  ],
})
export class PermitCatalogPage {
  protected readonly formAsset = permitFormAssetFor;
  protected readonly permitVisual = permitVisual;
  protected readonly businesses = inject(BusinessStore);
  private readonly router = inject(Router);

  protected readonly groups = PERMIT_TYPE_GROUPS;
  protected readonly catalog = REQUIREMENTS_CATALOG;
  protected readonly expanded = signal<PermitType | null>(null);

  toggle(type: PermitType): void {
    this.expanded.set(this.expanded() === type ? null : type);
  }

  office(type: PermitType): string {
    return this.catalog[type].reviewingOffice;
  }

  documentCount(type: PermitType): number {
    return this.catalog[type].documents.length;
  }

  verified(type: PermitType): boolean {
    return this.catalog[type].verificationStatus === 'CASTILLA_OFFICIAL_FORM_VERIFIED';
  }
}
