import { canResubmit, groupDocumentChains, needsCitizenAction, rejectionExplanation, reviewLabel, securityState, } from './document-chains';
import { CONTRACT_SAMPLES } from './contract-samples.fixture';
const RECORDED = CONTRACT_SAMPLES['applicant.applications.documents']
    .body;
/** A chain is not in the recorded samples, so it is CONSTRUCTED here — and said so. */
const doc = (over) => ({
    id: 'id-x', label: 'Lot plan', fileName: 'lot-plan.pdf', contentType: 'application/pdf',
    byteSize: '1000', sha256: 'a'.repeat(64), uploadedAt: '2026-01-01T00:00:00.000Z',
    expiresOn: null, reviewStatus: null, reviewedAt: null, reviewReason: null, reviewRemark: null,
    supersedesDocumentId: null, supersededByDocumentId: null, scanCleared: true, quarantined: false,
    ...over,
});
describe('Document review state (task 25)', () => {
    it('never renders an unreviewed document as a pass', () => {
        // The contract: "NULL MEANS NOBODY HAS LOOKED YET — it does not mean
        // nothing is wrong." A tick here would be a lie about an unopened file.
        expect(reviewLabel(null)).toBe('Not yet reviewed');
        expect(reviewLabel(null)).not.toMatch(/accept|approv|ok|pass/i);
        expect(needsCitizenAction(doc({ reviewStatus: null }))).toBe(false);
    });
    it('reads the recorded sample the way the office meant it', () => {
        const [identity, lotPlan] = RECORDED;
        expect(reviewLabel(identity.reviewStatus)).toBe('Not yet reviewed');
        expect(reviewLabel(lotPlan.reviewStatus)).toBe('Rejected');
        // The remark is the actionable half — it must survive to the citizen intact.
        expect(rejectionExplanation(lotPlan)).toContain('Illegible');
        expect(rejectionExplanation(lotPlan)).toContain('setback dimension cannot be read');
    });
    it('keeps the scanner on a different axis from the officer', () => {
        // A rejection is not a virus, and a quarantine is not a verdict.
        expect(securityState(doc({ reviewStatus: 'Rejected' }))).toBe('clear');
        expect(securityState(doc({ quarantined: true }))).toBe('quarantined');
        expect(securityState(doc({ scanCleared: false }))).toBe('scanning');
    });
});
describe('Document chains — "what was wrong" beside "what I sent instead"', () => {
    it('leaves unrelated documents as chains of one', () => {
        const chains = groupDocumentChains(RECORDED);
        expect(chains.length).toBe(2);
        expect(chains.every((c) => c.superseded.length === 0)).toBe(true);
    });
    it('pairs a replacement with what it replaced, and keeps the reason', () => {
        const rejected = doc({
            id: 'old', reviewStatus: 'Rejected', supersededByDocumentId: 'new',
            reviewReason: { code: 'illegible', label: 'Illegible', description: 'Cannot be read.' },
            reviewRemark: 'Page 3 is cut off at the right margin.',
        });
        const replacement = doc({ id: 'new', supersedesDocumentId: 'old' });
        const [chain] = groupDocumentChains([rejected, replacement]);
        expect(chain.current.id).toBe('new');
        expect(chain.superseded.map((s) => s.id)).toEqual(['old']);
        // The pair: the rejection's reason is still reachable from the chain.
        expect(rejectionExplanation(chain.superseded[0])).toContain('Illegible');
    });
    it('walks a chain more than one deep, newest first', () => {
        const a = doc({ id: 'a', supersededByDocumentId: 'b' });
        const b = doc({ id: 'b', supersedesDocumentId: 'a', supersededByDocumentId: 'c' });
        const c = doc({ id: 'c', supersedesDocumentId: 'b' });
        const [chain] = groupDocumentChains([a, b, c]);
        expect(chain.current.id).toBe('c');
        expect(chain.superseded.map((s) => s.id)).toEqual(['b', 'a']);
    });
    it('never loses a document to a broken or partial link', () => {
        // A citizen must not have a file disappear because the server sent a view
        // that does not contain the id it points at.
        //
        // The orphan is one superseded BY something absent: it is not a head, so no
        // head reaches it. An earlier version of this test used a document pointing
        // BACKWARDS at a missing id — but that one has supersededByDocumentId null,
        // which makes it a head, so it was never an orphan and the test could not
        // fail.
        const orphan = doc({ id: 'x', supersededByDocumentId: 'replacement-not-in-this-response' });
        const chains = groupDocumentChains([orphan]);
        expect(chains.length).toBe(1);
        expect(chains[0].current.id).toBe('x');
        // And a backward-dangling head still stands on its own.
        const danglingHead = doc({ id: 'y', supersedesDocumentId: 'older-not-in-this-response' });
        expect(groupDocumentChains([danglingHead]).map((c) => c.current.id)).toEqual(['y']);
    });
    it('survives a cycle instead of hanging', () => {
        const a = doc({ id: 'a', supersedesDocumentId: 'b', supersededByDocumentId: null });
        const b = doc({ id: 'b', supersedesDocumentId: 'a', supersededByDocumentId: 'a' });
        expect(() => groupDocumentChains([a, b])).not.toThrow();
    });
});
describe('When to offer "replace this"', () => {
    it('offers it on a rejected current document', () => {
        expect(canResubmit({ current: doc({ reviewStatus: 'Rejected' }), superseded: [] })).toBe(true);
        expect(canResubmit({ current: doc({ reviewStatus: 'Revision Required' }), superseded: [] })).toBe(true);
    });
    it('does NOT offer it where the server would answer 409', () => {
        // Already replaced, and already accepted — both are controls that exist to fail.
        expect(canResubmit({ current: doc({ reviewStatus: 'Rejected', supersededByDocumentId: 'newer' }), superseded: [] })).toBe(false);
        expect(canResubmit({ current: doc({ reviewStatus: 'Accepted' }), superseded: [] })).toBe(false);
    });
    it('does NOT offer it on a document nobody has reviewed', () => {
        // Replacing an unopened file is not an action the office has asked for.
        expect(canResubmit({ current: doc({ reviewStatus: null }), superseded: [] })).toBe(false);
    });
});
