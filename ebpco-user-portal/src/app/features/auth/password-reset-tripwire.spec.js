import { TestBed } from '@angular/core/testing';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/session/auth.service';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
 * `CitizenApiClient` (which never held it). `AuthService.changePassword()`
 * went the other direction: it used to take a current password and verify
 * it locally against the in-memory mock; the real backend has no
 * "change password while signed in" route at all, only the forgot/reset
 * flow, so it now takes NO arguments and always refuses — an even stronger
 * guarantee than before, since there is no argument shape left to get
 * wrong. `app.routes.ts` has no reset route yet (that is Stage 11 of the
 * connection plan), so the first test's early return still applies today.
 */
describe('PUB-007 — a password reset cannot be faked', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    });
    afterEach(() => TestBed.resetTestingModule());
    const flatten = (rs) => rs.flatMap((r) => [r, ...(r.children ? flatten(r.children) : [])]);
    const resetRoutes = () => flatten(routes).filter((r) => /reset|recover/i.test(r.path ?? ''));
    it('a reset route may exist ONLY once something can verify a reset token', () => {
        if (resetRoutes().length === 0)
            return; // nothing to guard yet — the state today
        const api = TestBed.inject(CitizenIdentityApi);
        const verifies = Object.getOwnPropertyNames(Object.getPrototypeOf(api))
            .some((m) => /reset|recover|verifyToken/i.test(m));
        expect(verifies).toBe(true);
        // If this fails: a reset screen was added with no server operation behind
        // it. Whoever opens that URL can set the password. Remove the route, or
        // add the verified server call it needs.
    });
    it('AuthService offers no local way to set a password at all', () => {
        const proto = Object.getPrototypeOf(TestBed.inject(AuthService));
        const setters = Object.getOwnPropertyNames(proto).filter((m) => /password/i.test(m));
        // changePassword() takes zero arguments and always refuses — see its own
        // doc comment. Anything else matching /password/ that is not it, or that
        // is it but accepts arguments, would be a local password-set path with
        // nothing verifying the requester.
        for (const name of setters) {
            if (name !== 'changePassword') {
                throw new Error(`AuthService.${name} sets a password and is not changePassword. ` +
                    `If this is a reset, it must verify a server-issued token first.`);
            }
            const fn = proto[name];
            expect(fn.length).toBe(0);
        }
    });
    it('changePassword always refuses — the real reset path is CitizenIdentityApi.resetPassword', () => {
        const auth = TestBed.inject(AuthService);
        expect(auth.changePassword().ok).toBe(false);
    });
});
