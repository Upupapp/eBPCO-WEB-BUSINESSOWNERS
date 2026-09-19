# Production-readiness pass — Citizen (User) Portal handoff

Ongoing. Work happened directly on `main` (a `prod-readiness` branch was created,
then abandoned at the owner's direction partway through — everything below is on
`main`, and `origin/prod-readiness` is a stale, unused ref left behind by that).

## What changed

**No demo/seed data reachable once a real API is configured.**
`ApplicationStore.seed()` ran unconditionally in the constructor. `myApplications()`
already correctly preferred real, fetched data the moment it was non-null, so
the applications LIST was never affected — but `applicationById('app-seed-1')`
returned "Dela Cruz Hardware & Construction Supply"'s fake, non-existent
application to ANY signed-in citizen on the real deployed site who opened that
URL, reachable by guessing (the id is a hardcoded, publicly-visible constant in
this file's source). Gated the one `seed()` call behind `!api.configured` — the
same signal that already distinguishes a real deployment from local/demo-only
running. Proved against the unfixed code first.

**Stale post-registration copy.** Told the citizen their account was "created in
this demonstration build" and "exists in your browser" — true while registration
wrote to a local store, false since it calls the real `POST /auth/register`.
Fixed to say plainly that the account has been created, without the now-false
browser-only claim.

**Broken in-place legal-document navigation.** Profile page's "Read full Terms &
Conditions"/"Privacy Policy" links `routerLink`'d to `/terms`/`/privacy`, whose
own "Back" link always goes to `/landing` regardless of where the citizen came
from — so reading the full text from Profile stranded them on the public landing
page. Now opens the same in-place modal the registration form already uses.

**Security headers**, same gap and same fix as the Admin Portal's — see that
repo's handoff for the reasoning. `check:headers` wired into `npm run verify`.

**Investigated and found NOT a bug:** `verify-permit.page.ts` (the public,
no-login QR-verification page) unconditionally tells a visitor "eBPCO is a
demonstration build... no permit issued by the Municipality can be confirmed
here." This reads like the same stale-copy class of defect as the registration
screen above, but it is not: **the backend has no public, unauthenticated
permit-verification-by-number endpoint at all** (checked `contract/route-table.json`
and the permits module directly — nothing there). The disclaimer is an honest,
currently-still-true statement of a real capability gap, not stale copy. Left
untouched. Building that endpoint (and wiring `verify-permit.page.ts` to it,
the way `application-details.page.ts` already wires `permitFor()`/`fetchPermit()`
for a signed-in citizen viewing their OWN application) is real, separate,
cross-repo work — not something to fake from this side.

## How it was verified

- Full suite after every change: **35 test files, 205 tests, all passing**.
- Every fix has a dedicated regression test proved to fail against the pre-fix
  code and pass against the post-fix code.
- `npm run check:headers`: proved against a deliberately broken header locally.
- `npm run check:assets`, `check:print`, `check:headings`, `check:vocab`,
  `check:screens`, `check:register`, `check:a11y`, `check:journeys`: not
  individually re-run this session; last known state is whatever a full
  `npm run verify` reports next.

## What remains for a human

1. **Public permit verification does not exist end-to-end.** See above. A real
   fix needs a backend decision (a new public route, its auth/rate-limit shape,
   what it's allowed to disclose to an anonymous caller) before any frontend
   change makes sense.
2. **`origin/prod-readiness` could not be deleted** — same git-credential-hang
   issue as the other two repos. Delete via the GitHub web UI, or leave it.
3. Part C was not worked through item-by-item against the original spec's
   C1–C12 (that text was not available to reconstruct faithfully — see the
   backend repo's own handoff for why); the items above came from an
   independent audit covering the same themes (demo-data reachability,
   citizen-facing honesty, security headers).
