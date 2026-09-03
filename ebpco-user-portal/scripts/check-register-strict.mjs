#!/usr/bin/env node
/**
 * `POST /auth/register` is `.strict()` on the server.
 *
 * It used to strip unknown fields silently: a client could send an address,
 * receive 202, and the data would vanish. Now it 400s instead of lying — the
 * better failure, but only if nobody adds fields to the registration request
 * expecting them to land.
 *
 * The server accepts exactly five: firstName, lastName, email, mobileNumber,
 * password. Everything else about a citizen — including the address both front
 * ends asked for — is corrected through `PATCH /me` after sign-in.
 *
 * This portal's registration is still in-memory, so nothing breaks today. That
 * is exactly why this gate exists: the defect appears only at the moment
 * someone wires the form to the network, and it appears as a 400 on the very
 * first real citizen sign-up.
 */
import { readFileSync } from 'node:fs';

const ACCEPTED = ['firstName', 'lastName', 'email', 'mobileNumber', 'password'];
const REGISTER = 'src/app/features/auth/register.page.ts';

const src = readFileSync(REGISTER, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const failures = [];

// Is registration wired to the network at all?
const wired = /CitizenApiClient|HttpClient|['"`]\/auth\/register/.test(src);

if (wired) {
  // It is. Now the field list matters: anything beyond the five is a 400.
  //
  // Only the call that actually reaches the SERVER is checked. This page also
  // calls the in-memory AuthService.register(), which legitimately takes more
  // than the server does — birth date, sex, civil status, nationality — and
  // reading that one would report a defect that is not there. So the scan is
  // anchored on the network call, and if it cannot find one it says so rather
  // than reporting a pass it did not earn.
  const call = src.match(/(?:CitizenApiClient|http)[\s\S]{0,200}?\.(?:post|register)\s*\([^,]*,\s*\{([\s\S]*?)\}/)
    ?? src.match(/['"`]\/auth\/register['"`][\s\S]{0,200}?\{([\s\S]*?)\}/);
  const sent = call ? [...call[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)].map((m) => m[1]) : [];
  for (const field of sent) {
    if (!ACCEPTED.includes(field)) {
      failures.push(
        `${REGISTER}: registration sends "${field}", which POST /auth/register refuses (.strict()). ` +
          `It accepts only ${ACCEPTED.join(', ')} — correct everything else through PATCH /me after sign-in.`,
      );
    }
  }
  if (sent.length === 0) {
    failures.push(
      `${REGISTER}: registration appears wired to the network but this gate could not read which ` +
        `fields it sends. A gate that cannot see is not a gate that passed — fix the check.`,
    );
  }
}

if (failures.length) {
  console.error('✘ register-strict check FAILED\n');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  wired
    ? `✔ registration sends only the ${ACCEPTED.length} fields POST /auth/register accepts`
    : `✔ registration is not wired to the network; the ${ACCEPTED.length}-field .strict() limit is recorded for when it is`,
);
