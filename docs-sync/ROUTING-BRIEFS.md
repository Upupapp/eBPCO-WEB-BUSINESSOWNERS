# Routing briefs — four short messages, one per lane

Paste the relevant block to each lane. Each is self-contained. Full detail is in
`HANDOFF_TYPOGRAPHY.md`; the patch is in `docs-sync/`.

**Updated 31 August 2026.** The patch is now **37 files**, not 4. Anything sent
from an earlier draft is stale.

---

## → ADMIN PORTAL (`Upupapp/eBPCO-Web`)

From the citizen web portal lane, 31 August 2026. All measured.

**1. Your `docs/` needs a 37-file patch.** Two owner rulings you do not have —
**Gothic A1** is the official typeface, and the **shipping** heading scale is
authoritative (your copy says H1 32px/700; the real scale is 28px/800). Plus a
correction across 33 files: the example copy said **"Business Permit"** 46 times,
a permit this product does not issue, and three of those told a citizen to claim
their permit at the **"Business Permit Office"** rather than the Office of the
Municipal Engineer. That wrong example copy reached our production code twice.

**2. The "Maximalist Motion Exception" written for YOUR portal is not in your
repo.** It exists only in the citizen portal's copy. It is in the same patch.

**3. You still `<link>` Google Fonts, and it is a BUILD failure mode.** Angular
inlines linked Google fonts at *build* time, so `ng build` fails ("Inlining of
fonts failed") whenever `fonts.googleapis.com` is unreachable from the build
image — the website lane hit this twice on 31 August. It also discloses every
visitor's IP to Google before the page paints, which matters more on a
signed-in staff tool. Self-host: `ebpco-user-portal/src/fonts.scss` is a tested
reference. **Ship `OFL.txt` with it** — Gothic A1 is SIL OFL 1.1 and
self-hosting makes you the redistributor. We shipped ten faces without it and
had to fix that.

**4. Four gate shapes yours does not cover.** Your `scripts/gates.mjs` is good —
orphans, write-only signals, double casts, notice, delete, icon — and none of
ours duplicates it. Ours adds: **form labels** (`for=`/`id`; we had 50 controls,
49 labels and zero `for` attributes — a screen reader said "edit text, blank"
for the whole registration form), **axe on the rendered DOM** (16 screens),
**print safety** (the app shell printed across the permit document and the
watermark could be dropped as ink-saving), and **heading scale vs the
guideline**. All are in `ebpco-user-portal/scripts/`.

**5. Two things to check on your own, which we got wrong:** your form controls'
`font-size` — **under 16px makes iOS Safari zoom the page on every field focus**
and it does not zoom back — and your sidebar on a phone. Ours was a fixed 290px
at every width, leaving a 100px content column; **yours is better** (260px with
a 900px breakpoint to a 76px icon rail, so ~314px of content on a 390px phone)
but it is still a rail rather than a drawer, and icon-only navigation needs
accessible names.

Get it: `git clone --depth 1 https://github.com/Upupapp/eBPCO-WEB-BUSINESSOWNERS.git`

---

## → INFORMATION WEBSITE (`Upupapp/eBPCO-Website`)

Reply to your handoff, plus rulings and a bigger patch.

**Your two findings were already fixed here before your handoff arrived** — the
CSS budget build failure and the Google Fonts fetch, both in `8e2da0a`, both
live. Your measurements matched ours exactly, which is a useful cross-check.

**You were right about something we got wrong.** Gothic A1 is SIL OFL 1.1 and the
licence *requires* shipping `OFL.txt` with the font. Self-hosting made us the
redistributor and we shipped ten faces without it. Fixed — check your own copy.

**Your weight-500 caution does not generalise.** Unused on your surface; used
three times on ours. Grep `font-weight` per surface rather than copying the
conclusion.

**The patch is now 37 files, not 4.** Two owner rulings (Gothic A1; the shipping
heading scale is authoritative) plus the 46 "Business Permit" corrections across
33 files. Rehearsed against *your actual* `docs/`: applies cleanly and leaves all
158 files byte-identical to ours.

**`docs/` is moving to its own repo** — `Upupapp/eBPCO-Design-System`, owner
decision. Seed it from our `docs/`; it is the only copy with both the correct
product name and the four ahead-documents.

Get it: `git clone --depth 1 https://github.com/Upupapp/eBPCO-WEB-BUSINESSOWNERS.git`

---

## → MOBILE APP (`Upupapp/eBPCOMobile`)

Two owner rulings that require work on your surface, and one warning.

**1. Move from Poppins to Gothic A1.** The owner has named Gothic A1 the official
eBPCO typeface. You are the only surface not on it, so the citizen web portal and
the citizen mobile app — one product the owner requires to be **in parity** — do
not share a typeface. **The licence travels with the font**: Gothic A1 is
© HanYang I&C under SIL OFL 1.1, and bundling it in the app makes you the
redistributor, so ship the licence and copyright notice with it.

**2. The heading scale is settled**: H1 28/800, H2 22/800, H3 18/700, H4 16/700,
H5 14/700, H6 13/700. The documented 32px/700 scale was never implemented
anywhere and has been corrected in the guideline.

**3. Our heading gate exists but you CANNOT use the file.**
`check-heading-scale.mjs` asserts the stylesheet against the guideline. Flutter
has no stylesheet, so the *idea* transfers — assert the shipped `TextTheme`
against the guideline — but it needs a Dart implementation. Do not wire in the JS
file and assume you are covered.

**Worth knowing from our mobile work:** touch targets below 44px and form fields
below 16px are the two defects we found that a desktop review never surfaces. The
44px minimum applies to your surface directly.

Get it: `git clone --depth 1 https://github.com/Upupapp/eBPCO-WEB-BUSINESSOWNERS.git`

---

## → BACKEND (`Upupapp/eBPCOBackend`)

From the citizen web portal lane, 31 August 2026. Read-only inspection of
`ebpco-api` at `5a0f18a`; nothing was changed there.

**The public permit-verification page cannot answer, and the reason is in your
schema.** `generated_permits` is six columns:

```sql
create table generated_permits (
  application_id  uuid        primary key references applications (id),
  permit_number   text        not null unique,
  issued_date     timestamptz not null,
  scope           text,
  conditions      text[]      not null default '{}',
  generated_by    uuid        not null references accounts (id)
);
```

**There is no status column, no revocation, and no expiry.** Once a permit row
exists it is permanent and unqualified: the schema has no way to say a permit was
withdrawn, suspended or cancelled, and no way to say when it lapses. The only
"revoked" in the codebase is refresh-token revocation in `001_identity.sql` and
`014_revoked_sessions.sql` — that is session auth, not permits. The application
lifecycle ends at `released`.

### Why this reached us

Our `/verify/:permitNumber` page used to compute validity: *issued and not
expired → **Valid***. That derivation has no term for revocation, so the moment
a backend set a permit to issued, **a permit the Municipality had revoked would
have been reported to the public as Valid**. Nobody would have had to make a
mistake; it was the default.

We have removed the derivation. The page now only relays an explicit standing
from the record and reports **Unverified** when it has none — which today is
always, because there is nothing to relay. `PermitStanding` and
`standing: PermitStanding | null` are the seam, in
`ebpco-user-portal/src/app/core/domain/permit.model.ts`. Nothing on our side
sets them.

### Four questions, and they need answering BEFORE the first real permit issues

1. **What are the withdrawn states?** We render `Revoked`, `Suspended`,
   `Cancelled` — that is what our page can display, **not** a claim about
   Castilla's model. Yours is the definition.
2. **Who may set them?** Issuing is already audited via `generated_by`.
   Withdrawing a live permit is at least as consequential — is it four-eyes,
   like the other consequential actions in this system?
3. **How does the portal learn?** Is standing returned with the permit, or must
   verification be a live call? **A cached "Valid" for a permit revoked this
   morning is the same defect in a different place.**
4. **Is a revoked permit's existence public?** "This number was revoked"
   discloses more than "no record found". That is a policy call, not a technical
   one, and it changes what the endpoint may return to an unauthenticated
   caller.

### One more, found while looking

**There is no `expiry_date` on `generated_permits`**, yet the LGU's own permit
conditions read *"Valid for twelve (12) months from issuance; work must commence
within one year or the permit lapses"*, and our document renders a "Valid Until"
date. Today that date is computed client-side from a validity period in our own
catalogue. **A lapse date that only the client knows is not a fact the
Municipality holds** — if the office ever changes a validity period, or grants an
extension, nothing in the record reflects it.

Get our side: `git clone --depth 1 https://github.com/Upupapp/eBPCO-WEB-BUSINESSOWNERS.git`
then read `SWEEP-2026-08-31.md` (see L-2) and `permit.model.ts`.
