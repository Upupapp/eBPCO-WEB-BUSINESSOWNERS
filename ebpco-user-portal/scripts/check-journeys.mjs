#!/usr/bin/env node
/**
 * End-to-end journey gate (FE task 20).
 *
 * The two longest citizen journeys - the four-step application and the payment
 * flow - had no test of any kind. Every piece under them was covered and the
 * WIRING between the pieces was not, which is the shape of defect that has bitten
 * this project three times (see ebpco-tested-pieces-untested-wiring): a store
 * spec passes, a component spec passes, and the journey they compose is broken.
 *
 * This drives the BUILT app in a real browser, because that is the only place
 * the wiring exists. Three rules it follows:
 *
 * 1. It asserts on FACTS THAT SURVIVED THE JOURNEY, not on reassuring screen
 *    text. A confirmation message is exactly what looked right while mobile
 *    filed `documents: []` for its entire life.
 *
 * 2. It asserts that HONEST WORDING IS STILL THERE. F-14 and F-4 were decisions
 *    to tell a citizen the truth - that nothing was sent, that no bank account
 *    has been published. Nothing else in the repo stops someone "improving"
 *    those into a cheerful success message, so this does.
 *
 * 3. It PROVES IT MOVED before it asserts. A journey test that silently failed
 *    to click reads exactly like one that passed - so every step checks the URL
 *    or the step indicator actually changed before looking at the result.
 *
 * Run: npm run check:journeys   (needs `npm run build` first - it drives dist/)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = 'dist/ebpco-user-portal/browser';
const PORT = 4401;

if (!existsSync(ROOT)) {
  console.error(`✘ journey check: ${ROOT} does not exist — run \`npm run build\` first.`);
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('✘ journey check: playwright is not installed.');
  console.error('   npm install    then    npx playwright install chromium');
  process.exit(2);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png',
                '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

const server = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ''));
  if (!existsSync(file) || !extname(file)) file = join(ROOT, 'index.html');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0, checks = 0;
const ok = (label) => { checks++; console.log(`    ✔ ${label}`); };
const bad = (label, detail) => {
  checks++; failures++;
  console.error(`    ✘ ${label}`);
  if (detail) console.error(`        ${detail}`);
};
const expect = (cond, label, detail) => (cond ? ok(label) : bad(label, detail));

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

const pdf = (name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 journey test') });

async function signIn() {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input').first().fill('juan.delacruz@example.com');
  await page.locator('input[type=password]').first().fill('Password1');
  await page.locator('button:has-text("Log In")').first().click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

/**
 * Open the wizard the way a citizen does — by clicking.
 *
 * page.goto() cannot be used after sign-in: the session is in-memory, so a page
 * load drops it and the router bounces to /login. The first version of this
 * gate did exactly that and timed out looking for a step indicator on the login
 * screen — a failure that reads like a broken selector, not a lost session.
 */
async function openWizard() {
  await page.locator('a:has-text("Permit Services")').first().click();
  await page.waitForTimeout(600);
  await page.locator('a:has-text("Start Application")').first().click();
  await page.waitForURL(/permits\/apply/, { timeout: 15000 });
  await page.waitForTimeout(400);
}

/** The step indicator's active number. Proof the wizard actually advanced. */
const wizardStep = () =>
  page.locator('.step-item.active').first().innerText().then((t) => t.trim()[0]);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▸ Journey 1 — file a new application, end to end');
// ─────────────────────────────────────────────────────────────────────────────
await signIn();
await openWizard();

expect(await wizardStep() === '1', 'the wizard opens on step 1');

await page.locator('#application-wizard-business-1').selectOption({ index: 1 });
const businessName = await page.locator('#application-wizard-business-1')
  .locator('option:checked').innerText();
await page.locator('button:has-text("Continue")').first().click();
await page.waitForTimeout(300);
expect(await wizardStep() === '2', 'step 1 → 2 with a business selected');

await page.locator('#application-wizard-project-business-address-3').fill('12 Rizal Street, Barangay Poblacion');
await page.locator('#application-wizard-scope-of-work-4').fill('Two-storey residential construction.');
await page.locator('button:has-text("Continue")').first().click();
await page.waitForTimeout(300);
expect(await wizardStep() === '3', 'step 2 → 3 with the project details filled');

// Attach a real file to every requirement, then remember what we attached.
const fileInputs = page.locator('input[type=file]');
const fileCount = await fileInputs.count();
expect(fileCount > 0, `step 3 offers ${fileCount} document slots`);
const attachedNames = [];
for (let i = 0; i < fileCount; i++) {
  const name = `journey-doc-${i + 1}.pdf`;
  await fileInputs.nth(i).setInputFiles(pdf(name));
  attachedNames.push(name);
  await page.waitForTimeout(60);
}
await page.locator('button:has-text("Continue")').first().click();
await page.waitForTimeout(300);
expect(await wizardStep() === '4', 'step 3 → 4 with every required document attached');

const reviewText = await page.locator('.card').first().innerText();
expect(reviewText.includes(businessName.trim()),
  'the review step shows the business actually selected',
  `review did not mention "${businessName.trim()}"`);

for (const cb of await page.locator('input[type=checkbox]').all()) await cb.check();
await page.locator('button:has-text("Submit Application")').click();
await page.waitForURL(/\/applications\//, { timeout: 15000 });
ok('submitting lands on the application it created');

const detailText = await page.locator('.page').innerText();
// The application number the portal minted. Everything after this identifies
// the record by THIS, never by the business name: the seed uses the same
// business, so a name match would pass against a seeded application even if the
// one just filed had vanished. An assertion that passes for the wrong reason is
// the whole defect class this gate exists to catch.
const applicationNumber = (detailText.match(/\b[A-Z]{2,6}-\d{4}-\d{5}\b/) ?? [])[0];
expect(!!applicationNumber, 'the filed application has a real application number',
  'no application-number-shaped string on the page');

// The mobile defect this whole portal is measured against: every count and
// badge looked right while the request carried documents: []. So assert the
// document NAMES the journey attached are on the page the citizen lands on.
const surviving = attachedNames.filter((n) => detailText.includes(n));
expect(surviving.length === attachedNames.length,
  `all ${attachedNames.length} attached documents survive to the application page`,
  `only ${surviving.length} of ${attachedNames.length} present — missing ${
    attachedNames.filter((n) => !detailText.includes(n)).join(', ')}`);

// F-14: nothing was sent to the Municipality, and this build must not say it was.
expect(!/submitted successfully|successfully submitted/i.test(detailText),
  'the page does not claim the application was successfully submitted (F-14)');

// Navigate IN-APP. Signing in again would reload the page, and the store is in
// memory — the application just filed would be gone, while the assertion below
// still passed against a seeded one. The whole session below is continuous for
// that reason.
await page.locator('a:has-text("My Applications")').first().click();
await page.waitForTimeout(600);
expect((await page.locator('.page').innerText()).includes(applicationNumber),
  `the application just filed (${applicationNumber}) is listed under My Applications`);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▸ Journey 2 — a Renewal cannot be filed without naming a permit');
// ─────────────────────────────────────────────────────────────────────────────
await openWizard();
await page.locator('#application-wizard-business-1').selectOption({ index: 1 });
await page.locator('#application-wizard-application-type-2').selectOption('Renewal');
await page.waitForTimeout(200);

expect(await page.locator('#application-wizard-related-permit').count() > 0
       || (await page.locator('.hint').allInnerTexts()).some((t) => /nothing to renew|no issued permits/i.test(t)),
  'choosing Renewal reveals the permit-being-renewed field (or says there is nothing to renew)');

await page.locator('button:has-text("Continue")').first().click();
await page.waitForTimeout(300);
expect(await wizardStep() === '1', 'the wizard REFUSES to advance without a permit named');
const err = await page.locator('.error').first().innerText().catch(() => '');
expect(/renew/i.test(err), 'and says why, in the citizen\'s words', `error text was: "${err}"`);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▸ Journey 3 — the payment flow, and what it must never claim');
// ─────────────────────────────────────────────────────────────────────────────
// The seed's only payable row is already settled, so this drives the
// application journey 1 filed through the office's own "simulate an update"
// control until an assessment with a balance exists. That tests more wiring
// than a pre-baked fixture would: the assessment has to actually arrive.
await page.locator('a:has-text("My Applications")').first().click();
await page.waitForTimeout(500);
await page.locator(`a:has-text("${applicationNumber}"), tr:has-text("${applicationNumber}") a`).first().click();
await page.waitForURL(/\/applications\//, { timeout: 15000 });
await page.waitForTimeout(400);

let advanced = 0;
while (advanced < 12) {
  const simulate = page.locator('button:has-text("Simulate Office Update")');
  if (await simulate.count() === 0) break;
  const balanceShown = /Pay Now/.test(await page.locator('.page').innerText());
  if (balanceShown) break;
  await simulate.first().click();
  await page.waitForTimeout(350);
  advanced++;
}
expect(/Pay Now/.test(await page.locator('.page').innerText()),
  `an assessment with a balance arrives after ${advanced} office updates`,
  'no Pay Now appeared on the application after advancing it');

await page.locator('a:has-text("Pay Now")').first().click();
await page.waitForURL(/\/payments\/[^/]+$/, { timeout: 15000 });
await page.waitForTimeout(400);
ok('Pay Now opens the payment flow for that application');

// F-4: the Municipality has published no deposit account. This screen asks a
// citizen to move real money, so it must show the refusal, never a placeholder.
await page.locator('button:has-text("Bank Transfer")').first().click();
await page.waitForTimeout(300);
const bankText = await page.locator('.page').innerText();
expect(/not available yet/i.test(bankText),
  'Bank Transfer shows the honest "not available yet" state (F-4)');
// Not "no long number anywhere" — the Municipal Engineer's contact mobile is on
// the page legitimately, and an assertion that flags it would be switched off
// within a week. What must never appear is a DEPOSIT ACCOUNT: the labels the
// bank-details card renders when it has something to show.
expect(!/Account Number|Account Name|\bBank:/i.test(bankText),
  'and shows no deposit account details at all — nothing to send money to',
  `matched: ${JSON.stringify(bankText.match(/Account Number|Account Name|\bBank:/gi))}`);

await page.locator('button:has-text("Onsite Payment")').first().click();
await page.waitForTimeout(300);
await page.locator('button:has-text("Mark as Paid")').first().click();
await page.waitForTimeout(900);
const afterPay = await page.locator('body').innerText();
expect(/no payment was sent or received|demo/i.test(afterPay),
  'recording a payment says plainly that no money moved');

await page.locator('a:has-text("Payments")').first().click();
await page.waitForTimeout(700);
const receiptRow = page.locator(`tr:has-text("${applicationNumber}") a:has-text("View Receipt")`);
expect(await receiptRow.count() > 0,
  'the application just paid offers its own receipt',
  `payments page shows:\n${(await page.locator('.page').innerText()).slice(0, 500)}`);
if (await receiptRow.count() > 0) {
  await receiptRow.first().click();
  await page.waitForURL(/receipt/, { timeout: 15000 });
  await page.waitForTimeout(400);
  const receipt = await page.locator('.page').innerText();
  expect(/NOT VALID AS AN OFFICIAL RECEIPT|PENDING VERIFICATION|REJECTED/.test(receipt),
    'the receipt carries a watermark — it never passes itself off as official');
  expect(receipt.includes(applicationNumber),
    'and the receipt names the application it is actually for');
}

await browser.close();
await new Promise((r) => server.close(r));

if (failures) {
  console.error(`\n✘ journey check FAILED — ${failures} of ${checks} assertions\n`);
  process.exit(1);
}
console.log(`\n✔ ${checks} journey assertions passed across 3 citizen journeys`);
