import { __decorate } from "tslib";
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
/**
 * Where the emailed "set your password" link lands — connection-plan Stage
 * 11. Did not exist before this: `/auth/password/reset` had a real,
 * verified server route with nothing at the other end of the link it mints,
 * so a citizen who clicked it landed on this portal's generic 404.
 *
 * Mirrors the Admin Portal's own `pages/reset-password/reset-password.ts` —
 * the proven pattern for this exact screen, just against
 * `CitizenIdentityApi` instead of the staff `IdentityApi`.
 */
let ResetPasswordPage = class ResetPasswordPage {
    route = inject(ActivatedRoute);
    identity = inject(CitizenIdentityApi);
    token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
    hasToken = this.token.length > 0;
    password = '';
    confirmPassword = '';
    submitting = signal(false);
    formError = signal('');
    outcome = signal(null);
    async submit() {
        if (this.submitting())
            return;
        this.formError.set('');
        if (!this.password || !this.confirmPassword) {
            this.formError.set('Please fill in both fields.');
            return;
        }
        // The server's own floor (password-policy.ts's MIN_PASSWORD_LENGTH),
        // matched here so it is caught before a round trip, not after one.
        if ([...this.password].length < 12) {
            this.formError.set('Use at least 12 characters.');
            return;
        }
        if (this.password !== this.confirmPassword) {
            this.formError.set('Those two passwords do not match.');
            return;
        }
        if (!this.hasToken) {
            this.outcome.set('invalid-link');
            return;
        }
        this.submitting.set(true);
        try {
            const result = await this.identity.resetPassword(this.token, this.password);
            if (result.kind === 'done') {
                this.outcome.set('done');
                return;
            }
            if (result.kind === 'invalid-link') {
                this.outcome.set('invalid-link');
                return;
            }
            this.formError.set(result.message);
        }
        finally {
            this.submitting.set(false);
        }
    }
};
ResetPasswordPage = __decorate([
    Component({
        selector: 'app-reset-password',
        imports: [FormsModule, RouterLink],
        template: `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;">
      <div class="card auth-card anim-pop-in" style="width:100%; max-width:400px;">
        @if (outcome() === 'done') {
          <h2>Password Set</h2>
          <p class="small" style="margin-bottom:16px;">
            Your password has been set. You can now sign in with it.
          </p>
          <a routerLink="/login" class="btn btn-primary btn-block">Log In</a>
        } @else if (outcome() === 'invalid-link' || !hasToken) {
          <h2>That Link Is No Longer Valid</h2>
          <p class="small" style="margin-bottom:16px;">
            This link may have expired, already been used, or been typed incorrectly. Request a new
            one from the sign-in screen.
          </p>
          <a routerLink="/forgot-password" class="btn btn-primary btn-block">Request a New Link</a>
        } @else {
          <h2>Set a New Password</h2>
          <p class="muted small" style="margin-bottom:16px;">Choose a new password for your account.</p>
          <div class="field">
            <label for="reset-password-new-1">New Password</label>
            <input id="reset-password-new-1" class="input" type="password" [(ngModel)]="password" />
            <div class="hint">At least 12 characters.</div>
          </div>
          <div class="field">
            <label for="reset-password-confirm-2">Confirm New Password</label>
            <input id="reset-password-confirm-2" class="input" type="password" [(ngModel)]="confirmPassword" />
          </div>
          @if (formError()) { <div class="field error">{{ formError() }}</div> }
          <button class="btn btn-primary btn-block" [disabled]="submitting()" (click)="submit()">
            {{ submitting() ? 'Setting…' : 'Set Password' }}
          </button>
        }
        <div style="text-align:center; margin-top:16px;">
          <a routerLink="/login" class="small">Back to Log In</a>
        </div>
      </div>
    </div>
  `,
    })
], ResetPasswordPage);
export { ResetPasswordPage };
