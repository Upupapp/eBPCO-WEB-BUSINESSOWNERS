import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MUNICIPAL_ENGINEER, MUNICIPAL_HALL_ADDRESS } from '../../core/domain/lgu-contact';

/**
 * F-5: this screen previously collected an email address, did nothing with it
 * — `(click)="sent.set(true)"` — and then told the user "a password reset link
 * has been sent". Nothing was sent, and there is no reset route anywhere in
 * `app.routes.ts`, so a locked-out user waited for mail that could never
 * arrive, with no other way back into the account.
 *
 * A mock that WORKS inside its own world (the in-memory login) is a reasonable
 * stand-in for a backend. A mock that reports success for something it did not
 * do is not — it is worse than an unimplemented screen, because the user stops
 * looking for another route.
 *
 * So the form is gone rather than made prettier. There is nothing to submit to
 * until a backend can actually send mail; asking for an address this build
 * cannot use would only repeat the deception more politely.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink],
  template: `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;">
      <div class="card auth-card anim-pop-in" style="width:100%; max-width:400px;">
        <h2>Password Reset</h2>
        <p class="small" style="margin-bottom:12px;">
          <strong>Password reset is not available in this build.</strong> eBPCO cannot send email yet,
          so no reset link can reach you — and this portal will not pretend otherwise.
        </p>
        <p class="muted small" style="margin-bottom:16px;">
          If you cannot sign in, contact the {{ engineer.name }} directly and they can help you with
          your application in person:
        </p>
        <div class="card" style="background:var(--secondary-50);">
          <div class="small"><strong>{{ engineer.shortName }}:</strong> {{ engineer.mobile }}</div>
          <div class="small">
            <a [href]="'mailto:' + engineer.email">{{ engineer.email }}</a>
          </div>
          <div class="small muted" style="margin-top:6px;">{{ hallAddress }}</div>
        </div>
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
}
