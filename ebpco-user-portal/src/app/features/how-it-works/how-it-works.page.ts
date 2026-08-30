import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ProcessStep {
  label: string;
  title: string;
  description: string;
}

// Six steps, drawn straight from the same ApplicantStatus vocabulary
// every application-tracking screen in this portal already uses
// (core/domain/status.model.ts) — this page never invents its own stage
// names, it just explains the ones an applicant will actually see.
const STEPS: ProcessStep[] = [
  {
    label: 'Draft',
    title: 'Register & start your application',
    description: 'Create your account, register your business, and choose the permit type you need. You can save your application as a draft and finish it later.',
  },
  {
    label: 'Submitted',
    title: 'Submit your application',
    description: 'Upload the required documents for your permit type and submit. Your application is logged and queued for review.',
  },
  {
    label: 'Under Review',
    title: 'Document & technical evaluation',
    description: 'Your documents are checked for completeness, then evaluated by the relevant office — Zoning, Fire Safety, and/or the Office of the Building Official, depending on your permit type.',
  },
  {
    label: 'Payment Verification',
    title: 'Assessment & payment',
    description: 'Once evaluation passes, you’ll receive an Order of Payment. Pay by bank transfer or onsite, then your payment is verified by the collecting office.',
  },
  {
    label: 'Approved',
    title: 'Approval & permit generation',
    description: 'With evaluation and payment complete, your application is approved and your permit or clearance is generated.',
  },
  {
    label: 'Ready for Release',
    title: 'Release',
    description: 'Your permit is ready for release. Visit the issuing office or check your application for pickup instructions.',
  },
];

@Component({
  selector: 'app-how-it-works',
  imports: [RouterLink],
  template: `
    <div style="min-height:100vh; display:flex; flex-direction:column;">
      <header style="display:flex; align-items:center; justify-content:space-between; padding:18px 32px; background:#fff; border-bottom:1px solid var(--border-light);">
        <a routerLink="/landing" style="display:flex; align-items:center; gap:10px; text-decoration:none; color:inherit;">
          <img src="logo.png" alt="eBPCO" style="width:34px; height:34px; object-fit:contain;" />
          <strong style="font-size:16px;">eBPCO User Portal</strong>
        </a>
        <div style="display:flex; gap:10px;">
          <a routerLink="/login" class="btn btn-secondary">Log In</a>
          <a routerLink="/register" class="btn btn-primary">Register</a>
        </div>
      </header>
      <div class="accent-bar"></div>

      <section class="page" style="max-width:840px; flex:1;">
        <div class="anim-fade-rise" style="text-align:center; margin-bottom:32px;">
          <h1 style="margin-bottom:8px;">How eBPCO Works</h1>
          <p class="muted" style="font-size:16px;">
            From registration to permit release — here's what to expect at every step.
          </p>
        </div>

        <div style="display:flex; flex-direction:column; gap:16px;">
          @for (step of steps; track step.label; let i = $index) {
            <div class="card anim-fade-rise" style="display:flex; gap:16px; align-items:flex-start;" [style.animation-delay]="i * 0.08 + 's'">
              <div class="hiw-step-number anim-flip-in" [style.animation-delay]="i * 0.08 + 0.1 + 's'">{{ i + 1 }}</div>
              <div style="flex:1;">
                <div class="badge badge-gold" style="margin-bottom:6px;">{{ step.label }}</div>
                <h3 style="margin-bottom:4px;">{{ step.title }}</h3>
                <p class="muted small" style="margin:0;">{{ step.description }}</p>
              </div>
            </div>
          }
        </div>

        <div class="card" style="margin-top:24px; background:var(--info-100); border:none;">
          <p class="small" style="color:var(--info-text); margin:0;">
            <strong>If revision is needed:</strong> your application may be sent back with remarks at the
            Document/Under Review stage — just address the requested items and resubmit. No need to start over.
          </p>
        </div>

        <div style="display:flex; gap:12px; justify-content:center; margin-top:32px; flex-wrap:wrap;">
          <a routerLink="/register" class="btn btn-primary">Get Started</a>
          <a routerLink="/login" class="btn btn-secondary">I already have an account</a>
        </div>
      </section>
    </div>
  `,
})
export class HowItWorksPage {
  readonly steps = STEPS;
}
