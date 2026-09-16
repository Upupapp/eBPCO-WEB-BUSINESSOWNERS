import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MUNICIPAL_ENGINEER, MUNICIPAL_HALL_ADDRESS } from '../../core/domain/lgu-contact';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { CitizenApiClient } from '../../core/api/citizen-api.client';

/**
 * F-5's fix, connection-plan Stage 11: this screen used to collect an email
 * address, do nothing with it, and claim a link had been sent — worse than
 * an unimplemented screen, because a locked-out citizen stopped looking for
 * another way in. It was then made honest instead: no form, a plain
 * statement that reset was not connected, and the office's phone number.
 *
 * `POST /auth/password/forgot` now exists on this side of the connection
 * (`CitizenIdentityApi.requestPasswordReset`) and the backend's own mailer
 * now brands the email for THIS portal, not the admin one (see
 * `account-recovery-mailer.ts`'s `kind` branch) — so the honest answer has
 * changed from "cannot" to "can", and the form belongs back.
 *
 * Still deliberately generic on success: the server answers 202 identically
 * whether or not the address has an account, and showing a different
 * message here would undo that anti-enumeration property from the client
 * side. See `CitizenIdentityApi.requestPasswordReset`'s own doc comment.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, FormsModule],
  template: `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;">
      <div class="card auth-card anim-pop-in" style="width:100%; max-width:400px;">
        <h2>Password Reset</h2>

        @if (!api.configured) {
          <p class="small" style="margin-bottom:12px;">
            <strong>Password reset is not available in this build.</strong> eBPCO cannot send email
            yet, so no reset link can reach you — and this portal will not pretend otherwise.
          </p>
          <p class="muted small" style="margin-bottom:16px;">
            If you cannot sign in, contact the {{ engineer.name }} directly and they can help you
            with your application in person:
          </p>
          <div class="card" style="background:var(--secondary-50);">
            <div class="small"><strong>{{ engineer.shortName }}:</strong> {{ engineer.mobile }}</div>
            <div class="small">
              <a [href]="'mailto:' + engineer.email">{{ engineer.email }}</a>
            </div>
            <div class="small muted" style="margin-top:6px;">{{ hallAddress }}</div>
          </div>
        } @else if (sent()) {
          <p class="small" style="margin-bottom:12px;">
            If an account exists for <strong>{{ email }}</strong>, we've sent a link to set a new
            password. It works once and expires in a few minutes.
          </p>
          <p class="muted small">
            Didn't get it? Check your spam folder, or contact the {{ engineer.name }} —
            {{ engineer.mobile }}.
          </p>
        } @else {
          <p class="muted small" style="margin-bottom:16px;">
            Enter the email address on your account and we'll send you a link to set a new password.
          </p>
          <div class="field">
            <label for="forgot-password-email-1">Email Address</label>
            <input id="forgot-password-email-1" class="input" type="email" [(ngModel)]="email" placeholder="you@example.com" />
          </div>
          @if (error()) { <div class="field error">{{ error() }}</div> }
          <button class="btn btn-primary btn-block" [disabled]="submitting()" (click)="submit()">
            {{ submitting() ? 'Sending…' : 'Send Reset Link' }}
          </button>
        }

        <div style="text-align:center; margin-top:16px;">
          <a routerLink="/login" class="small">Back to Log In</a>
        </div>
      </div>
    </div>
  `,
})
export class ForgotPasswordPage {
  protected readonly engineer = MUNICIPAL_ENGINEER;
  protected readonly hallAddress = MUNICIPAL_HALL_ADDRESS;
  protected readonly api = inject(CitizenApiClient);
  private readonly identity = inject(CitizenIdentityApi);

  email = '';
  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (!this.email) {
      this.error.set('Please enter your email address.');
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    try {
      // Always resolves — the server answers 202 identically whether or not
      // the address has an account. Nothing here branches on the result.
      await this.identity.requestPasswordReset(this.email);
      this.sent.set(true);
    } catch {
      this.error.set('We could not reach the Municipality’s system. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
