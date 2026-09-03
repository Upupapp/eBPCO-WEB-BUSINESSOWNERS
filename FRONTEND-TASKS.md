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
| 1 | ✅ **DONE (93ea4c2)** **Build the Renewal flow** — REN-001 Select Existing Permit, REN-002 Renewal Form, REN-003 Review Renewal | The wizard offers `Renewal` in a dropdown and then shows the identical New-application form. There is no "select an existing permit" step, so a renewal cannot reference the permit it renews. |
| 2 | ✅ **DONE (93ea4c2)** **Build the Amendment flow** — AMD-001/002/003 | Same: an `Amendment` option with no amendment form and no permit to amend. |
| 3 | ✅ **DONE (93ea4c2)** **Build Edit Business** — BUS-004 | No route, no control, nothing. A citizen who mistypes a business name cannot correct it. |
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
| 21 | ✅ **SCREEN BUILT 2 Sep** — ~~`GET /applications/{id}/permit`~~ permit number and all four release states render; switches to live data by changing its input.| **`release: null` means not yet ready for collection**, not "no release" — the two must not render the same. Before this endpoint a citizen who filed, paid and was approved had **no way to learn their permit number**. |
| 22 | ~~**Render `conditions[]` in full**~~ **DONE 2 Sep** — the seam is built and the invented content is gone; it fills when the endpoint lands. | Ours are wrong today, not merely absent. `requirements-catalog.ts` carries `validityRules` — **one client-authored sentence per permit type**, e.g. *"Valid for twelve (12) months from issuance, per standard LGU clearance practice"*, which is an inference we wrote, not the office's word. The server returns a **list**: cash bond, setbacks, notice before excavation. A citizen is currently shown a validity note where their actual obligations belong. Render every item; do not summarise, and do not keep a local copy. |
| 23 | ✅ **SCREEN BUILT 2 Sep** — ~~`GET /applications/{id}/documents`~~ the view renders chains and is written against the contract shape; it switches to live data by changing its input. | **`reviewStatus: null` means not yet reviewed — NOT approved.** Same fail-closed rule as `PermitStanding`: absence of a verdict is never a pass. Use **`reviewReason.label` from the server**, never our own copy of the catalogue — the LGU can edit it, and a local copy would silently go stale. Also carries the supersession chain and `scanCleared` / `quarantined`. |
| 24 | ✅ **BUILT 2 Sep** — ~~`POST .../resubmit`~~ picker, size pre-check, idempotency-key lifecycle and error mapping; sends once an API host exists. | Body `{fileName, label, contentBase64}` → 201 `{documentId, supersedesDocumentId, status, removedMetadata}`. **Send an `Idempotency-Key` (UUID)** — a retry with the same key replays the same answer instead of creating a second document. Refuses **409** if the document was already replaced or already accepted; that is a real state to render, not an error toast. |
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
| 17 | ✅ **DONE** **Add a route-vs-inventory gate** | Task 6 exists because a spec and a router drifted with nothing comparing them — exactly how the heading scale drifted before `check:headings`. Read `04-Screen-Inventory.md`, read `app.routes.ts`, fail on a citizen-facing screen with no route and no recorded deviation. |
| 18 | ✅ **DONE** **Run axe at mobile viewports too** | `check:a11y` scans 16 screens at 1280×900 only. The drawer, the 44px touch targets and the scrollable table cards only exist below 1024px, so the gate never sees the state most citizens will. Add a 390px pass. |
| 19 | ✅ **DONE** **Add a WebKit pass to the gate** | Every iOS-specific defect found here — focus zoom under 16px, native `<select>` ignoring author height, the 750×342 landscape viewport — was invisible to Chromium. The browser is already installed. |
| 20 | ✅ **DONE** **Cover the wizard and payment flows with tests** | 49 tests, and the two longest citizen journeys — the five-step application and the payment flow — have none. Both have been driven manually and both work; nothing holds them there. |

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


---

## Tasks 1–3 — closed 3 September 2026 (93ea4c2)

**The missing screens were hiding a missing fact.** `ApplicationRecord` recorded
`applicationAction: 'Renewal'` and nothing else. A renewal reached the office
asserting an existing permit was involved, with no way to tell which one, and
the citizen had no field in which to say. REN-001 and AMD-001 exist to capture
exactly that.

- `relatedPermitNumber` added to `ApplicationRecord` — required for Renewal and
  Amendment, and null for New, so a stray reference on a New application is
  refused too (it would assert a relationship the citizen never claimed).
- The rule is a domain predicate, enforced in the **wizard and the store**. A
  rule enforced only in a template is enforced only for callers who go through
  the template.
- The permit list is drawn from permits actually issued to the signed-in
  citizen, so it cannot offer one that does not exist. Not filtered by expiry:
  a lapsed permit is often what someone came to renew, and what is still
  renewable is the office's judgement.
- **Edit Business** exposes only the citizen's own fields. Registration number,
  date registered, owner and status are unreachable by construction.
- **Editing does not rewrite applications already filed.** `businessName` on an
  application is a submission-time snapshot; syncing it would let a citizen
  rename an application the Municipality had already assessed. Said on screen,
  with Amendment named as the real route.

Both guards break-checked separately. 125 tests, 22 files, six gates green,
verified from a detached worktree at 93ea4c2.

**Caught while writing it:** the on-screen warning first used a
`.callout-warning` class this codebase does not define — it would have shipped
as unstyled text. A warning nobody sees is worse than no warning, because it
is recorded as delivered.


---

## Tasks 17–19 — closed 3 September 2026

**Task 17 — `check:screens`.** Compares the Screen Inventory's 42 citizen
screens against `app.routes.ts` through a checked-in ruling
(`scripts/screen-inventory.map.json`). It does not claim a screen is well
built — it cannot; a route existing is not the screen working. What it makes
impossible is a citizen screen going *unruled-on*. Fails three ways: an
inventory ID the map never mentions, a map entry naming a route the router
lacks, and a map entry for an ID the inventory no longer has. The third
matters as much as the first — a map keeping entries for deleted screens
quietly loses its denominator.

**It found two real gaps on its first run:**

| ID | Screen | Gap |
|----|--------|-----|
| PUB-007 | Reset Password | **Correction (3 Sep):** my first reading of this was wrong. Forgot Password does *not* collect an address and stop — F-5 removed that form deliberately, and the page now says plainly that reset is unavailable and names a real person to contact. The absence is the correct state: nothing issues a reset token, so any screen accepting a new password would set it for whoever opened the URL. Now guarded by a tripwire spec. |
| DOC-003 | Document Preview | A citizen sees that a document is on file and its name, but cannot open it to check they attached the right scan. |

Three more absences are recorded as decisions, not gaps: PUB-001 (splash is a
mobile concept), SHR-004 (no account settings exist behind it — a settings
screen over nothing is four dead controls), and PAY-005 (**no "Payment
Success" screen: nothing was paid** — that screen is the F-14 defect with a
bigger heading).

**Tasks 18 + 19 — `check:a11y` now runs three profiles**, 50 scans:
Chromium 1280×900, Chromium 390×844, WebKit 390×844. The mobile passes also
scan the **open navigation drawer**, a screen state the desktop pass cannot
reach.

**Break-check, and the reason both tasks existed:** stripping the drawer
toggle's accessible name produced **zero violations at 1280×900** and flagged
it on nine screens in each mobile profile. A nav button with no accessible
name would have shipped past the old gate untouched.


---

## Task 20 — closed 3 September 2026

`npm run check:journeys` drives the **built** app in a real browser through three
citizen journeys, 22 assertions. Every piece beneath these journeys was already
covered and the wiring between them was not — the shape of defect that has bitten
this project three times.

1. **File an application end to end** — open the wizard, select a business,
   fill the project details, attach a real file to all 22 document slots,
   accept both declarations, submit. Asserts the **document names survive to
   the application page**, and that nothing claims the application was
   "successfully submitted" (F-14).
2. **A Renewal cannot be filed without naming a permit** — the guard shipped in
   tasks 1–3, exercised through the actual form.
3. **The payment flow** — drives the application it just filed to an assessed
   state through the office's own simulate control, pays it, and checks what
   the screens must never claim: Bank Transfer shows the honest "not available
   yet" state with **no deposit account details** (F-4), the confirmation says
   plainly that no money moved, and the receipt carries a watermark rather than
   passing itself off as official.

### It found a real defect on its first complete run — F-23

**The payments list invited a citizen to pay twice.**

After paying, the list showed balance ₱5,250.00, status **"Awaiting Payment"**,
and a **"Pay Now"** button. The store was right: a submitted payment sits at
`Pending Verification` and the balance correctly does *not* move until the
Treasurer's cashier verifies it. The list was wrong — it derived both the label
and the button from `balanceCentavos > 0` alone, ignoring `paymentStatus`
entirely.

Balance answers *"does the Municipality still expect money"*. It does not answer
*"has this citizen already sent it"*, and only the second question may decide
whether to offer to take a payment.

Fixed: rows now read the submitted payments. `Awaiting Verification` with no Pay
Now while one is pending; `Payment Rejected` **does** offer it again, because
that is the one case where paying a second time is what the office is asking
for. Covered at its own layer too (`payments-list.page.spec.ts`) — but note
**no unit test could have found it**, because every piece was correct alone.

### Two things worth keeping from writing it

- **`page.goto` after sign-in logs the citizen out.** The session is in memory,
  so the first version timed out hunting a step indicator on the login screen —
  a lost session that reads exactly like a broken selector.
- **An assertion passed for the wrong reason.** "The filed application is listed
  under My Applications" matched on the *business name*, which the seed shares —
  so it would have passed even if the application had vanished. It now keys on
  the application number the portal actually minted.


---

## PUB-007 Reset Password — ruled, not built (3 September 2026)

**The right answer to this task was not to build the screen.**

A Reset Password screen needs something that proves the person asking is the
account holder. Nothing in this system issues a reset token — no email, no SMS,
no backend endpoint. A screen that accepted a new password today would set it on
the say-so of whoever opened the URL. That is not an unfinished feature; it is an
account-takeover route with a friendly form on top, and it is the same deception
F-5 removed from Forgot Password, where the screen reported that a reset link had
been sent and nothing had been sent.

**What was actually dangerous here is the task list itself.** PUB-007 sits among
ordinary missing work and reads like ordinary missing work. Someone picks it up,
wires the form to the nearest password setter, and ships an account takeover in
good faith.

So the deliverable is a **tripwire**, `password-reset-tripwire.spec.ts`:

- A route matching `reset` or `recover` may exist **only** once the API client
  has an operation that verifies a reset token. Break-checked: renaming
  `forgot-password` to `reset-password` fails the suite immediately.
- `AuthService` must expose no password setter other than `changePassword`,
  which takes the *current* password as well as the new one.
- And `changePassword` must actually **refuse a wrong current password** — a
  shape check alone is satisfied by a method that ignores its first argument.

**Correction to my own earlier note.** The gate's first PUB-007 entry said
"Forgot Password collects an address and stops". That was wrong, and it was
wrong in the direction that matters: it described a defect the portal had
already fixed. The page collects nothing. Both the map and the table above are
corrected.

**This unblocks only from the backend side** — see the message to the backend
lane for what is needed: an endpoint that issues a single-use, expiring reset
token to a verified address, and one that redeems it.


---

## DOC-003 Document Preview — shipped 3 September 2026

A citizen could see that a document was on file and what it was called, and
could not open it. "Survey Plan — survey-plan.pdf, Uploaded" is exactly as
reassuring when they attached the right scan as when they attached last year's,
and there was no way to tell those apart before an officer did.

Preview is now on **My Documents** and on each document filed against an
application. It shows the bytes the portal actually kept, and says plainly when
it has none — seeded example rows have no file, and an empty frame there would
read as a broken document rather than an absent one.

**The security decision, which is the substance of this change.** The blob's
MIME type comes from our own `SavedDocumentFileType` enum and **never** from
`File.type`. `fileTypeFromName()` reads the extension and falls back to `'pdf'`
for anything it does not recognise, so a file called `notes.html` is stored as a
`'pdf'` while the browser still reports it as `text/html`. Building the blob
from `File.type` would put that HTML at a `blob:` URL — which inherits this
portal's origin — inside an iframe: script execution as the signed-in citizen,
from a file anyone could have handed them to upload. Break-checked by swapping
`mimeFor(type)` for `f.type`; the suite fails.

The preview also checks the **magic bytes** and warns when a file's contents do
not match its extension, so a citizen learns their `.pdf` is not one here rather
than from a rejection weeks later.

### Two defects found while building it

- **My own effect leaked.** `revoke()` read the `objectUrl` signal while the
  effect wrote it, so every write retriggered the effect and created another
  object URL. It exhausted a 4 GB heap in the test run; in a browser it would
  have held a copy of the file in memory for every cycle the preview was open.
  The live URL is now held outside the signal graph.
- **An existing test would have been silently weakened.** "Offers replace only
  where the office asked" asserted `querySelector('button')` was null — and
  every document now carries a Preview button, so that assertion would have
  passed while the replace offer sat on a document the server would 409.
  Narrowed to `[data-action="replace"]`, which is **stricter** than before, and
  re-break-checked to confirm it still catches the original defect.

The a11y sweep now scans the preview dialog as its own screen state: 53 screens
across three profiles.


---

## REN-002 / AMD-002 — what I could decide, and what I could not (3 September 2026)

**I did not shorten the renewal document list, because nothing gives me the
authority to.** I looked: the design docs name "Permit Renewal" only as a
workflow for UI standards, the requirements catalogue mentions renewal only in
validity rules, and the backend contract says nothing at all. Deciding that a
renewal may omit a document is LGU policy. Getting it wrong costs a citizen a
rejected application weeks later, which is worse than the burden of being asked
for one document too many.

**What was decidable, and was a real defect:** the wizard wrote every upload
into the document library and **never once read it back**. "My Documents" listed
everything a citizen had ever uploaded and offered no way to use any of it
again. A renewal made that plain — the same twenty-two files, uploaded a second
time, all already on file.

So:

- **Documents already on file can now be reused**, on every requirement, in
  every application type. Policy-neutral: reusing a document does not change
  which documents are required.
- **The screen says the truth** on a renewal or amendment: the Municipality has
  published no shorter list, so the portal asks for everything rather than
  guessing what it may leave out.

**The dangerous half was the filter.** The library also holds seeded rows with
`file: null`. Offering one would attach a *filename with no document under it* —
the exact defect that cost the mobile app its entire document history,
reintroduced through a convenience feature. Documents without bytes are excluded,
and the tests follow the bytes rather than the name or the count. One of them
guards the guard: it asserts file-less rows actually exist in the seed, or the
exclusion test would pass while checking nothing.

Break-checked. Removing the filter fails two tests. Attaching a hollow document
does not even compile — `AttachedDoc.file` is non-nullable, so that defect is
unrepresentable rather than merely tested.

### Still open — needs a ruling from the Municipality

| Question | Why it matters |
|---|---|
| Which documents may a **renewal** omit? | Twenty-two documents is a real barrier. Some (lot title, survey plan) plausibly have not changed. |
| Which may an **amendment** omit, and does it depend on what is being amended? | Amending a contractor is not amending a structure. |
| Does a reused document need re-certification if it is over a year old? | Some documents carry their own validity; the portal has no rule for this today. |
