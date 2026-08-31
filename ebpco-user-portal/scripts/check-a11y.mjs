#!/usr/bin/env node
/**
 * Accessibility gate: axe-core against the REAL rendered DOM of the built app.
 *
 * The other four gates read source. This one is the only check that sees what a
 * browser actually produces, and it is the one that would have caught the
 * portal's worst accessibility defect on its own: 50 form controls, 49 visible
 * <label> elements, and ZERO `for` attributes - a screen reader announced "edit
 * text, blank" for the whole registration form. The screen looked correct, so no
 * amount of reading found it; axe found it in seconds.
 *
 * TWO THINGS THIS SCRIPT DOES DELIBERATELY.
 *
 * It SETTLES ANIMATIONS before scanning. axe samples computed colour, so an
 * element mid-fade reads as a contrast failure. Scanning this app un-settled
 * reported 13 contrast violations of which only 6 were real - the landing CTA
 * came back at 1.08:1 while being perfectly legible. A gate that cries wolf gets
 * switched off, so the stylesheet injected below forces every animation and
 * transition to its end state first.
 *
 * It FAILS CLOSED when the browser is missing. A gate that silently skips reads
 * exactly like a gate that passed. If Chromium is not installed this exits
 * non-zero and tells you the one command to fix it.
 *
 * Run: npm run check:a11y   (needs `npm run build` first - it scans dist/)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = 'dist/ebpco-user-portal/browser';
const PORT = 4399;

if (!existsSync(ROOT)) {
  console.error(`✘ a11y check: ${ROOT} does not exist — run \`npm run build\` first.`);
  process.exit(2);
}

let chromium, AxeBuilder;
try {
  ({ chromium } = await import('playwright'));
  AxeBuilder = (await import('@axe-core/playwright')).default;
} catch (e) {
  console.error('✘ a11y check: playwright / @axe-core/playwright not installed.');
  console.error('   npm install    then    npx playwright install chromium');
  process.exit(2);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png',
                '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

const server = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ''));
  // SPA fallback, mirroring netlify.toml's /* -> /index.html
  if (!existsSync(file) || !extname(file)) file = join(ROOT, 'index.html');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}`;

const SETTLE = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;
                transition-duration:0s!important;animation-fill-mode:forwards!important}`;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

let browser, failures = 0, scanned = 0;
try {
  browser = await chromium.launch({ args: ['--no-sandbox'] });
} catch (e) {
  console.error('✘ a11y check: Chromium is not installed for Playwright.');
  console.error('   npx playwright install chromium');
  await new Promise((r) => server.close(r));
  process.exit(2);
}
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

async function scan(label) {
  await page.addStyleTag({ content: SETTLE });
  await page.waitForTimeout(500);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  scanned++;
  if (violations.length) {
    failures += violations.length;
    console.error(`\n  ✘ ${label}`);
    for (const v of violations) {
      console.error(`      [${v.impact}] ${v.id} x${v.nodes.length} — ${v.help}`);
      console.error(`        ${v.nodes[0]?.html?.replace(/\s+/g, ' ').slice(0, 110)}`);
    }
  } else {
    console.log(`  ✔ ${label}`);
  }
}

for (const [path, label] of [['/landing', 'landing'], ['/login', 'login'], ['/register', 'register'],
                             ['/verify/ZLC-2026-0231', 'verify'], ['/how-it-works', 'how-it-works'],
                             ['/privacy', 'privacy'], ['/terms', 'terms'], ['/not-found', '404']]) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await scan(label);
}

// Signed-in screens. The session is in-memory, so every hop after sign-in must
// be an in-app click - a page load logs straight back out.
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.locator('input').first().fill('juan.delacruz@example.com');
await page.locator('input[type=password]').first().fill('Password1');
await page.locator('button:has-text("Log In")').first().click();
await page.waitForURL('**/dashboard', { timeout: 15000 });
await scan('dashboard');
for (const [link, label] of [['Permit Services', 'permit catalogue'], ['My Applications', 'my applications'],
                             ['My Documents', 'my documents'], ['Payments', 'payments'],
                             ['Notifications', 'notifications'], ['Profile', 'profile'],
                             ['Help & Support', 'help & support']]) {
  await page.locator(`a:has-text("${link}")`).first().click();
  await page.waitForTimeout(600);
  await scan(label);
}

await browser.close();
await new Promise((r) => server.close(r));

if (failures) {
  console.error(`\n✘ accessibility check FAILED — ${failures} violation type(s) across ${scanned} screens\n`);
  process.exit(1);
}
console.log(`\n✔ no WCAG 2.0/2.1 A or AA violations across ${scanned} screens`);
