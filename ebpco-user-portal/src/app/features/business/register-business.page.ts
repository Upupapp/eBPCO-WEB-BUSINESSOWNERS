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
        <div class="field"><label>Business Name*</label><input class="input" [(ngModel)]="name" /></div>
        <div class="field">
          <label>Business Category*</label>
          <select class="input" [(ngModel)]="category">
            @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </div>
        <div class="field"><label>House Number / Street*</label><input class="input" [(ngModel)]="street" /></div>
        <div class="form-row">
          <div class="field"><label>Barangay*</label><input class="input" [(ngModel)]="barangay" /></div>
          <div class="field"><label>City / Municipality*</label><input class="input" [(ngModel)]="city" /></div>
        </div>
        <div class="field"><label>Province*</label><input class="input" [(ngModel)]="province" /></div>

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
    this.toast.success(`${business.name} has been registered.`);
    this.router.navigate(['/businesses', business.id]);
  }
}
