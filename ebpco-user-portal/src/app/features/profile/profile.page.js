import { __decorate } from "tslib";
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/session/auth.service';
import { TERMS_CONDITIONS_TEXT, PRIVACY_POLICY_TEXT } from '../../core/domain/legal-copy';
import { ToastService } from '../../shared/ui/toast.service';
import { MUNICIPAL_ENGINEER } from '../../core/domain/lgu-contact';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { buildRectification, rectificationProblem } from '../../core/api/citizen-profile';
import { ApiError } from '../../core/api/problem';
import { firstValueFrom } from 'rxjs';
import { formatDateTime } from '../../core/utils/ids';
import { CapitalizeNameDirective } from '../../core/utils/capitalize-name.directive';
let ProfilePage = class ProfilePage {
    auth = inject(AuthService);
    toast = inject(ToastService);
    api = inject(CitizenApiClient);
    router = inject(Router);
    /** Named on screen because the office has no other way to learn a new address. */
    engineer = MUNICIPAL_ENGINEER;
    formatDateTime = formatDateTime;
    tab = signal('profile');
    passwordError = signal(null);
    termsText = TERMS_CONDITIONS_TEXT;
    privacyText = PRIVACY_POLICY_TEXT;
    u = this.auth.currentUser();
    /**
     * What the office holds, in the SERVER's shape.
     *
     * Sourced from the local account today because `GET /me` has no host to call.
     * The shape is the server's so that the day it is connected, only where this
     * comes FROM changes — not what anything downstream does with it.
     */
    heldProfile() {
        const u = this.auth.currentUser();
        return {
            firstName: u.firstName, middleName: u.middleName ?? null, lastName: u.lastName,
            mobileNumber: u.mobileNumber, street: u.street || null, barangay: u.barangay || null,
            city: u.city || null, province: u.province || null, postalCode: u.postalCode || null,
            dateOfBirth: u.dateOfBirth, sex: u.sex, civilStatus: u.civilStatus,
            nationality: u.nationality || null,
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
    photoPreview = signal(this.u.photoPath);
    initials = signal(this.computeInitials());
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
    prefs = this.auth.notificationPreferencesFor();
    prefKeys = Object.keys(this.prefs);
    prefLabel(key) {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    }
    computeInitials() {
        return [this.firstName, this.lastName]
            .map((part) => part.trim().charAt(0).toUpperCase())
            .filter(Boolean)
            .join('');
    }
    onPhotoSelected(event) {
        const input = event.target;
        const file = input.files?.[0];
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            this.toast.error('Please choose an image file.');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => this.photoPreview.set(reader.result);
        reader.readAsDataURL(file);
        input.value = '';
    }
    removePhoto() {
        this.photoPreview.set(null);
    }
    savePreferences() {
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
    canReachTheOffice() {
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
    addressNeverRecorded() {
        const p = this.heldProfile();
        return !p.street && !p.barangay && !p.city && !p.province && !p.postalCode;
    }
    /** True once a save has un-verified the mobile number, as the server reported. */
    mobileUnverified = signal(false);
    saveError = signal(null);
    saveProfile() {
        // Captured BEFORE the local optimistic update below, and deliberately
        // not merged into one step: `updateProfile()` mutates the signal
        // `heldProfile()` reads, so computing the diff afterward compared the
        // new values against themselves and always found nothing to send. Real
        // once `canReachTheOffice()` could ever be true — invisible before,
        // because until this connection work landed it never was. Caught live,
        // the first time a real PATCH was expected and none went out.
        const before = this.heldProfile();
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
        const patch = buildRectification(before, {
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
                this.toast.success(result.mobileVerificationCleared
                    ? 'Sent to the Municipality. Your mobile number is now unverified.'
                    : 'Sent to the Municipality.');
            },
            error: (e) => this.saveError.set(e instanceof ApiError
                ? e.citizenMessage
                : 'We could not reach the Municipality’s system. Your details are unchanged.'),
        });
    }
    /**
     * F-20: this used to skip straight to the match check, so two blank fields
     * ("" === "") sailed through and silently set the account's password to an
     * empty string as long as the current password was correct. Register enforces
     * the same 8-char/letter/number rule on account creation; Change Password must
     * enforce it too, not just on the way in.
     */
    changePassword() {
        if (this.newPassword.length < 8 || !/[a-zA-Z]/.test(this.newPassword) || !/\d/.test(this.newPassword)) {
            this.passwordError.set('Password must be at least 8 characters with at least 1 letter and 1 number.');
            return;
        }
        if (this.newPassword !== this.confirmPassword) {
            this.passwordError.set('New passwords do not match.');
            return;
        }
        const result = this.auth.changePassword();
        this.passwordError.set(result.error);
    }
    // ── RA 10173 §18 — data portability ─────────────────────────────────────
    exportRequestId = signal(null);
    exportStatus = signal(null);
    exportDownloadUrl = signal(null);
    exportBusy = signal(false);
    exportError = signal(null);
    async requestExport() {
        this.exportBusy.set(true);
        this.exportError.set(null);
        try {
            const result = await firstValueFrom(this.api.requestExport());
            this.exportRequestId.set(result.requestId);
            await this.checkExportStatus();
        }
        catch (error) {
            this.exportError.set(error instanceof ApiError ? error.citizenMessage : 'We could not reach the Municipality’s system. Please try again.');
        }
        finally {
            this.exportBusy.set(false);
        }
    }
    /**
     * A manual "Check Status" button, not an auto-polling loop.
     *
     * `scheduler disabled by configuration` in this dev environment means the
     * background job that turns a queued request into a ready file may never
     * run here at all — a polling loop would spin forever with nothing to
     * show for it. A citizen pressing a real button, in production, against a
     * real scheduler, is the honest interaction this maps to.
     */
    async checkExportStatus() {
        const id = this.exportRequestId();
        if (!id)
            return;
        this.exportBusy.set(true);
        try {
            const status = await firstValueFrom(this.api.getExportStatus(id));
            this.exportStatus.set(status);
            if (status.status === 'ready') {
                const content = await firstValueFrom(this.api.getExportContent(id));
                this.exportDownloadUrl.set(content.url);
            }
        }
        catch (error) {
            this.exportError.set(error instanceof ApiError ? error.citizenMessage : 'We could not reach the Municipality’s system. Please try again.');
        }
        finally {
            this.exportBusy.set(false);
        }
    }
    // ── RA 10173 §16(e) — right to erasure ──────────────────────────────────
    /** Plain field, not a signal — bound with [(ngModel)], same convention as firstName/lastName/etc. above. */
    deleteConfirmText = '';
    deleteBusy = signal(false);
    deleteError = signal(null);
    deleteReceipt = signal(null);
    async eraseAccount() {
        // Typed confirmation, not a single click: this is the one action on this
        // whole page that cannot be undone by saving something different
        // afterward.
        if (this.deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
            this.deleteError.set('Type DELETE (in capital letters) to confirm.');
            return;
        }
        this.deleteBusy.set(true);
        this.deleteError.set(null);
        try {
            const receipt = await firstValueFrom(this.api.eraseAccount());
            this.deleteReceipt.set(receipt);
            this.toast.success('Your account has been erased, as far as the law allows.');
            // Nothing left to sign in as — the identity row itself is gone, not
            // merely deactivated. Sign out locally and leave; there is no page
            // left on this portal that a request with this token could reach.
            await this.auth.logout();
            this.router.navigate(['/landing']);
        }
        catch (error) {
            this.deleteError.set(error instanceof ApiError ? error.citizenMessage : 'We could not reach the Municipality’s system. Please try again.');
        }
        finally {
            this.deleteBusy.set(false);
        }
    }
};
ProfilePage = __decorate([
    Component({
        selector: 'app-profile',
        imports: [FormsModule, RouterLink, CapitalizeNameDirective],
        templateUrl: './profile.page.html',
        styleUrl: './profile.page.scss',
    })
], ProfilePage);
export { ProfilePage };
