# Citizen web portal — pending register

Unfinished work with the REASON it is unfinished. Updated 5 September 2026.
HEAD `ac6d391`, committed and green, **not pushed** (hub #0336 step 5).

| # | Item | Why it is not done |
|---|---|---|
| 1 | ~~`ac6d391` is not pushed~~ | **DONE 8 Sep.** Pushed as `f1ed315`; `ls-remote` confirms remote main = local main. Deploy verified BY HASH: live serves `main-AFR6PEIB.js`, sha256 `7d12960d68f4d596`, byte-identical to the local build. |
| 2 | **Who supplies `certifiedOn`** | **Partly resolved.** Backend adopted the null-everywhere option (#0426) and shipped `documents.certified_on` in migration 037, exposed on all three surfaces. Who eventually *records* it is still with the owner. The client is already correct for a null column. |
| 3 | **Amendment supersession scope** | The ruling says amended items remove the old ones. The wizard carries everything over; it does not yet know WHICH requirement group is being amended, so nothing is dropped. Needs the amendment picker to name a group. Backend has the same gap (#0347 item 3). |
| 4 | **`GET /me` on load** | The profile screen builds its patch from the local account. Wiring the read needs `API_BASE_URL`, which is with the owner. |
| 5 | **Re-derive the `/me` types** | Backend #0392 says the GET/PATCH asymmetry is now fixed as a strict superset, committed at `6155e47` and unpushed. My split was made against the older recorded bytes and will be wrong in the other direction once that lands. |
| 6 | **`reused` on the wire** | **Blocked on an architecture choice, not on a field.** Backend measured (#0425) that the schema cannot express reuse at all: `documents.application_id` is a single FK, there is no link table, and `storage_key` is UNIQUE. Copy-on-reuse vs a link table is a real decision; I argued for copy-on-reuse in #0528 with client-side evidence. `reused` stays local until there is a column. `certifiedOn` now exists (migration 037). |
| 7 | **Password reset screen** | Endpoints exist and are contracted (#0039), but the LGU has **no message provider**, so nothing is delivered. A screen promising a mail the citizen will not receive is the F-5 defect again. The tripwire spec stays. |
| 8 | **Email transfer UI** | Decided by backend #0032 — old address notified first, then the new one gets the link. Not built; no endpoint yet. |
| 9 | **Splitting `landing.page.scss`** | 9.80 kB compiled against a 10 kB warning and a 12 kB error. Deliberately not split now: the budget was settled once and the next file to cross 10 kB gets split rather than another raise. |
| 10 | **Business edit + permit document in the axe sweep** | Two journey-deep screens still outside the 77-scan sweep. Everything they contain is covered elsewhere, but a screen the sweep does not visit is unmeasured, not clean. |
