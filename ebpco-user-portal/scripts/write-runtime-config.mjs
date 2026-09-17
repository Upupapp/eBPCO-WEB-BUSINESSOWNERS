#!/usr/bin/env node
/**
 * Writes `public/config.js` from the build's own environment, so a deploy
 * points this portal at a real API without anyone hand-editing a checked-in
 * file per environment.
 *
 * `public/config.js` has always documented this as the intended path ("have
 * the deploy write it... a CI job can emit it from environment variables
 * without touching the Angular build. Mirrors the same pattern already in
 * production use by the Admin Portal") — this is that CI job, and its
 * counterpart lives at the same relative path in the Admin Portal's own
 * repository.
 *
 * Run BEFORE `ng build` (see netlify.toml's `command`), because Angular's
 * asset step copies `public/` verbatim — whatever this file contains at that
 * moment is what ships.
 *
 * Deliberately not the reverse: this never invents a value. An unset
 * variable writes `''`, exactly what the file already shipped with, so a
 * deploy that has not been given a real API host degrades to the same
 * honestly-disabled behaviour as before — `CitizenApiClient` refuses to send
 * a request rather than guessing (see `ApiNotConfiguredError`).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'public', 'config.js');

const apiBaseUrl = process.env.EBPCO_API_BASE_URL ?? '';

const contents = `/**
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
 * \`API_BASE_URL\`'s factory (core/api/api-config.ts) sees this value when it
 * first resolves. \`CitizenApiClient\` treats '' as "not configured" and
 * refuses to send a request rather than guessing — see the
 * ApiNotConfiguredError doc comment in api-config.ts.
 */
globalThis.EBPCO_API_BASE_URL = ${JSON.stringify(apiBaseUrl)};
`;

writeFileSync(target, contents, 'utf8');

process.stdout.write(
  `wrote public/config.js `
  + `(EBPCO_API_BASE_URL=${apiBaseUrl === '' ? '<unset, same-origin>' : JSON.stringify(apiBaseUrl)})\n`,
);
