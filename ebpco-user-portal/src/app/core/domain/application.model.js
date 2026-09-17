/**
 * Does this application say what it acts on?
 *
 * A 'New' application acts on nothing and must carry no related permit — a
 * stray one there would assert a relationship the citizen never claimed. A
 * 'Renewal' or 'Amendment' acts on exactly one existing permit and is
 * incomplete without it: the office receives "this is a renewal" and has no
 * way to tell which of the applicant's permits was meant.
 *
 * Written as a predicate rather than left to the wizard's template so the
 * store can refuse the same record the form refuses. A rule enforced in only
 * one of the two places is enforced by whichever path the caller happens to
 * take.
 */
export function actionReferenceIsComplete(action, relatedPermitNumber) {
    return action === 'New' ? relatedPermitNumber === null : !!relatedPermitNumber;
}
/** Whether this action must name an existing permit. Drives the wizard's extra step. */
export function actionNeedsExistingPermit(action) {
    return action === 'Renewal' || action === 'Amendment';
}
/** What the citizen is asked to pick, in their words. REN-001 and AMD-001 label this differently. */
export function existingPermitPrompt(action) {
    return action === 'Renewal' ? 'Permit being renewed' : 'Permit being amended';
}
