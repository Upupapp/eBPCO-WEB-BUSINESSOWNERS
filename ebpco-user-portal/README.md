# eBPCO User Portal

The business-owner-facing web application for eBPCO — built directly from
`eBPCO-User-Portal-Master-Command.pdf` (repo root), which itself was compiled
from the real Admin Portal (`EBPCO WEB ADMIN/E-BPCO-Software-main`) and the
Flutter mobile app (`ebpco-mobile`). Angular 22, standalone components,
signals — same stack as the Admin Portal, so the domain models below can be
shared/reconciled later.

## Running it

```bash
npm install
npx ng serve
```

Open `http://localhost:4200/`. Demo account: `juan.delacruz@example.com` / `Password1`.

## What's implemented (master command Sections 3–11)

- **Auth**: 3-step register, login, forgot-password — mock/local, matching the
  convention already used by both existing apps (no backend exists anywhere
  in eBPCO yet — see master command Section 15).
- **Dashboard**, **My Businesses** (register/list/details, multi-business per
  account), **My Documents** library (9 categories, matches mobile exactly).
- **Permit Services**: the full 19-permit-type catalog from
  `core/domain/requirements-catalog.ts` (ported from the Admin Portal's own
  catalog, same document lists, same verification-status honesty convention),
  browsable as a Requirements Checklist before applying.
- **Application Wizard**: see "Architecture decision" below.
- **My Applications** / **Application Details**: status timeline, applicant-facing
  7-status vocabulary (`core/domain/status.model.ts`), assessment view, permit
  download affordance.
- **Payments**: Bank Transfer / Onsite, "Payment Acknowledgment" vs "Official
  Receipt" rule preserved.
- **Notifications**, **Profile** (edit profile, change password, notification
  preferences, legal), **Help & Support**.

## Architecture decision: one dynamic wizard, not 19

`ebpco-mobile` implements each of its 19 permit types as its own multi-step
wizard (9 files each for Building Permit alone). This portal instead has
**one** catalog-driven wizard
(`features/permits/application-wizard.page.ts`) that reads its document
checklist from `requirements-catalog.ts` for whichever permit type was
selected — same document/feature coverage per type, far less duplicated code
to maintain. If per-type custom form fields beyond the generic
address/scope/professional-in-charge set are needed later (e.g. Building
Permit's full 9-step field set), extend this one component's Step 2 rather
than forking new wizard files per type.

## Known gaps / scaffolding, called out explicitly (not hidden)

- **No backend.** Every store in `core/stores/` is in-memory + signals,
  seeded with demo data. `ApplicationStore.advanceForDemo()` is explicitly
  marked scaffold-only — it simulates the reviewing office advancing an
  application's status, standing in for what a real backend/admin action
  would do. Remove it once a real API exists.
- **Brand palette**: uses the documented "Approved" blue palette
  (`docs/01-Brand-Guidelines/03-Color-Palette.md`), NOT the red actually
  implemented in the Admin Portal's `_tokens.scss`. This conflict is
  unresolved project-wide — see master command Section 12.2 / Open Decision #2.
  All tokens are isolated in `src/styles.scss` `:root` if this needs to change.
- **Payment gateway**: Bank Transfer / Onsite only, matching both existing
  apps. GCash/PayMongo is explicitly out of scope until commissioned.
- **Contact verification, RBAC enforcement, and audit trail** need a real
  backend to be genuine rather than mocked — see master command Section 13.
