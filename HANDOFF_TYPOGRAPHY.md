# HANDOFF — typography ruling and the duplicated brand guideline

**To:** the admin portal (`Upupapp/eBPCO-Web`), the information website
(`Upupapp/eBPCO-Website`), and the mobile app (`Upupapp/eBPCOMobile`).
**From:** the citizen web portal lane (`Upupapp/eBPCO-WEB-BUSINESSOWNERS`).
**Date:** 31 August 2026. Nothing was fixed in your repositories — different lane.

Two owner decisions you need, and one structural problem that will undo both
unless somebody owns it.

---

## 1. THE STRUCTURAL PROBLEM — read this first          [urgent]

**`docs/` exists as a separate copy in each repository, and the copies have
drifted in BOTH directions.** Measured read-only on 31 August, then partly
reconciled from this side.

**Correction to an earlier draft of this handoff.** It said your copies were
stale and this repo's was current. That was wrong, and the error is instructive:
this repo's copy carried the **superseded product name** — *"Electronic Business
Permit and Clearance Office"* — **223 times across 156 files**, while yours had
already been corrected to *"Electronic Building Permit and Certificate of
Occupancy"*. Neither copy was simply ahead. **"Pick one and overwrite" would have
destroyed real work in whichever direction it ran.**

Now reconciled from this side (commit `f1e1dc9`): **154 of 158 files are
byte-identical** to your copies. Four remain, and on those this repo is ahead —
see section 5 for a patch that applies cleanly.

The clearest illustration of the defect: **the "Maximalist Motion Exception",
written explicitly for the Angular Web Admin Portal, exists only in the CITIZEN
portal's copy.** The admin repo does not have its own exception.

**Owner decision, 31 August 2026: `docs/` moves to its own repository —
`Upupapp/eBPCO-Design-System` — consumed by all four surfaces.**

Each surface references it (submodule, or a pull step in the build) instead of
holding a copy. One place to rule, one version number, and a stale copy becomes
*impossible* rather than merely discouraged. This is not a lane's decision to
implement alone; it needs the four repos to move roughly together.

Suggested order, so nothing is lost:

1. Create the new repo from **this repo's `docs/` at `f1e1dc9`** — it is the
   only copy that now carries both the correct product name *and* the four
   ahead-files. Verify before trusting that: `diff -r` it against your copy and
   expect exactly the four files in section 5.
2. Each surface removes its `docs/` and references the new repo.
3. Leave a `docs/README.md` pointer where the directory was, so the next agent
   who looks for it finds the new home rather than assuming it was deleted.

**Do not hand-merge four copies.** That is how bidirectional drift becomes
silent data loss.

**One thing deliberately NOT fixed.** Both this repo and yours contain **46**
occurrences of "Business Permit" that are *not* the product name — "Business
Permit Application", "Business Permit Renewal". Identical count on both sides,
which is evidence they were left alone deliberately in your rename too. A
business permit is a different permit from a building permit, so blanket
replacing that phrase is a trap. Whether those 46 are correct is an estate-wide
question and no single lane should settle it.

## 2. RULING: the official typeface is Gothic A1

Owner, 31 August 2026. Recorded in this repo at commit `de8a47c`, guideline
v1.1.0.

The section previously read *"the official font family shall be the font used by
the approved eBPCO interface"* — circular. It defines the font as whatever the
interface happens to use, so it could never be violated and never settled
anything. Its fallback stack listed `Primary Font` as a literal placeholder. A
grep of the whole `docs/` tree found no document naming a typeface anywhere.

**What this means for you:**

- **Admin and website** — already on Gothic A1. No visual change. Update your
  copy of the guideline (or adopt the canonical one) so it says so.
- **Mobile** — you are on **Poppins** and must move to **Gothic A1**. Until you
  do, the citizen web portal and the citizen mobile app are not in parity, and
  the owner has ruled those two are one product.

**Two obligations come with the typeface:**

**Ship `OFL.txt`.** Gothic A1 is © HanYang I&C Co., Ltd. under the SIL Open Font
License 1.1, which *requires* the licence and copyright notice to be distributed
with the font. Self-hosting turns a Google-served font into one **you
redistribute** — the obligation moves to your repo along with the files. This
lane shipped ten faces without it and had to fix it; do not repeat that.

**Self-host, never `<link>` Google Fonts.** Two independent reasons. Every
visitor's IP is disclosed to Google before the page paints — worse on a
signed-in surface than a public one. And Angular resolves the link at **build**
time, so `ng build` fails ("Inlining of fonts failed") whenever
`fonts.googleapis.com` is unreachable from the build image. The website lane hit
that twice on 31 August. **Admin: you still carry those three `<link>` lines.**

Reference implementation, copy it: `ebpco-user-portal/src/fonts.scss` plus
`public/assets/fonts/`. Latin and Latin-Extended subsets only, Google's own
`unicode-range` values preserved verbatim, `OFL.txt` beside the faces. Ten files,
153 kB.

**One gotcha, and check it rather than copying the answer.** Grep for
`font-weight` before choosing which weights to bundle. Weight 500 is unused on
the information website and *is* used here (three times in `dashboard.page.scss`).
Same source link, two surfaces, two correct answers.

---

## 3. RULING: the SHIPPING heading scale is authoritative

Owner, 31 August 2026. This repo, commit `c446418`, guideline v1.2.0.

The document and the code disagreed **systematically, not by drift** — at every
level the code was *smaller and heavier* than the approved spec:

| Level | Documented | Shipping (now authoritative) |
|---|---|---|
| H1 | 32px / 700 | **28px / 800** |
| H2 | 28px / 600 | **22px / 800** |
| H3 | 24px / 600 | **18px / 700** |
| H4 | 20px / 600 | **16px / 700** |
| H5 | 18px / 600 | **14px / 700** |
| H6 | 16px / 600 | **13px / 700** |

That is a coherent denser, bolder scale somebody designed and nobody wrote down,
and **no surface ever implemented the documented one**. The ruling corrects the
document rather than the code: the code is live, internally consistent, and
changing it would restyle every heading on production.

`h5` and `h6` previously had **no `font-size` rule at all** in this repo and fell
through to a blanket `font-weight: 800`, so the first `<h5>` anyone wrote would
have rendered at the browser default in Extra Bold. **Check your own stylesheet
for the same hole** — a blanket `h1, h2, h3, h4, h5, h6` rule plus per-level
overrides very easily leaves the last two levels undefined.

---

## 4. THE GATE — take it, it is portable

`ebpco-user-portal/scripts/check-heading-scale.mjs` reads a stylesheet, reads the
guideline, and fails if they disagree. Paths are arguments:

```sh
node scripts/check-heading-scale.mjs <stylesheet> <guideline>
# defaults: src/styles.scss  ../docs/01-Brand-Guidelines/04-Typography.md
```

Wire it into your build script the way this repo does (`npm run verify` runs
`check:assets && check:print && check:labels && check:headings && build && test`).

**Why a gate and not just an edit.** A stylesheet and a Markdown file have no
reason to be compared, so nothing ever compared them, so they drifted for the
life of the project without anyone being at fault. The edit fixes today; the gate
fixes the class.

Proof it works, run just now against the admin repo's stale copy:

```
✘ heading-scale check FAILED
  - h1: code is 28px, the guideline says 32px
  - h1: code is weight 800, the guideline says 700
  - h2: code is 22px, the guideline says 28px
  ...
```

**Two cautions:**

**It is CSS-only. Mobile cannot use this file.** Flutter has no stylesheet. The
*idea* transfers — assert the shipped `TextTheme` against the guideline — but it
needs a Dart implementation. Do not wire this in and believe you are covered.

**Run it against a state you already believe is good, before you trust it.** On
its first run here it reported `h6` as unsized while `h6` was defined a few lines
below: an unanchored `h6 {` also matches the *tail* of the blanket rule
`h1, h2, h3, h4, h5, h6 {`, which has no `font-size`. The gate found its own bug.
A first run that passes teaches you nothing; a first run that fails on
known-good input has just found something.

---

## 5. THE FOUR FILES WHERE THIS REPO IS AHEAD — patch attached

`docs-sync/2026-08-31-design-system-ahead-of-admin-and-website.patch`

| File | Change |
|---|---|
| `01-Brand-Guidelines/04-Typography.md` | v1.0.0 → **v1.2.0** — Gothic A1 named, shipping heading scale |
| `02-Design-System/10-Motion.md` | v1.0.0 → **v1.1.0** — Maximalist Motion Exception |
| `01-Brand-Guidelines/19-Do-and-Dont.md` | v1.0.0 → **v1.1.0** — the same exception, cross-referenced |
| `08-Reusable-Stitch/04-Screen-Inventory.md` | fuller PUB-001..005 inventory |

Apply from the directory **containing** `docs/`:

```sh
git apply --check docs-sync/2026-08-31-design-system-ahead-of-admin-and-website.patch   # dry run
git apply         docs-sync/2026-08-31-design-system-ahead-of-admin-and-website.patch
```

Generated against your copies as the baseline (admin and website are
byte-identical to each other) and **tested**: applied to a pristine copy of the
admin `docs/`, it applies cleanly and reproduces all four files exactly. The two
`trailing whitespace` warnings are Markdown hard line breaks and are intended.

If the design-system repo lands first, skip this — take `docs/` from this repo at
`f1e1dc9` instead and the four files come with it.

---

## Provenance

Everything above was measured, not assumed. The typography defects were found
while sweeping this portal, and the Google-Fonts and build-budget findings were
raised independently by the information-website lane in its own handoff — the two
readings matched exactly, which is why they are stated as fact rather than
opinion. The full record is `SWEEP-2026-08-31.md` in this repository.

