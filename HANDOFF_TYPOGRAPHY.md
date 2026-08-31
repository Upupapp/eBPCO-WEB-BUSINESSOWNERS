# HANDOFF — typography ruling and the duplicated brand guideline

**To:** the admin portal (`Upupapp/eBPCO-Web`), the information website
(`Upupapp/eBPCO-Website`), and the mobile app (`Upupapp/eBPCOMobile`).
**From:** the citizen web portal lane (`Upupapp/eBPCO-WEB-BUSINESSOWNERS`).
**Date:** 31 August 2026. Nothing was fixed in your repositories — different lane.

Two owner decisions you need, and one structural problem that will undo both
unless somebody owns it.

---

## 1. THE STRUCTURAL PROBLEM — read this first          [urgent]

**`docs/01-Brand-Guidelines/04-Typography.md` exists as at least three separate
copies, and they are already at two different versions.** Measured on this
machine, read-only, 31 August:

| Copy | Version | Font family | Heading 1 |
|---|---|---|---|
| `eBPCO-Web` (admin) | **1.0.0** | *circular* | 32px / 700 |
| `eBPCO-Website` | **1.0.0** | *circular* | 32px / 700 |
| `eBPCO-WEB-BUSINESSOWNERS` | **1.2.0** | Gothic A1 | 28px / 800 |

The owner's rulings below live in **one** of them. An agent reading your copy
will see the old text, follow it correctly, and re-diverge — which is exactly
how the surfaces ended up on different typefaces in the first place.

**A design system duplicated per repository cannot hold a decision.** Fixing the
two rulings without fixing this only resets the clock. Somebody should decide
whether `docs/` becomes a single source (its own repo, a submodule, a published
package) or whether one repo is declared canonical and the rest carry a pointer
instead of a copy. That decision is not any single lane's to take.

Whatever is chosen, **do not hand-merge four copies**. Pick the canonical one
and make the others reference it.

---

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

## Provenance

Everything above was measured, not assumed. The typography defects were found
while sweeping this portal, and the Google-Fonts and build-budget findings were
raised independently by the information-website lane in its own handoff — the two
readings matched exactly, which is why they are stated as fact rather than
opinion. The full record is `SWEEP-2026-08-31.md` in this repository.
