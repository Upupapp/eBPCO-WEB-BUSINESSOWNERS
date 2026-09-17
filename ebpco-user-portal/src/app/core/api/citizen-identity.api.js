import { __decorate } from "tslib";
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL, ApiNotConfiguredError } from './api-config';
import { ApiError, problemFrom } from './problem';
import { CitizenTokenStore } from './citizen-token-store';
let CitizenIdentityApi = class CitizenIdentityApi {
    http = inject(HttpClient);
    baseUrl = inject(API_BASE_URL);
    tokens = inject(CitizenTokenStore);
    async signIn(email, password) {
        const issued = await this.post('/auth/token', {
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
    async register(input) {
        await this.post('/auth/register', input);
    }
    me() {
        return this.get('/me');
    }
    async signOut() {
        const refresh = this.tokens.refreshToken();
        try {
            // Best effort — matches the Admin Portal's identity.api.ts: the server
            // revoking the session is what makes signing out mean something to a
            // token already issued, but a citizen closing a tab on a flaky
            // connection must not be left signed in locally because the request
            // failed.
            if (refresh !== null)
                await this.post('/auth/revoke', { refreshToken: refresh });
        }
        catch {
            // Deliberately ignored; the local clear below is what the citizen sees.
        }
        finally {
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
    async requestPasswordReset(email) {
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
    async resetPassword(token, password) {
        try {
            await this.post('/auth/password/reset', { token, password });
            return { kind: 'done' };
        }
        catch (error) {
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
    async get(path) {
        if (this.baseUrl === null)
            throw new ApiNotConfiguredError();
        try {
            return await firstValueFrom(this.http.get(`${this.baseUrl}${path}`));
        }
        catch (e) {
            throw this.toApiError(e);
        }
    }
    async post(path, body = {}) {
        if (this.baseUrl === null)
            throw new ApiNotConfiguredError();
        try {
            return await firstValueFrom(this.http.post(`${this.baseUrl}${path}`, body));
        }
        catch (e) {
            throw this.toApiError(e);
        }
    }
    toApiError(e) {
        if (e instanceof HttpErrorResponse)
            return problemFrom(e.error, e.status);
        return e;
    }
};
CitizenIdentityApi = __decorate([
    Injectable({ providedIn: 'root' })
], CitizenIdentityApi);
export { CitizenIdentityApi };
