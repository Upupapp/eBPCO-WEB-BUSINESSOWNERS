import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/session/auth.service';
import { CivilStatus, Sex } from '../../core/domain/user.model';
import { CapitalizeNameDirective } from '../../core/utils/capitalize-name.directive';
import { NATIONALITIES, PH_PROVINCES } from '../../core/domain/ph-reference-data';

type Step = 1 | 2 | 3;

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, CapitalizeNameDirective, NgTemplateOutlet],
  template: `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;">
      <div class="card auth-card anim-pop-in" style="width:100%; max-width:520px;">
        <div style="text-align:center; margin-bottom:12px;">
          <h2>Create Your Account</h2>
          <p class="muted small">Step {{ step() }} of 3</p>
        </div>
        <div class="steps" style="justify-content:center;">
          <div class="step-item" [class.active]="step() === 1" [class.done]="step() > 1"><span class="dot">1</span> Personal</div>
          <div class="step-sep"></div>
          <div class="step-item" [class.active]="step() === 2" [class.done]="step() > 2"><span class="dot">2</span> Contact</div>
          <div class="step-sep"></div>
          <div class="step-item" [class.active]="step() === 3"><span class="dot">3</span> Security</div>
        </div>

        @if (step() === 1) {
          <div class="form-row">
            <div class="field"><label for="register-first-name-1">First Name<span class="required">*</span></label><input id="register-first-name-1" class="input" [(ngModel)]="firstName" appCapitalizeName /></div>
            <div class="field"><label for="register-middle-name-2">Middle Name</label><input id="register-middle-name-2" class="input" [(ngModel)]="middleName" appCapitalizeName /></div>
          </div>
          <div class="field"><label for="register-last-name-3">Last Name<span class="required">*</span></label><input id="register-last-name-3" class="input" [(ngModel)]="lastName" appCapitalizeName /></div>
          <div class="form-row">
            <div class="field"><label for="register-date-of-birth-4">Date of Birth<span class="required">*</span></label><input id="register-date-of-birth-4" class="input" type="date" [(ngModel)]="dateOfBirth" /></div>
            <div class="field">
              <label for="register-sex-5">Sex<span class="required">*</span></label>
              <select id="register-sex-5" class="input" [(ngModel)]="sex">
                <option [ngValue]="null" disabled>Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="register-civil-status-6">Civil Status<span class="required">*</span></label>
              <select id="register-civil-status-6" class="input" [(ngModel)]="civilStatus">
                <option [ngValue]="null" disabled>Select</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>
            <div class="field">
              <label for="register-nationality-7">Nationality<span class="required">*</span></label>
              <select id="register-nationality-7" class="input" [(ngModel)]="nationality">
                @for (n of nationalities; track n) {
                  <option [value]="n">{{ n }}</option>
                }
              </select>
              @if (nationality === 'Other') {
                <input class="input" style="margin-top:8px;" placeholder="Enter your nationality" [(ngModel)]="otherNationality" aria-label="Specify your nationality" />
              }
            </div>
          </div>
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <button class="btn btn-primary btn-block" (click)="toStep2()">Continue</button>
        }

        @if (step() === 2) {
          <div class="field"><label for="register-email-address-8">Email Address<span class="required">*</span></label><input id="register-email-address-8" class="input" type="email" [(ngModel)]="email" /></div>
          <div class="field">
            <label for="register-mobile-number-9">Mobile Number<span class="required">*</span></label>
            <input id="register-mobile-number-9" class="input" type="tel" inputmode="numeric" maxlength="11"
              placeholder="09XXXXXXXXX" [ngModel]="mobileNumber" (ngModelChange)="onMobileNumberInput($event)" />
          </div>
          <div class="field"><label for="register-house-number-street-10">House Number / Street<span class="required">*</span></label><input id="register-house-number-street-10" class="input" [(ngModel)]="street" /></div>
          <div class="form-row">
            <div class="field"><label for="register-barangay-11">Barangay<span class="required">*</span></label><input id="register-barangay-11" class="input" [(ngModel)]="barangay" /></div>
            <div class="field"><label for="register-city-municipality-12">City / Municipality<span class="required">*</span></label><input id="register-city-municipality-12" class="input" [(ngModel)]="city" /></div>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="register-province-13">Province<span class="required">*</span></label>
              <select id="register-province-13" class="input" [(ngModel)]="province">
                @for (p of provinces; track p) {
                  <option [value]="p">{{ p }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="register-postal-code-14">Postal Code<span class="required">*</span></label>
              <input id="register-postal-code-14" class="input" type="text" inputmode="numeric" maxlength="4"
                placeholder="0000" [ngModel]="postalCode" (ngModelChange)="onPostalCodeInput($event)" />
            </div>
          </div>
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" style="flex:1" (click)="step.set(1)">Back</button>
            <button class="btn btn-primary" style="flex:2" (click)="toStep3()">Continue</button>
          </div>
        }

        @if (step() === 3) {
          <div class="field">
            <label for="register-password-15">Password<span class="required">*</span></label>
            <div class="password-field">
              <input id="register-password-15" class="input" [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" />
              <button type="button" class="password-toggle" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                <ng-container *ngTemplateOutlet="eyeIcon; context: { open: showPassword() }" />
              </button>
            </div>
            <div class="hint">At least 12 characters. A longer phrase is easier to remember and harder to guess than a short one with symbols in it.</div>
          </div>
          <div class="field">
            <label for="register-confirm-password-16">Confirm Password<span class="required">*</span></label>
            <div class="password-field">
              <input id="register-confirm-password-16" class="input" [type]="showConfirmPassword() ? 'text' : 'password'" [(ngModel)]="confirmPassword" />
              <button type="button" class="password-toggle" (click)="showConfirmPassword.set(!showConfirmPassword())" [attr.aria-label]="showConfirmPassword() ? 'Hide password' : 'Show password'">
                <ng-container *ngTemplateOutlet="eyeIcon; context: { open: showConfirmPassword() }" />
              </button>
            </div>
          </div>
          <label class="checkbox-row" style="margin-bottom:8px;">
            <input type="checkbox" [(ngModel)]="acceptedTerms" /> I agree to the <a routerLink="/terms">Terms &amp; Conditions</a>
          </label>
          <label class="checkbox-row" style="margin-bottom:14px;">
            <input type="checkbox" [(ngModel)]="acceptedPrivacy" /> I agree to the <a routerLink="/privacy">Privacy Policy</a>
          </label>
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" style="flex:1" [disabled]="submitting()" (click)="step.set(2)">Back</button>
            <button class="btn btn-primary" style="flex:2" [disabled]="submitting()" (click)="submit()">
              {{ submitting() ? 'Creating account…' : 'Create Account' }}
            </button>
          </div>
        }

        <hr class="divider" />
        <div style="text-align:center;" class="small muted">Already have an account? <a routerLink="/login">Log In</a></div>
      </div>
    </div>

    <ng-template #eyeIcon let-open="open">
      @if (open) {
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7Z" stroke="currentColor" stroke-width="1.6" />
          <circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.6" />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7Z" stroke="currentColor" stroke-width="1.6" />
          <circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.6" />
          <path d="m3 3 18 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      }
    </ng-template>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly step = signal<Step>(1);
  readonly error = signal<string | null>(null);

  readonly nationalities = NATIONALITIES;
  readonly provinces = PH_PROVINCES;

  // Step 1
  firstName = '';
  middleName = '';
  lastName = '';
  dateOfBirth = '';
  sex: Sex | null = null;
  civilStatus: CivilStatus | null = null;
  nationality = 'Filipino';
  /** Only sent when `nationality === 'Other'` — see the dropdown's own fallback field. */
  otherNationality = '';

  // Step 2
  email = '';
  mobileNumber = '';
  street = '';
  barangay = '';
  city = '';
  province = 'Sorsogon';
  postalCode = '';

  /** Digits only, capped at 11 — matches the `09XXXXXXXXX` format this form actually accepts (see the regex check in `toStep3`). Sanitized on every keystroke rather than only on submit, same as a normal sign-up form's phone field. */
  onMobileNumberInput(value: string): void {
    this.mobileNumber = value.replace(/\D/g, '').slice(0, 11);
  }

  /** Digits only, capped at 4 — the PH postal-code format the server itself enforces (`postal_code ~ '^[0-9]{4}$'`, migration 036_applicant_address.sql). */
  onPostalCodeInput(value: string): void {
    this.postalCode = value.replace(/\D/g, '').slice(0, 4);
  }

  // Step 3
  password = '';
  confirmPassword = '';
  acceptedTerms = false;
  acceptedPrivacy = false;
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  toStep2(): void {
    if (!this.firstName || !this.lastName || !this.dateOfBirth || !this.sex || !this.civilStatus || !this.nationality) {
      this.error.set('Please complete all required fields.');
      return;
    }
    const age = this.ageFrom(this.dateOfBirth);
    if (age < 18) {
      this.error.set('You must be at least 18 years old to register.');
      return;
    }
    if (this.nationality === 'Other' && !this.otherNationality.trim()) {
      this.error.set('Please specify your nationality.');
      return;
    }
    this.error.set(null);
    this.step.set(2);
  }

  private ageFrom(dob: string): number {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age;
  }

  toStep3(): void {
    if (!this.email || !this.mobileNumber || !this.street || !this.barangay || !this.city || !this.province || !this.postalCode) {
      this.error.set('Please complete all required fields.');
      return;
    }
    if (!/^09\d{9}$/.test(this.mobileNumber)) {
      this.error.set('Mobile number must be in the format 09XXXXXXXXX.');
      return;
    }
    if (!/^\d{4}$/.test(this.postalCode)) {
      this.error.set('Postal code must be exactly 4 digits.');
      return;
    }
    this.error.set(null);
    this.step.set(3);
  }

  readonly submitting = signal(false);

  async submit(): Promise<void> {
    // 12, matching the server's real policy (password-policy.ts,
    // MIN_PASSWORD_LENGTH — NIST SP 800-63B length-over-composition, no
    // letter/digit mix required). The server also screens for repetitive,
    // sequential, context-specific and breached passwords; those cannot be
    // replicated client-side, so a password that passes this check can still
    // come back with a specific reason from the server.
    if ([...this.password].length < 12) {
      this.error.set('Password must be at least 12 characters.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }
    if (!this.acceptedTerms || !this.acceptedPrivacy) {
      this.error.set('You must agree to the Terms & Conditions and Privacy Policy.');
      return;
    }
    this.submitting.set(true);
    try {
      const result = await this.auth.register(
        {
          firstName: this.firstName,
          middleName: this.middleName || null,
          lastName: this.lastName,
          dateOfBirth: this.dateOfBirth,
          sex: this.sex!,
          civilStatus: this.civilStatus!,
          nationality: this.nationality === 'Other' ? this.otherNationality.trim() : this.nationality,
        },
        {
          email: this.email,
          mobileNumber: this.mobileNumber,
          street: this.street,
          barangay: this.barangay,
          city: this.city,
          province: this.province,
          postalCode: this.postalCode,
        },
        { password: this.password },
      );
      if (!result.ok) {
        this.error.set(result.error);
        return;
      }
      this.router.navigate(['/registration-success']);
    } finally {
      this.submitting.set(false);
    }
  }
}
