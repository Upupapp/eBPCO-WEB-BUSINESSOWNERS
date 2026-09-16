/**
 * Runtime configuration for the eBPCO Citizen Portal.
 *
 * Loaded from index.html BEFORE the application bundle, so `API_BASE_URL`'s
 * factory (core/api/api-config.ts) sees this value when it first resolves.
 *
 * ── Why a file rather than a compiled-in constant ────────────────────────
 *
 * This differs per environment, and a portal that has to be rebuilt to point
 * at a different server is one that eventually gets pointed at the wrong
 * one. Edit this file for the environment being deployed, or have the
 * deploy write it — it is plain JavaScript with no build step, so a CI job
 * can emit it from environment variables without touching the Angular
 * build. Mirrors the same pattern already in production use by the Admin
 * Portal (public/config.js there).
 *
 * Leave this '' when genuinely unknown. `CitizenApiClient` treats null/''
 * as "not configured" and refuses to send a request rather than guessing —
 * see the ApiNotConfiguredError doc comment in api-config.ts.
 */
globalThis.EBPCO_API_BASE_URL = '';
