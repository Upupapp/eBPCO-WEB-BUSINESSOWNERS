import { __decorate } from "tslib";
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/session/auth.service';
import { CapitalizeNameDirective } from '../../core/utils/capitalize-name.directive';
let RegisterPage = class RegisterPage {
    auth = inject(AuthService);
    router = inject(Router);
    step = signal(1);
    error = signal(null);
    // Step 1
    firstName = '';
    middleName = '';
    lastName = '';
    dateOfBirth = '';
    sex = null;
    civilStatus = null;
    nationality = 'Filipino';
    // Step 2
    email = '';
    mobileNumber = '';
    street = '';
    barangay = '';
    city = '';
    province = '';
    postalCode = '';
    // Step 3
    password = '';
    confirmPassword = '';
    acceptedTerms = false;
    acceptedPrivacy = false;
    toStep2() {
        if (!this.firstName || !this.lastName || !this.dateOfBirth || !this.sex || !this.civilStatus || !this.nationality) {
            this.error.set('Please complete all required fields.');
            return;
        }
        const age = this.ageFrom(this.dateOfBirth);
        if (age < 18) {
            this.error.set('You must be at least 18 years old to register.');
            return;
        }
        this.error.set(null);
        this.step.set(2);
    }
    ageFrom(dob) {
        const birth = new Date(dob);
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
            age -= 1;
        }
        return age;
    }
    toStep3() {
        if (!this.email || !this.mobileNumber || !this.street || !this.barangay || !this.city || !this.province || !this.postalCode) {
            this.error.set('Please complete all required fields.');
            return;
        }
        if (!/^09\d{9}$/.test(this.mobileNumber)) {
            this.error.set('Mobile number must be in the format 09XXXXXXXXX.');
            return;
        }
        this.error.set(null);
        this.step.set(3);
    }
    submitting = signal(false);
    async submit() {
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
            const result = await this.auth.register({
                firstName: this.firstName,
                middleName: this.middleName || null,
                lastName: this.lastName,
                dateOfBirth: this.dateOfBirth,
                sex: this.sex,
                civilStatus: this.civilStatus,
                nationality: this.nationality,
            }, {
                email: this.email,
                mobileNumber: this.mobileNumber,
                street: this.street,
                barangay: this.barangay,
                city: this.city,
                province: this.province,
                postalCode: this.postalCode,
            }, { password: this.password });
            if (!result.ok) {
                this.error.set(result.error);
                return;
            }
            this.router.navigate(['/registration-success']);
        }
        finally {
            this.submitting.set(false);
        }
    }
};
RegisterPage = __decorate([
    Component({
        selector: 'app-register',
        imports: [FormsModule, RouterLink, CapitalizeNameDirective],
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
            <div class="field"><label for="register-nationality-7">Nationality<span class="required">*</span></label><input id="register-nationality-7" class="input" [(ngModel)]="nationality" /></div>
          </div>
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <button class="btn btn-primary btn-block" (click)="toStep2()">Continue</button>
        }

        @if (step() === 2) {
          <div class="field"><label for="register-email-address-8">Email Address<span class="required">*</span></label><input id="register-email-address-8" class="input" type="email" [(ngModel)]="email" /></div>
          <div class="field"><label for="register-mobile-number-9">Mobile Number<span class="required">*</span></label><input id="register-mobile-number-9" class="input" placeholder="09XXXXXXXXX" [(ngModel)]="mobileNumber" /></div>
          <div class="field"><label for="register-house-number-street-10">House Number / Street<span class="required">*</span></label><input id="register-house-number-street-10" class="input" [(ngModel)]="street" /></div>
          <div class="form-row">
            <div class="field"><label for="register-barangay-11">Barangay<span class="required">*</span></label><input id="register-barangay-11" class="input" [(ngModel)]="barangay" /></div>
            <div class="field"><label for="register-city-municipality-12">City / Municipality<span class="required">*</span></label><input id="register-city-municipality-12" class="input" [(ngModel)]="city" /></div>
          </div>
          <div class="form-row">
            <div class="field"><label for="register-province-13">Province<span class="required">*</span></label><input id="register-province-13" class="input" [(ngModel)]="province" /></div>
            <div class="field"><label for="register-postal-code-14">Postal Code<span class="required">*</span></label><input id="register-postal-code-14" class="input" maxlength="4" [(ngModel)]="postalCode" /></div>
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
            <input id="register-password-15" class="input" type="password" [(ngModel)]="password" />
            <div class="hint">At least 12 characters. A longer phrase is easier to remember and harder to guess than a short one with symbols in it.</div>
          </div>
          <div class="field"><label for="register-confirm-password-16">Confirm Password<span class="required">*</span></label><input id="register-confirm-password-16" class="input" type="password" [(ngModel)]="confirmPassword" /></div>
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
  `,
    })
], RegisterPage);
export { RegisterPage };
