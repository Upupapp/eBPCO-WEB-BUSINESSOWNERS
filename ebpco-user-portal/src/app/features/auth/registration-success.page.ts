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
          Your account has been created. Please verify your email and mobile number from your
          Profile before submitting a permit application.
        </p>
        <a routerLink="/login" class="btn btn-primary btn-block" style="margin-top:12px;">Continue to Log In</a>
      </div>
    </div>
  `,
})
export class RegistrationSuccessPage {}
