import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PERMIT_TYPE_GROUPS, PermitType } from '../../core/domain/permit.model';
import { REQUIREMENTS_CATALOG } from '../../core/domain/requirements-catalog';
import { BusinessStore } from '../../core/stores/business.store';
import { permitFormAssetFor } from '../../core/domain/permit-form-assets';

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
        <h3 style="margin-top:24px;">{{ group.label }}</h3>
        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
          @for (type of group.types; track type) {
            <div class="card card-fill">
              <span class="badge" style="align-self:flex-start; margin-bottom:8px;" [class]="verified(type) ? 'badge-green' : 'badge-amber'">
                {{ verified(type) ? 'Verified Checklist' : 'Pending Verification' }}
              </span>
              <h4 style="margin:0 0 8px; min-height:3em;">{{ type }}</h4>
              <p class="small muted" style="margin:0 0 16px; min-height:3em;">{{ office(type) }} · {{ documentCount(type) }} documents</p>

              @if (expanded() === type) {
                <ul style="padding-left:18px; margin:0 0 16px;">
                  @for (d of catalog[type].documents; track d.id) {
                    <li class="small" style="margin-bottom:6px;">
                      <span class="badge" [class]="d.required ? 'badge-req' : 'badge-opt'" style="margin-right:6px;">{{ d.required ? 'Required' : 'Optional' }}</span>
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
                  class="small"
                  style="display:inline-block; margin:0 0 16px;"
                  [href]="formAsset(type).fileName"
                  target="_blank"
                  rel="noopener"
                >
                  Download the official blank form — {{ formAsset(type).label }}
                </a>
                @if (formAsset(type).isFallback) {
                  <p class="small muted" style="margin:-10px 0 16px;">
                    Castilla has no dedicated form for this permit; the generic Unified Application
                    Form is used.
                  </p>
                }
              }

              <div class="card-footer" style="display:flex; flex-direction:column; gap:8px;">
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
})
export class PermitCatalogPage {
  protected readonly formAsset = permitFormAssetFor;
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
