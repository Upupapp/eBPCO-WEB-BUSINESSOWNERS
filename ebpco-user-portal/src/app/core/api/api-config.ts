import { InjectionToken } from '@angular/core';

/**
 * Where the eBPCO API lives.
 *
 * `null` means no API has been configured, and that is the value this build
 * ships with. It is not a placeholder to fill in with something plausible: the
 * Municipality's API host is theirs to give, exactly like the deposit account in
 * `payment.model.ts` and the office hours in `lgu-contact.ts`. A guessed host is
 * worse than none — it fails at runtime, in the citizen's browser, with an error
 * that looks like the portal being broken rather than unconfigured.
 *
 * `CitizenApiClient` refuses to issue a request while this is null and says so,
 * rather than quietly resolving to nothing.
 */
export const API_BASE_URL = new InjectionToken<string | null>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => null,
});

/** Thrown rather than returned: an unconfigured API is a deployment fault, not a citizen-facing state. */
export class ApiNotConfiguredError extends Error {
  constructor() {
    super('No API base URL is configured for this build, so no request was sent.');
    this.name = 'ApiNotConfiguredError';
  }
}

/**
 * The largest FILE a resubmission may carry, in bytes.
 *
 * This is a client-side echo of a SERVER configuration value, so it is a token
 * rather than a constant. The backend measured it (C-8, 740b92c): the Fastify
 * adapter's `bodyLimit` is `BODY_LIMIT_BYTES`, 1MB by default, and base64
 * inflates by about a third — "a ~400KB PDF is accepted 201; a ~900KB PDF is
 * refused 413 with nothing stored". Hence ~750KB.
 *
 * **`BODY_LIMIT_BYTES` is deliberately configurable and the backend has filed
 * that it needs raising for production**, to whatever the LGU's real plan scans
 * are. A hardcoded 750,000 here would then refuse files the server would accept
 * — a client-side copy of someone else's setting, which is the same defect as
 * keeping our own copy of the permit vocabulary or the reason catalogue.
 *
 * So: this is an OPTIMISTIC PRE-CHECK, to save a citizen spending an upload on
 * a file that cannot land. **The server's 413 is the authority**, and the client
 * must handle it whatever this value says.
 */
export const RESUBMIT_MAX_FILE_BYTES = new InjectionToken<number>('RESUBMIT_MAX_FILE_BYTES', {
  providedIn: 'root',
  factory: () => 750_000,
});
