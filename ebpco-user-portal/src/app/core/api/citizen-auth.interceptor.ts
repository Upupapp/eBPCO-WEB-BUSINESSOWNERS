import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from './api-config';

/**
 * Attaches the citizen bearer token. All three citizen endpoints require one.
 *
 * There is nothing to attach yet: this build's authentication is in-memory and
 * mints no token (`auth.service.ts`). This deliberately sends NO Authorization
 * header rather than a placeholder — a fake bearer would turn "we have no
 * session" into a 401 that looks like the citizen's credentials being rejected.
 *
 * ONLY same-origin-with-the-API requests are touched. A token must never ride
 * along to a third party, and the portal has no third-party hosts precisely so
 * that nothing leaks (see scripts/check-no-third-party-assets.mjs).
 */
export const citizenAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  if (!base || !req.url.startsWith(base)) return next(req);

  const token = readCitizenToken();
  if (!token) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

/**
 * Where the token will come from once a real sign-in exists. Returns null
 * today, and that is honest: this build has no token to send.
 */
function readCitizenToken(): string | null {
  return null;
}
