import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BusinessStore } from '../../core/stores/business.store';
import { ApplicationStore } from '../../core/stores/application.store';
import { BUSINESS_CATEGORIES, BusinessCategory } from '../../core/domain/business.model';
import { CASTILLA_BARANGAYS } from '../../core/domain/ph-reference-data';
import { ToastService } from '../../shared/ui/toast.service';
import { registrationDateProblem, registrationNumberProblem } from '../../core/domain/registration-number';

/**
 * BUS-004 — Edit Business.
 *
 * Shows only what is the citizen's to change. The business's status is the
 * Municipality's and is absent from this form. The DTI/SEC/CDA registration
 * number and date are what the citizen typed, so they are theirs to correct
 * until an application filed under the business reaches the office (QA
 * TC-24, 2026-10-03: a mistyped "x" could never be fixed); after that the
 * office relies on them, and the form shows them read-only with who to ask.
 *
 * The notice about filed applications is not decoration. A citizen who renames
 * their business here reasonably expects the change to follow through to work
 * already in progress; it does not, and finding that out from the office weeks
 * later is worse than reading it now.
 */
@Component({
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
              <select id="edit-business-barangay" class="input" [(ngModel)]="barangay">
                <option value="" disabled>Select</option>
                @for (b of barangays; track b) { <option [value]="b">{{ b }}</option> }
              </select>
            </div>
            <div class="field">
              <label for="edit-business-city">City / Municipality<span class="required">*</span></label>
              <select id="edit-business-city" class="input" [(ngModel)]="city">
                <option value="Castilla">Castilla</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label for="edit-business-province">Province<span class="required">*</span></label>
            <select id="edit-business-province" class="input" [(ngModel)]="province">
              <option value="Sorsogon">Sorsogon</option>
            </select>
          </div>

          @if (store.usingReal()) {
            @if (registrationLocked()) {
              <div class="field">
                <span class="small muted" style="display:block; margin-bottom:4px;">DTI / SEC / CDA Registration</span>
                <div><strong>{{ registrationNumber }}</strong> · registered {{ dateRegistered || 'date not on file' }}</div>
                <p class="small muted" style="margin:6px 0 0;">
                  An application filed under this business has reached the office, which now relies on these details.
                  To correct them, ask the Office of the Building Official.
                </p>
              </div>
            } @else {
              <div class="form-row">
                <div class="field">
                  <label for="edit-business-registration-number">DTI / SEC / CDA Registration No.<span class="required">*</span></label>
                  <input id="edit-business-registration-number" class="input" [(ngModel)]="registrationNumber" autocomplete="off" />
                </div>
                <div class="field">
                  <label for="edit-business-date-registered">Date Registered<span class="required">*</span></label>
                  <input id="edit-business-date-registered" class="input" type="date" [(ngModel)]="dateRegistered" />
                </div>
              </div>
              <p class="small muted" style="margin:-4px 0 10px;">
                You can correct these until you file an application for this business.
              </p>
            }
          }

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
            <button class="btn btn-primary" [disabled]="saving()" (click)="save()">
              {{ saving() ? 'Saving…' : 'Save Changes' }}
            </button>
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
export class EditBusinessPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(BusinessStore);
  private readonly applications = inject(ApplicationStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly categories = BUSINESS_CATEGORIES;
  readonly barangays = CASTILLA_BARANGAYS;
  readonly error = signal<string | null>(null);

  readonly id = this.route.snapshot.paramMap.get('id')!;

  name = '';
  category: BusinessCategory = 'Retail';
  street = '';
  barangay = '';
  city = '';
  province = '';
  registrationNumber = '';
  dateRegistered = '';
  private originalRegistration = { registrationNumber: '', dateRegistered: '' };

  private readonly loaded = signal(false);

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
      this.dateRegistered = (b.dateRegistered ?? '').slice(0, 10);
      this.originalRegistration = { registrationNumber: this.registrationNumber, dateRegistered: this.dateRegistered };
      this.loaded.set(true);
    }
  }

  found(): boolean {
    return this.loaded();
  }

  /** Applications for this business that the office has not finished with. */
  openApplicationCount(): number {
    return this.applications
      .myApplications()
      .filter((a) => a.businessId === this.id && a.lifecycleStatus !== 'Draft').length;
  }

  /** The office's cut-off, the same as the server's: an application under this business has left Draft. */
  registrationLocked(): boolean {
    return this.openApplicationCount() > 0;
  }

  protected readonly saving = signal(false);

  async save(): Promise<void> {
    if (!this.name.trim() || !this.street.trim() || !this.barangay.trim() || !this.city.trim() || !this.province.trim()) {
      this.error.set('Please complete every required field.');
      return;
    }
    const registrationChanged = this.store.usingReal() && !this.registrationLocked()
      && (this.registrationNumber.trim() !== this.originalRegistration.registrationNumber
        || this.dateRegistered !== this.originalRegistration.dateRegistered);
    if (registrationChanged) {
      const problem = registrationNumberProblem(this.registrationNumber) ?? registrationDateProblem(this.dateRegistered);
      if (problem) {
        this.error.set(problem);
        return;
      }
    }
    const input = {
      name: this.name,
      category: this.category,
      street: this.street,
      barangay: this.barangay,
      city: this.city,
      province: this.province,
      ...(registrationChanged
        ? { registration: { registrationNumber: this.registrationNumber.trim(), dateRegistered: this.dateRegistered } }
        : {}),
    };

    if (this.store.usingReal()) {
      this.saving.set(true);
      const result = await this.store.updateReal(this.id, input);
      this.saving.set(false);
      if (!result.ok) {
        this.error.set(result.error);
        return;
      }
    } else {
      try {
        this.store.update(this.id, input);
      } catch (e) {
        this.error.set(e instanceof Error ? e.message : 'That change could not be saved.');
        return;
      }
    }

    this.error.set(null);
    // Says what was and was not changed. "Saved" alone would let a citizen
    // believe their in-progress applications moved with it.
    this.toast.success(
      this.openApplicationCount() > 0
        ? 'Business details updated. Applications already filed are unchanged.'
        : 'Business details updated.',
    );
    this.router.navigate(['/businesses', this.id]);
  }
}
