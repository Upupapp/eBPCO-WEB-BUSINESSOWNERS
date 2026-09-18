import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/session/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;">
      <div class="card auth-card anim-pop-in" style="width:100%; max-width:400px;">
        <div style="text-align:center; margin-bottom:20px;">
          <img src="logo.png" alt="eBPCO" style="width:48px; height:48px; object-fit:contain; margin-bottom:8px;" />
          <h2>Log In</h2>
          <p class="muted small">Sign in to your eBPCO account</p>
        </div>

        <div class="field">
          <label for="login-email-or-mobile-1">Email or Mobile Number</label>
          <input id="login-email-or-mobile-1" class="input" [(ngModel)]="identifier" placeholder="you@example.com" />
        </div>
        <div class="field">
          <label for="login-password-2">Password</label>
          <div class="password-field">
            <input id="login-password-2" class="input" [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" placeholder="••••••••" />
            <button type="button" class="password-toggle" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
              @if (showPassword()) {
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
            </button>
          </div>
        </div>

        @if (error()) {
          <div class="field error">{{ error() }}</div>
        }

        <button class="btn btn-primary btn-block" [disabled]="submitting()" (click)="submit()">
          {{ submitting() ? 'Signing in' : 'Log In' }}
        </button>

        <div style="text-align:center; margin-top:14px;">
          <a routerLink="/forgot-password" class="small">Forgot password?</a>
        </div>
        <hr class="divider" />
        <div style="text-align:center;" class="small muted">
          Don't have an account? <a routerLink="/register">Register</a>
        </div>
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  identifier = '';
  password = '';
  readonly error = signal<string | null>(null);
  readonly showPassword = signal(false);

  readonly submitting = signal(false);

  async submit(): Promise<void> {
    if (!this.identifier && !this.password) {
      this.error.set('Please enter your email/mobile number and password.');
      return;
    }
    if (!this.identifier) {
      this.error.set('Please enter your email or mobile number.');
      return;
    }
    if (!this.password) {
      this.error.set('Please enter your password.');
      return;
    }
    this.submitting.set(true);
    try {
      const result = await this.auth.login(this.identifier, this.password);
      if (!result.ok) {
        this.error.set(result.error);
        return;
      }
      this.error.set(null);
      this.router.navigate(['/dashboard']);
    } finally {
      this.submitting.set(false);
    }
  }
}
