/**
 * Runtime configuration for the eBPCO Citizen Portal.
 *
 * GENERATED at build time by scripts/write-runtime-config.mjs, from
 * EBPCO_API_BASE_URL in the build environment — do not hand-edit this file;
 * edit that variable (in Netlify's UI, or wherever this build actually
 * runs) and rebuild instead. Empty means the variable was not set, which is
 * a real, honestly-degraded state (see the script's own doc comment), not a
 * mistake.
 *
 * Loaded from index.html BEFORE the application bundle, so
 * `API_BASE_URL`'s factory (core/api/api-config.ts) sees this value when it
 * first resolves. `CitizenApiClient` treats '' as "not configured" and
 * refuses to send a request rather than guessing — see the
 * ApiNotConfiguredError doc comment in api-config.ts.
 */
globalThis.EBPCO_API_BASE_URL = "";
