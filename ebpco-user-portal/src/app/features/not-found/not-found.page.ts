import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/session/auth.service';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;">
      <div class="empty-state">
        <div class="anim-flip-in" style="margin:0 auto 20px;">
          <svg width="120" height="120" viewBox="0 0 120 120" class="anim-float" aria-hidden="true">
            <circle cx="60" cy="60" r="56" fill="var(--primary-50)" />
            <circle cx="60" cy="60" r="56" fill="none" stroke="var(--gold-border)" stroke-width="2" stroke-dasharray="4 6" />
            <path
              d="M44 40 h32 a4 4 0 0 1 4 4 v32 a4 4 0 0 1 -4 4 h-32 a4 4 0 0 1 -4 -4 v-32 a4 4 0 0 1 4 -4 Z"
              fill="#fff"
              stroke="var(--primary-500)"
              stroke-width="2.5"
            />
            <line x1="50" y1="52" x2="70" y2="52" stroke="var(--border-medium)" stroke-width="2.5" stroke-linecap="round" />
            <line x1="50" y1="60" x2="66" y2="60" stroke="var(--border-medium)" stroke-width="2.5" stroke-linecap="round" />
            <circle cx="60" cy="60" r="15" fill="var(--gold-500)" />
            <text x="60" y="66" text-anchor="middle" font-size="18" font-weight="800" fill="#fff" font-family="inherit">?</text>
          </svg>
        </div>
        <h1>Page not found</h1>
        <p class="muted">The page you're looking for doesn't exist.</p>
        <a [routerLink]="auth.isAuthenticated() ? '/dashboard' : '/landing'" class="btn btn-primary" style="margin-top:12px;">
          Back to Home
        </a>
      </div>
    </div>
  `,
})
export class NotFoundPage {
  protected readonly auth = inject(AuthService);
}
