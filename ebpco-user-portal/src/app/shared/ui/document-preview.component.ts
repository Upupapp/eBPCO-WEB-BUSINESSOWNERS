import { Component, computed, inject, input, output, signal, effect, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SavedDocumentFileType } from '../../core/domain/document.model';

/**
 * The MIME type a preview is allowed to be rendered as.
 *
 * Derived from OUR OWN fileType enum, never from `File.type`. That is the whole
 * security decision in this component and it is not a formality:
 * `fileTypeFromName()` reads the extension and falls back to 'pdf' for anything
 * it does not recognise, so a file called `notes.html` is stored as a 'pdf'
 * while the browser still reports its type as `text/html`. Building the blob
 * from `file.type` would put that HTML at a `blob:` URL — which inherits this
 * portal's origin — and render it in an iframe. That is script execution as the
 * signed-in citizen, from a file anyone could have handed them to upload.
 *
 * Four types in, four types out, nothing else reachable.
 */
const SAFE_MIME: Record<SavedDocumentFileType, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** The first bytes each accepted format really begins with. */
const MAGIC: Record<SavedDocumentFileType, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]],                    // %PDF
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
};

export function mimeFor(fileType: SavedDocumentFileType): string {
  return SAFE_MIME[fileType] ?? 'application/octet-stream';
}

/** Do the bytes match the extension the file claims? */
export function bytesMatchType(head: Uint8Array, fileType: SavedDocumentFileType): boolean {
  const candidates = MAGIC[fileType];
  if (!candidates) return false;
  return candidates.some((sig) => sig.every((b, i) => head[i] === b));
}

/**
 * DOC-003 — Document Preview.
 *
 * A citizen could see that a document was on file and what it was called, and
 * could not open it. "Survey Plan — survey-plan.pdf, Uploaded" is exactly as
 * reassuring when they attached the right scan as when they attached last
 * year's, and there was no way to tell the two apart before an officer did.
 *
 * Shows the real bytes the portal kept, and says plainly when it has none —
 * seeded demo rows have `file: null`, and an empty frame there would suggest a
 * broken document rather than an absent one.
 */
@Component({
  selector: 'app-document-preview',
  template: `
    <div class="doc-preview-backdrop" (click)="close.emit()">
      <div
        class="doc-preview-panel"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Preview of ' + fileName()"
        (click)="$event.stopPropagation()"
      >
        <div class="doc-preview-head">
          <div>
            <strong>{{ fileName() }}</strong>
            @if (label()) { <div class="small muted">{{ label() }}</div> }
          </div>
          <button class="btn btn-ghost btn-sm" (click)="close.emit()" aria-label="Close preview">Close</button>
        </div>

        @if (!file()) {
          <div class="card empty-state" style="margin:0;">
            <p>
              This portal has no copy of <strong>{{ fileName() }}</strong> to show you.
              @if (seeded()) {
                It is one of the example records this demo build starts with, which never had a real file behind them.
              } @else {
                The file was not kept — please attach it again so you can check it.
              }
            </p>
          </div>
        } @else {
          @if (mismatch()) {
            <div
              class="card"
              style="background:var(--warning-100); border:1px solid var(--warning-text); color:var(--warning-text); margin:0 0 10px;"
            >
              <strong>This file does not look like a {{ fileType().toUpperCase() }}.</strong>
              Its name ends in .{{ fileType() }}, but its contents do not match that format. The
              Municipality may not be able to open it — it is worth attaching it again.
            </div>
          }

          @if (fileType() === 'pdf') {
            <iframe
              class="doc-preview-frame"
              [src]="safeUrl()"
              [title]="'Preview of ' + fileName()"
              sandbox
            ></iframe>
          } @else {
            <img class="doc-preview-image" [src]="url()" [alt]="'Preview of ' + fileName()" />
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .doc-preview-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.55);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; z-index: 200;
    }
    .doc-preview-panel {
      background: var(--white, #fff); border-radius: 12px; padding: 16px;
      width: 100%; max-width: 900px; max-height: 90vh; overflow: auto;
    }
    .doc-preview-head {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 12px; margin-bottom: 12px;
    }
    .doc-preview-frame { width: 100%; height: 70vh; border: 1px solid var(--border-light); border-radius: 8px; }
    .doc-preview-image { max-width: 100%; height: auto; border: 1px solid var(--border-light); border-radius: 8px; display: block; }
  `],
})
export class DocumentPreviewComponent implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);

  readonly file = input<File | null>(null);
  readonly fileName = input.required<string>();
  readonly fileType = input.required<SavedDocumentFileType>();
  readonly label = input<string | null>(null);
  /** True when the absent file is an example row rather than something lost. */
  readonly seeded = input<boolean>(false);

  readonly close = output<void>();

  private readonly objectUrl = signal<string | null>(null);
  protected readonly mismatch = signal(false);

  /**
   * The live URL, held OUTSIDE the signal graph.
   *
   * This was a signal read inside the effect below, which also writes it — so
   * every write retriggered the effect, which created another object URL,
   * which triggered it again. It exhausted a 4GB heap in the test run. In a
   * browser it would have leaked object URLs for as long as the preview was
   * open, holding every copy of the file in memory.
   *
   * The template needs a signal to render; revocation must not read one.
   */
  private liveUrl: string | null = null;

  constructor() {
    effect(() => {
      const f = this.file();
      const type = this.fileType();
      this.revoke();
      this.mismatch.set(false);
      if (!f) return;
      // The blob is typed from OUR enum, not from f.type. See SAFE_MIME.
      const url = URL.createObjectURL(new Blob([f], { type: mimeFor(type) }));
      this.liveUrl = url;
      this.objectUrl.set(url);
      void f.slice(0, 8).arrayBuffer().then((buf) => {
        this.mismatch.set(!bytesMatchType(new Uint8Array(buf), type));
      });
    });
  }

  protected url(): string | null {
    return this.objectUrl();
  }

  protected safeUrl(): SafeResourceUrl | null {
    const u = this.objectUrl();
    return u ? this.sanitizer.bypassSecurityTrustResourceUrl(u) : null;
  }

  private revoke(): void {
    if (this.liveUrl) URL.revokeObjectURL(this.liveUrl);
    this.liveUrl = null;
    this.objectUrl.set(null);
  }

  ngOnDestroy(): void {
    this.revoke();
  }
}
