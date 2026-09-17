import { __decorate } from "tslib";
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CitizenApiClient } from './citizen-api.client';
/**
 * The real, live file-size ceiling, read from `GET /limits`.
 *
 * `RESUBMIT_MAX_FILE_BYTES` (api-config.ts) used to be the only source of
 * this number — a hardcoded 750,000, captured once at DI-resolution time,
 * with its own doc comment already admitting it would drift the moment the
 * server's `BODY_LIMIT_BYTES` changed. `GET /limits` exists precisely so a
 * client is never left holding a stale copy — this service is what actually
 * calls it, on a signal so every consumer sees the real number the moment it
 * loads rather than whatever was true when the app booted.
 *
 * Starts at the same 750,000 fallback `RESUBMIT_MAX_FILE_BYTES` always had,
 * and refreshes via `provideAppInitializer` in `app.config.ts` — fire-and-
 * forget, not blocking bootstrap the way session restore does, because a
 * few seconds of the old default costs nothing: **the server's 413 is still
 * the authority regardless of what this says**, this is only an optimistic
 * pre-check so a citizen is not made to wait for one.
 */
let UploadLimitsService = class UploadLimitsService {
    api = inject(CitizenApiClient);
    _maxFileBytes = signal(750_000);
    maxFileBytes = this._maxFileBytes.asReadonly();
    async refresh() {
        if (!this.api.configured)
            return;
        try {
            const limits = await firstValueFrom(this.api.getLimits());
            this._maxFileBytes.set(limits.upload.maxFileBytes);
        }
        catch {
            // Keep the fallback. See class doc — the server's own 413 still governs.
        }
    }
};
UploadLimitsService = __decorate([
    Injectable({ providedIn: 'root' })
], UploadLimitsService);
export { UploadLimitsService };
