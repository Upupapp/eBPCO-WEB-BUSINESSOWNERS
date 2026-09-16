import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationWizardPage } from './application-wizard.page';
import { ApplicationStore } from '../../core/stores/application.store';
import { DocumentLibraryStore } from '../../core/stores/document-library.store';
import { AuthService } from '../../core/session/auth.service';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { FakeCitizenIdentityApi } from '../../core/testing/fake-citizen-identity-api';

/**
 * Guards the defect that cost the mobile app its entire document history: every
 * wizard showed the attachments in place, the review step counted them, the
 * confirmation said the application was filed — and the request carried
 * `documents: []`, because nothing upstream had ever kept the bytes.
 *
 * This portal is in parity with mobile and had the same shape by construction.
 * `onFileSelected` read `file.name` and let the File go out of scope on the
 * next line.
 *
 * These tests follow a REAL File from the store's intake to what it holds. They
 * deliberately do not assert on anything named `documents` or on a count — that
 * is exactly what looked correct while the bytes were already gone. A filename
 * is not a document.
 */
describe('Attachments carry the file, not just its name', () => {
  let store: ApplicationStore;
  let library: DocumentLibraryStore;

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
    store = TestBed.inject(ApplicationStore);
    library = TestBed.inject(DocumentLibraryStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  const sample = () => new File([new Uint8Array([1, 2, 3, 4, 5])], 'survey-plan.pdf', { type: 'application/pdf' });

  it('an attached document holds the actual File, with its bytes', async () => {
    const file = sample();
    const app = store.createDraft({
      businessId: 'biz-1', businessName: 'Test', permitType: 'Zoning / Locational Clearance',
      applicationAction: 'New', relatedPermitNumber: null,
    });
    store.attachDocument(app.id, 'req-1', 'Survey Plan', file, 'pdf');

    const doc = store.documentsFor(app.id).find((d) => d.requirementId === 'req-1');
    expect(doc).toBeTruthy();
    // The point of the whole test: not a name, a File.
    expect(doc!.file).toBeInstanceOf(File);
    expect(doc!.file).toBe(file);
    expect(await doc!.file!.arrayBuffer()).toEqual(await file.arrayBuffer());
    expect(doc!.file!.size).toBe(5);
  });

  it('My Documents keeps the file too', () => {
    const file = sample();
    const saved = library.add({ file, fileName: file.name, fileType: 'pdf', category: 'uncategorized', sizeBytes: file.size });
    expect(saved.file).toBeInstanceOf(File);
    expect(library.myDocuments().find((d) => d.id === saved.id)?.file).toBe(file);
  });

  it('every document a citizen attached has a file — a name alone is not enough', () => {
    const app = store.createDraft({
      businessId: 'biz-1', businessName: 'Test', permitType: 'Zoning / Locational Clearance',
      applicationAction: 'New', relatedPermitNumber: null,
    });
    for (const [id, label] of [['req-1', 'Survey Plan'], ['req-2', 'Valid ID']]) {
      store.attachDocument(app.id, id, label, sample(), 'pdf');
    }
    const attached = store.documentsFor(app.id);
    expect(attached.length).toBe(2);
    // This is the assertion the mobile bug would have failed while every
    // count and every label still looked right.
    expect(attached.every((d) => d.file instanceof File && d.file.size > 0)).toBe(true);
  });
  // THE TEST THAT MATTERS, and the one my first attempt was missing.
  //
  // The three above call store.attachDocument() directly. Substituting an empty
  // File at the WIZARD's intake still passed all of them — and the wizard's
  // intake is exactly where mobile's bug lived. A store-level test would have
  // passed on mobile too, while every real application went out with no
  // documents. So this one drives the component's own handler.
  it('carries the file the citizen actually picked, from onFileSelected to the store', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ApplicationWizardPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CitizenIdentityApi, useClass: FakeCitizenIdentityApi },
        { provide: ActivatedRoute, useValue: {
            snapshot: { queryParamMap: convertToParamMap({ type: 'Zoning / Locational Clearance' }) } } },
      ],
    });
    await TestBed.inject(AuthService).login('juan.delacruz@example.com', 'Password1');
    const appStore = TestBed.inject(ApplicationStore);
    const fixture = TestBed.createComponent(ApplicationWizardPage);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as {
      documents: { id: string; label: string; required: boolean }[];
      // Mirrors the component's Slot union. A reused document is a REFERENCE to
      // bytes the office already holds and carries no File; an upload carries
      // the real one. This test is about the upload half.
      attached: Record<string, { kind: 'upload'; file: File } | { kind: 'reused' }>;
      onFileSelected(e: Event, d: { id: string; label: string }): void;
    };

    const chosen = new File([new Uint8Array([9, 8, 7, 6])], 'my-survey-plan.pdf', { type: 'application/pdf' });
    const requirement = page.documents[0];
    // The shape the handler actually reads: event.target.files[0].
    // (jsdom has no DataTransfer, so the FileList is supplied directly.)
    const event = { target: { files: [chosen] } } as unknown as Event;
    page.onFileSelected(event, requirement);

    // What the wizard is holding must BE the file, not a copy of its name.
    const slot = page.attached[requirement.id];
    if (slot.kind !== 'upload') throw new Error('a chosen file must be an upload slot');
    expect(slot.file).toBe(chosen);

    // And it must survive the hand-off into the store with its bytes intact.
    const app = appStore.createDraft({
      businessId: 'biz-1', businessName: 'Test',
      permitType: 'Zoning / Locational Clearance', applicationAction: 'New', relatedPermitNumber: null,
    });
    appStore.attachDocument(app.id, requirement.id, requirement.label,
                            slot.file, 'pdf');
    const stored = appStore.documentsFor(app.id)[0];
    expect(stored.file).toBe(chosen);
    expect(await stored.file!.arrayBuffer()).toEqual(await chosen.arrayBuffer());
    expect(stored.file!.size).toBe(4);
  });
});
