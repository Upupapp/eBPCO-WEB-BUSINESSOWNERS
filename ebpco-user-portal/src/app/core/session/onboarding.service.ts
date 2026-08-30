import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'ebpco-user-portal.onboarding-completed';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly completed = signal(this.readFlag());

  readonly isCompleted = this.completed.asReadonly();

  markCompleted(): void {
    this.completed.set(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // localStorage unavailable (private browsing, etc.) — flag still works for this tab via the signal.
    }
  }

  private readFlag(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
