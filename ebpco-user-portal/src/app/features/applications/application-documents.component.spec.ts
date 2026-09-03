import { TestBed } from '@angular/core/testing';
import { ApplicationDocumentsComponent } from './application-documents.component';
import { ApplicationDocumentResponse } from '../../core/api/citizen-api.models';
import { CONTRACT_SAMPLES } from '../../core/api/contract-samples.fixture';

const RECORDED = CONTRACT_SAMPLES['applicant.applications.documents']
  .body as unknown as ApplicationDocumentResponse[];

const doc = (over: Partial<ApplicationDocumentResponse>): ApplicationDocumentResponse => ({
  id: 'id-x', label: 'Lot plan', fileName: 'lot-plan.pdf', contentType: 'application/pdf',
  byteSize: '1000', sha256: 'a'.repeat(64), uploadedAt: '2026-01-01T00:00:00.000Z',
  expiresOn: null, reviewStatus: null, reviewedAt: null, reviewReason: null, reviewRemark: null,
  supersedesDocumentId: null, supersededByDocumentId: null, scanCleared: true, quarantined: false,
  ...over,
});

function render(documents: ApplicationDocumentResponse[]) {
  // Reset first: a second configureTestingModule on an instantiated module
  // throws, and the throw surfaces as the assertion "failing" for the wrong
  // reason entirely.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [ApplicationDocumentsComponent] });
  const fixture = TestBed.createComponent(ApplicationDocumentsComponent);
  fixture.componentRef.setInput('documents', documents);
  fixture.detectChanges();
  return fixture;
}

describe('ApplicationDocuments — the office speaking to the citizen', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders the recorded sample: one unreviewed, one rejected WITH its reason', () => {
    const text = (render(RECORDED).nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Not yet reviewed');
    expect(text).toContain('Rejected');
    // The actionable half must reach the citizen intact.
    expect(text).toContain('Illegible');
    expect(text).toContain('setback dimension cannot be read');
  });

  it('never gives an unreviewed document the green a citizen reads as done', () => {
    const el = (render([doc({ reviewStatus: null })]).nativeElement as HTMLElement);
    expect(el.querySelector('.badge-green')).toBeNull();
    expect(el.textContent).toContain('Not yet reviewed');
  });

  it('shows the rejection and its replacement together', () => {
    const rejected = doc({
      id: 'old', fileName: 'lot-plan-v1.pdf', reviewStatus: 'Rejected', supersededByDocumentId: 'new',
      reviewReason: { code: 'illegible', label: 'Illegible', description: 'Cannot be read.' },
      reviewRemark: 'Page 3 is cut off at the right margin.',
    });
    const replacement = doc({ id: 'new', fileName: 'lot-plan-v2.pdf', supersedesDocumentId: 'old' });
    const text = ((render([rejected, replacement]).nativeElement as HTMLElement).textContent ?? '');
    // What I sent instead…
    expect(text).toContain('lot-plan-v2.pdf');
    // …and what was wrong, still visible.
    expect(text).toContain('lot-plan-v1.pdf');
    expect(text).toContain('Page 3 is cut off');
    expect(text).toContain('earlier version');
  });

  it('keeps the virus scanner off the officer’s axis', () => {
    const quarantined = (render([doc({ quarantined: true })]).nativeElement as HTMLElement).textContent ?? '';
    expect(quarantined).toContain('held by the virus scanner');
    expect(quarantined).toContain('not a decision about your application');

    // A rejection must NOT read as a virus.
    const rejected = (render([doc({ reviewStatus: 'Rejected' })]).nativeElement as HTMLElement).textContent ?? '';
    expect(rejected).not.toContain('virus');
  });

  it('an EXPIRED document says so on screen, not just in a helper', () => {
    // The helper being right is not the feature. The whole defect was that
    // expiresOn was carried correctly all the way to a screen that never
    // mentioned it.
    const past = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const text = (render([doc({ expiresOn: past, reviewStatus: 'Accepted' })])
      .nativeElement as HTMLElement).textContent ?? '';
    expect(text).toMatch(/expired on/i);
    // An expiry is a fact about the document, NOT the officer's verdict — the
    // status badge must still say what the office actually decided.
    expect(text).toContain('Accepted');
  });

  it('a document with plenty of validity left does not nag', () => {
    const future = new Date(Date.now() + 400 * 86_400_000).toISOString();
    const text = (render([doc({ expiresOn: future })]).nativeElement as HTMLElement).textContent ?? '';
    expect(text).toMatch(/valid until/i);
    expect(text).not.toMatch(/expired/i);
  });

  it('says nothing about validity when the office set no expiry', () => {
    const text = (render([doc({ expiresOn: null })]).nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toMatch(/valid until|expired/i);
  });

  it('offers "replace" only where the office asked, never where the server would 409', () => {
    // Keyed on data-action="replace", not on "is there any button". Every
    // document now also carries a Preview button (DOC-003), and a bare
    // `querySelector('button')` would be satisfied by that one — the assertion
    // would pass while the replace offer was on a document the server would
    // 409. Narrowed rather than loosened: the check is now stricter than it was.
    const askable = (render([doc({ reviewStatus: 'Rejected' })]).nativeElement as HTMLElement);
    expect(askable.querySelector('[data-action="replace"]')).toBeTruthy();

    for (const d of [doc({ reviewStatus: 'Accepted' }),
                     doc({ reviewStatus: null }),
                     doc({ reviewStatus: 'Rejected', supersededByDocumentId: 'newer' })]) {
      expect((render([d]).nativeElement as HTMLElement).querySelector('[data-action="replace"]')).toBeNull();
    }
  });
});
