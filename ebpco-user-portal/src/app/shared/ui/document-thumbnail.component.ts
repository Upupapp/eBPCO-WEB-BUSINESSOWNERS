import { Component, Injectable, OnChanges, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { CitizenApiClient } from '../../core/api/citizen-api.client';

/**
 * A picture of the document itself at the top of its card: the first page of
 * a PDF, or the image, cropped from the top so a form's heading is what shows.
 *
 * Until it is drawn, and for good when there is nothing to draw (a file still
 * being scanned, one quarantined, no connection), the card shows a quiet panel
 * with the file type instead.
 */
@Component({
  selector: 'app-document-thumbnail',
  template: `
    <button type="button" class="thumb" [class.thumb--ready]="src()" (click)="open.emit()"
            [attr.aria-label]="'Open ' + fileName()">
      @if (src(); as url) {
        <img [src]="url" alt="" />
      } @else {
        <span class="thumb-placeholder" [class.thumb-placeholder--image]="kind() === 'img'">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
          </svg>
          <span>{{ kind() === 'pdf' ? 'PDF' : 'IMG' }}</span>
        </span>
      }
    </button>
  `,
  styles: [`
    :host { display: block; }
    .thumb {
      display: block;
      width: 100%;
      height: 150px;
      padding: 0;
      border: 0;
      border-bottom: 1px solid var(--border-light, #eeeef2);
      background: var(--gray-50, #f7f7f9);
      overflow: hidden;
      cursor: pointer;
    }
    .thumb img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      background: #fff;
    }
    .thumb:focus-visible { outline: 2px solid var(--primary-500, #c81e2c); outline-offset: -2px; }
    .thumb-placeholder {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: var(--primary-500, #c81e2c);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .06em;
      opacity: .7;
    }
    .thumb-placeholder--image { color: #1d4ed8; }
  `],
})
export class DocumentThumbnailComponent implements OnChanges {
  private readonly thumbnails = inject(DocumentThumbnails);

  readonly documentId = input.required<string>();
  readonly fileName = input.required<string>();
  readonly kind = input<'pdf' | 'img'>('pdf');
  readonly open = output<void>();

  protected readonly src = signal<string | null>(null);
  private drawing: string | null = null;

  ngOnChanges(): void {
    const id = this.documentId();
    if (id === this.drawing) return;
    this.drawing = id;
    this.src.set(null);
    void this.thumbnails.pictureOf(id, this.kind()).then((url) => {
      if (this.drawing === id) this.src.set(url);
    });
  }
}

/**
 * One picture per document for the session, as a blob: URL (the page's CSP
 * allows blob: images). A filed document never changes, so the list costs one
 * download per file however often it is shown; a failed attempt is forgotten
 * and tried again next time. At most three files are fetched at once.
 */
@Injectable({ providedIn: 'root' })
export class DocumentThumbnails {
  private readonly api = inject(CitizenApiClient);
  private readonly pictures = new Map<string, Promise<string | null>>();
  private running = 0;
  private readonly waiting: Array<() => void> = [];

  pictureOf(documentId: string, kind: 'pdf' | 'img'): Promise<string | null> {
    let picture = this.pictures.get(documentId);
    if (!picture) {
      picture = this.queued(() => this.draw(documentId, kind));
      this.pictures.set(documentId, picture);
      void picture.then((url) => {
        if (url === null) this.pictures.delete(documentId);
      });
    }
    return picture;
  }

  private async queued<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= 3) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }

  private async draw(documentId: string, kind: 'pdf' | 'img'): Promise<string | null> {
    try {
      const { url } = await firstValueFrom(this.api.getDocumentContent(documentId));
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (kind === 'img') return URL.createObjectURL(blob);
      return await firstPageOf(blob);
    } catch {
      return null;
    }
  }
}

/**
 * The first page of a PDF as a PNG blob: URL. pdf.js is loaded only here, the
 * first time a PDF needs a picture, and its worker is the copy the build ships
 * at /pdfjs/ (the site's own origin, which the CSP allows). pdf.js 6 never
 * evaluates code, so the CSP needs no 'unsafe-eval'.
 */
async function firstPageOf(blob: Blob): Promise<string | null> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const pdf = await task.promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 520 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport, background: '#ffffff' }).promise;
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return png ? URL.createObjectURL(png) : null;
  } finally {
    await task.destroy();
  }
}
