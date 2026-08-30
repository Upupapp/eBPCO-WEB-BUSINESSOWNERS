import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink],
  template: `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;">
      <div class="card auth-card anim-pop-in" style="width:100%; max-width:400px;">
        @if (!sent()) {
          <h2>Forgot Password</h2>
          <p class="muted small" style="margin-bottom:16px;">Enter your account email and we'll send you a reset link.</p>
          <div class="field">
            <label>Email Address</label>
            <input class="input" type="email" [(ngModel)]="email" placeholder="you@example.com" />
          </div>
          <button class="btn btn-primary btn-block" [disabled]="!email" (click)="sent.set(true)">Send Reset Link</button>
        } @else {
          <div style="text-align:center;">
            <h2>Check your email</h2>
            <p class="muted small">If an account exists for <strong>{{ email }}</strong>, a password reset link has been sent.</p>
          </div>
        }
        <div style="text-align:center; margin-top:16px;">
          <a routerLink="/login" class="small">Back to Log In</a>
        </div>
      </div>
    </div>
  `,
})
export class ForgotPasswordPage {
  email = '';
  readonly sent = signal(false);
}
