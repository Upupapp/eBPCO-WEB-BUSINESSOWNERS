import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL, ApiNotConfiguredError } from './api-config';
import { ApiError, problemFrom } from './problem';
import { CitizenTokenStore } from './citizen-token-store';
import { MeResponse } from './citizen-profile';

/**
 * Signing in, registering, and finding out who signed in — the citizen
 * equivalent of the Admin Portal's `identity.api.ts`.
 *
 * Sign-in and "who am I" are separate calls on purpose, same reasoning as
 * the Admin Portal: the token says the credentials were right, and `/me`
 * says what the account actually holds (kind, verification state, profile).
 */

export interface TokenResponse {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresIn?: number;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  password: string;
  /** Migration 038. Optional on the wire — omit rather than send '' for an unanswered one. */
  dateOfBirth?: string;
  sex?: string;
  civilStatus?: string;
  nationality?: string;
}

@Injectable({ providedIn: 'root' })
export class CitizenIdentityApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly tokens = inject(CitizenTokenStore);

  async signIn(email: string, password: string): Promise<MeResponse> {
    const issued = await this.post<TokenResponse>('/auth/token', {
      // Required by the API. Anything else is refused 400 with a pointer at
      // this field — see auth.controller.ts's `credentials` schema.
      grantType: 'password',
      email,
      password,
    });
    this.tokens.set({ accessToken: issued.accessToken, refreshToken: issued.refreshToken ?? null });
    return this.me();
  }

  /**
   * `POST /auth/register` — self-service applicant signup.
   *
   * `.strict()` on the server: the five original fields plus the four
   * migration-038 ones above, nothing more. Address (street/barangay/city/
   * province/postalCode) is still NOT collected here — the server has no
   * field for it at registration, only via `PATCH /me` — sending it would be
   * silently accepted and then refused for an unknown key.
   *
   * Always resolves 202 for a well-formed request, identically whether or
   * not the email is already registered — the server does not say, on
   * purpose (enumeration). A weak password IS reported, because that is the
   * caller's own input, not a fact about who else has an account.
   */
  async register(input: RegisterInput): Promise<void> {
    await this.post('/auth/register', input);
  }

  me(): Promise<MeResponse> {
    return this.get<MeResponse>('/me');
  }

  /**
   * `POST /auth/token/refresh` — trades the stored refresh token for a new
   * access/refresh pair.
   *
   * Not part of `citizen-auth.interceptor.ts`'s job (that interceptor's own
   * doc comment explains why it deliberately never refreshes reactively on a
   * 401 mid-request: queueing and replaying a write risks firing it twice).
   * This exists for `AuthService.restore()` instead — called once, at app
   * bootstrap, before any write is in flight, specifically so a citizen
   * whose 15-minute access token has simply expired since their last visit
   * is transparently signed back in rather than sent to `/login`, the same
   * way a still-valid refresh token is supposed to work.
   */
  async refresh(refreshToken: string): Promise<TokenResponse> {
    const issued = await this.post<TokenResponse>('/auth/token/refresh', { refreshToken });
    this.tokens.set({ accessToken: issued.accessToken, refreshToken: issued.refreshToken ?? null });
    return issued;
  }

  async signOut(): Promise<void> {
    const refresh = this.tokens.refreshToken();
    try {
      // Best effort — matches the Admin Portal's identity.api.ts: the server
      // revoking the session is what makes signing out mean something to a
      // token already issued, but a citizen closing a tab on a flaky
      // connection must not be left signed in locally because the request
      // failed.
      if (refresh !== null) await this.post('/auth/revoke', { refreshToken: refresh });
    } catch {
      // Deliberately ignored; the local clear below is what the citizen sees.
    } finally {
      this.tokens.clear();
    }
  }

  /**
   * Start account recovery.
   *
   * Always resolves — never throws for the address being unknown, because
   * the server answers 202 identically either way. See `IdentityApi`'s
   * identical method in the Admin Portal for the full reasoning.
   */
  async requestPasswordReset(email: string): Promise<void> {
    await this.post('/auth/password/forgot', { email });
  }

  /**
   * Finish account recovery with the token from the emailed link.
   *
   * Same disambiguation as the Admin Portal's `resetPassword`: both a weak
   * password and an invalid/expired/unknown link come back as a 400, and the
   * only way to tell them apart is whether the field error points at
   * `/password` (weak password, from the server's own policy) or `/token`
   * (malformed/reused link). Anything else re-throws.
   */
  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ kind: 'done' } | { kind: 'invalid-link' } | { kind: 'weak-password'; message: string }> {
    try {
      await this.post('/auth/password/reset', { token, password });
      return { kind: 'done' };
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        const passwordErrors = (error.problem?.fieldErrors ?? []).filter((e) => e.pointer === '/password');
        if (passwordErrors.length > 0) {
          return { kind: 'weak-password', message: passwordErrors.map((e) => e.message).join(' ') };
        }
        return { kind: 'invalid-link' };
      }
      throw error;
    }
  }

  private async get<T>(path: string): Promise<T> {
    if (this.baseUrl === null) throw new ApiNotConfiguredError();
    try {
      return await firstValueFrom(this.http.get<T>(`${this.baseUrl}${path}`));
    } catch (e) {
      throw this.toApiError(e);
    }
  }

  private async post<T>(path: string, body: unknown = {}): Promise<T> {
    if (this.baseUrl === null) throw new ApiNotConfiguredError();
    try {
      return await firstValueFrom(this.http.post<T>(`${this.baseUrl}${path}`, body));
    } catch (e) {
      throw this.toApiError(e);
    }
  }

  private toApiError(e: unknown): unknown {
    if (e instanceof HttpErrorResponse) return problemFrom(e.error, e.status);
    return e;
  }
}
