import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { ApplicationDetailsPage } from './application-details.page';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { ApplicationDocumentResponse } from '../../core/api/citizen-api.models';
import { ToastService } from '../../shared/ui/toast.service';

/**
 * A citizen's own real, backend-uploaded document must actually open when they
 * click "Preview".
 *
 * `onPreview` used to look the clicked document up in the LOCAL DEMO store
 * (`ApplicationStore.documentsFor`) unconditionally, even once
 * `GET /applications/{id}/documents` had already populated `realDocuments()`.
 * A real document's id is a server-generated UUID that never matches anything
 * in the demo store, so the lookup always missed, `previewing` was set to
 * `null`, and the preview modal simply never opened — no error, no toast,
 * nothing a citizen could act on.
 */
describe('ApplicationDetailsPage — previewing a real, backend-uploaded document', () => {
  const REAL_DOC: ApplicationDocumentResponse = {
    id: 'real-doc-1',
    label: 'Land Title',
    fileName: 'land-title.pdf',
    contentType: 'application/pdf',
    byteSize: '11',
    sha256: 'deadbeef',
    uploadedAt: '2026-09-01T00:00:00.000Z',
    expiresOn: null,
    reviewStatus: null,
    reviewedAt: null,
    reviewReason: null,
  } as ApplicationDocumentResponse;

  function render(api: Partial<CitizenApiClient>) {
    TestBed.configureTestingModule({
      imports: [ApplicationDetailsPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'app-real-1' }) } } },
        { provide: CitizenApiClient, useValue: api },
      ],
    });
    return TestBed.createComponent(ApplicationDetailsPage).componentInstance;
  }

  const baseApi: Partial<CitizenApiClient> = {
    configured: true,
    listDocuments: () => of([REAL_DOC]),
    getTimeline: () => EMPTY,
    getPermit: () => EMPTY,
    getRequirementsForPermitType: () => EMPTY,
  } as Partial<CitizenApiClient>;

  afterEach(() => TestBed.resetTestingModule());

  it('fetches the real signed content and shows the actual file, not a silent no-op', async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 9, 9]);
    const page = render({
      ...baseApi,
      getDocumentContent: () => of({ url: 'https://signed.example/land-title.pdf' }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(bytes, { status: 200 })) as typeof fetch;
    try {
      await (page as unknown as { onPreview(d: ApplicationDocumentResponse): Promise<void> }).onPreview(REAL_DOC);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const previewing = (page as unknown as { previewing(): { file: File | null; fileName: string } | null }).previewing();
    expect(previewing).not.toBeNull();
    expect(previewing!.fileName).toBe('land-title.pdf');
    expect(previewing!.file).toBeInstanceOf(File);
    const readBack = new Uint8Array(await previewing!.file!.arrayBuffer());
    expect(Array.from(readBack)).toEqual(Array.from(bytes));
  });

  it('reports a real failure with a toast rather than silently doing nothing', async () => {
    const page = render({
      ...baseApi,
      getDocumentContent: () => { throw new Error('network down'); },
    });
    const toasts = TestBed.inject(ToastService);

    await (page as unknown as { onPreview(d: ApplicationDocumentResponse): Promise<void> }).onPreview(REAL_DOC);

    expect(toasts.toasts().some((t) => t.kind === 'error')).toBe(true);
  });
});
