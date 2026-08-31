#!/usr/bin/env node
/**
 * F-8 gate: the portal must not fetch anything from a third-party host at
 * runtime.
 *
 * A government portal that collects a citizen's name, address, date of birth
 * and land titles must not hand their IP address and user-agent to another
 * company before the page renders. index.html used to load the typeface from
 * fonts.googleapis.com / fonts.gstatic.com on every visit — a disclosure the
 * privacy notice does not make and the citizen never agreed to.
 *
 * This is a build-time check rather than a unit test on purpose: it asks a
 * question about FILES, and the unit-test runner compiles through Angular in a
 * browser-like context where reading the repo is the wrong tool.
 *
 * Run: npm run check:assets
 */
import { readFileSync } from 'node:fs';

const BLOCKED = ['googleapis.com', 'gstatic.com', 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com'];
const failures = [];

// index.html: inspect the tags that actually cause a fetch, so the explanatory
// comment naming these hosts does not trip the gate on itself. A gate that
// fails against its own explanation is a gate nobody keeps.
const index = readFileSync('src/index.html', 'utf8');
for (const tag of index.match(/<(?:link|script|img|iframe)[^>]*>/g) ?? []) {
  for (const host of BLOCKED) {
    if (tag.includes(host)) failures.push(`src/index.html loads from ${host}: ${tag.trim()}`);
  }
}

// Stylesheets: every url() must be same-origin.
for (const file of ['src/fonts.scss', 'src/styles.scss']) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [, url] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (/^https?:\/\//i.test(url)) failures.push(`${file} references an absolute URL: ${url}`);
  }
}

// The bundled faces must exist, or the page silently falls back to the system
// stack and the fix looks applied while doing nothing.
const fonts = readFileSync('src/fonts.scss', 'utf8');
const faces = [...fonts.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
if (faces.length === 0) failures.push('src/fonts.scss declares no @font-face src');
for (const url of faces) {
  try {
    readFileSync(`public${url}`);
  } catch {
    failures.push(`src/fonts.scss points at a missing file: public${url}`);
  }
}

if (failures.length > 0) {
  console.error('✘ third-party asset check FAILED\n');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✔ no third-party asset references; ${faces.length} bundled font files present`);
