import { __decorate } from "tslib";
import { Injectable, signal } from '@angular/core';
const STORAGE_KEY = 'ebpco-user-portal.onboarding-completed';
let OnboardingService = class OnboardingService {
    completed = signal(this.readFlag());
    isCompleted = this.completed.asReadonly();
    markCompleted() {
        this.completed.set(true);
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        }
        catch {
            // localStorage unavailable (private browsing, etc.) — flag still works for this tab via the signal.
        }
    }
    readFlag() {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1';
        }
        catch {
            return false;
        }
    }
};
OnboardingService = __decorate([
    Injectable({ providedIn: 'root' })
], OnboardingService);
export { OnboardingService };
