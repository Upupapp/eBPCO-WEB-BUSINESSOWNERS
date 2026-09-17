import { __decorate } from "tslib";
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BusinessStore } from '../../core/stores/business.store';
import { BUSINESS_CATEGORIES } from '../../core/domain/business.model';
import { ToastService } from '../../shared/ui/toast.service';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
let RegisterBusinessPage = class RegisterBusinessPage {
    store = inject(BusinessStore);
    router = inject(Router);
    toast = inject(ToastService);
    api = inject(CitizenApiClient);
    categories = BUSINESS_CATEGORIES;
    error = signal(null);
    submitting = signal(false);
    name = '';
    category = 'Retail';
    street = '';
    barangay = '';
    city = '';
    province = '';
    /** Required only for a real submission — see class doc and the server's `businessShape`. */
    registrationNumber = '';
    dateRegistered = '';
    async submit() {
        if (!this.name || !this.street || !this.barangay || !this.city || !this.province) {
            this.error.set('Please complete all required fields.');
            return;
        }
        if (this.api.configured) {
            await this.submitReal();
            return;
        }
        const business = this.store.register({
            name: this.name,
            category: this.category,
            street: this.street,
            barangay: this.barangay,
            city: this.city,
            province: this.province,
        });
        // F-14: "registered" reads as registered WITH THE MUNICIPALITY. It is not.
        this.toast.success(`${business.name} saved to this demo, not registered with the Municipality.`);
        this.router.navigate(['/businesses', business.id]);
    }
    async submitReal() {
        if (!this.registrationNumber || !this.dateRegistered) {
            this.error.set('Please complete all required fields.');
            return;
        }
        this.submitting.set(true);
        try {
            const result = await this.store.registerReal({
                name: this.name,
                category: this.category,
                street: this.street,
                barangay: this.barangay,
                city: this.city,
                province: this.province,
                registrationNumber: this.registrationNumber,
                dateRegistered: this.dateRegistered,
            });
            if (!result.ok) {
                this.error.set(result.error);
                return;
            }
            this.toast.success(`${this.name} registered with the Municipality.`);
            this.router.navigate(['/businesses', result.id]);
        }
        finally {
            this.submitting.set(false);
        }
    }
};
RegisterBusinessPage = __decorate([
    Component({
        selector: 'app-register-business',
        imports: [FormsModule, RouterLink],
        template: `
    <div class="page" style="max-width:600px;">
      <div class="page-header">
        <div>
          <h1>Register a Business</h1>
          <div class="subtitle">Add a new business to your account.</div>
        </div>
      </div>

      <div class="card">
        <div class="field"><label for="register-business-business-name-1">Business Name<span class="required">*</span></label><input id="register-business-business-name-1" class="input" [(ngModel)]="name" /></div>
        <div class="field">
          <label for="register-business-business-category-2">Business Category<span class="required">*</span></label>
          <select id="register-business-business-category-2" class="input" [(ngModel)]="category">
            @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </div>
        <div class="field"><label for="register-business-house-number-street-3">House Number / Street<span class="required">*</span></label><input id="register-business-house-number-street-3" class="input" [(ngModel)]="street" /></div>
        <div class="form-row">
          <div class="field"><label for="register-business-barangay-4">Barangay<span class="required">*</span></label><input id="register-business-barangay-4" class="input" [(ngModel)]="barangay" /></div>
          <div class="field"><label for="register-business-city-municipality-5">City / Municipality<span class="required">*</span></label><input id="register-business-city-municipality-5" class="input" [(ngModel)]="city" /></div>
        </div>
        <div class="field"><label for="register-business-province-6">Province<span class="required">*</span></label><input id="register-business-province-6" class="input" [(ngModel)]="province" /></div>
        @if (api.configured) {
          <div class="form-row">
            <div class="field">
              <label for="register-business-registration-number-7">DTI / SEC / CDA Registration No.<span class="required">*</span></label>
              <input id="register-business-registration-number-7" class="input" [(ngModel)]="registrationNumber" />
            </div>
            <div class="field">
              <label for="register-business-date-registered-8">Date Registered<span class="required">*</span></label>
              <input id="register-business-date-registered-8" class="input" type="date" [(ngModel)]="dateRegistered" />
            </div>
          </div>
        }

        @if (error()) { <div class="field error">{{ error() }}</div> }

        <div style="display:flex; gap:10px; margin-top:8px;">
          <a routerLink="/businesses" class="btn btn-secondary" style="flex:1">Cancel</a>
          <button class="btn btn-primary" style="flex:2" [disabled]="submitting()" (click)="submit()">
            {{ submitting() ? 'Registering…' : 'Register Business' }}
          </button>
        </div>
      </div>
    </div>
  `,
    })
], RegisterBusinessPage);
export { RegisterBusinessPage };
