import { InjectionToken } from '@angular/core';
/**
 * Where the eBPCO API lives.
 *
 * Read from `globalThis.EBPCO_API_BASE_URL`, set by public/config.js BEFORE
 * this bundle loads (see index.html) — same runtime-config pattern already
 * in production use by the Admin Portal (core/api/api.config.ts there).
 * '' means same-origin (the dev-server proxy / production redirect rules
 * forward the real paths — see proxy.conf.json).
 *
 * `null` means no API has been configured at all — config.js never ran, or
 * was edited to remove the assignment. It is not a placeholder to fill in
 * with something plausible: the Municipality's API host is theirs to give,
 * exactly like the deposit account in `payment.model.ts` and the office
 * hours in `lgu-contact.ts`. A guessed host is worse than none — it fails at
 * runtime, in the citizen's browser, with an error that looks like the
 * portal being broken rather than unconfigured.
 *
 * `CitizenApiClient` refuses to issue a request while this is null and says so,
 * rather than quietly resolving to nothing.
 */
export const API_BASE_URL = new InjectionToken('API_BASE_URL', {
    providedIn: 'root',
    factory: () => {
        const configured = globalThis.EBPCO_API_BASE_URL;
        return typeof configured === 'string' ? configured.replace(/\/$/, '') : null;
    },
});
/** Thrown rather than returned: an unconfigured API is a deployment fault, not a citizen-facing state. */
export class ApiNotConfiguredError extends Error {
    constructor() {
        super('No API base URL is configured for this build, so no request was sent.');
        this.name = 'ApiNotConfiguredError';
    }
}
/**
 * The largest FILE a resubmission may carry, in bytes — the BUILD-TIME
 * default only.
 *
 * `UploadLimitsService` is now the primary, LIVE source of this number: it
 * calls the real `GET /limits` at app startup and holds the answer on a
 * signal, so `DocumentResubmissionService` and friends see the server's
 * actual, current ceiling rather than a value frozen at DI-resolution time.
 * This token still exists as that service's own starting default before the
 * real fetch resolves, and as a convenient thing for a test to override —
 * but nothing reads it as the live limit anymore.
 *
 * The backend measured the original 750,000 (C-8, 740b92c): the Fastify
 * adapter's `bodyLimit` is `BODY_LIMIT_BYTES`, 1MB by default, and base64
 * inflates by about a third — "a ~400KB PDF is accepted 201; a ~900KB PDF is
 * refused 413 with nothing stored". **`BODY_LIMIT_BYTES` is deliberately
 * configurable and the backend has filed that it needs raising for
 * production** — which is exactly the drift `UploadLimitsService` closes: a
 * hardcoded number here would refuse files the server would accept the
 * moment that config changes, same defect as keeping a client-side copy of
 * the permit vocabulary or the reason catalogue.
 *
 * Either way this is an OPTIMISTIC PRE-CHECK, to save a citizen spending an
 * upload on a file that cannot land. **The server's 413 is the authority**,
 * and the client must handle it whatever either value says.
 */
export const RESUBMIT_MAX_FILE_BYTES = new InjectionToken('RESUBMIT_MAX_FILE_BYTES', {
    providedIn: 'root',
    factory: () => 750_000,
});
