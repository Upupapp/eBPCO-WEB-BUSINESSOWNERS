#!/usr/bin/env node
/**
 * Holds the portal's permit names against the office's nineteen — the server's
 * keys since D-10 (`033_permit_vocabulary.sql`, live at 43f5187).
 *
 * WHY A GATE AND NOT A COMMENT. These names are a wire contract now: the value
 * we send IS the server's key. A client vocabulary and a server vocabulary with
 * nothing comparing them drift silently — exactly how the heading scale drifted
 * before check:headings. The difference here is that drift would not look like a
 * style bug, it would look like a permit type that simply does not exist.
 *
 * THE SILENT ONE. Three names contain an EN DASH (U+2013), not a hyphen:
 *
 *     Building Permit – New Construction
 *     Building Permit – Renovation / Alteration
 *     Building Permit – Addition / Extension
 *
 * A hyphen will not match, and nothing about the failure says "wrong dash" — an
 * editor, a copy-paste through a tool that normalises punctuation, or a helpful
 * autocorrect is enough. This check compares CODE POINTS, so it catches that.
 *
 * Four names contain a forward slash, so `permitType` must be URL-encoded
 * (%2F) wherever it goes in a path.
 *
 * Updating this list is a deliberate act: change it only to follow a change the
 * office and the server have already made, and say so in the commit.
 *
 * Run: npm run check:vocab
 */
import { readFileSync } from 'node:fs';

// The office's nineteen. Transcribed from the backend's 033_permit_vocabulary.sql
// and verified byte-exact against ebpco-api at 5a0f18a on 2 September 2026.
const OFFICE_19 = [
  'Architectural Permit',
  'Building Permit – Addition / Extension',
  'Building Permit – New Construction',
  'Building Permit – Renovation / Alteration',
  'Certificate of Occupancy',
  'Civil / Structural Permit',
  'Demolition Permit',
  'Electrical Permit',
  'Electronics Permit',
  'Excavation Permit',
  'FSEC for Building Permit (BFP)',
  'FSIC for Occupancy Permit (BFP)',
  'Fencing Permit',
  'Interior Design Permit',
  'Mechanical Permit',
  'Plumbing Permit',
  'Sanitary Permit',
  'Sign Permit',
  'Zoning / Locational Clearance',
];

const src = readFileSync('src/app/core/domain/requirements-catalog.ts', 'utf8');
const found = [...src.matchAll(/^ {2}'([^']+)':/gm)].map((m) => m[1]).sort();
const expected = [...OFFICE_19].sort();
const failures = [];

for (const name of expected) if (!found.includes(name)) failures.push(`missing from the catalogue: ${JSON.stringify(name)}`);
for (const name of found) if (!expected.includes(name)) failures.push(`not one of the office's nineteen: ${JSON.stringify(name)}`);

// Code-point check, so a hyphen substituted for an en dash is named as such
// rather than showing up as two visually identical strings that differ.
for (const name of found) {
  if (/Building Permit [-–—]/.test(name) && !name.includes('–')) {
    const ch = name.match(/Building Permit (.)/)?.[1];
    failures.push(
      `${JSON.stringify(name)} uses U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} ` +
      `where the server's key has U+2013 (en dash). The server will not match it.`,
    );
  }
}

if (failures.length) {
  console.error("✘ permit-vocabulary check FAILED — the catalogue and the office's nineteen disagree\n");
  for (const f of failures) console.error(`  - ${f}`);
  console.error('\n  These names are the server\'s keys. Change them only to follow the office and the backend.');
  process.exit(1);
}
console.log(`✔ all ${expected.length} permit names match the office's vocabulary, en dashes included`);
