# eBPCO — Citizen Portal (web)

The **citizen-facing** web portal for the Electronic Building Permit and
Certificate of Occupancy system of the **Municipality of Castilla, Sorsogon**.

> **This is not the admin portal.** Three repositories in this estate begin with
> `eBPCO-Web`; read to the end of the name.
>
> | Repo | Surface |
> |---|---|
> | `Upupapp/eBPCO-WEB-BUSINESSOWNERS` | **this one** — citizens apply, upload, pay, track |
> | `Upupapp/eBPCO-Web` | admin portal — LGU staff receive, evaluate, assess, approve, release |
> | `Upupapp/eBPCO-Website` | public information website |
> | `Upupapp/eBPCOMobile` | the citizen mobile app — **one product with this portal, in parity** |
> | `Upupapp/eBPCOBackend` | serves all of the above |

The system has three user types: **PUBLIC** (the information website),
**CITIZEN** (this portal and the mobile app) and **ADMIN** (LGU staff, with
sub-types by access). "Citizen" is the canonical term for the person who applies
— business owner, applicant and user are older names for the same person.

`Applicant` is kept where it names a **role on a statutory form**: the LGU's
Unified Application Form distinguishes Applicant, Lot Owner and Licensed
Architect / Civil Engineer as separate signing roles. Do not sweep those into
"citizen".

---

## This is a demonstration build

Several screens link here to explain why their data does not persist. The short
version:

**There is no backend wired to this portal.** No `HttpClient`, no `fetch` — every
store is in-memory Angular signals, seeded at startup. Consequently:

- **Nothing you enter is transmitted anywhere**, and a page refresh clears it.
- **Sign-in is mocked.** A demo account is seeded and its credentials are printed
  on the login screen, deliberately, rather than hidden.
- **Uploads keep the file's name, type and size only.** The bytes are discarded.
- **No permit can be issued.** Every generated document is watermarked, and the
  public verification page reports `Unverified` for everything, because no record
  here was issued by the Municipality. See `PermitProvenance` in
  `src/app/core/domain/permit.model.ts` — nothing sets `'issued'` until a backend
  does, and that is the only signal permitted to clear a watermark.
- **Password reset does not exist**, and the screen says so instead of pretending.
- **Bank transfer details are absent, not placeheld.** The Municipality has not
  published a deposit account.

Do not file a real permit application through this build.

---

## Running it

```sh
cd ebpco-user-portal
npm install
npm start          # dev server
npm run verify     # the gate: asset check, production build, unit tests
```

`npm run verify` must be green before pushing. It runs:

| Step | What it catches |
|---|---|
| `npm run check:assets` | any third-party asset host reintroduced into `index.html` or the global stylesheets, and any bundled font file that has gone missing |
| `npm run build` | compilation, and the per-component CSS budgets |
| `npm test` | 25 unit tests, most of them guarding specific findings |

Many tests exist to hold a *finding* closed rather than to describe a feature —
they name the finding in their `describe` block. If one fails, read what it is
protecting before changing it to pass.

## Deployment

Netlify, configured in `netlify.toml`: base `ebpco-user-portal`, command
`npm run build`, publish `dist/ebpco-user-portal/browser`, Node 22, with an SPA
redirect. The npm package is named `ebpco-user-portal` and the publish path
depends on it — do not rename it for vocabulary reasons.

## Layout

```
assets/                    the Municipality's own PDF forms and checklists (source of truth)
docs/                      brand, design system, component and UX guidelines
ebpco-user-portal/         the Angular 22 application
  public/assets/fonts/     Gothic A1, self-hosted — no third-party font host
  public/assets/permit-forms/  the bundled LGU forms
  scripts/                 repo gates
  src/app/core/domain/     models, the requirements catalogue, LGU contact details
  src/app/features/        27 screens
SWEEP-2026-08-31.md        the findings book — read this before changing behaviour
```

**`src/app/core/domain/lgu-contact.ts` is the single source of truth for LGU
contact details, and every value names the bundled document it was transcribed
from.** Do not add a phone number, mailbox or address that is not in a source
document. Invented ones shipped here before, while the real details sat in
`assets/`.
