import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/session/auth.service';
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
            <div style="display:flex; gap:16px; margin-bottom:6px;">
              <span class="badge" [class]="u.emailVerification.status === 'Verified' ? 'badge-green' : 'badge-amber'">Email: {{ u.emailVerification.status }}</span>
              <span class="badge" [class]="u.mobileVerification.status === 'Verified' ? 'badge-green' : 'badge-amber'">Mobile: {{ u.mobileVerification.status }}</span>
            </div>
            <!-- F-16: these badges report a status nothing can change and nothing enforces. Say so. -->
            <p class="small muted" style="margin:0 0 16px;">
              Verification is not available in this build and is not required for anything here.
            </p>
            <div class="form-row">
              <div class="field"><label for="profile-first-name-1">First Name</label><input id="profile-first-name-1" class="input" [(ngModel)]="firstName" /></div>
              <div class="field"><label for="profile-middle-name-2">Middle Name</label><input id="profile-middle-name-2" class="input" [(ngModel)]="middleName" /></div>
            </div>
            <div class="field"><label for="profile-last-name-3">Last Name</label><input id="profile-last-name-3" class="input" [(ngModel)]="lastName" /></div>
            <div class="field"><label for="profile-email-read-only-4">Email <span class="small muted">(read-only)</span></label><input id="profile-email-read-only-4" class="input" [value]="u.email" disabled /></div>
            <div class="field"><label for="profile-mobile-number-5">Mobile Number</label><input id="profile-mobile-number-5" class="input" [(ngModel)]="mobileNumber" /></div>
            <div class="field"><label for="profile-address-6">Address</label><input id="profile-address-6" class="input" [(ngModel)]="address" /></div>
            <div class="form-row">
              <div class="field"><label for="profile-barangay-7">Barangay</label><input id="profile-barangay-7" class="input" [(ngModel)]="barangay" /></div>
              <div class="field"><label for="profile-city-municipality-8">City / Municipality</label><input id="profile-city-municipality-8" class="input" [(ngModel)]="city" /></div>
            </div>
            <div class="form-row">
              <div class="field"><label for="profile-province-9">Province</label><input id="profile-province-9" class="input" [(ngModel)]="province" /></div>
              <div class="field"><label for="profile-zip-code-10">ZIP Code</label><input id="profile-zip-code-10" class="input" [(ngModel)]="zipCode" /></div>
            </div>
            <button class="btn btn-primary" (click)="saveProfile()">Save Changes</button>
          </div>
        }

        @if (tab() === 'password') {
          <div class="card" style="max-width:420px;">
            <div class="field"><label for="profile-current-password-11">Current Password</label><input id="profile-current-password-11" class="input" type="password" [(ngModel)]="currentPassword" /></div>
            <div class="field"><label for="profile-new-password-12">New Password</label><input id="profile-new-password-12" class="input" type="password" [(ngModel)]="newPassword" /></div>
            <div class="field"><label for="profile-confirm-new-password-13">Confirm New Password</label><input id="profile-confirm-new-password-13" class="input" type="password" [(ngModel)]="confirmPassword" /></div>
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
            <!--
              F-15: this Save button is the point. The checkboxes were always
              bound, but bound to a local object nobody stored — the panel
              looked functional and configured nothing.
            -->
            <button class="btn btn-primary" (click)="savePreferences()">Save Preferences</button>
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

  prefs = this.auth.notificationPreferencesFor();
  readonly prefKeys = Object.keys(this.prefs) as (keyof typeof this.prefs)[];

  prefLabel(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }

  savePreferences(): void {
    this.auth.updateNotificationPreferences(this.prefs);
    this.toast.success('Notification preferences saved to this demo.');
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
