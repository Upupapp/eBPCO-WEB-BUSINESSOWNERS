import { Location } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/** Sign-in screens: a signed-in page never goes "back" into one of them. */
const SIGN_IN_PATHS = ['/', '/onboarding', '/login', '/forgot-password', '/reset-password', '/registration-success'];

const LABELS: ReadonlyArray<[RegExp, string]> = [
  [/^\/dashboard$/, 'Dashboard'],
  [/^\/businesses$/, 'My Businesses'],
  [/^\/businesses\/register$/, 'Register a Business'],
  [/^\/businesses\/[^/]+(\/edit)?$/, 'Business'],
  [/^\/permits$/, 'Permits'],
  [/^\/permits\/apply$/, 'Application Form'],
  [/^\/applications$/, 'My Applications'],
  [/^\/applications\/[^/]+\/permit$/, 'Permit'],
  [/^\/applications\/[^/]+$/, 'Application'],
  [/^\/documents$/, 'My Documents'],
  [/^\/payments$/, 'Payments'],
  [/^\/payments\/[^/]+\/receipt$/, 'Receipt'],
  [/^\/payments\/[^/]+$/, 'Payment'],
  [/^\/notifications$/, 'Notifications'],
  [/^\/profile$/, 'Profile'],
  [/^\/help$/, 'Help & Support'],
  [/^\/landing$/, 'Home'],
  [/^\/register$/, 'Registration'],
  [/^\/login$/, 'Log In'],
  [/^\/how-it-works$/, 'How It Works'],
  [/^\/verify(\/[^/]+)?$/, 'Permit Verification'],
];

/** A screen's name, from its URL; null for one this list does not know. */
export function screenLabel(url: string): string | null {
  const path = url.split(/[?#]/)[0];
  return LABELS.find(([pattern]) => pattern.test(path))?.[1] ?? null;
}

/**
 * The screens a citizen has passed through in this tab, so a Back link returns
 * to the one they came from (a notification, a business, the dashboard)
 * rather than to one fixed page.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHistory {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly entries = signal<readonly string[]>([]);

  readonly previous = computed(() => {
    const list = this.entries();
    return list.length >= 2 ? list[list.length - 2] : null;
  });

  constructor() {
    let trigger = 'imperative';
    let replace = false;
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        trigger = event.navigationTrigger ?? 'imperative';
        replace = this.router.getCurrentNavigation()?.extras.replaceUrl === true;
        return;
      }
      if (!(event instanceof NavigationEnd)) return;
      const url = event.urlAfterRedirects;
      this.entries.update((list) => {
        if (trigger === 'popstate') {
          const at = list.lastIndexOf(url);
          return at >= 0 ? list.slice(0, at + 1) : [url];
        }
        if (list[list.length - 1] === url) return list;
        if (replace && list.length > 0) return [...list.slice(0, -1), url];
        return [...list, url];
      });
    });
  }

  /**
   * The screen a Back link on a signed-in page returns to: the previous one,
   * unless that was a sign-in screen. A public page (the terms, opened from
   * registration) may return to any.
   */
  private target(publicPage: boolean): string | null {
    const url = this.previous();
    if (url === null) return null;
    const path = url.split(/[?#]/)[0];
    return !publicPage && SIGN_IN_PATHS.includes(path) ? null : url;
  }

  back(fallback: string, publicPage = false): void {
    if (this.target(publicPage) !== null) this.location.back();
    else void this.router.navigateByUrl(fallback);
  }

  label(fallback: string, publicPage = false): string {
    const url = this.target(publicPage);
    return url === null ? fallback : screenLabel(url) ?? fallback;
  }
}
