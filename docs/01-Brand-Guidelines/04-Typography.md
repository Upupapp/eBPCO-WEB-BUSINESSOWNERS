# 04 Typography

Version: 1.2.0  
Status: Approved  
Document Owner: UI/UX Team  
Last updated: 31 August 2026 — the official font family is now NAMED (see Font Family),
and the Typography Scale now records the scale that actually ships (see Font Weights).

---

# Purpose

Typography is one of the primary elements of the eBPCO visual identity. It establishes readability, hierarchy, consistency, and professionalism across all interfaces.

The typography system must be applied consistently throughout both the Angular Web Administration Portal and the Flutter Mobile Application.

No page or component should introduce a custom typography style outside of this specification.

---

# Typography Principles

The typography system is designed to achieve the following goals:

- Excellent readability
- Clear visual hierarchy
- Professional government appearance
- Cross-platform consistency
- Accessibility compliance
- Responsive scaling

---

# Font Family

**The official eBPCO font family is Gothic A1.**

Owner decision, 31 August 2026. Until that date this section read *"the official
font family shall be the font used by the approved eBPCO interface"*, which is
circular — it defines the font as whatever the interface happens to use, so it
could never be violated and never settled anything. The surfaces duly diverged:
the three web surfaces adopted Gothic A1 while the Flutter mobile app adopted
Poppins, leaving the citizen web portal and the citizen mobile app — one product,
required to be in parity — on different typefaces.

Gothic A1 was chosen because three of the four surfaces already ship it and it is
live in production, and because its Latin set is a clean geometric sans suited to
the English and Filipino text these interfaces render.

**Consequence: the Flutter mobile application must move from Poppins to Gothic
A1.** Until it does, the two citizen surfaces are not in parity.

Licence: Gothic A1 is © HanYang I&C Co., Ltd., released under the SIL Open Font
License 1.1. **The OFL requires the licence and copyright notice to be
distributed with the font**, so any surface that self-hosts it must ship
`OFL.txt` alongside the font files. Self-hosting is preferred over a Google
Fonts `<link>`: the link discloses every visitor's IP address to a third party
before the page paints, and Angular additionally resolves it at *build* time, so
the build fails whenever that host is unreachable. See
`ebpco-user-portal/src/fonts.scss` for a working reference implementation
(Latin and Latin-Extended subsets only, Google's own `unicode-range` values
preserved, `OFL.txt` shipped beside the faces).

If future changes are required, they must be documented and approved before
implementation.

Fallback order:

```
Gothic A1
System UI (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
Helvetica
Arial
Sans-serif
```

---

# Font Weights

| Weight | Usage |
|---------|------|
| Light (300) | Not used. Not bundled. |
| Regular (400) | Body text |
| Medium (500) | Labels, secondary link text |
| SemiBold (600) | Buttons, table headers, form labels |
| Bold (700) | Headings 3-6, badges |
| Extra Bold (800) | Headings 1-2, and display / hero type |

Extra Bold (800) is reserved for Headings 1-2 and display type. Do not use it
for body copy, labels, buttons or table text.

> **Settled 31 August 2026 (owner).** This table and the Typography Scale below
> previously specified 700 for main headings and 600 for Headings 2-6, and told
> implementers to avoid Extra Bold. **No surface ever implemented that scale.**
> The shipping scale was systematically smaller *and* heavier at every level —
> a coherent, denser, bolder scale that someone designed and nobody wrote down.
>
> The ruling is that **the shipping scale is authoritative**, and this document
> has been corrected to describe it. That is why the numbers above and below
> changed rather than the code: the code is live on a production portal, is
> internally consistent, and was evidently a deliberate design; the documented
> scale existed only here.
>
> Recorded so the next reader knows this was decided, not drifted into. If the
> UI/UX Team wants the lighter scale, that is a fresh decision and it must move
> all four surfaces together.
>
> Weight 300 (Light) is used zero times and is not bundled — the table now says
> so rather than calling it "rarely used".

---

# Typography Scale

## Display

Purpose

Landing pages

Marketing

Large dashboard titles

Desktop

48px

Tablet

42px

Mobile

36px

Weight

700

---

## Heading 1

Purpose

Main page titles

Desktop

28px

Tablet

28px

Mobile

24px

Weight

800

---

## Heading 2

Purpose

Section titles

Desktop

22px

Tablet

22px

Mobile

20px

Weight

800

---

## Heading 3

Purpose

Cards

Forms

Dashboard widgets

Desktop

18px

Tablet

18px

Mobile

17px

Weight

700

---

## Heading 4

Purpose

Cards

Tables

Panels

Desktop

16px

Tablet

16px

Mobile

16px

Weight

700

---

## Heading 5

Desktop

14px

Tablet

14px

Mobile

14px

Weight

700

---

## Heading 6

Desktop

13px

Tablet

13px

Mobile

13px

Weight

700

---

## Body Large

Desktop

16px

Tablet

16px

Mobile

16px

Weight

400

Usage

Primary reading content

---

## Body

Desktop

14px

Tablet

14px

Mobile

14px

Weight

400

Usage

Forms

Tables

Descriptions

General content

---

## Small Text

Desktop

12px

Tablet

12px

Mobile

12px

Usage

Supporting information

Helper text

Metadata

---

## Caption

Desktop

11px

Tablet

11px

Mobile

11px

Usage

Image captions

Footnotes

System information

---

# Button Typography

Buttons should use:

Weight

600

Desktop

14px

Mobile

14px

Text should use sentence case.

Examples:

```
Submit Application
```

Not:

```
SUBMIT APPLICATION
```

---

# Form Typography

Labels

14px

Weight

500

Placeholder

14px

Weight

400

Helper Text

12px

Weight

400

Validation Messages

12px

Weight

500

---

# Table Typography

Header

14px

Weight

600

Body

14px

Weight

400

Footer

12px

Weight

400

---

# Navigation Typography

Sidebar

14px

Weight

500

Top Navigation

14px

Weight

500

Breadcrumb

13px

Weight

400

---

# Card Typography

Statistic Number

32px

Weight

700

Statistic Label

14px

Weight

500

Description

12px

Weight

400

---

# Line Height

Recommended:

120%

Large headings

140%

Body text

150%

Long paragraphs

---

# Letter Spacing

Default

0

Headings

0

Body

0

Buttons

0.2px

Do not introduce decorative spacing.

---

# Text Alignment

Default

Left

Numbers

Right (within tables)

Statistics

Center or Left depending on layout

Avoid justified text.

---

# Accessibility

Minimum body text:

14px

Minimum contrast:

WCAG AA compliant

Avoid:

- Extremely thin fonts
- Decorative fonts
- Low contrast text
- Excessive uppercase text

---

# Responsive Behaviour

Typography should scale proportionally between desktop, tablet, and mobile while maintaining hierarchy.

Never reduce body text below 14px for standard reading content.

---

# Developer Guidelines

Angular

Typography values should be implemented through shared SCSS variables or design tokens.

Flutter

Typography should be defined in ThemeData using centralized TextTheme definitions.

Developers must not hardcode typography values within individual components.

---

# Governance

Any typography change requires:

1. Design review
2. Documentation update
3. Approval
4. Component update
5. Implementation

---

# Approval

Project

Electronic Building Permit and Certificate of Occupancy (eBPCO)

Platforms

- Angular Web Administration Portal
- Flutter Mobile Application

Status

Approved

Version

1.0.0