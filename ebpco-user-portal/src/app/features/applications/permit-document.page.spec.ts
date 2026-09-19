import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { PermitDocumentPage } from './permit-document.page';
import { ApplicationStore } from '../../core/stores/application.store';

/**
 * Guards F-2: a permit record that no office issued must never produce a clean,
 * printable document. The printed page carries the Republic of the Philippines
 * letterhead, the municipal seal and a verification QR, so an unwatermarked one
 * is a forgeable artifact.
 *
 * The watermark may only clear on `provenance === 'issued'`, which nothing sets
 * until a backend does. Do not relax these to make a demo document print clean.
 */
function renderFor(applicationId: string) {
  TestBed.configureTestingModule({
    imports: [PermitDocumentPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: applicationId }) } } },
    ],
  });
  const fixture = TestBed.createComponent(PermitDocumentPage);
  fixture.detectChanges();
  return fixture;
}

describe('PermitDocumentPage (F-2: demo permits cannot print clean)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('watermarks a seeded demo permit that carries a full permit record', () => {
    // app-seed-2 has a permitNumber, issue date, expiry and approving office —
    // everything a finished permit has. Before the fix it printed unwatermarked.
    const fixture = renderFor('app-seed-2');
    const permit = TestBed.inject(ApplicationStore).permitFor('app-seed-2');
    expect(permit).toBeTruthy();
    expect(permit!.provenance).toBe('demo');

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('SAMPLE — NOT AN OFFICIAL PERMIT');
  });

  it('withholds the verification QR from a document it has not cleared', () => {
    const fixture = renderFor('app-seed-2');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('QR verification not yet available');
    expect((fixture.nativeElement as HTMLElement).querySelector('svg')).toBeNull();
  });

  it('does not claim an uncleared document was issued by the Municipality', () => {
    const text = (renderFor('app-seed-2').nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('is a system-generated document issued by the Municipality');
    expect(text).toContain('not an issued permit and has no legal effect');
  });

  it('keeps the LGU form\'s "Owner / Applicant" role label', () => {
    // Not a CITIZEN-vocabulary miss. This mirrors BOX 1 of the Unified
    // Application Form, where Applicant, Owner and Licensed Architect /
    // Civil Engineer are three distinct signing roles. "Citizen" is who uses
    // the portal; "Applicant" is the role they signed a statutory form in.
    const text = (renderFor('app-seed-2').nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Owner / Applicant');
  });

  it('still watermarks after the demo advance walks an application to Permit Generated', () => {
    // The exact attack path: the "Demo: Simulate Office Update" button.
    const fixture = renderFor('app-seed-1');
    const store = TestBed.inject(ApplicationStore);
    for (let i = 0; i < 20; i++) store.advanceForDemo('app-seed-1');

    const minted = store.permitFor('app-seed-1');
    expect(minted).toBeTruthy();
    expect(minted!.provenance).toBe('demo');

    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('SAMPLE — NOT AN OFFICIAL PERMIT');
  });
});

describe('PermitDocumentPage (task 22: conditions come from the office, in full)', () => {
  afterEach(() => TestBed.resetTestingModule());

  // Guards the defect this replaced: a single CLIENT-authored sentence from
  // requirements-catalog.ts rendered under a heading reading "Conditions".
  // One of those sentences says "per standard LGU clearance practice" — an
  // inference we wrote, presented to a citizen as their obligations.
  it('never renders the catalogue validity sentence as a condition', () => {
    const text = (renderFor('app-seed-2').nativeElement as HTMLElement).textContent ?? '';
    const conditionsIdx = text.indexOf('Conditions');
    const validityIdx = text.indexOf('Validity');
    expect(conditionsIdx).toBeGreaterThan(-1);
    // Validity is its own section, separately labelled — not the conditions.
    if (validityIdx > -1) expect(validityIdx).toBeGreaterThan(conditionsIdx);
  });

  it('says the office has supplied none, rather than substituting our own', () => {
    // Seeded permits carry conditions: [] — the office has said nothing.
    const text = (renderFor('app-seed-2').nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('has not supplied the conditions');
    // And it must not let the citizen read that as "there are none".
    expect(text).toContain('This does not mean there are none');
  });

  it('renders every condition the office supplied, not a summary', () => {
    const fixture = renderFor('app-seed-2');
    const store = TestBed.inject(ApplicationStore);
    const permit = store.permitFor('app-seed-2')!;
    const withConditions = {
      ...permit,
      conditions: [
        'A cash bond of P50,000.00 shall be posted before excavation.',
        'Setbacks shall conform to the approved plans.',
        'Written notice shall be given to the Office five (5) days before excavation.',
      ],
    };
    (store as unknown as { permitsByApp: { update(f: (m: Record<string, unknown>) => Record<string, unknown>): void } })
      .permitsByApp.update((m) => ({ ...m, 'app-seed-2': withConditions }));
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    for (const c of withConditions.conditions) expect(text).toContain(c);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.doc-generated-conditions li').length).toBe(3);
  });
});
