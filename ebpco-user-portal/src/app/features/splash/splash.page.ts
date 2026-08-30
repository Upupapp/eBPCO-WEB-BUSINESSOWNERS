import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/session/auth.service';
import { OnboardingService } from '../../core/session/onboarding.service';

// Long enough to actually see the entrance sequence play out (logo flip →
// title → subtitle → spinner, ~1.1s) plus a comfortable brand-moment hold
// before handing off — short splash durations that cut the animation off
// mid-flight read as broken, not fast.
const SPLASH_DURATION_MS = 2600;

@Component({
  selector: 'app-splash',
  template: `
    <div class="splash-shell">
      <div class="splash-glow"></div>
      <div class="splash-dots" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>

      <div class="anim-flip-in splash-badge">
        <img src="logo.png" alt="eBPCO" style="width:46px; height:46px; object-fit:contain;" />
      </div>
      <div class="anim-fade-rise" style="text-align:center; animation-delay:0.3s;">
        <h1 style="color:#fff; margin-bottom:4px; letter-spacing:0.02em;">eBPCO</h1>
        <p style="color:rgba(255,255,255,.75); margin:0;">Permits and clearances, simplified.</p>
      </div>
      <div class="anim-fade-rise" style="animation-delay:0.55s;">
        <div class="splash-spinner"></div>
      </div>

      <div class="splash-progress-track anim-fade-rise" style="animation-delay:0.7s;">
        <div class="splash-progress-fill" [style.animation-duration]="progressDurationMs + 'ms'"></div>
      </div>
    </div>
  `,
  styles: [`
    .splash-shell {
      position: relative;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: var(--primary-500);
      overflow: hidden;
    }

    .splash-glow {
      position: absolute;
      inset: -20%;
      background:
        radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.16), transparent 55%),
        radial-gradient(circle at 75% 70%, rgba(255, 210, 120, 0.18), transparent 50%);
      animation: splash-glow-shift 6s ease-in-out infinite;
      pointer-events: none;
    }

    @keyframes splash-glow-shift {
      0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.9; }
      50% { transform: translate(3%, -3%) scale(1.08); opacity: 1; }
    }

    .splash-dots {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .splash-dots span {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.35);
      animation: splash-dot-float 5s ease-in-out infinite;
    }
    .splash-dots span:nth-child(1) { top: 18%; left: 20%; animation-delay: 0s; }
    .splash-dots span:nth-child(2) { top: 28%; left: 78%; animation-delay: 0.6s; background: rgba(255, 210, 120, 0.55); }
    .splash-dots span:nth-child(3) { top: 68%; left: 15%; animation-delay: 1.1s; }
    .splash-dots span:nth-child(4) { top: 76%; left: 82%; animation-delay: 1.6s; background: rgba(255, 210, 120, 0.45); }
    .splash-dots span:nth-child(5) { top: 12%; left: 55%; animation-delay: 2s; }
    .splash-dots span:nth-child(6) { top: 85%; left: 48%; animation-delay: 0.3s; background: rgba(255, 210, 120, 0.4); }

    @keyframes splash-dot-float {
      0%, 100% { transform: translateY(0) scale(1); opacity: 0.5; }
      50% { transform: translateY(-18px) scale(1.4); opacity: 1; }
    }

    .splash-badge {
      position: relative;
      z-index: 1;
      width: 76px;
      height: 76px;
      border-radius: 50%;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-md);
      animation: flip-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both, splash-breathe 2.4s ease-in-out 0.9s infinite;
    }

    @keyframes splash-breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.06); }
    }

    .splash-progress-track {
      position: relative;
      z-index: 1;
      width: 140px;
      height: 3px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.25);
      overflow: hidden;
      margin-top: 4px;
    }
    .splash-progress-fill {
      height: 100%;
      width: 0%;
      background: #fff;
      border-radius: 999px;
      animation-name: splash-progress;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }
    @keyframes splash-progress {
      from { width: 0%; }
      to { width: 100%; }
    }

    @media (prefers-reduced-motion: reduce) {
      .splash-badge { animation: none; }
    }
  `],
})
export class SplashPage implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(OnboardingService);

  // The progress bar's own fill duration mirrors the real wait, minus the
  // lead-in delay it starts at, so it genuinely finishes filling right as
  // the splash hands off — not a decorative loop unrelated to the timer.
  protected readonly progressDurationMs = SPLASH_DURATION_MS - 700;

  ngOnInit(): void {
    setTimeout(() => this.proceed(), SPLASH_DURATION_MS);
  }

  private proceed(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    } else if (!this.onboarding.isCompleted()) {
      this.router.navigate(['/onboarding']);
    } else {
      this.router.navigate(['/landing']);
    }
  }
}
