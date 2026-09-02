# Citizen web portal — 20 front-end tasks

**Produced 2 September 2026** from a sweep + Stitch-conformance + test pass over
`d0caa27`. Front end only: everything below is doable inside
`ebpco-user-portal/` without a backend, an admin change or an LGU answer.
Items that *do* need someone else are listed at the end as blocked, not as tasks.

**State at the time of writing:** `npm run verify` green — five gates, 49 tests,
axe clean on 16 screens. Nothing here is a regression; these are gaps.

---

## A. Stitch conformance — screens the design system specifies that do not exist

Measured against `docs/08-Reusable-Stitch/04-Screen-Inventory.md`. It lists 65
screens; **37 are citizen-facing** (INS-* and PVO-* belong to the Inspector and
Payment Officer, which are internal roles, so they are out of this lane).

| # | Task | Evidence |
|---|---|---|
| 1 | **Build the Renewal flow** — REN-001 Select Existing Permit, REN-002 Renewal Form, REN-003 Review Renewal | The wizard offers `Renewal` in a dropdown and then shows the identical New-application form. There is no "select an existing permit" step, so a renewal cannot reference the permit it renews. |
| 2 | **Build the Amendment flow** — AMD-001/002/003 | Same: an `Amendment` option with no amendment form and no permit to amend. |
| 3 | **Build Edit Business** — BUS-004 | No route, no control, nothing. A citizen who mistypes a business name cannot correct it. |
| 4 | **Build Document Preview** — DOC-003 | `My Documents` stores filename, type and size only; there is nothing to preview. Pair this with task 12. |
| 5 | **Build Payment Success** — PAY-005 | `payment-flow` navigates straight to `/applications/:id`. The citizen never gets a confirmation screen, only a toast that vanishes in 3.5s. |
| 6 | **Reconcile the wizard against PER-001..005** | The spec names five steps; four are implemented (`step() === 1..4`) and there is **no "Business Activity" step** (PER-003, 0 hits). Either fold it explicitly and record that, or add it. Folding is legitimate — leaving the spec and the code silently disagreeing is not. |
| 7 | **Decide and record PUB-006 / PUB-007** | Forgot Password is deliberately reduced to an honest notice (F-5) and **Reset Password does not exist**. That was the right call while nothing can send email, but the Screen Inventory still lists both as required. Record the deviation in the inventory so the next reader does not "fix" it by restoring a lie. |

---

## B. Defects found in this pass

| # | Task | Evidence |
|---|---|---|
| 8 | **An application can be "Paid" with no payment record** | `advanceForDemo` sets `paymentStatus: 'Paid'` on the application, but a `PaymentTransaction` is only created by `submitPayment()`. Advance an application past Payment Verified and Payments shows **Paid** while `/payments/:id/receipt` says *"No payment has been submitted for this application yet."* Two screens, two answers, same fact. |
| 9 | **Cap the toast stack** | `ToastService.show()` appends with no limit; each dismisses after 3500ms. Fourteen rapid actions produced **10+ stacked toasts** covering the right of a 1440px screen — on a 390px phone that is the whole screen, and they sit above the content. Cap the visible count and coalesce repeats. |
| 10 | **Give toasts an `aria-live` region** | `toast-host.component.ts` renders a plain `<div>`. A screen-reader user is never told an action succeeded or failed. WCAG 2.1 **4.1.3 Status Messages (AA)** — axe does not flag it because the rule needs a live region to exist before it can judge it. |
| 11 | **Make the receipt's cleared state something earned, not the absence of data** | `gateCleared = watermarkText() === null`, and `watermarkText()` returns `null` only when `payment()` is undefined. It is dead today because the document sits inside `@if (payment(); as tx)` — but it is the same latent fail-open the verification page had, one refactor from claiming *"This is a system-generated Official Receipt issued by the Municipality"* for a receipt with no payment behind it. |
| 12 | **Say that uploaded files are not stored** | `my-documents` records `fileName`, `fileType`, `sizeBytes` — the bytes are discarded. The toast now says so, but the list itself shows a filename with no indication the file behind it does not exist. |
| 13 | **Explain the silent logout** | The session is in-memory by design, so a refresh or a shared deep link bounces to `/login` with no explanation. A citizen who reloads mid-application sees a login screen and no reason. Add an explanatory state on that bounce. |
| 14 | **Finish the CITIZEN vocabulary pass** | The rename covered the brand strings and the Help FAQ. Remaining screens still say "applicant" and "user" in body copy. **Do not touch `Owner / Applicant` on the permit document, `ApplicantStatus`, `applicantId` or `ApplicantType`** — that is a statutory form role and code identifiers respectively. |
| 15 | **Self-minted business registration numbers** (F-17) | `business.store.ts` mints `REG-{year}-{seq}` and the list renders it as **"Reg. No."**. A business registration number comes from the DTI, the SEC or the licensing office — never this portal. Either mark it as demo-generated on screen or stop displaying it until the field has a real source. |

---

## C. Hardening — cheap now, expensive later

| # | Task | Evidence |
|---|---|---|
| 16 | **Gate the demo disclosure on document-like surfaces** | The permit document and the receipt each carry a watermark gate, written twice by two people. A third document will be written by a third person. One gate asserting *"every printable document-like page has a watermark path that cannot clear without positive provenance"* would hold the rule instead of the convention. |
| 17 | **Add a route-vs-inventory gate** | Task 6 exists because a spec and a router drifted with nothing comparing them — exactly how the heading scale drifted before `check:headings`. Read `04-Screen-Inventory.md`, read `app.routes.ts`, fail on a citizen-facing screen with no route and no recorded deviation. |
| 18 | **Run axe at mobile viewports too** | `check:a11y` scans 16 screens at 1280×900 only. The drawer, the 44px touch targets and the scrollable table cards only exist below 1024px, so the gate never sees the state most citizens will. Add a 390px pass. |
| 19 | **Add a WebKit pass to the gate** | Every iOS-specific defect found here — focus zoom under 16px, native `<select>` ignoring author height, the 750×342 landscape viewport — was invisible to Chromium. The browser is already installed. |
| 20 | **Cover the wizard and payment flows with tests** | 49 tests, and the two longest citizen journeys — the five-step application and the payment flow — have none. Both have been driven manually and both work; nothing holds them there. |

---

## Blocked — not tasks, and not this lane

Listed so nobody picks them up as front-end work.

| Item | Waiting on |
|---|---|
| Bank account for permit fees | the Municipality |
| Real fee schedule (amounts are marked *"Illustrative — not a Castilla rate"*) | the Municipality |
| Data retention period, DPO identity, recipient offices | the Municipality |
| Office hours | the Municipality |
| Digital payment — PAY-003, GCash / Maya / LandBank Link.Biz | the Municipality + backend; a payment rail is not a front-end decision |
| Permit revocation / suspension / expiry | the backend — `generated_permits` has no status and no expiry column |
| Poppins → Gothic A1 | the mobile lane |
| `docs/` duplication | the design-system repo decision |
