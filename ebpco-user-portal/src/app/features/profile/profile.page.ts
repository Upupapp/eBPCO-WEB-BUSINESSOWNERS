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
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
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

  readonly photoPreview = signal<string | null>(this.u.photoPath);
  readonly initials = signal(this.computeInitials());

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  prefs = this.auth.notificationPreferencesFor();
  readonly prefKeys = Object.keys(this.prefs) as (keyof typeof this.prefs)[];

  prefLabel(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }

  private computeInitials(): string {
    return [this.firstName, this.lastName]
      .map((part) => part.trim().charAt(0).toUpperCase())
      .filter(Boolean)
      .join('');
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.error('Please choose an image file.');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.photoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
    input.value = '';
  }

  removePhoto(): void {
    this.photoPreview.set(null);
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
      photoPath: this.photoPreview(),
    });
    this.initials.set(this.computeInitials());
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
