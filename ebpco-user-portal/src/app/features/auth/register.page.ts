import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/session/auth.service';
import { CivilStatus, Sex } from '../../core/domain/user.model';

type Step = 1 | 2 | 3;

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
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
            <div class="field"><label>First Name*</label><input class="input" [(ngModel)]="firstName" /></div>
            <div class="field"><label>Middle Name</label><input class="input" [(ngModel)]="middleName" /></div>
          </div>
          <div class="field"><label>Last Name*</label><input class="input" [(ngModel)]="lastName" /></div>
          <div class="form-row">
            <div class="field"><label>Date of Birth*</label><input class="input" type="date" [(ngModel)]="dateOfBirth" /></div>
            <div class="field">
              <label>Sex*</label>
              <select class="input" [(ngModel)]="sex">
                <option [ngValue]="null" disabled>Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label>Civil Status*</label>
              <select class="input" [(ngModel)]="civilStatus">
                <option [ngValue]="null" disabled>Select</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>
            <div class="field"><label>Nationality*</label><input class="input" [(ngModel)]="nationality" /></div>
          </div>
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <button class="btn btn-primary btn-block" (click)="toStep2()">Continue</button>
        }

        @if (step() === 2) {
          <div class="field"><label>Email Address*</label><input class="input" type="email" [(ngModel)]="email" /></div>
          <div class="field"><label>Mobile Number*</label><input class="input" placeholder="09XXXXXXXXX" [(ngModel)]="mobileNumber" /></div>
          <div class="field"><label>House Number / Street*</label><input class="input" [(ngModel)]="address" /></div>
          <div class="form-row">
            <div class="field"><label>Barangay*</label><input class="input" [(ngModel)]="barangay" /></div>
            <div class="field"><label>City / Municipality*</label><input class="input" [(ngModel)]="city" /></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Province*</label><input class="input" [(ngModel)]="province" /></div>
            <div class="field"><label>Postal Code*</label><input class="input" maxlength="4" [(ngModel)]="zipCode" /></div>
          </div>
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" style="flex:1" (click)="step.set(1)">Back</button>
            <button class="btn btn-primary" style="flex:2" (click)="toStep3()">Continue</button>
          </div>
        }

        @if (step() === 3) {
          <div class="field">
            <label>Password*</label>
            <input class="input" type="password" [(ngModel)]="password" />
            <div class="hint">Minimum 8 characters, at least 1 letter and 1 number.</div>
          </div>
          <div class="field"><label>Confirm Password*</label><input class="input" type="password" [(ngModel)]="confirmPassword" /></div>
          <label class="checkbox-row" style="margin-bottom:8px;">
            <input type="checkbox" [(ngModel)]="acceptedTerms" /> I agree to the <a routerLink="/terms">Terms &amp; Conditions</a>
          </label>
          <label class="checkbox-row" style="margin-bottom:14px;">
            <input type="checkbox" [(ngModel)]="acceptedPrivacy" /> I agree to the <a routerLink="/privacy">Privacy Policy</a>
          </label>
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" style="flex:1" (click)="step.set(2)">Back</button>
            <button class="btn btn-primary" style="flex:2" (click)="submit()">Create Account</button>
          </div>
        }

        <hr class="divider" />
        <div style="text-align:center;" class="small muted">Already have an account? <a routerLink="/login">Log In</a></div>
      </div>
    </div>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly step = signal<Step>(1);
  readonly error = signal<string | null>(null);

  // Step 1
  firstName = '';
  middleName = '';
  lastName = '';
  dateOfBirth = '';
  sex: Sex | null = null;
  civilStatus: CivilStatus | null = null;
  nationality = 'Filipino';

  // Step 2
  email = '';
  mobileNumber = '';
  address = '';
  barangay = '';
  city = '';
  province = '';
  zipCode = '';

  // Step 3
  password = '';
  confirmPassword = '';
  acceptedTerms = false;
  acceptedPrivacy = false;

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
    if (!this.email || !this.mobileNumber || !this.address || !this.barangay || !this.city || !this.province || !this.zipCode) {
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

  submit(): void {
    if (this.password.length < 8 || !/[a-zA-Z]/.test(this.password) || !/\d/.test(this.password)) {
      this.error.set('Password must be at least 8 characters with at least 1 letter and 1 number.');
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
    const result = this.auth.register(
      {
        firstName: this.firstName,
        middleName: this.middleName || null,
        lastName: this.lastName,
        dateOfBirth: this.dateOfBirth,
        sex: this.sex!,
        civilStatus: this.civilStatus!,
        nationality: this.nationality,
      },
      {
        email: this.email,
        mobileNumber: this.mobileNumber,
        address: this.address,
        barangay: this.barangay,
        city: this.city,
        province: this.province,
        zipCode: this.zipCode,
      },
      { password: this.password },
    );
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.router.navigate(['/registration-success']);
  }
}
