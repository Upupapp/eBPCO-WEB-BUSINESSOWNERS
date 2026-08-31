import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BusinessStore } from '../../core/stores/business.store';
import { BUSINESS_CATEGORIES, BusinessCategory } from '../../core/domain/business.model';
import { ToastService } from '../../shared/ui/toast.service';

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
        <div class="field"><label for="register-business-business-name-1">Business Name*</label><input id="register-business-business-name-1" class="input" [(ngModel)]="name" /></div>
        <div class="field">
          <label for="register-business-business-category-2">Business Category*</label>
          <select id="register-business-business-category-2" class="input" [(ngModel)]="category">
            @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </div>
        <div class="field"><label for="register-business-house-number-street-3">House Number / Street*</label><input id="register-business-house-number-street-3" class="input" [(ngModel)]="street" /></div>
        <div class="form-row">
          <div class="field"><label for="register-business-barangay-4">Barangay*</label><input id="register-business-barangay-4" class="input" [(ngModel)]="barangay" /></div>
          <div class="field"><label for="register-business-city-municipality-5">City / Municipality*</label><input id="register-business-city-municipality-5" class="input" [(ngModel)]="city" /></div>
        </div>
        <div class="field"><label for="register-business-province-6">Province*</label><input id="register-business-province-6" class="input" [(ngModel)]="province" /></div>

        @if (error()) { <div class="field error">{{ error() }}</div> }

        <div style="display:flex; gap:10px; margin-top:8px;">
          <a routerLink="/businesses" class="btn btn-secondary" style="flex:1">Cancel</a>
          <button class="btn btn-primary" style="flex:2" (click)="submit()">Register Business</button>
        </div>
      </div>
    </div>
  `,
})
export class RegisterBusinessPage {
  private readonly store = inject(BusinessStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly categories = BUSINESS_CATEGORIES;
  readonly error = signal<string | null>(null);

  name = '';
  category: BusinessCategory = 'Retail';
  street = '';
  barangay = '';
  city = '';
  province = '';

  submit(): void {
    if (!this.name || !this.street || !this.barangay || !this.city || !this.province) {
      this.error.set('Please complete all required fields.');
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
}
