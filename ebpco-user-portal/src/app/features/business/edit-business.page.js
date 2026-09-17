import { __decorate } from "tslib";
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BusinessStore } from '../../core/stores/business.store';
import { ApplicationStore } from '../../core/stores/application.store';
import { BUSINESS_CATEGORIES } from '../../core/domain/business.model';
import { ToastService } from '../../shared/ui/toast.service';
/**
 * BUS-004 — Edit Business.
 *
 * Shows only what is the citizen's to change. The registration number, the
 * date registered and the business's status are shown as facts on the details
 * page and are absent from this form: they are the Municipality's, and a field
 * offering to change one would misrepresent who decides.
 *
 * The notice about filed applications is not decoration. A citizen who renames
 * their business here reasonably expects the change to follow through to work
 * already in progress; it does not, and finding that out from the office weeks
 * later is worse than reading it now.
 */
let EditBusinessPage = class EditBusinessPage {
    route = inject(ActivatedRoute);
    store = inject(BusinessStore);
    applications = inject(ApplicationStore);
    router = inject(Router);
    toast = inject(ToastService);
    categories = BUSINESS_CATEGORIES;
    error = signal(null);
    id = this.route.snapshot.paramMap.get('id');
    name = '';
    category = 'Retail';
    street = '';
    barangay = '';
    city = '';
    province = '';
    registrationNumber = '';
    loaded = signal(false);
    constructor() {
        const b = this.store.businessById(this.id);
        if (b) {
            this.name = b.name;
            this.category = b.category;
            this.street = b.street;
            this.barangay = b.barangay;
            this.city = b.city;
            this.province = b.province;
            this.registrationNumber = b.registrationNumber;
            this.loaded.set(true);
        }
    }
    found() {
        return this.loaded();
    }
    /** Applications for this business that the office has not finished with. */
    openApplicationCount() {
        return this.applications
            .myApplications()
            .filter((a) => a.businessId === this.id && a.lifecycleStatus !== 'Draft').length;
    }
    save() {
        if (!this.name.trim() || !this.street.trim() || !this.barangay.trim() || !this.city.trim() || !this.province.trim()) {
            this.error.set('Please complete every required field.');
            return;
        }
        try {
            this.store.update(this.id, {
                name: this.name,
                category: this.category,
                street: this.street,
                barangay: this.barangay,
                city: this.city,
                province: this.province,
            });
        }
        catch (e) {
            this.error.set(e instanceof Error ? e.message : 'That change could not be saved.');
            return;
        }
        this.error.set(null);
        // Says what was and was not changed. "Saved" alone would let a citizen
        // believe their in-progress applications moved with it.
        this.toast.success(this.openApplicationCount() > 0
            ? 'Business details updated. Applications already filed are unchanged.'
            : 'Business details updated.');
        this.router.navigate(['/businesses', this.id]);
    }
};
EditBusinessPage = __decorate([
    Component({
        selector: 'app-edit-business',
        imports: [FormsModule, RouterLink],
        template: `
    <div class="page" style="max-width:720px;">
      @if (found()) {
        <div class="page-header">
          <div>
            <h1>Edit Business</h1>
            <div class="subtitle">{{ registrationNumber }}</div>
          </div>
        </div>

        <div class="card">
          <div class="field">
            <label for="edit-business-name">Business Name<span class="required">*</span></label>
            <input id="edit-business-name" class="input" [(ngModel)]="name" />
          </div>
          <div class="field">
            <label for="edit-business-category">Business Category<span class="required">*</span></label>
            <select id="edit-business-category" class="input" [(ngModel)]="category">
              @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
            </select>
          </div>
          <div class="field">
            <label for="edit-business-street">House Number / Street<span class="required">*</span></label>
            <input id="edit-business-street" class="input" [(ngModel)]="street" />
          </div>
          <div class="form-row">
            <div class="field">
              <label for="edit-business-barangay">Barangay<span class="required">*</span></label>
              <input id="edit-business-barangay" class="input" [(ngModel)]="barangay" />
            </div>
            <div class="field">
              <label for="edit-business-city">City / Municipality<span class="required">*</span></label>
              <input id="edit-business-city" class="input" [(ngModel)]="city" />
            </div>
          </div>
          <div class="field">
            <label for="edit-business-province">Province<span class="required">*</span></label>
            <input id="edit-business-province" class="input" [(ngModel)]="province" />
          </div>

          @if (openApplicationCount() > 0) {
            <div class="card" style="background:var(--warning-100); border:1px solid var(--warning-text); color:var(--warning-text); margin-top:6px;">
              <strong>This will not change applications already filed.</strong>
              You have {{ openApplicationCount() }}
              {{ openApplicationCount() === 1 ? 'application' : 'applications' }} in progress. The
              Municipality assessed {{ openApplicationCount() === 1 ? 'it' : 'them' }} under the
              details on file at the time. To change the details on an application already
              submitted, file an <strong>Amendment</strong> for it.
            </div>
          }

          @if (error()) { <div class="field error">{{ error() }}</div> }

          <div style="display:flex; gap:10px; margin-top:14px;">
            <a class="btn btn-secondary" [routerLink]="['/businesses', id]">Cancel</a>
            <button class="btn btn-primary" (click)="save()">Save Changes</button>
          </div>
        </div>
      } @else {
        <div class="card empty-state">
          <p>We couldn't find that business in your account.</p>
          <a routerLink="/businesses" class="btn btn-primary">Back to My Businesses</a>
        </div>
      }
    </div>
  `,
    })
], EditBusinessPage);
export { EditBusinessPage };
