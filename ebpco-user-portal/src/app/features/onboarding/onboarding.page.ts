import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingService } from '../../core/session/onboarding.service';

interface OnboardingSlide {
  /** First heading line (dark ink). Concatenated with titleAccent this is the same copy the page always had — split in two only for typographic emphasis. */
  titleLine1: string;
  /** Second heading line (Castilla-red accent). */
  titleAccent: string;
  body: string;
}

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss',
})
export class OnboardingPage {
  private readonly router = inject(Router);
  private readonly onboarding = inject(OnboardingService);

  readonly slides: OnboardingSlide[] = [
    {
      titleLine1: 'Apply for permits',
      titleAccent: 'from your phone',
      body: 'Submit new, renewal, and amendment permit applications through a simple mobile process.',
    },
    {
      titleLine1: 'Submit and manage',
      titleAccent: 'requirements',
      body: 'Review required documents and prepare your permit application in one place.',
    },
    {
      titleLine1: 'Track your',
      titleAccent: 'application',
      body: 'Monitor evaluations, payments, approval, and permit release status.',
    },
  ];

  readonly index = signal(0);
  readonly isLast = computed(() => this.index() === this.slides.length - 1);

  next(): void {
    this.index.update((i) => Math.min(i + 1, this.slides.length - 1));
  }

  finish(): void {
    this.onboarding.markCompleted();
    this.router.navigate(['/landing']);
  }
}
