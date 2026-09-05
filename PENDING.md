# Citizen web portal — pending register

Unfinished work with the REASON it is unfinished. Updated 5 September 2026.
HEAD `ac6d391`, committed and green, **not pushed** (hub #0336 step 5).

| # | Item | Why it is not done |
|---|---|---|
| 1 | **`ac6d391` is not pushed** | The hub's full-sweep instruction (#0336) says report and stop. It is green in-tree — 196 tests, 9 gates, verify exit 0 — but has NOT had the detached-worktree verification, because the protocol runs that immediately before a push. |
| 2 | **Who supplies `certifiedOn`** | Owner decision, raised by backend #0391 and answered from my side in #0423. The client is already correct for a null-everywhere column: `certifiedOn` is null when the office recorded nothing, never the upload date. |
| 3 | **Amendment supersession scope** | The ruling says amended items remove the old ones. The wizard carries everything over; it does not yet know WHICH requirement group is being amended, so nothing is dropped. Needs the amendment picker to name a group. Backend has the same gap (#0347 item 3). |
| 4 | **`GET /me` on load** | The profile screen builds its patch from the local account. Wiring the read needs `API_BASE_URL`, which is with the owner. |
| 5 | **Re-derive the `/me` types** | Backend #0392 says the GET/PATCH asymmetry is now fixed as a strict superset, committed at `6155e47` and unpushed. My split was made against the older recorded bytes and will be wrong in the other direction once that lands. |
| 6 | **`reused` / `certifiedOn` on the wire** | Modelled and tested locally. They do not exist on the backend yet (#0391: nothing records a certification date; grep returns zero), so nothing is sent. |
| 7 | **Password reset screen** | Endpoints exist and are contracted (#0039), but the LGU has **no message provider**, so nothing is delivered. A screen promising a mail the citizen will not receive is the F-5 defect again. The tripwire spec stays. |
| 8 | **Email transfer UI** | Decided by backend #0032 — old address notified first, then the new one gets the link. Not built; no endpoint yet. |
| 9 | **Splitting `landing.page.scss`** | 9.80 kB compiled against a 10 kB warning and a 12 kB error. Deliberately not split now: the budget was settled once and the next file to cross 10 kB gets split rather than another raise. |
| 10 | **Business edit + permit document in the axe sweep** | Two journey-deep screens still outside the 77-scan sweep. Everything they contain is covered elsewhere, but a screen the sweep does not visit is unmeasured, not clean. |
