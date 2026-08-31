#!/usr/bin/env node
/**
 * F-18 / F-2 gate: what the PRINTER produces, not what the screen shows.
 *
 * The permit document is the one artifact that leaves the building. It carries
 * the Republic of the Philippines letterhead and the municipal seal, and it is
 * the thing a bank, a barangay official or a contractor will actually be handed.
 * Two ways it went wrong, both invisible to every other check:
 *
 *  - The app shell printed with it. The sidebar took a third of the page and the
 *    entire right half of the permit — municipality, title, owner's business and
 *    address, and the whole AMOUNT column — fell off the sheet.
 *  - The watermark is a 14%-opacity tint. Under the default
 *    `print-color-adjust: economy` a browser may drop it as decorative ink,
 *    handing back exactly the clean letterheaded document F-2 exists to prevent.
 *
 * A unit test cannot see either: both live in an `@media print` block that only
 * applies at the page boundary.
 *
 * Run: npm run check:print
 */
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles.scss', 'utf8');
const failures = [];

const block = css.slice(css.indexOf('@media print'));
if (!block.startsWith('@media print')) failures.push('src/styles.scss has no @media print block at all');

const need = [
  ['.ds-sidenav', 'the nav sidebar must be hidden, or it prints across the permit'],
  ['.ds-topbar', 'the topbar must be hidden'],
  ['.ds-main', 'the main column must be reset to full width, or the permit is cut off at the right edge'],
  ['.ds-demo-banner', 'the demo notice must print WITH the document — a disclosure that is only on screen does not travel with the artifact'],
  ['.doc-generated-watermark', 'the watermark needs an explicit print rule'],
];
for (const [sel, why] of need) {
  if (!block.includes(sel)) failures.push(`@media print does not mention ${sel} — ${why}`);
}

// The watermark and the notice must both survive ink-saving.
for (const sel of ['.doc-generated-watermark', '.ds-demo-banner']) {
  const i = block.indexOf(sel);
  const rule = i === -1 ? '' : block.slice(i, block.indexOf('}', i));
  if (!rule.includes('print-color-adjust: exact')) {
    failures.push(`${sel} lacks print-color-adjust: exact — the browser may drop it to save ink`);
  }
}

if (failures.length) {
  console.error('✘ print-safety check FAILED\n');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✔ print styles hide the shell and force-print the watermark and demo notice');
