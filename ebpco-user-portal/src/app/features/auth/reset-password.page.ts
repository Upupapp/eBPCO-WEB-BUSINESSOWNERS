import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { firstPasswordRejectionMessage, passwordChecks } from '../../core/domain/password-policy';

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
@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink, NgTemplateOutlet],
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
            <div class="password-field">
              <input id="reset-password-new-1" class="input" [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" />
              <button type="button" class="password-toggle" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                <ng-container *ngTemplateOutlet="eyeIcon; context: { open: showPassword() }" />
              </button>
            </div>
            <ul class="password-checklist" aria-label="Password requirements">
              @for (check of passwordChecks; track check.label) {
                <li [class.met]="check.passed">
                  <span class="check-icon" aria-hidden="true">✓</span>
                  {{ check.label }}
                </li>
              }
            </ul>
            <div class="hint">We also check it isn't a password already known from a real data breach — that part happens when you submit, not here in the browser.</div>
          </div>
          <div class="field">
            <label for="reset-password-confirm-2">Confirm New Password</label>
            <div class="password-field">
              <input id="reset-password-confirm-2" class="input" [type]="showConfirmPassword() ? 'text' : 'password'" [(ngModel)]="confirmPassword" />
              <button type="button" class="password-toggle" (click)="showConfirmPassword.set(!showConfirmPassword())" [attr.aria-label]="showConfirmPassword() ? 'Hide password' : 'Show password'">
                <ng-container *ngTemplateOutlet="eyeIcon; context: { open: showConfirmPassword() }" />
              </button>
            </div>
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
export class ResetPasswordPage {
  private readonly route = inject(ActivatedRoute);
  private readonly identity = inject(CitizenIdentityApi);

  private readonly token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
  protected readonly hasToken = this.token.length > 0;

  password = '';
  confirmPassword = '';
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal('');
  readonly outcome = signal<'done' | 'invalid-link' | null>(null);

  get passwordChecks(): { label: string; passed: boolean }[] {
    return passwordChecks(this.password);
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.formError.set('');

    if (!this.password || !this.confirmPassword) {
      this.formError.set('Please fill in both fields.');
      return;
    }
    const rejection = firstPasswordRejectionMessage(this.password);
    if (rejection) {
      this.formError.set(rejection);
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
    } finally {
      this.submitting.set(false);
    }
  }
}
