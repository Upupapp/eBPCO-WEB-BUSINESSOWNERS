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
