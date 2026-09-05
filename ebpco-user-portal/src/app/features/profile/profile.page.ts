import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/session/auth.service';
import { TERMS_CONDITIONS_TEXT, PRIVACY_POLICY_TEXT } from '../../core/domain/legal-copy';
import { ToastService } from '../../shared/ui/toast.service';
import { MUNICIPAL_ENGINEER } from '../../core/domain/lgu-contact';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { CitizenProfile, buildRectification, rectificationProblem } from '../../core/api/citizen-profile';
import { ApiError } from '../../core/api/problem';

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
  private readonly api = inject(CitizenApiClient);

  /** Named on screen because the office has no other way to learn a new address. */
  protected readonly engineer = MUNICIPAL_ENGINEER;

  readonly tab = signal<Tab>('profile');
  readonly passwordError = signal<string | null>(null);
  readonly termsText = TERMS_CONDITIONS_TEXT;
  readonly privacyText = PRIVACY_POLICY_TEXT;

  private u = this.auth.currentUser()!;

  /**
   * What the office holds, in the SERVER's shape.
   *
   * Sourced from the local account today because `GET /me` has no host to call.
   * The shape is the server's so that the day it is connected, only where this
   * comes FROM changes — not what anything downstream does with it.
   */
  private heldProfile(): CitizenProfile {
    const u = this.auth.currentUser()!;
    return {
      firstName: u.firstName, middleName: u.middleName ?? null, lastName: u.lastName,
      mobileNumber: u.mobileNumber, street: u.street || null, barangay: u.barangay || null,
      city: u.city || null, province: u.province || null, postalCode: u.postalCode || null,
    };
  }

  firstName = this.u.firstName;
  middleName = this.u.middleName ?? '';
  lastName = this.u.lastName;
  mobileNumber = this.u.mobileNumber;
  street = this.u.street;
  barangay = this.u.barangay;
  city = this.u.city;
  province = this.u.province;
  postalCode = this.u.postalCode;

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

  /**
   * Whether the Municipality can actually receive a correction yet.
   *
   * `PATCH /me` now EXISTS — the backend shipped it as the RA 10173 s.16(d)
   * right to rectification. What is still missing here is a host to send it to,
   * so the honest state is "built, not connected", not "impossible".
   */
  protected canReachTheOffice(): boolean {
    return this.api.configured;
  }

  /**
   * The office holds no address at all for this citizen.
   *
   * Null means NOT RECORDED, not blank. Nobody has ever been asked for these
   * fields — the column did not exist until migration 036 — so showing empty
   * boxes with no explanation would read as "you left this out". It is the
   * absence of a question, not the citizen's answer.
   */
  protected addressNeverRecorded(): boolean {
    const p = this.heldProfile();
    return !p.street && !p.barangay && !p.city && !p.province && !p.postalCode;
  }

  /** True once a save has un-verified the mobile number, as the server reported. */
  protected readonly mobileUnverified = signal(false);
  protected readonly saveError = signal<string | null>(null);

  saveProfile(): void {
    this.auth.updateProfile({
      firstName: this.firstName,
      middleName: this.middleName || null,
      lastName: this.lastName,
      mobileNumber: this.mobileNumber,
      street: this.street,
      barangay: this.barangay,
      city: this.city,
      province: this.province,
      postalCode: this.postalCode,
      photoPath: this.photoPreview(),
    });
    this.initials.set(this.computeInitials());

    // Only what actually CHANGED goes to the server, and an emptied optional
    // field goes as null rather than being omitted: absent leaves a field
    // alone, null clears it. A citizen who typed a middle name by mistake must
    // be able to remove it.
    const patch = buildRectification(this.heldProfile(), {
      firstName: this.firstName, middleName: this.middleName, lastName: this.lastName,
      mobileNumber: this.mobileNumber, street: this.street, barangay: this.barangay,
      city: this.city, province: this.province, postalCode: this.postalCode,
    });

    const problem = rectificationProblem(patch);
    if (problem) {
      // Checked here so the citizen is told before a round trip. An address the
      // office cannot post to is worse than none, because it gets acted on.
      this.saveError.set(problem);
      return;
    }
    this.saveError.set(null);

    if (!this.canReachTheOffice()) {
      // Not "Profile updated." on its own. Within this app it IS updated - the
      // falsehood was never the verb, it was the implication that the office
      // now knows. That is the question worth asking of any profile screen:
      // does the citizen believe the office has the new address?
      this.toast.success('Saved on this device. The Municipality has not been told.');
      return;
    }

    if (Object.keys(patch).length === 0) {
      this.toast.success('Nothing to correct — those details are already on file.');
      return;
    }

    this.api.patchMe(patch).subscribe({
      next: (result) => {
        // Stated by the server, not inferred. Changing the number cleared the
        // verification that belonged to the OLD one, and a screen that does not
        // say so leaves a citizen holding an unverified contact they believe is
        // verified.
        this.mobileUnverified.set(result.mobileVerificationCleared);
        this.toast.success(
          result.mobileVerificationCleared
            ? 'Sent to the Municipality. Your mobile number is now unverified.'
            : 'Sent to the Municipality.',
        );
      },
      error: (e) =>
        this.saveError.set(
          e instanceof ApiError
            ? e.citizenMessage
            : 'We could not reach the Municipality’s system. Your details are unchanged.',
        ),
    });
  }

  /**
   * F-20: this used to skip straight to the match check, so two blank fields
   * ("" === "") sailed through and silently set the account's password to an
   * empty string as long as the current password was correct. Register enforces
   * the same 8-char/letter/number rule on account creation; Change Password must
   * enforce it too, not just on the way in.
   */
  changePassword(): void {
    if (this.newPassword.length < 8 || !/[a-zA-Z]/.test(this.newPassword) || !/\d/.test(this.newPassword)) {
      this.passwordError.set('Password must be at least 8 characters with at least 1 letter and 1 number.');
      return;
    }
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
