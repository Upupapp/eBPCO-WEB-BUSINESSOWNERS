import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationWizardPage } from './application-wizard.page';
import { DocumentLibraryStore } from '../../core/stores/document-library.store';
import { ApplicationStore } from '../../core/stores/application.store';
import { AuthService } from '../../core/session/auth.service';
import { RequirementDocument } from '../../core/domain/requirements-catalog';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { FakeCitizenIdentityApi } from '../../core/testing/fake-citizen-identity-api';
import { SavedDocument } from '../../core/domain/document.model';

/**
 * A citizen may reuse a document already on file — and only one that has bytes.
 *
 * The wizard wrote every upload into the document library and never once read
 * it back, so "My Documents" listed everything a citizen had ever uploaded and
 * offered no way to use any of it again. A renewal made that plain: the same
 * twenty-two files, uploaded a second time, all already on file.
 *
 * The dangerous half of this feature is the filter. The library also holds
 * seeded example rows with `file: null`. Offering one of those would attach a
 * FILENAME with no document under it — the exact defect that cost the mobile
 * app its entire document history, reintroduced through a convenience feature.
 * So these tests follow the BYTES, never the name or the count.
 */
describe('Reusing a document already on file', () => {
  let library: DocumentLibraryStore;
  let store: ApplicationStore;
  let page: ApplicationWizardPage;

  const req: RequirementDocument = {
    id: 'req-1', label: 'Survey Plan', required: true,
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CitizenIdentityApi, useClass: FakeCitizenIdentityApi },
      ],
    });
    await TestBed.inject(AuthService).login('juan.delacruz@example.com', 'Password1');
    library = TestBed.inject(DocumentLibraryStore);
    store = TestBed.inject(ApplicationStore);
    page = TestBed.createComponent(ApplicationWizardPage).componentInstance;
  });
  afterEach(() => TestBed.resetTestingModule());

  const realFile = () =>
    new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 9, 9])], 'survey-plan.pdf', { type: 'application/pdf' });

  it('offers ONLY documents that actually have bytes', () => {
    // Seeded rows exist with file: null. If any of them is offered, a citizen
    // can attach a name with nothing behind it.
    //
    // Cast to SavedDocument: `reusable()` is real-or-demo (DocumentHistoryEntry
    // | SavedDocument), and this test — no API_BASE_URL provided, so
    // `api.configured` is false — always exercises the demo half.
    for (const d of page['reusable']() as SavedDocument[]) {
      expect(d.file).not.toBeNull();
    }
  });

  it('a seeded row with no file is excluded even though it is in the library', () => {
    const withoutBytes = library.myDocuments().filter((d) => d.file === null);
    // Guard the guard: if the seed ever stops containing a file-less row, this
    // test would pass while checking nothing.
    expect(withoutBytes.length).toBeGreaterThan(0);

    const offeredIds = new Set(page['reusable']().map((d) => d.id));
    for (const d of withoutBytes) expect(offeredIds.has(d.id)).toBe(false);
  });

  it('reusing attaches the ACTUAL File, not just its name', async () => {
    const file = realFile();
    const saved = library.add({
      file, fileName: file.name, fileType: 'pdf', category: 'supportingDocument', sizeBytes: file.size,
    });

    page['reuseExisting'](req, saved);

    const attached = page.attached['req-1'];
    expect(attached).toBeTruthy();
    // A library document is an UPLOAD — we hold its bytes and send them. That
    // is a different thing from a document REUSED from a previous permit, which
    // is a reference to bytes the office already has. The union keeps the two
    // apart, and this test is about the first.
    expect(attached.kind).toBe('upload');
    if (attached.kind !== 'upload') throw new Error('expected an upload slot');
    expect(attached.file).toBeInstanceOf(File);
    // A filename is not a document: read the bytes back.
    const bytes = new Uint8Array(await attached.file.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it('a file-less document attaches NOTHING rather than a name', () => {
    const hollow = { id: 'x', ownerId: 'u', fileName: 'ghost.pdf', fileType: 'pdf' as const,
                     category: 'supportingDocument' as const, uploadedAt: '2026-01-01',
                     sizeBytes: 0, file: null };
    page['reuseExisting'](req, hollow);
    expect(page.attached['req-1']).toBeUndefined();
  });

  it('a reused document survives all the way into the filed application', async () => {
    const file = realFile();
    const saved = library.add({
      file, fileName: file.name, fileType: 'pdf', category: 'supportingDocument', sizeBytes: file.size,
    });
    page['reuseExisting'](req, saved);

    const app = store.createDraft({
      businessId: 'biz-1', businessName: 'Test',
      permitType: 'Zoning / Locational Clearance', applicationAction: 'New', relatedPermitNumber: null,
    });
    const a = page.attached['req-1'];
    if (a.kind !== 'upload') throw new Error('expected an upload slot');
    store.attachDocument(app.id, req.id, req.label, a.file, a.fileType);

    const filed = store.documentsFor(app.id).find((d) => d.requirementId === 'req-1')!;
    expect(filed.file).toBeInstanceOf(File);
    const bytes = new Uint8Array(await filed.file!.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(0);
  });
});
