import { TestBed } from '@angular/core/testing';
import { PermitReleaseComponent } from './permit-release.component';
import { CONTRACT_SAMPLES } from '../../core/api/contract-samples.fixture';
const READY = CONTRACT_SAMPLES['applicant.applications.permit'].body;
const BEFORE = CONTRACT_SAMPLES['applicant.applications.permit.beforeRelease'].body;
function render(permitNumber, release) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [PermitReleaseComponent] });
    const f = TestBed.createComponent(PermitReleaseComponent);
    f.componentRef.setInput('permitNumber', permitNumber);
    f.componentRef.setInput('release', release);
    f.detectChanges();
    return f.nativeElement;
}
/**
 * Both `release` branches are RECORDED server-side, so these decode real bytes
 * rather than shapes anyone invented.
 */
describe('PermitRelease — can the citizen collect it? (task 21)', () => {
    afterEach(() => TestBed.resetTestingModule());
    it('shows the permit number, which is what the endpoint exists for', () => {
        // "Before this, a citizen who filed, paid and was approved had no way to
        // learn their permit number."
        const el = render(READY.permitNumber, READY.release);
        expect(el.textContent).toContain('FP-2026-000001');
    });
    it('renders the RECORDED ready branch as collectable, with where to go', () => {
        const el = render(READY.permitNumber, READY.release);
        expect(el.textContent).toContain('Ready to collect');
        expect(el.textContent).toContain('Office of the Municipal Engineer');
        expect(el.querySelector('.release-ready')).toBeTruthy();
    });
    it('renders the RECORDED null branch as a fact, never as missing data', () => {
        // The contract: release is "ALWAYS PRESENT, and null until an officer has
        // prepared the release. Null is a fact to render, not an absent key."
        expect(BEFORE.release).toBeNull();
        const el = render(BEFORE.permitNumber, BEFORE.release);
        expect(el.textContent).toContain('Not yet ready to collect');
        expect(el.textContent).toContain('has not arranged collection');
        // It still shows the permit number: not-collectable is not not-issued.
        expect(el.textContent).toContain('FP-2026-000001');
    });
    it('distinguishes "nobody arranged it" from an officer saying Not Ready', () => {
        const nullText = render('FP-1', null).textContent ?? '';
        const notReady = render('FP-1', { status: 'Not Ready', method: null, releasedAt: null }).textContent ?? '';
        expect(nullText).toContain('has not arranged collection');
        expect(notReady).toContain('has not finished preparing');
        expect(nullText).not.toBe(notReady);
    });
    it('never lets a non-ready state read as collectable', () => {
        for (const r of [null,
            { status: 'Not Ready', method: null, releasedAt: null },
            { status: 'Released', method: null, releasedAt: null }]) {
            const el = render('FP-1', r);
            expect(el.querySelector('.release-ready')).toBeNull();
            expect(el.textContent).not.toContain('Ready to collect');
        }
    });
    it('says a representative may collect only when the office said so', () => {
        const rep = render('FP-1', { status: 'Ready for Release', method: 'Authorized Representative', releasedAt: null });
        expect(rep.textContent).toContain('authorised representative');
        expect(rep.textContent).toContain('letter of authorisation');
        const inPerson = render('FP-1', { status: 'Ready for Release', method: 'Physical Claim', releasedAt: null });
        expect(inPerson.textContent).toContain('in person');
        expect(inPerson.textContent).not.toContain('letter of authorisation');
    });
    it('says plainly when no permit has been issued', () => {
        const el = render(null, null);
        expect(el.textContent).toContain('No permit has been issued');
    });
});
