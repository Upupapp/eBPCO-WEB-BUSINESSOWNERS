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
| 8 | ✅ **DONE 2 Sep** — ~~An application can be "Paid" with no payment record~~ | `advanceForDemo` sets `paymentStatus: 'Paid'` on the application, but a `PaymentTransaction` is only created by `submitPayment()`. Advance an application past Payment Verified and Payments shows **Paid** while `/payments/:id/receipt` says *"No payment has been submitted for this application yet."* Two screens, two answers, same fact. |
| 9 | ✅ **DONE 2 Sep** — ~~Cap the toast stack~~ | `ToastService.show()` appends with no limit; each dismisses after 3500ms. Fourteen rapid actions produced **10+ stacked toasts** covering the right of a 1440px screen — on a 390px phone that is the whole screen, and they sit above the content. Cap the visible count and coalesce repeats. |
| 10 | ✅ **DONE 2 Sep** — ~~Give toasts an `aria-live` region~~ | `toast-host.component.ts` renders a plain `<div>`. A screen-reader user is never told an action succeeded or failed. WCAG 2.1 **4.1.3 Status Messages (AA)** — axe does not flag it because the rule needs a live region to exist before it can judge it. |
| 11 | ✅ **DONE 2 Sep** — ~~Make the receipt's cleared state something earned, not the absence of data~~ | `gateCleared = watermarkText() === null`, and `watermarkText()` returns `null` only when `payment()` is undefined. It is dead today because the document sits inside `@if (payment(); as tx)` — but it is the same latent fail-open the verification page had, one refactor from claiming *"This is a system-generated Official Receipt issued by the Municipality"* for a receipt with no payment behind it. |
| 12 | ~~**Say that uploaded files are not stored**~~ — **SUPERSEDED: they are now.** See below. | `my-documents` records `fileName`, `fileType`, `sizeBytes` — the bytes are discarded. The toast now says so, but the list itself shows a filename with no indication the file behind it does not exist. |
| 13 | **Explain the silent logout** | The session is in-memory by design, so a refresh or a shared deep link bounces to `/login` with no explanation. A citizen who reloads mid-application sees a login screen and no reason. Add an explanatory state on that bounce. |
| 14 | **Finish the CITIZEN vocabulary pass** | The rename covered the brand strings and the Help FAQ. Remaining screens still say "applicant" and "user" in body copy. **Do not touch `Owner / Applicant` on the permit document, `ApplicantStatus`, `applicantId` or `ApplicantType`** — that is a statutory form role and code identifiers respectively. |
| 15 | **Self-minted business registration numbers** (F-17) | `business.store.ts` mints `REG-{year}-{seq}` and the list renders it as **"Reg. No."**. A business registration number comes from the DTI, the SEC or the licensing office — never this portal. Either mark it as demo-generated on screen or stop displaying it until the field has a real source. |

---

## B2. Closed 2 September — the attachments were never being kept

Raised by the mobile lane: *"the mobile app filed applications with zero
documents for its entire life, and nobody noticed."* We are in parity with
mobile, so it was a candidate here by construction. It was present.

**The trace, from the file input to the end of the line:**

| Step | What happened |
|---|---|
| `application-wizard.page.ts:211` | `const file = input.files?.[0]` — the `File` exists, for two statements |
| `:213` | `{ fileName: file.name, fileType: … }` — **only `.name` is read; the File goes out of scope** |
| `:256` | `attachDocument(…, a.fileName, a.fileType)` — a name is handed on |
| `application.store.ts:283` | the store keeps `fileName`, `fileType` |
| — | **there is no HTTP layer at all**: no `HttpClient`, no `fetch`, no `FormData` anywhere in `src/` |

So the answer to *"what actually uploads it"* was **nothing, and nothing could**
— the bytes were gone before any store, and there was no request to carry them.

**Severity, stated honestly.** Mobile's defect was *live*: a real POST sent
`documents: []`, so real applications were filed with no documents. Ours was
*latent*: nothing is filed anywhere yet, so no citizen has lost a document to a
server. But the wizard was already in the state that produced mobile's bug —
**wiring HTTP would have filed zero-document applications on day one**, because
there would have been nothing to send.

**Fixed following the shape of mobile's `af7b8a1`, not its code.** The fix went
into the type, so the compiler enumerated every construction site (four) rather
than us hunting them: `ApplicationDocument.file` and `SavedDocument.file` are now
`File | null`, `AttachedDoc.file` is a required `File`, and `attachDocument()`
takes a `File` instead of a filename. Both intake points — the wizard and
My Documents — keep it. `submit()`'s single loop remains the one place
attachments leave the wizard, so it is the one place a future upload hooks.

**The first guards I wrote would have passed on mobile.** They called
`store.attachDocument()` directly, so replacing the File with an empty one at the
*wizard's intake* — mobile's exact bug — still passed 52/52. The test now drives
`onFileSelected` itself. Break-checked both halves: discarding at intake fails
**1**, dropping it in the store fails **3**. Neither is a type error, which is
why nothing caught this before.

## D. Three citizen endpoints — the HTTP layer now exists

**Built 2 September.** The backend supplied `contract/citizen-endpoints.openapi.yaml`
— written for this lane, every field pinned against recorded responses — so the
client is typed from a contract rather than inferred from prose, and its tests
decode the backend's **own recorded bytes** from `response-samples.json`.

What exists now: `provideHttpClient`, a bearer interceptor, RFC 9457 problem
handling, the three typed operations, and `API_BASE_URL` — **null in this
build**, because the Municipality's API host is theirs to supply. The client
refuses to issue a request while it is null rather than resolving to nothing.

What remains is the UI for each, below. Numbered 21–25 because they are
additions to the twenty above, not replacements.

| # | Task | Notes that change the design, not just the wiring |
|---|---|---|
| 21 | **`GET /applications/{id}/permit`** (f7eb40e) — `{permitNumber, issuedDate, scope, conditions[], release}` | **`release: null` means not yet ready for collection**, not "no release" — the two must not render the same. Before this endpoint a citizen who filed, paid and was approved had **no way to learn their permit number**. |
| 22 | ~~**Render `conditions[]` in full**~~ **DONE 2 Sep** — the seam is built and the invented content is gone; it fills when the endpoint lands. | Ours are wrong today, not merely absent. `requirements-catalog.ts` carries `validityRules` — **one client-authored sentence per permit type**, e.g. *"Valid for twelve (12) months from issuance, per standard LGU clearance practice"*, which is an inference we wrote, not the office's word. The server returns a **list**: cash bond, setbacks, notice before excavation. A citizen is currently shown a validity note where their actual obligations belong. Render every item; do not summarise, and do not keep a local copy. |
| 23 | **`GET /applications/{id}/documents`** (5a0f18a) — per-document verdict | **`reviewStatus: null` means not yet reviewed — NOT approved.** Same fail-closed rule as `PermitStanding`: absence of a verdict is never a pass. Use **`reviewReason.label` from the server**, never our own copy of the catalogue — the LGU can edit it, and a local copy would silently go stale. Also carries the supersession chain and `scanCleared` / `quarantined`. |
| 24 | **`POST /applications/{id}/documents/{documentId}/resubmit`** (18028a8) | Body `{fileName, label, contentBase64}` → 201 `{documentId, supersedesDocumentId, status, removedMetadata}`. **Send an `Idempotency-Key` (UUID)** — a retry with the same key replays the same answer instead of creating a second document. Refuses **409** if the document was already replaced or already accepted; that is a real state to render, not an error toast. |
| 25 | ✅ **DESIGNED 2 Sep** — ~~Show the rejection and its replacement together~~ (logic + tests in `core/api/document-chains.ts`; the screen still needs building) | **Replacements append.** The rejected document stays visible with its reason, alongside what was sent instead. *"What was wrong"* and *"what I sent instead"* is the pair that makes a rejection actionable — showing only the newest upload throws away the half the citizen needs. Design the list around the pair, not around the latest row. |

| 26 | **Read `permitTypeName` before `permitType`** when the HTTP layer lands | From the mobile lane: keep reading `permitTypeName` first **until the server is definitely upgraded everywhere** — on an older deployment the two still differ. A client that reads only `permitType` will be right against the new deployment and quietly wrong against an old one, and the failure looks like a missing value rather than a version mismatch. |

**Vocabulary — verified, corrected, and gated at TWENTY.** D-10 (live at `43f5187`) makes the
office's nineteen names the server's keys. Checked byte-exact against
`033_permit_vocabulary.sql`: **all 19 office names match, en dashes included.**
Three contain an **en dash (U+2013)**, not a hyphen; four contain a forward slash
and must be `%2F`-encoded in a path.

**But the published set is TWENTY, and ours was nineteen plus a phantom.**
D-10 deliberately did not remove `'Business Permit'` — the legacy flow still
files against it, and the migration says *"Deleting it here would strand that
flow."* The mobile lane held nineteen and hit it: validation failed, the type
arrived `null`, and those applications rendered **"Not recorded"** — the client
claiming not to know something the server had said plainly, with 443 tests green.

Ours was worse. We carried nineteen **plus a literal `'General Business Permit'`
— a third spelling invented here that no server sends and none would accept**,
repeated as an ad-hoc `PermitType | '…'` union in five places across eight files.
That is exactly the "cast" the D-10 migration complains about: a spelling with no
authority, in a place no client can see.

Now one named `PublishedPermitType = PermitType | 'Business Permit'`, and
`npm run check:vocab` fails if the union shrinks to nineteen or if the invented
spelling returns.

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
