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
          <label>Email or Mobile Number</label>
          <input class="input" [(ngModel)]="identifier" placeholder="you@example.com" />
        </div>
        <div class="field">
          <label>Password</label>
          <input class="input" type="password" [(ngModel)]="password" placeholder="••••••••" />
        </div>

        @if (error()) {
          <div class="field error">{{ error() }}</div>
        }

        <button class="btn btn-primary btn-block" (click)="submit()">Log In</button>

        <div style="text-align:center; margin-top:14px;">
          <a routerLink="/forgot-password" class="small">Forgot password?</a>
        </div>
        <hr class="divider" />
        <div style="text-align:center;" class="small muted">
          Don't have an account? <a routerLink="/register">Register</a>
        </div>
        <div class="card" style="margin-top:16px; background:var(--info-100); border:none;">
          <p class="small" style="color:var(--info-text); margin:0;">Demo account — <strong>juan.delacruz&#64;example.com</strong> / <strong>Password1</strong></p>
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

  submit(): void {
    if (!this.identifier || !this.password) {
      this.error.set('Please enter your email/mobile number and password.');
      return;
    }
    const result = this.auth.login(this.identifier, this.password);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.error.set(null);
    this.router.navigate(['/dashboard']);
  }
}
