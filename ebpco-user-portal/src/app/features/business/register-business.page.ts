import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BusinessStore } from '../../core/stores/business.store';
import { BUSINESS_CATEGORIES, BusinessCategory } from '../../core/domain/business.model';
import { CASTILLA_BARANGAYS } from '../../core/domain/ph-reference-data';
import { ToastService } from '../../shared/ui/toast.service';
import { CitizenApiClient } from '../../core/api/citizen-api.client';

@Component({
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
          <div class="field">
            <label for="register-business-barangay-4">Barangay<span class="required">*</span></label>
            <select id="register-business-barangay-4" class="input" [(ngModel)]="barangay">
              <option value="" disabled>Select</option>
              @for (b of barangays; track b) { <option [value]="b">{{ b }}</option> }
            </select>
          </div>
          <div class="field">
            <label for="register-business-city-municipality-5">City / Municipality<span class="required">*</span></label>
            <select id="register-business-city-municipality-5" class="input" [(ngModel)]="city">
              <option value="Castilla">Castilla</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="register-business-province-6">Province<span class="required">*</span></label>
          <select id="register-business-province-6" class="input" [(ngModel)]="province">
            <option value="Sorsogon">Sorsogon</option>
          </select>
        </div>
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
export class RegisterBusinessPage {
  private readonly store = inject(BusinessStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly api = inject(CitizenApiClient);

  readonly categories = BUSINESS_CATEGORIES;
  readonly barangays = CASTILLA_BARANGAYS;
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  name = '';
  category: BusinessCategory = 'Retail';
  street = '';
  barangay = '';
  /** eBPCO only serves businesses within this LGU, so both fields are locked
   *  to it rather than left as free text — unlike the citizen's own personal
   *  address (register.page.ts), which can legitimately be anywhere in the
   *  Philippines, a business filed here must be located in Castilla, Sorsogon. */
  city = 'Castilla';
  province = 'Sorsogon';
  /** Required only for a real submission — see class doc and the server's `businessShape`. */
  registrationNumber = '';
  dateRegistered = '';

  async submit(): Promise<void> {
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

  private async submitReal(): Promise<void> {
    if (!this.registrationNumber || !this.dateRegistered) {
      this.error.set('Please complete all required fields.');
      return;
    }
    // A DTI/SEC/CDA registration cannot predate its own issuance — accepted
    // a date years in the future with no check at all until now (found live
    // 2026-09-25). Same reasoning register.page.ts's own DOB check already
    // applies to a citizen's date of birth.
    if (new Date(this.dateRegistered) > new Date()) {
      this.error.set('Date Registered cannot be in the future.');
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
    } finally {
      this.submitting.set(false);
    }
  }
}
