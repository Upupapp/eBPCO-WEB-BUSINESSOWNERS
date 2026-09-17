import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { VerifyPermitPage } from './verify-permit.page';
import { ApplicationStore } from '../../core/stores/application.store';
import { isPermitStanding } from '../../core/domain/permit.model';
/**
 * Guards F-3: the public, no-login verification page must fail CLOSED and must
 * never present demo data as a confirmed permit.
 *
 * These assertions are the reason the provenance check exists. If someone
 * reintroduces a `return 'Valid'` fallthrough, or drops the disclosure, these
 * fail — which is the whole point, so do not relax them to make them pass.
 */
function renderFor(permitNumber) {
    TestBed.configureTestingModule({
        imports: [VerifyPermitPage],
        providers: [
            {
                provide: ActivatedRoute,
                useValue: { snapshot: { paramMap: convertToParamMap(permitNumber ? { permitNumber } : {}) } },
            },
        ],
    });
    const fixture = TestBed.createComponent(VerifyPermitPage);
    fixture.detectChanges();
    return fixture;
}
describe('VerifyPermitPage (F-3: public verification fails closed)', () => {
    afterEach(() => TestBed.resetTestingModule());
    it('never reports Valid for a permit number it holds no record of', () => {
        const text = renderFor('BP-2026-99999').nativeElement.textContent ?? '';
        expect(text).not.toContain('Valid');
    });
    it('never reports Valid for a seeded demo permit', () => {
        // The seeded record is deliberately 'demo' provenance. Before the fix this
        // rendered a green "Valid" badge for a fabricated establishment.
        const fixture = renderFor('ZLC-2026-0231');
        const seeded = TestBed.inject(ApplicationStore).permitByNumber('ZLC-2026-0231');
        expect(seeded).toBeTruthy();
        expect(seeded.provenance).toBe('demo');
        const text = fixture.nativeElement.textContent ?? '';
        expect(text).toContain('Unverified');
        expect(text).toContain('demonstration data');
    });
    it('tells the reader that a missing record does not mean the permit is invalid', () => {
        const text = renderFor('BP-2026-99999').nativeElement.textContent ?? '';
        expect(text).toContain('does not mean the permit is invalid');
    });
    it('carries the demo disclosure and the real MEO contact on every path', () => {
        for (const number of ['ZLC-2026-0231', 'BP-2026-99999']) {
            const text = renderFor(number).nativeElement.textContent ?? '';
            expect(text).toContain('demonstration build');
            expect(text).toContain('09054818572');
            expect(text).toContain('meocastilla@gmail.com');
            TestBed.resetTestingModule();
        }
    });
});
describe('VerifyPermitPage (L-2: revocation cannot fall through to Valid)', () => {
    afterEach(() => TestBed.resetTestingModule());
    // Renders the PAGE against a stubbed store, not the pure type-guard. An
    // earlier version of these tests only exercised isPermitStanding(), so
    // restoring the old `return 'Valid'` derivation still passed 44/44 - a test
    // that cannot fail is not a guard.
    //
    // Nothing sets `standing` in the app today, so this guards the SEAM: the day
    // a backend sets provenance:'issued', a revoked permit must not be reported
    // to the public as Valid.
    function renderWithPermit(standing) {
        const permit = {
            applicationId: 'app-x', permitNumber: 'BP-2026-0001',
            provenance: 'issued', standing,
            issuedDateValue: new Date('2026-01-01'), issuedDate: '2026-01-01T00:00:00.000Z',
            expiryDateValue: new Date('2099-01-01'), expiryDate: '2099-01-01T00:00:00.000Z',
            approvingOfficial: 'Engr. X', approvingOffice: 'Office of the Municipal Engineer',
        };
        TestBed.configureTestingModule({
            imports: [VerifyPermitPage],
            providers: [
                { provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ permitNumber: 'BP-2026-0001' }) } } },
                { provide: ApplicationStore, useValue: {
                        permitByNumber: () => permit,
                        applicationById: () => ({ id: 'app-x', permitType: 'Building Permit – New Construction',
                            businessId: 'biz-1', businessName: 'Test' }),
                    } },
            ],
        });
        const fixture = TestBed.createComponent(VerifyPermitPage);
        fixture.detectChanges();
        return fixture.nativeElement.textContent ?? '';
    }
    it('reports a REVOKED permit as revoked, never as Valid', () => {
        const text = renderWithPermit('Revoked');
        expect(text).toContain('Revoked');
        expect(text).not.toContain('Valid');
    });
    it('does the same for Suspended and Cancelled', () => {
        for (const s of ['Suspended', 'Cancelled']) {
            expect(renderWithPermit(s)).toContain(s);
            TestBed.resetTestingModule();
        }
    });
    it('an issued permit the office has said nothing about is Unverified, not Valid', () => {
        const text = renderWithPermit(null);
        expect(text).toContain('Unverified');
        expect(text).not.toContain('Valid');
    });
    it('a standing the portal has never heard of is Unverified, not Valid', () => {
        // The failure this guards: the backend adds a state, the portal has not been
        // updated, and the public sees a green Valid badge for it.
        const text = renderWithPermit('Lapsed');
        expect(text).toContain('Unverified');
        expect(text).not.toContain('Valid');
    });
    it('only relays standings it can render', () => {
        for (const s of [null, undefined, '', 'Lapsed', 'valid', 0, {}]) {
            expect(isPermitStanding(s)).toBe(false);
        }
        for (const s of ['Valid', 'Revoked', 'Suspended', 'Cancelled']) {
            expect(isPermitStanding(s)).toBe(true);
        }
    });
});
