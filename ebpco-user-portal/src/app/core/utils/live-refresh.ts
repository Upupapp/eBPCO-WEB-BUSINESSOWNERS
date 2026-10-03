import { DestroyRef, Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { CitizenApiClient } from '../api/citizen-api.client';
import { AuthService } from '../session/auth.service';
import { ApplicationStore } from '../stores/application.store';
import { NotificationStore } from '../stores/notification.store';

/** How often an open portal checks for news on its own: once a minute. */
export const LIVE_REFRESH_INTERVAL_MS = 60_000;
/** Opening pages in quick succession refetches once, not once per click. */
export const LIVE_REFRESH_MIN_GAP_MS = 5_000;

/**
 * Keeps a signed-in citizen's applications and notifications current while
 * the portal stays open (QA finding TC-20, 2026-10-03).
 *
 * The stores fetched once, at sign-in. A citizen who kept the portal open
 * while the office worked saw "Submitted" and "You're all caught up" until
 * they reloaded the browser, and so missed that their application had been
 * returned for revision. Now every page they open refetches both, as does
 * coming back to the tab, and once a minute while it is open.
 */
@Injectable({ providedIn: 'root' })
export class LiveRefresh {
  private readonly auth = inject(AuthService);
  private readonly api = inject(CitizenApiClient);
  private readonly applications = inject(ApplicationStore);
  private readonly notifications = inject(NotificationStore);
  private lastRefreshAt = 0;

  constructor() {
    const router = inject(Router);
    const destroyRef = inject(DestroyRef);

    const navigations = router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.refresh());
    destroyRef.onDestroy(() => navigations.unsubscribe());

    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const timer = window.setInterval(() => this.refresh(), LIVE_REFRESH_INTERVAL_MS);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') this.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    destroyRef.onDestroy(() => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  /** Refetches both stores, unless signed out, unconfigured, or done moments ago. */
  refresh(now: number = Date.now()): void {
    if (!this.auth.isAuthenticated() || !this.api.configured) return;
    if (now - this.lastRefreshAt < LIVE_REFRESH_MIN_GAP_MS) return;
    this.lastRefreshAt = now;
    void this.applications.refreshMine();
    void this.notifications.refreshMine();
  }
}
