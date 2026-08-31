# Routing briefs — three short messages, one per lane

Paste the relevant block to each lane. Each is self-contained and states only
what that lane must act on. The full detail is in `HANDOFF_TYPOGRAPHY.md`.

---

## → ADMIN PORTAL (`Upupapp/eBPCO-Web`)

Three things from the citizen web portal lane, measured 31 August 2026.

**1. You still `<link>` Google Fonts, and it can fail your build.** Angular
inlines linked Google fonts at *build* time, so `ng build` calls
`fonts.googleapis.com` and fails ("Inlining of fonts failed") whenever that host
is unreachable from the build image. The information-website lane hit this twice
on 31 August. It also discloses every visitor's IP to Google before the page
paints — worse on a signed-in surface. Self-host instead; there is a tested
reference implementation to copy.

**2. Your `docs/` is missing two rulings and four documents.** The owner has
named **Gothic A1** as the official typeface and ruled that the **shipping**
heading scale is authoritative (your copy still says 32px/700; the real scale is
28px/800). A tested patch is attached that brings four files up to date.

**3. The "Maximalist Motion Exception" written for YOUR portal is not in your
repo.** It exists only in the citizen portal's copy of `docs/`. It is in the same
patch.

Also: `docs/` is moving to its own repository, `Upupapp/eBPCO-Design-System`
(owner decision). Your copy and the citizen portal's are now byte-identical on
154 of 158 files.

Get everything: `git clone --depth 1 https://github.com/Upupapp/eBPCO-WEB-BUSINESSOWNERS.git`
then read `HANDOFF_TYPOGRAPHY.md`.

---

## → INFORMATION WEBSITE (`Upupapp/eBPCO-Website`)

Reply to your handoff, plus two rulings.

**Your two findings were already fixed here before your handoff arrived** — the
CSS budget build failure and the Google Fonts fetch, both in commit `8e2da0a`,
both live. Your measurements matched ours exactly (landing 9.80 kB, dashboard
8.99 kB, onboarding 6.56 kB), which is a useful cross-check.

**You were right about something we got wrong.** Gothic A1 is SIL OFL 1.1 and
the licence *requires* shipping `OFL.txt` with the font. Self-hosting made us the
redistributor and we shipped ten faces without it. Fixed — check your own copy.

**Your weight-500 caution does not generalise.** It was unused on your surface;
it *is* used here, three times. Grep `font-weight` per surface rather than
copying the conclusion.

**Two owner rulings for your `docs/`:** Gothic A1 is the official typeface, and
the shipping heading scale (28px/800, not 32px/700) is authoritative. Tested
patch attached. `docs/` is also moving to its own repo.

Get everything: `git clone --depth 1 https://github.com/Upupapp/eBPCO-WEB-BUSINESSOWNERS.git`
then read `HANDOFF_TYPOGRAPHY.md`.

---

## → MOBILE APP (`Upupapp/eBPCOMobile`)

Two owner rulings that require work on your surface.

**1. Move from Poppins to Gothic A1.** The owner has named Gothic A1 the
official eBPCO typeface. You are the only surface not on it. Until you move, the
citizen web portal and the citizen mobile app — one product the owner requires to
be in parity — do not share a typeface.

**The licence travels with the font.** Gothic A1 is © HanYang I&C under SIL OFL
1.1, which requires the licence and copyright notice to ship with it. Bundling it
in the app makes you the redistributor.

**2. The heading scale is settled**: H1 28px/800, H2 22px/800, H3 18px/700,
H4 16px/700, H5 14px/700, H6 13px/700. The documented 32px/700 scale was never
implemented anywhere and has been corrected.

**A gate exists but you cannot use the file.** `check-heading-scale.mjs` asserts
the stylesheet against the guideline. Flutter has no stylesheet, so the *idea*
transfers — assert the shipped `TextTheme` against the guideline — but it needs a
Dart implementation. Do not wire in the JS file and assume you are covered.

Get everything: `git clone --depth 1 https://github.com/Upupapp/eBPCO-WEB-BUSINESSOWNERS.git`
then read `HANDOFF_TYPOGRAPHY.md`.
