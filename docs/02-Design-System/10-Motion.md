# 10 Motion

Version: 1.1.0
Status: Approved
Document Owner: UI/UX Team

Category: Interaction

---

# Purpose

The Motion System defines the animation and transition standards used throughout the eBPCO ecosystem.

Motion should enhance usability by providing visual feedback, reinforcing interactions, and guiding users through workflows. Animations should never distract from completing government services.

This document applies to both the Angular Web Administration Portal and the Flutter Mobile Application.

---

# Objectives

The Motion System exists to:

- Improve user experience.
- Provide visual feedback.
- Reinforce interaction states.
- Create smooth transitions.
- Improve perceived performance.
- Standardize animation behavior.
- Support accessible interfaces.
- Improve AI-assisted frontend development.

---

# Design Principles

Motion should be:

- Purposeful
- Subtle
- Consistent
- Predictable
- Accessible
- Fast
- Non-blocking

Animations should communicate intent rather than decoration.

---

# Maximalist Motion Exception (Angular Web Admin Portal)

As of version 1.1.0 (2026-08-27), the Angular Web Administration Portal deliberately runs a denser, more expressive motion treatment across all of its screens — not only the brand/auth moments this document otherwise reserves richer motion for. This was requested and approved by the Web Admin UI Lead (michaela@lguids.com.ph) under this document's own Governance rule that new animation patterns require UI/UX Team review before implementation; this section is that review record.

Scope: this exception applies **only** to the Angular Web Administration Portal. The Flutter Mobile Application continues to follow the restrained motion system described in the rest of this document, unchanged.

What the exception does **not** relax:

- The "Hardcoded Animations" rule below still applies in full — every duration, easing curve, and keyframe used anywhere in the Admin Portal routes through the centralized tokens in `shared/styles/_motion.scss`, extended for this pass with: `$dur-stagger-step`, `$dur-count-up`, `$dur-chart-draw`, `$dur-page` (durations), `$ease-emphasis`, `$ease-draw` (easings), and shared keyframes `stagger-in`, `skeleton-shimmer`, `pill-swap`, `count-pop`.
- The Accessibility section's reduced-motion requirements remain in full force, with no Admin Portal carve-out — every new animation is still caught by the app-wide `prefers-reduced-motion` kill-switch, and the two JS-timed additions (KPI count-up, chart draw-in) each check the media query directly and render their final state instantly when motion is reduced.
- Motion must still be purposeful, not decorative — see the corresponding note added to `01-Brand-Guidelines/19-Do-and-Dont.md`.

---

# Motion Categories

The Design System defines the following motion categories:

- Page Transitions
- Component Transitions
- Hover Animations
- Focus Animations
- Loading Animations
- Navigation Animations
- Dialog Animations
- Notification Animations
- Status Animations

Each category should follow the approved motion standards.

---

# Transition Durations

Motion durations should use centralized duration tokens.

Examples:

```
motion-instant

motion-fast

motion-normal

motion-slow
```

Applications should avoid arbitrary animation durations.

---

# Easing

Animations should use approved easing curves.

Examples:

```
ease-standard

ease-in

ease-out

ease-in-out
```

The same easing functions should be used consistently throughout the application.

---

# Page Transitions

Page transitions should:

- Feel smooth.
- Complete quickly.
- Preserve user orientation.
- Avoid excessive movement.

Recommended transitions:

- Fade
- Slide
- Fade + Slide (where appropriate)

Complex transitions are discouraged.

The Angular Web Admin Portal implements page transitions via a plain CSS `animation` on each routed page's own host element (no `@angular/animations`, no View Transitions API) — a small `page-in` mount keyframe layered on top of each page's existing entrance animation. This satisfies the "Fade + Slide" pattern above without introducing a second animation system into a codebase that is otherwise 100% hand-rolled CSS.

---

# Component Transitions

Interactive components should animate appropriately.

Examples:

- Expansion panels
- Accordions
- Dropdown menus
- Side drawers
- Bottom sheets
- Floating menus

Transitions should remain responsive and unobtrusive.

---

# Hover Animations

Desktop interactions may include:

- Background color changes
- Shadow changes
- Elevation changes
- Border emphasis

Hover animations should not delay user interaction.

Flutter should not implement hover effects except on desktop platforms.

---

# Focus Animations

Focused elements should provide clear visual feedback.

Examples:

- Focus ring
- Border highlight
- Subtle color transition

Focus indicators must remain visible for keyboard users.

---

# Loading Animations

Loading indicators should communicate system activity without causing distraction.

Approved loading components include:

- Circular progress indicators
- Linear progress indicators
- Skeleton loaders
- Button loading states

Avoid decorative loading animations.

---

# Dialog Animations

Dialogs should:

- Fade into view.
- Scale subtly where appropriate.
- Close smoothly.

Animations should not interfere with user interaction.

---

# Navigation Animations

Navigation components should transition consistently.

Examples:

- Sidebar expansion
- Drawer opening
- Bottom navigation changes
- Page navigation

Navigation animations should preserve spatial orientation.

---

# Notification Animations

Notifications should:

- Enter smoothly.
- Exit automatically when appropriate.
- Avoid covering critical interface elements.

Examples:

- Snackbars
- Toast messages
- Alert banners

---

# Status Animations

Status changes may include subtle animations.

Examples:

- Success confirmation
- Progress completion
- Upload completion
- Approval indicators

Animations should reinforce workflow without distracting users.

---

# Accessibility

Motion must support users with motion sensitivity.

Applications should:

- Respect operating system motion preferences.
- Reduce non-essential animations.
- Avoid flashing effects.
- Avoid rapid movement.
- Never rely on animation alone to communicate information.

Users must still understand interface changes when animations are disabled.

---

# Platform Implementation

## Angular

Motion should be implemented using:

- Angular Animations
- CSS transitions
- CSS keyframes (where appropriate)

Animations should be centralized and reusable.

---

## Flutter

Motion should be implemented using:

- AnimatedContainer
- AnimatedOpacity
- AnimatedSwitcher
- Hero (where appropriate)
- AnimationController
- Theme animations

Widgets should avoid custom animation implementations unless required.

---

# Hardcoded Animations

Hardcoded animation timings and easing curves are prohibited except for documented exceptions approved by the UI/UX Team.

---

# AI Development Guidelines

AI-generated code must:

- Use approved motion tokens.
- Reuse existing animation patterns.
- Respect accessibility preferences.
- Avoid unnecessary animations.
- Maintain consistent transition behavior across Angular and Flutter.

---

# Governance

All animations within the eBPCO ecosystem must comply with the approved Motion System.

New animation patterns require UI/UX Team review before implementation.

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

1.1.0