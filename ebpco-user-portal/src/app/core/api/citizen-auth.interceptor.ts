import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { CitizenTokenStore } from './citizen-token-store';
import { AuthService } from '../session/auth.service';

/**
 * Attaches the citizen bearer token, and clears the session on a real 401.
 *
 * ── Only same-origin-with-the-API requests are touched ──────────────────
 *
 * A token must never ride along to a third party, and the portal has no
 * third-party hosts precisely so that nothing leaks (see
 * scripts/check-no-third-party-assets.mjs).
 *
 * `base === null`, not a truthiness check: '' is a real, configured value
 * meaning same-origin (see api-config.ts), and `!''` is true in
 * JavaScript. The original guard here (`!base`) treated the normal
 * same-origin dev/production case as unconfigured, so the token was never
 * attached to any request once config.js actually set
 * EBPCO_API_BASE_URL = '' — caught wiring this against a live proxy for
 * the first time.
 *
 * ── What it deliberately does not do ────────────────────────────────────
 *
 * It does not silently refresh on 401 — same reasoning as the Admin
 * Portal's `auth.interceptor.ts`: a refresh interceptor has to queue and
 * replay requests, and getting that wrong risks a write (like a payment
 * submission) firing twice. Only a request that WAS carrying a token counts
 * as a session expiring; a 401 from an unauthenticated call (wrong password
 * at `/auth/token`) is a normal refusal on that screen, not a session to
 * tear down.
 */
export const citizenAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  if (base === null || !req.url.startsWith(base)) return next(req);

  const tokens = inject(CitizenTokenStore);
  const router = inject(Router);
  const auth = inject(AuthService);
  const token = tokens.access();

  const authorised = token === null
    ? req
    : req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  return next(authorised).pipe(
    catchError((error: unknown) => {
      // `POST /auth/password/change` is the one authenticated route where a
      // 401 does not mean the bearer token is bad — auth.controller.ts's own
      // `changePassword` deliberately answers 401 "That is not your current
      // password" on an otherwise-valid, authenticated request, because the
      // route separately verifies a second secret. Treating it the same as
      // every other 401 signed the citizen out and bounced them to
      // /login?reason=session-expired on a simple typo in their CURRENT
      // password, discarding profile.page.ts's own "show it on the form and
      // let them retry" handling before it ever ran (found live 2026-09-25).
      const isPasswordChange = req.url.endsWith('/auth/password/change');
      if (!isPasswordChange && token !== null && error instanceof HttpErrorResponse && error.status === 401) {
        // The API answers 401 for expired, revoked and disabled alike, on
        // purpose — from here they are all the same thing: this token no
        // longer works.
        tokens.clear();
        // Clearing the token store alone left `AuthService.isAuthenticated()`
        // reading stale, cached profile data — still true — so `guestGuard`
        // on the very /login this redirect targets bounced straight back to
        // /dashboard, as if nothing had happened. Caught live: filing a real
        // application when the access token expired mid-wizard.
        //
        // Injected at the TOP of this function (into `auth` above), not
        // here: `inject()` only works within Angular's injection context,
        // and this `catchError` callback runs later, outside it.
        auth.dropSession();
        if (!router.url.startsWith('/login')) {
          router.navigate(['/login'], { queryParams: { reason: 'session-expired' } });
        }
      }
      return throwError(() => error);
    }),
  );
};
