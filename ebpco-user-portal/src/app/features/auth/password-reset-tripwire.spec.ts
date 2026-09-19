import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/session/auth.service';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { API_BASE_URL } from '../../core/api/api-config';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

const BASE = 'https://api.example.gov.ph';

/**
 * PUB-007 Reset Password — a tripwire, not a screen.
 *
 * The Screen Inventory lists a Reset Password screen and this portal
 * deliberately does not have one. It cannot have an honest one yet: nothing
 * issues a reset token, so any screen that accepted a new password would be
 * setting it on the say-so of whoever opened the URL. That is not an
 * unfinished feature, it is an account-takeover route with a friendly form on
 * top — and it is the same deception F-5 removed from Forgot Password, where a
 * screen reported that a reset link had been sent and nothing had been sent.
 *
 * The danger is that PUB-007 sits on a task list looking like ordinary missing
 * work. Someone reads "build the reset screen", wires it to whatever password
 * setter is nearest, and ships an account takeover in good faith. These tests
 * exist so that the moment a reset route appears, the suite demands the
 * verification that makes it safe.
 *
 * Delete these tests only together with the reason for them.
 *
 * Updated once real auth landed (`CitizenIdentityApi`, `AuthService`): a
 * server-issued, token-verified reset path now genuinely exists —
 * `POST /auth/password/forgot` then `POST /auth/password/reset`, wired as
 * `CitizenIdentityApi.requestPasswordReset`/`resetPassword` — so the first
 * test below now looks for it on `CitizenIdentityApi`, not
 * `CitizenApiClient` (which never held it). `app.routes.ts` has no reset
 * route yet (that is Stage 11 of the connection plan), so the first test's
 * early return still applies today.
 *
 * Updated AGAIN once `POST /auth/password/change` landed:
 * `AuthService.changePassword()` now takes a current password and a new one
 * and sends both to the server, which verifies the current one
 * (`IdentityService.changePassword`, scrypt-comparing it against the stored
 * hash) before touching anything. That is not the local, unverified setter
 * this file exists to catch — it is the SAME shape as `resetPassword`'s own
 * verified change, just verified by a password already in hand instead of a
 * mailed token. What the last two tests below now check is that shape: the
 * method's own signature requires a current password (nothing shorter would
 * compile), and a real HTTP round trip proves the server is what decides,
 * not this client.
 */
describe('PUB-007 — a password reset cannot be faked', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: BASE }],
    });
  });
  afterEach(() => TestBed.resetTestingModule());

  const flatten = (rs: readonly Route[]): Route[] =>
    rs.flatMap((r) => [r, ...(r.children ? flatten(r.children) : [])]);

  const resetRoutes = () =>
    flatten(routes).filter((r) => /reset|recover/i.test(r.path ?? ''));

  it('a reset route may exist ONLY once something can verify a reset token', () => {
    if (resetRoutes().length === 0) return; // nothing to guard yet — the state today

    const api = TestBed.inject(CitizenIdentityApi) as unknown as Record<string, unknown>;
    const verifies = Object.getOwnPropertyNames(Object.getPrototypeOf(api))
      .some((m) => /reset|recover|verifyToken/i.test(m));
    expect(verifies).toBe(true);
    // If this fails: a reset screen was added with no server operation behind
    // it. Whoever opens that URL can set the password. Remove the route, or
    // add the verified server call it needs.
  });

  it('AuthService offers no local way to set a password without one already in hand', () => {
    const proto = Object.getPrototypeOf(TestBed.inject(AuthService));
    const setters = Object.getOwnPropertyNames(proto).filter((m) => /password/i.test(m));

    // changePassword(currentPassword, newPassword) — two arguments, not
    // zero. That is the point now: a method that set a password with FEWER
    // than a current-password argument would be the local, unverified path
    // this file exists to catch. Anything else matching /password/ that is
    // not it would be a second such path.
    for (const name of setters) {
      if (name !== 'changePassword') {
        throw new Error(
          `AuthService.${name} sets a password and is not changePassword. ` +
            `If this is a reset, it must verify a server-issued token first.`,
        );
      }
      const fn = proto[name] as (...a: unknown[]) => unknown;
      expect(fn.length).toBe(2);
    }
  });

  it('changePassword sends the current password for the SERVER to verify, and trusts only its answer', () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);

    const result = auth.changePassword('whatever the citizen typed', 'A new one entirely!2');
    const req = http.expectOne(`${BASE}/auth/password/change`);
    expect(req.request.method).toBe('POST');
    // Both, always — this client never decides on its own that a change is
    // acceptable. A request that omitted `currentPassword` would be exactly
    // the unverified setter this file exists to catch.
    expect(req.request.body).toEqual({
      currentPassword: 'whatever the citizen typed',
      newPassword: 'A new one entirely!2',
    });

    // The server, not this client, is what refuses a wrong current password.
    req.flush({ type: '/problems/unauthorized', title: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    return result.then((r) => expect(r.ok).toBe(false));
  });
});
