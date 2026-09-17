import { __decorate } from "tslib";
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingService } from '../../core/session/onboarding.service';
let OnboardingPage = class OnboardingPage {
    router = inject(Router);
    onboarding = inject(OnboardingService);
    slides = [
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
    index = signal(0);
    isLast = computed(() => this.index() === this.slides.length - 1);
    next() {
        this.index.update((i) => Math.min(i + 1, this.slides.length - 1));
    }
    finish() {
        this.onboarding.markCompleted();
        this.router.navigate(['/landing']);
    }
};
OnboardingPage = __decorate([
    Component({
        selector: 'app-onboarding',
        templateUrl: './onboarding.page.html',
        styleUrl: './onboarding.page.scss',
    })
], OnboardingPage);
export { OnboardingPage };
