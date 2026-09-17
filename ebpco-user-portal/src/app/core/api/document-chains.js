/**
 * Groups a flat document list into chains.
 *
 * Follows `supersedesDocumentId` backwards from each head. A head is a document
 * nothing supersedes — `supersededByDocumentId === null`. Documents whose link
 * points at an id not present in the response are kept as their own chain
 * rather than dropped: a citizen must never lose a document because the server
 * sent a partial view.
 */
export function groupDocumentChains(docs) {
    const byId = new Map(docs.map((d) => [d.id, d]));
    const heads = docs.filter((d) => d.supersededByDocumentId === null);
    const chains = heads.map((head) => {
        const superseded = [];
        const seen = new Set([head.id]);
        let cursor = head.supersedesDocumentId;
        while (cursor && byId.has(cursor) && !seen.has(cursor)) {
            const prev = byId.get(cursor);
            superseded.push(prev);
            seen.add(prev.id);
            cursor = prev.supersedesDocumentId;
        }
        return { current: head, superseded };
    });
    // Anything not reachable from a head — a broken or partial link — still shows.
    const claimed = new Set(chains.flatMap((c) => [c.current.id, ...c.superseded.map((s) => s.id)]));
    const orphans = docs.filter((d) => !claimed.has(d.id)).map((d) => ({ current: d, superseded: [] }));
    return [...chains, ...orphans];
}
/**
 * What to show for a document's review state.
 *
 * `reviewStatus: null` is **"Not yet reviewed"**, never a tick and never a
 * blank. The contract is explicit: *"NULL MEANS NOBODY HAS LOOKED YET — it does
 * not mean nothing is wrong. Rendering null as a tick would tell an applicant
 * their document passed when it has not been opened."*
 */
export function reviewLabel(status) {
    return status ?? 'Not yet reviewed';
}
/** Whether the review state is one the citizen must act on. */
export function needsCitizenAction(doc) {
    return doc.reviewStatus === 'Rejected' || doc.reviewStatus === 'Revision Required';
}
/**
 * Whether to offer "replace this".
 *
 * Only on the CURRENT document of a chain, and only when the office has asked
 * for something. Offering it on a superseded document invites a 409 ("already
 * replaced"), and offering it on an accepted one invites the other 409 —
 * both of which are a control that exists to fail.
 */
export function canResubmit(chain) {
    return chain.current.supersededByDocumentId === null && needsCitizenAction(chain.current);
}
export function securityState(doc) {
    if (doc.quarantined)
        return 'quarantined';
    if (!doc.scanCleared)
        return 'scanning';
    return 'clear';
}
/**
 * The sentence that makes a rejection actionable, assembled in the order a
 * citizen reads it: what the office called it, then what they said about this
 * specific file.
 *
 * `reviewReason.label` comes from the server on purpose — the LGU can edit the
 * catalogue, and a client-side copy drifts. `code` is for switching on, never
 * for display.
 */
export function rejectionExplanation(doc) {
    const parts = [doc.reviewReason?.label, doc.reviewRemark].filter((p) => !!p && p.trim().length > 0);
    return parts.length ? parts.join(' — ') : null;
}
/** Inside this many days, a citizen still has time to act. Beyond it, saying "expiring" is noise. */
export const EXPIRY_WARNING_DAYS = 60;
const DAY = 86_400_000;
export function documentValidity(expiresOn, now = new Date()) {
    if (!expiresOn)
        return { state: 'no-expiry' };
    const due = new Date(expiresOn);
    if (Number.isNaN(due.getTime()))
        return { state: 'no-expiry' };
    // Compare whole days, not instants. A clearance valid "until 5 August" is
    // valid THROUGH the 5th — treating it as expired at 00:00 that morning would
    // tell a citizen their document is dead on a day the office still accepts it.
    const startOfDay = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
    if (days < 0)
        return { state: 'expired', on: expiresOn, daysAgo: -days };
    if (days <= EXPIRY_WARNING_DAYS)
        return { state: 'expiring', on: expiresOn, daysLeft: days };
    return { state: 'valid', on: expiresOn, daysLeft: days };
}
