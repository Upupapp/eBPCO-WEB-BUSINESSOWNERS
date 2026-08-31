#!/usr/bin/env node
/**
 * Keeps the heading scale in `styles.scss` and the brand guideline in step.
 *
 * These two drifted apart silently once already: the guideline specified
 * 32/700, 28/600, 24/600, 20/600 while the app shipped 28/800, 22/800, 18/700,
 * 16/700 - systematically smaller AND heavier at every level - and h5/h6 had no
 * size at all. Nothing detected it, because a stylesheet and a Markdown file
 * have no reason to be compared.
 *
 * Owner ruling 31 Aug 2026: the SHIPPING scale is authoritative. So this gate
 * reads the code and asserts the document still describes it. If you change a
 * heading, update 04-Typography.md in the same commit.
 *
 * Run: npm run check:headings
 */
import { readFileSync } from 'node:fs';

// Paths are overridable so this script can be dropped into the admin portal and
// the information website unchanged - they carry the same guideline and have no
// such check. Defaults are this repo's layout.
//
//   node check-heading-scale.mjs [stylesheet] [guideline]
//
// NOT directly reusable by the Flutter mobile app: it has no stylesheet. The
// same IDEA transfers - assert the shipped TextTheme against the guideline - but
// it needs a Dart implementation. Do not pretend this file covers that surface.
const [cssPath = 'src/styles.scss',
       docPath = '../docs/01-Brand-Guidelines/04-Typography.md'] = process.argv.slice(2);

const read = (p, what) => {
  try { return readFileSync(p, 'utf8'); }
  catch { console.error(`✘ cannot read the ${what}: ${p}`); process.exit(2); }
};
const css = read(cssPath, 'stylesheet');
const doc = read(docPath, 'guideline');
const failures = [];

// Blanket rule supplies 800; a level may override it.
const blanket = /h1, h2, h3, h4, h5, h6 \{[^}]*font-weight:\s*(\d+)/.exec(css);
if (!blanket) failures.push('styles.scss: cannot find the h1-h6 blanket rule');
const base = blanket ? Number(blanket[1]) : null;

for (const level of [1, 2, 3, 4, 5, 6]) {
  // Anchored to line start on purpose: an unanchored `h6 {` also matches the
  // TAIL of the blanket rule `h1, h2, h3, h4, h5, h6 {`, which has no
  // font-size - so the check reported h6 unsized while it was defined a few
  // lines below. The gate caught its own bug, which is the point of running it
  // against a known-good state before trusting it.
  const rule = new RegExp(`^h${level} \\{([^}]*)\\}`, 'm').exec(css);
  if (!rule) { failures.push(`${cssPath}: h${level} has no rule of its own - it would inherit the blanket weight at the browser's default size`); continue; }
  const size = /font-size:\s*(\d+)px/.exec(rule[1]);
  if (!size) { failures.push(`${cssPath}: h${level} sets no font-size`); continue; }
  const w = /font-weight:\s*(\d+)/.exec(rule[1]);
  const weight = w ? Number(w[1]) : base;

  // The document's own block for this level.
  const block = new RegExp(`## Heading ${level}\\n[\\s\\S]*?Desktop\\n\\n(\\d+)px[\\s\\S]*?Weight\\n\\n(\\d+)`).exec(doc);
  if (!block) { failures.push(`${docPath}: no parsable "Heading ${level}" block`); continue; }
  if (Number(block[1]) !== Number(size[1])) {
    failures.push(`h${level}: code is ${size[1]}px, the guideline says ${block[1]}px`);
  }
  if (Number(block[2]) !== weight) {
    failures.push(`h${level}: code is weight ${weight}, the guideline says ${block[2]}`);
  }
}

if (failures.length) {
  console.error(`✘ heading-scale check FAILED — ${cssPath} and ${docPath} disagree\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('\n  The shipping scale is authoritative (owner, 31 Aug 2026): fix the document.');
  process.exit(1);
}
console.log(`✔ heading scale in ${cssPath} matches ${docPath}`);
