import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-registration-success',
  imports: [RouterLink],
  template: `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;">
      <div class="card auth-card anim-pop-in" style="width:100%; max-width:420px; text-align:center;">
        <div class="badge badge-green anim-flip-in" style="margin-bottom:12px; animation-delay:0.15s;">Account Created</div>
        <h2>Welcome to eBPCO</h2>
        <!--
          Used to say "...in this demonstration build. It exists in your
          browser and is saved when you close or refresh the page." That was
          true while registration wrote to a local, in-browser store. It now
          calls the real POST /auth/register (auth.service.ts's register())
          and the account is a real row in the real database from this
          screen onward -- telling the citizen otherwise is the F-16 defect
          in the other direction.
        -->
        <p class="muted">
          Your account has been created.
        </p>
        <!--
          F-16: this used to say "Please verify your email and mobile number from
          your Profile before submitting a permit application." Three things were
          wrong with it. The Profile screen has NO verification action — only two
          read-only badges. Nothing can send a verification email or an OTP,
          because nothing here sends anything. And the verified/pending status
          gates nothing anywhere in the app, so the instruction was not even a
          real precondition. It was a dead instruction pointing at a screen with
          no such control. Do not restore it without the control it names.
        -->
        <!--
          Rewritten 2026-09-20: sign-up now confirms the email address with a
          real code (step 2), so "not available yet" stopped being true. Mobile
          numbers are recorded and not verified, by decision — say so rather
          than imply a step the citizen should go looking for.
        -->
        <p class="small muted">
          If you confirmed the code sent to your email during sign-up, your address shows as
          Verified on your Profile. Your mobile number is kept on file and is not verified.
        </p>
        <a routerLink="/login" class="btn btn-primary btn-block" style="margin-top:12px;">Continue to Log In</a>
      </div>
    </div>
  `,
})
export class RegistrationSuccessPage {}
