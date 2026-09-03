import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/session/auth.service';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { provideHttpClient } from '@angular/common/http';

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
 */
describe('PUB-007 — a password reset cannot be faked', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  });
  afterEach(() => TestBed.resetTestingModule());

  const flatten = (rs: readonly Route[]): Route[] =>
    rs.flatMap((r) => [r, ...(r.children ? flatten(r.children) : [])]);

  const resetRoutes = () =>
    flatten(routes).filter((r) => /reset|recover/i.test(r.path ?? ''));

  it('a reset route may exist ONLY once something can verify a reset token', () => {
    if (resetRoutes().length === 0) return; // nothing to guard yet — the state today

    const api = TestBed.inject(CitizenApiClient) as unknown as Record<string, unknown>;
    const verifies = Object.getOwnPropertyNames(Object.getPrototypeOf(api))
      .some((m) => /reset|recover|verifyToken/i.test(m));
    expect(verifies).toBe(true);
    // If this fails: a reset screen was added with no server operation behind
    // it. Whoever opens that URL can set the password. Remove the route, or
    // add the verified server call it needs.
  });

  it('AuthService offers no way to set a password without proving who you are', () => {
    const proto = Object.getPrototypeOf(TestBed.inject(AuthService));
    const setters = Object.getOwnPropertyNames(proto).filter((m) => /password/i.test(m));

    // changePassword(currentPassword, newPassword) is safe: it demands the
    // password the account already has. Anything else taking only a new
    // password would be a reset with nothing verifying the requester.
    for (const name of setters) {
      const fn = proto[name] as (...a: unknown[]) => unknown;
      if (name === 'changePassword') {
        expect(fn.length).toBeGreaterThanOrEqual(2);
      } else {
        throw new Error(
          `AuthService.${name} sets a password and is not changePassword. ` +
            `If this is a reset, it must verify a server-issued token first.`,
        );
      }
    }
  });

  it('changePassword actually refuses a wrong current password', () => {
    const auth = TestBed.inject(AuthService);
    auth.login('juan.delacruz@example.com', 'Password1');
    // Not a shape assertion: the guard has to BITE, or the two-argument check
    // above is satisfied by a method that ignores its first argument.
    expect(auth.changePassword('NotTheRightOne1', 'BrandNewPass1').ok).toBe(false);
    expect(auth.changePassword('Password1', 'BrandNewPass1').ok).toBe(true);
  });
});
