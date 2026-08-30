import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/session/auth.service';
import { defaultNotificationPreferences } from '../../core/domain/user.model';
import { TERMS_CONDITIONS_TEXT, PRIVACY_POLICY_TEXT } from '../../core/domain/legal-copy';
import { ToastService } from '../../shared/ui/toast.service';

type Tab = 'profile' | 'password' | 'notifications' | 'legal';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, RouterLink],
  template: `
    @if (auth.currentUser(); as u) {
      <div class="page">
        <div class="page-header">
          <div>
            <h1>Profile &amp; Settings</h1>
            <div class="subtitle">Manage your account details, security, and preferences.</div>
          </div>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
          <button class="btn btn-sm" [class.btn-primary]="tab() === 'profile'" [class.btn-secondary]="tab() !== 'profile'" (click)="tab.set('profile')">Edit Profile</button>
          <button class="btn btn-sm" [class.btn-primary]="tab() === 'password'" [class.btn-secondary]="tab() !== 'password'" (click)="tab.set('password')">Change Password</button>
          <button class="btn btn-sm" [class.btn-primary]="tab() === 'notifications'" [class.btn-secondary]="tab() !== 'notifications'" (click)="tab.set('notifications')">Notification Preferences</button>
          <button class="btn btn-sm" [class.btn-primary]="tab() === 'legal'" [class.btn-secondary]="tab() !== 'legal'" (click)="tab.set('legal')">Legal</button>
        </div>

        @if (tab() === 'profile') {
          <div class="card" style="max-width:520px;">
            <div style="display:flex; gap:16px; margin-bottom:16px;">
              <span class="badge" [class]="u.emailVerification.status === 'Verified' ? 'badge-green' : 'badge-amber'">Email: {{ u.emailVerification.status }}</span>
              <span class="badge" [class]="u.mobileVerification.status === 'Verified' ? 'badge-green' : 'badge-amber'">Mobile: {{ u.mobileVerification.status }}</span>
            </div>
            <div class="form-row">
              <div class="field"><label>First Name</label><input class="input" [(ngModel)]="firstName" /></div>
              <div class="field"><label>Middle Name</label><input class="input" [(ngModel)]="middleName" /></div>
            </div>
            <div class="field"><label>Last Name</label><input class="input" [(ngModel)]="lastName" /></div>
            <div class="field"><label>Email <span class="small muted">(read-only)</span></label><input class="input" [value]="u.email" disabled /></div>
            <div class="field"><label>Mobile Number</label><input class="input" [(ngModel)]="mobileNumber" /></div>
            <div class="field"><label>Address</label><input class="input" [(ngModel)]="address" /></div>
            <div class="form-row">
              <div class="field"><label>Barangay</label><input class="input" [(ngModel)]="barangay" /></div>
              <div class="field"><label>City / Municipality</label><input class="input" [(ngModel)]="city" /></div>
            </div>
            <div class="form-row">
              <div class="field"><label>Province</label><input class="input" [(ngModel)]="province" /></div>
              <div class="field"><label>ZIP Code</label><input class="input" [(ngModel)]="zipCode" /></div>
            </div>
            <button class="btn btn-primary" (click)="saveProfile()">Save Changes</button>
          </div>
        }

        @if (tab() === 'password') {
          <div class="card" style="max-width:420px;">
            <div class="field"><label>Current Password</label><input class="input" type="password" [(ngModel)]="currentPassword" /></div>
            <div class="field"><label>New Password</label><input class="input" type="password" [(ngModel)]="newPassword" /></div>
            <div class="field"><label>Confirm New Password</label><input class="input" type="password" [(ngModel)]="confirmPassword" /></div>
            @if (passwordError()) { <div class="field error">{{ passwordError() }}</div> }
            <button class="btn btn-primary" (click)="changePassword()">Update Password</button>
          </div>
        }

        @if (tab() === 'notifications') {
          <div class="card" style="max-width:420px;">
            @for (key of prefKeys; track key) {
              <label class="checkbox-row" style="margin-bottom:12px;">
                <input type="checkbox" [(ngModel)]="prefs[key]" [ngModelOptions]="{ standalone: true }" /> {{ prefLabel(key) }}
              </label>
            }
          </div>
        }

        @if (tab() === 'legal') {
          <div class="card" style="max-width:600px;">
            <h4>Terms &amp; Conditions</h4>
            <p class="small muted">{{ termsText }}</p>
            <a routerLink="/terms" class="small">Read full Terms &amp; Conditions</a>
            <h4 style="margin-top:16px;">Privacy Policy</h4>
            <p class="small muted">{{ privacyText }}</p>
            <a routerLink="/privacy" class="small">Read full Privacy Policy</a>
          </div>
        }
      </div>
    }
  `,
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<Tab>('profile');
  readonly passwordError = signal<string | null>(null);
  readonly termsText = TERMS_CONDITIONS_TEXT;
  readonly privacyText = PRIVACY_POLICY_TEXT;

  private u = this.auth.currentUser()!;
  firstName = this.u.firstName;
  middleName = this.u.middleName ?? '';
  lastName = this.u.lastName;
  mobileNumber = this.u.mobileNumber;
  address = this.u.address;
  barangay = this.u.barangay;
  city = this.u.city;
  province = this.u.province;
  zipCode = this.u.zipCode;

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  prefs = defaultNotificationPreferences();
  readonly prefKeys = Object.keys(this.prefs) as (keyof typeof this.prefs)[];

  prefLabel(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }

  saveProfile(): void {
    this.auth.updateProfile({
      firstName: this.firstName,
      middleName: this.middleName || null,
      lastName: this.lastName,
      mobileNumber: this.mobileNumber,
      address: this.address,
      barangay: this.barangay,
      city: this.city,
      province: this.province,
      zipCode: this.zipCode,
    });
    this.toast.success('Profile updated.');
  }

  changePassword(): void {
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError.set('New passwords do not match.');
      return;
    }
    const result = this.auth.changePassword(this.currentPassword, this.newPassword);
    if (!result.ok) {
      this.passwordError.set(result.error);
      return;
    }
    this.passwordError.set(null);
    this.currentPassword = this.newPassword = this.confirmPassword = '';
    this.toast.success('Password updated.');
  }
}
