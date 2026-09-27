import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { VerifyPermitPage } from './verify-permit.page';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { PublicPermitRecord } from '../../core/api/citizen-api.models';

/**
 * The public, no-login page the permit's QR code opens.
 *
 * Guards two things. It asks the Municipality's server, not the visitor's own
 * browser data (a stranger scanning a genuine permit used to be told "No
 * record", found live 2026-09-27). And it never says "Valid": the system
 * records no revocation, so standing is the office's to confirm — do not relax
 * that to make a test pass.
 */
function render(permitNumber: string, answer: () => Observable<PublicPermitRecord>) {
  const calls: string[] = [];
  TestBed.configureTestingModule({
    imports: [VerifyPermitPage],
    providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ permitNumber }) } } },
      { provide: CitizenApiClient, useValue: {
          configured: true,
          verifyPermit: (n: string) => { calls.push(n); return answer(); },
        } },
    ],
  });
  const fixture = TestBed.createComponent(VerifyPermitPage);
  fixture.detectChanges();
  return { text: (fixture.nativeElement as HTMLElement).textContent ?? '', calls };
}

const ISSUED: PublicPermitRecord = {
  permitNumber: 'FP-2026-000003', permitType: 'Fencing Permit', businessName: 'Dela Cruz Sari-Sari Store',
  issuedDate: '2026-09-27T03:41:57.323Z', released: true, releasedAt: '2026-09-27T03:44:00.000Z',
};

describe('VerifyPermitPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('asks the server for the scanned number and shows what is on record', () => {
    const { text, calls } = render('FP-2026-000003', () => of(ISSUED));
    expect(calls).toEqual(['FP-2026-000003']);
    expect(text).toContain('On record');
    expect(text).toContain('Dela Cruz Sari-Sari Store');
    expect(text).toContain('Fencing Permit');
    expect(text).toContain('Office of the Building Official');
  });

  it('never reports Valid, even for a permit on record', () => {
    const { text } = render('FP-2026-000003', () => of(ISSUED));
    expect(text).not.toContain('Valid');
  });

  it('says a missing record does not by itself mean the permit is invalid', () => {
    const { text } = render('FP-1999-000001', () => throwError(() => ({ status: 404 })));
    expect(text).toContain('No permit with this number is on record');
    expect(text).toContain('does not by itself mean the permit is invalid');
    expect(text).not.toContain('Valid');
  });

  it('tells the reader the records could not be reached rather than calling the permit unknown', () => {
    const { text } = render('FP-2026-000003', () => throwError(() => ({ status: 503 })));
    expect(text).toContain('could not be reached');
    expect(text).not.toContain('No permit with this number');
  });

  it('gives the real MEO contact on every path', () => {
    for (const answer of [() => of(ISSUED), () => throwError(() => ({ status: 404 }))]) {
      const { text } = render('FP-2026-000003', answer as () => Observable<PublicPermitRecord>);
      expect(text).toContain('09054818572');
      expect(text).toContain('meocastilla@gmail.com');
      TestBed.resetTestingModule();
    }
  });
});
