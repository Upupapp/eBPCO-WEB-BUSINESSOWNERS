import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { VerifyPermitPage } from './verify-permit.page';
import { ApplicationStore } from '../../core/stores/application.store';

/**
 * Guards F-3: the public, no-login verification page must fail CLOSED and must
 * never present demo data as a confirmed permit.
 *
 * These assertions are the reason the provenance check exists. If someone
 * reintroduces a `return 'Valid'` fallthrough, or drops the disclosure, these
 * fail — which is the whole point, so do not relax them to make them pass.
 */
function renderFor(permitNumber: string | null) {
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
    const text = (renderFor('BP-2026-99999').nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Valid');
  });

  it('never reports Valid for a seeded demo permit', () => {
    // The seeded record is deliberately 'demo' provenance. Before the fix this
    // rendered a green "Valid" badge for a fabricated establishment.
    const fixture = renderFor('ZLC-2026-0231');
    const seeded = TestBed.inject(ApplicationStore).permitByNumber('ZLC-2026-0231');
    expect(seeded).toBeTruthy();
    expect(seeded!.provenance).toBe('demo');

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Unverified');
    expect(text).toContain('demonstration data');
  });

  it('tells the reader that a missing record does not mean the permit is invalid', () => {
    const text = (renderFor('BP-2026-99999').nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('does not mean the permit is invalid');
  });

  it('carries the demo disclosure and the real MEO contact on every path', () => {
    for (const number of ['ZLC-2026-0231', 'BP-2026-99999']) {
      const text = (renderFor(number).nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('demonstration build');
      expect(text).toContain('09054818572');
      expect(text).toContain('meocastilla@gmail.com');
      TestBed.resetTestingModule();
    }
  });
});
