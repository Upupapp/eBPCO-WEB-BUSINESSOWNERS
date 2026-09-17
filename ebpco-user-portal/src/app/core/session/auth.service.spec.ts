import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { CitizenIdentityApi } from '../api/citizen-identity.api';
import { CitizenTokenStore } from '../api/citizen-token-store';
import { FakeCitizenIdentityApi } from '../testing/fake-citizen-identity-api';

/**
 * `restore()` — the exact gap a real reload hit live.
 *
 * `hasSession()` is true the moment an access token string sits in
 * localStorage, whether or not the server still honours it: the access
 * token is real but short-lived (15 minutes server-side), so "a stored
 * token exists" and "that token still works" are different facts, and a
 * tab left open past that window is the ORDINARY case for a citizen
 * portal, not an edge one. Before this, `restore()` went straight to
 * `GET /me` with whatever access token survived the reload — which 401s
 * once it has expired — and read exactly like no session had ever
 * existed, even with a perfectly good refresh token sitting right there.
 */
describe('AuthService.restore()', () => {
  let auth: AuthService;
  let tokens: CitizenTokenStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CitizenIdentityApi, useClass: FakeCitizenIdentityApi },
      ],
    });
    auth = TestBed.inject(AuthService);
    tokens = TestBed.inject(CitizenTokenStore);
  });

  it('does nothing when there is no stored session at all', async () => {
    expect(auth.isAuthenticated()).toBe(false);

    await auth.restore();

    expect(auth.isAuthenticated()).toBe(false);
  });

  it('recovers a real session from an expired-looking access token, via the stored refresh token', async () => {
    // Simulates exactly the moment right after a reload: the tokens survive
    // in localStorage (real storage, not wiped by a reload), but nothing has
    // repopulated the in-memory profile signal yet — `isAuthenticated()`
    // reads that signal, not the storage.
    tokens.set({ accessToken: 'a-now-expired-access-token', refreshToken: 'fake-refresh-token' });
    expect(auth.isAuthenticated()).toBe(false);

    await auth.restore();

    expect(auth.isAuthenticated()).toBe(true);
  });

  it('signs out cleanly when the refresh token itself is no good', async () => {
    tokens.set({ accessToken: 'a-now-expired-access-token', refreshToken: 'a-revoked-refresh-token' });

    await auth.restore();

    expect(auth.isAuthenticated()).toBe(false);
  });
});
