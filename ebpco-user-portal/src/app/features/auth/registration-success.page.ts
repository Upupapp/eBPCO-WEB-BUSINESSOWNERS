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
        <p class="muted">
          Your account has been created in this demonstration build. It exists in your browser only
          and is gone when you close or refresh the page.
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
        <p class="small muted">
          Email and mobile verification are not available yet, so your account shows as pending. That
          does not block anything in this build.
        </p>
        <a routerLink="/login" class="btn btn-primary btn-block" style="margin-top:12px;">Continue to Log In</a>
      </div>
    </div>
  `,
})
export class RegistrationSuccessPage {}
