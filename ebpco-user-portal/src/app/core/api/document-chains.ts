import { ApplicationDocumentResponse, DocumentReviewStatus } from './citizen-api.models';

/**
 * Turning the server's flat document list into what a citizen needs to act on.
 *
 * THE DESIGN NOTE THIS IMPLEMENTS, from the backend lane: *"replacements append.
 * The rejected document stays visible with its reason, alongside its
 * replacement — show both, because 'what was wrong' and 'what I sent instead'
 * is the pair that makes a rejection actionable."*
 *
 * The endpoint returns a BARE ARRAY, oldest upload first, with replacements
 * linked by `supersedesDocumentId` / `supersededByDocumentId`. Rendering that
 * array as rows would show a citizen two "Lot plan" entries and leave them to
 * work out which one counts — and would bury the reason, which is the only part
 * that tells them what to do next.
 *
 * So the unit of display is the CHAIN, not the row.
 */
export interface DocumentChain {
  /** The one that counts now — the newest in the chain. */
  current: ApplicationDocumentResponse;
  /**
   * What it replaced, newest first. Each keeps its own verdict and reason:
   * that is the half that says what was wrong.
   */
  superseded: ApplicationDocumentResponse[];
}

/**
 * Groups a flat document list into chains.
 *
 * Follows `supersedesDocumentId` backwards from each head. A head is a document
 * nothing supersedes — `supersededByDocumentId === null`. Documents whose link
 * points at an id not present in the response are kept as their own chain
 * rather than dropped: a citizen must never lose a document because the server
 * sent a partial view.
 */
export function groupDocumentChains(docs: readonly ApplicationDocumentResponse[]): DocumentChain[] {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const heads = docs.filter((d) => d.supersededByDocumentId === null);

  const chains = heads.map((head) => {
    const superseded: ApplicationDocumentResponse[] = [];
    const seen = new Set<string>([head.id]);
    let cursor = head.supersedesDocumentId;
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      const prev = byId.get(cursor)!;
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
export function reviewLabel(status: DocumentReviewStatus | null): string {
  return status ?? 'Not yet reviewed';
}

/** Whether the review state is one the citizen must act on. */
export function needsCitizenAction(doc: ApplicationDocumentResponse): boolean {
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
export function canResubmit(chain: DocumentChain): boolean {
  return chain.current.supersededByDocumentId === null && needsCitizenAction(chain.current);
}

/**
 * The malware scanner's state, which is **a different axis from the officer's
 * verdict** and must not be blended with it.
 *
 * An officer's rejection does not mean a virus, and a quarantined file is not a
 * verdict on the application. Showing one where the other belongs would tell a
 * citizen their lot plan was infected when it was merely illegible.
 */
export type SecurityState = 'quarantined' | 'scanning' | 'clear';

export function securityState(doc: ApplicationDocumentResponse): SecurityState {
  if (doc.quarantined) return 'quarantined';
  if (!doc.scanCleared) return 'scanning';
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
export function rejectionExplanation(doc: ApplicationDocumentResponse): string | null {
  const parts = [doc.reviewReason?.label, doc.reviewRemark].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.length ? parts.join(' — ') : null;
}
