import { TestBed } from '@angular/core/testing';
import { DocumentPreviewComponent, bytesMatchType, mimeFor } from './document-preview.component';
import { SavedDocumentFileType } from '../../core/domain/document.model';

/**
 * DOC-003 — the preview must show the citizen's real file, and must never let
 * that file decide what it is rendered as.
 *
 * `fileTypeFromName()` reads the extension and falls back to 'pdf' for anything
 * it does not recognise, so a file called `notes.html` is stored with
 * fileType 'pdf' while the browser still reports `type: 'text/html'`. If the
 * preview built its blob from `File.type`, that HTML would sit at a `blob:` URL
 * — which inherits this portal's origin — inside an iframe. Script execution as
 * the signed-in citizen, from a file anyone could have handed them to upload.
 */
describe('Document preview', () => {
  beforeEach(() => TestBed.configureTestingModule({}));
  afterEach(() => TestBed.resetTestingModule());

  it('renders only the four accepted MIME types, whatever the file claims', () => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    for (const t of ['pdf', 'jpg', 'jpeg', 'png'] as SavedDocumentFileType[]) {
      expect(allowed).toContain(mimeFor(t));
    }
  });

  it('NEVER derives the render type from the file itself', async () => {
    const created: string[] = [];
    const realCreate = URL.createObjectURL;
    const seen: Blob[] = [];
    URL.createObjectURL = ((b: Blob) => { seen.push(b); const u = realCreate(b); created.push(u); return u; }) as typeof URL.createObjectURL;

    try {
      const fixture = TestBed.createComponent(DocumentPreviewComponent);
      // A file that lies: HTML content, HTML MIME, .pdf name — exactly what
      // fileTypeFromName() would classify as 'pdf'.
      const hostile = new File(['<script>alert(1)</script>'], 'notes.pdf', { type: 'text/html' });
      fixture.componentRef.setInput('file', hostile);
      fixture.componentRef.setInput('fileName', 'notes.pdf');
      fixture.componentRef.setInput('fileType', 'pdf');
      fixture.detectChanges();

      expect(seen.length).toBeGreaterThan(0);
      // The blob the browser was handed must be a PDF, not the file's own type.
      expect(seen[0].type).toBe('application/pdf');
      expect(seen[0].type).not.toBe('text/html');
    } finally {
      URL.createObjectURL = realCreate;
    }
  });

  it('tells the citizen when the bytes do not match the extension', () => {
    const pdfHead = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const pngHead = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpgHead = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const htmlHead = new Uint8Array([0x3c, 0x21, 0x44, 0x4f, 0x43]); // <!DOC

    expect(bytesMatchType(pdfHead, 'pdf')).toBe(true);
    expect(bytesMatchType(pngHead, 'png')).toBe(true);
    expect(bytesMatchType(jpgHead, 'jpg')).toBe(true);
    expect(bytesMatchType(jpgHead, 'jpeg')).toBe(true);

    // The whole point: a file named .pdf that is not one.
    expect(bytesMatchType(htmlHead, 'pdf')).toBe(false);
    expect(bytesMatchType(pngHead, 'pdf')).toBe(false);
    expect(bytesMatchType(pdfHead, 'png')).toBe(false);
  });

  it('revokes the object URL when it closes, rather than leaking the file', () => {
    const revoked: string[] = [];
    const realRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = ((u: string) => { revoked.push(u); realRevoke(u); }) as typeof URL.revokeObjectURL;
    try {
      const fixture = TestBed.createComponent(DocumentPreviewComponent);
      fixture.componentRef.setInput('file', new File([new Uint8Array([1, 2, 3])], 'a.png'));
      fixture.componentRef.setInput('fileName', 'a.png');
      fixture.componentRef.setInput('fileType', 'png');
      fixture.detectChanges();
      fixture.destroy();
      expect(revoked.length).toBeGreaterThan(0);
    } finally {
      URL.revokeObjectURL = realRevoke;
    }
  });

  it('creates no object URL at all when there is no file', () => {
    const created: string[] = [];
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = ((b: Blob) => { const u = realCreate(b); created.push(u); return u; }) as typeof URL.createObjectURL;
    try {
      const fixture = TestBed.createComponent(DocumentPreviewComponent);
      fixture.componentRef.setInput('file', null);
      fixture.componentRef.setInput('fileName', 'seeded-row.pdf');
      fixture.componentRef.setInput('fileType', 'pdf');
      fixture.componentRef.setInput('seeded', true);
      fixture.detectChanges();
      expect(created.length).toBe(0);
      // ...and it says so, rather than showing an empty frame that reads as a
      // broken document instead of an absent one.
      expect(fixture.nativeElement.textContent).toContain('no copy of');
    } finally {
      URL.createObjectURL = realCreate;
    }
  });
});
