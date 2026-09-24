import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocumentLibraryStore } from '../../core/stores/document-library.store';
import { SAVED_DOCUMENT_CATEGORY_LABELS, SavedDocument, SavedDocumentCategory, SavedDocumentFileType } from '../../core/domain/document.model';
import { DocumentPreviewComponent } from '../../shared/ui/document-preview.component';
import { ConfirmModalComponent } from '../../shared/ui/confirm-modal.component';
import { formatDate } from '../../core/utils/ids';
import { ToastService } from '../../shared/ui/toast.service';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { DocumentHistoryEntry } from '../../core/api/citizen-api.models';
import { toBase64 } from '../../core/api/document-resubmission.service';

function fileTypeFromName(name: string): SavedDocumentFileType {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'pdf') return ext as SavedDocumentFileType;
  return 'pdf';
}

/** What a real document's preview needs — built from fetched bytes, not the demo store's SavedDocument. */
interface RealPreview {
  file: File;
  fileName: string;
  fileType: SavedDocumentFileType;
  label: string;
}

/**
 * Real data now exists to show: `GET /documents/me` (broadened — see
 * `citizen-api.client.ts`'s `getMyDocuments`) returns every document this
 * citizen has ever uploaded, attached or not. The old `DocumentLibraryStore`
 * path — where "Added" meant the filename was kept and the bytes discarded —
 * stays as the fallback for an unconfigured backend, since it is genuinely
 * all that build can honestly offer.
 *
 * Real documents have no `category` (that was always a local-only grouping
 * with no server column behind it), so the real view is a flat list rather
 * than the demo's category filter buttons — showing a category that does not
 * exist would be inventing structure the office never asked for.
 */
@Component({
  selector: 'app-my-documents',
  imports: [FormsModule, DocumentPreviewComponent, ConfirmModalComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>My Documents</h1>
          <div class="subtitle">A reusable library of documents you can attach to any permit application.</div>
        </div>
        @if (!api.configured || realChecked()) {
          <label class="btn btn-primary" style="cursor:pointer;">
            + Upload Document
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none;" (change)="onFileSelected($event)" [disabled]="uploading()" />
          </label>
        }
      </div>

      @if (api.configured) {
        @if (!realChecked()) {
          <div class="card empty-state">Loading your documents&hellip;</div>
        } @else if (realDocuments().length === 0) {
          <div class="card empty-state">No documents uploaded yet.</div>
        } @else {
          <div class="doc-toolbar">
            <input
              class="input doc-search"
              type="text"
              aria-label="Search your documents by name"
              placeholder="Search by file or document name"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
            />
            <label class="sort-field">
              <span>Sort by</span>
              <select class="input" [ngModel]="sortBy()" (ngModelChange)="sortBy.set($event)">
                <option value="newest">Date added (newest first)</option>
                <option value="oldest">Date added (oldest first)</option>
                <option value="name">Name (A&ndash;Z)</option>
              </select>
            </label>
          </div>

          @if (visibleRealDocuments().length === 0) {
            <div class="card empty-state">No documents match &ldquo;{{ searchTerm() }}&rdquo;.</div>
          } @else {
          <div class="doc-grid">
            @for (d of visibleRealDocuments(); track d.id) {
              <div class="doc-card">
                <div class="doc-card-top">
                  <span class="doc-type-chip" [class.doc-type-chip--image]="fileTypeOf(d) !== 'pdf'">
                    {{ fileTypeOf(d) === 'pdf' ? 'PDF' : 'IMG' }}
                  </span>
                  @if (d.applicationReference) {
                    <span class="doc-badge doc-badge--attached">Attached to an application</span>
                  } @else {
                    <span class="doc-badge doc-badge--reusable">Available to reuse</span>
                  }
                </div>
                <div class="doc-name" [title]="d.fileName">{{ d.fileName }}</div>
                <div class="doc-label">{{ d.label }}</div>
                <div class="doc-meta">
                  {{ (Number(d.byteSize) / 1024).toFixed(0) }} KB &middot; {{ formatDate(d.uploadedAt) }}
                  @if (d.expiresOn) {
                    &middot; Expires {{ formatDate(d.expiresOn) }}
                  }
                </div>
                <div class="doc-actions">
                  <button class="btn btn-secondary btn-sm" [disabled]="viewingId() === d.id" (click)="viewReal(d)">
                    {{ viewingId() === d.id ? 'Opening…' : 'View' }}
                  </button>
                  <button class="btn btn-secondary btn-sm" [disabled]="downloadingId() === d.id" (click)="downloadReal(d)">
                    {{ downloadingId() === d.id ? 'Downloading…' : 'Download' }}
                  </button>
                </div>
                <button class="btn btn-sm doc-delete" [disabled]="deletingId() === d.id" (click)="deleteReal(d)">
                  {{ deletingId() === d.id ? 'Removing…' : 'Delete' }}
                </button>
              </div>
            }
          </div>
          }
        }
      } @else {
        <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
          <button class="btn btn-sm" [class.btn-primary]="filter() === null" [class.btn-secondary]="filter() !== null" (click)="filter.set(null)">All</button>
          @for (c of categories; track c) {
            <button class="btn btn-sm" [class.btn-primary]="filter() === c" [class.btn-secondary]="filter() !== c" (click)="filter.set(c)">{{ labels[c] }}</button>
          }
        </div>

        @if (filtered().length === 0) {
          <div class="card empty-state">No documents in this category yet.</div>
        } @else {
          <div class="doc-grid">
            @for (d of filtered(); track d.id) {
              <div class="doc-card">
                <div class="doc-card-top">
                  <span class="doc-type-chip" [class.doc-type-chip--image]="d.fileType !== 'pdf'">
                    {{ d.fileType === 'pdf' ? 'PDF' : 'IMG' }}
                  </span>
                  <span class="doc-badge doc-badge--reusable">{{ labels[d.category] }}</span>
                </div>
                <div class="doc-name" [title]="d.fileName">{{ d.fileName }}</div>
                <div class="doc-meta">{{ (d.sizeBytes / 1024).toFixed(0) }} KB · {{ formatDate(d.uploadedAt) }}</div>
                <div class="doc-actions">
                  <button class="btn btn-secondary btn-sm" (click)="preview.set(d)">Preview</button>
                  <button class="btn btn-ghost btn-sm" (click)="remove(d.id)">Remove</button>
                </div>
              </div>
            }
          </div>
        }
      }

      @if (preview(); as p) {
        <app-document-preview
          [file]="p.file"
          [fileName]="p.fileName"
          [fileType]="p.fileType"
          [label]="labels[p.category]"
          [seeded]="p.file === null"
          (close)="preview.set(null)"
        />
      }

      @if (realPreview(); as p) {
        <app-document-preview
          [file]="p.file"
          [fileName]="p.fileName"
          [fileType]="p.fileType"
          [label]="p.label"
          (close)="realPreview.set(null)"
        />
      }

      @if (confirmDeleteFor(); as d) {
        <app-confirm-modal
          title="Remove from My Documents"
          [message]="d.applicationReference
            ? 'Remove ' + d.fileName + ' from My Documents? It will stay exactly as filed on ' + d.applicationReference + ' — this only stops it being offered for reuse elsewhere.'
            : 'Remove ' + d.fileName + ' from My Documents? This deletes it.'"
          confirmLabel="Remove"
          tone="danger"
          (confirm)="confirmDelete()"
          (cancel)="confirmDeleteFor.set(null)"
        />
      }
    </div>
  `,
  styles: [`
    .doc-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .doc-search {
      flex: 1 1 260px;
      min-width: 200px;
    }
    .sort-field {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--gray-500, #6b7080);
      white-space: nowrap;
    }
    .sort-field select {
      width: auto;
    }
    .doc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 14px;
    }
    .doc-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: var(--surface, #fff);
      border: 1px solid var(--border-light, #eeeef2);
      border-radius: var(--radius-lg, 12px);
      padding: 16px;
      transition: box-shadow .15s ease, transform .15s ease, border-color .15s ease;
    }
    .doc-card:hover {
      border-color: var(--border-medium, #e6e6ec);
      box-shadow: 0 6px 18px rgba(31, 36, 48, .08);
      transform: translateY(-1px);
    }
    .doc-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .doc-type-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      height: 22px;
      padding: 0 6px;
      border-radius: 6px;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: .03em;
      background: var(--primary-100, #fdeceb);
      color: var(--primary-700, #a5182a);
    }
    .doc-type-chip--image {
      background: #e8f1ff;
      color: #1d4ed8;
    }
    .doc-badge {
      display: inline-flex;
      align-items: center;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .doc-badge--attached {
      background: #e7f7ee;
      color: #157347;
    }
    .doc-badge--reusable {
      background: var(--primary-100, #fdeceb);
      color: var(--primary-700, #a5182a);
    }
    .doc-name {
      font-weight: 700;
      color: var(--gray-900, #1f2430);
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .doc-label {
      font-size: 12.5px;
      color: var(--gray-500, #6b7080);
    }
    .doc-meta {
      font-size: 12px;
      color: var(--gray-400, #8b8f9b);
      margin-bottom: 6px;
    }
    .doc-actions {
      display: flex;
      gap: 6px;
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px solid var(--border-light, #eeeef2);
    }
    .doc-actions .btn {
      flex: 1;
    }
    // A real button, not a bare red link floating under the row above —
    // same border/radius/padding weight as View and Download, just tinted
    // for a destructive action, so it reads as a deliberate part of the
    // card rather than something left unstyled (found live 2026-09-20).
    .doc-delete {
      width: 100%;
      margin-top: 6px;
      background: transparent;
      color: var(--danger-text, #a5182a);
      border: 1px solid var(--danger-100, #fdeceb);
    }
    .doc-delete:hover:not(:disabled) {
      background: var(--danger-100, #fdeceb);
      border-color: var(--danger-500, #dc2626);
    }
  `],
})
export class MyDocumentsPage {
  /** The document being previewed, or null. DOC-003. Demo path only — the real path builds its own RealPreview from fetched bytes. */
  protected readonly preview = signal<SavedDocument | null>(null);
  /** Real path's preview — built in viewReal() from bytes actually fetched, never from the forced-download signed URL directly (that response is always Content-Disposition: attachment; see documents.controller.ts). */
  protected readonly realPreview = signal<RealPreview | null>(null);

  private readonly store = inject(DocumentLibraryStore);
  private readonly toast = inject(ToastService);
  protected readonly api = inject(CitizenApiClient);

  protected readonly labels = SAVED_DOCUMENT_CATEGORY_LABELS;
  protected readonly categories = Object.keys(SAVED_DOCUMENT_CATEGORY_LABELS) as SavedDocumentCategory[];
  readonly filter = signal<SavedDocumentCategory | null>(null);
  protected readonly formatDate = formatDate;
  protected readonly Number = Number;
  protected readonly fileTypeOf = (d: DocumentHistoryEntry) => fileTypeFromName(d.fileName);

  protected readonly realChecked = signal(false);
  protected readonly realDocuments = signal<DocumentHistoryEntry[]>([]);
  /** Matches file name or label — the two things a citizen actually recognises a document by, not its internal id. */
  protected readonly searchTerm = signal('');
  protected readonly sortBy = signal<'newest' | 'oldest' | 'name'>('newest');
  /** What the grid actually renders — realDocuments() filtered by searchTerm() and ordered by sortBy(). */
  protected readonly visibleRealDocuments = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const matched = term
      ? this.realDocuments().filter((d) =>
          d.fileName.toLowerCase().includes(term) || d.label.toLowerCase().includes(term))
      : this.realDocuments();
    const sorted = [...matched];
    const sort = this.sortBy();
    if (sort === 'name') {
      sorted.sort((a, b) => a.fileName.localeCompare(b.fileName));
    } else {
      sorted.sort((a, b) => {
        const diff = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        return sort === 'newest' ? -diff : diff;
      });
    }
    return sorted;
  });
  protected readonly viewingId = signal<string | null>(null);
  protected readonly downloadingId = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly uploading = signal(false);

  constructor() {
    if (this.api.configured) this.refreshReal();
  }

  private refreshReal(): void {
    this.api.getMyDocuments().subscribe({
      next: (docs) => { this.realDocuments.set(docs); this.realChecked.set(true); },
      error: () => this.realChecked.set(true),
    });
  }

  filtered() {
    const f = this.filter();
    const all = this.store.myDocuments();
    return f ? all.filter((d) => d.category === f) : all;
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.api.configured) {
      this.uploading.set(true);
      try {
        await new Promise<void>((resolve, reject) => {
          void (async () => {
            const contentBase64 = await toBase64(file);
            this.api.uploadDocument({ fileName: file.name, label: file.name, contentBase64 }).subscribe({
              next: () => { this.toast.success(`${file.name} uploaded.`); this.refreshReal(); resolve(); },
              error: (e: unknown) => reject(e as Error),
            });
          })();
        });
      } catch {
        this.toast.error(`Could not upload ${file.name}. Try again.`);
      } finally {
        this.uploading.set(false);
        input.value = '';
      }
      return;
    }

    this.store.add({ file, fileName: file.name, fileType: fileTypeFromName(file.name), category: 'uncategorized', sizeBytes: file.size });
    // F-14: only the name, type and size are kept — the file's CONTENTS are
    // discarded. "Added" implied the document itself was stored.
    this.toast.success(`${file.name} listed by name only — the file itself was not stored.`);
    input.value = '';
  }

  /**
   * Shows the document in-page instead of forcing a download.
   *
   * `getDocumentContent` returns a signed URL whose response is ALWAYS
   * `Content-Disposition: attachment` (documents.controller.ts — a
   * deliberate XSS guard, never relaxed). Navigating to it directly, the
   * old behaviour here, therefore always downloads regardless of file
   * type. Fetching the bytes with `fetch()` and building our OWN blob: URL
   * sidesteps that header entirely — the same pattern
   * DocumentPreviewComponent already uses for a locally-picked File, typed
   * from OUR OWN extension enum rather than trusted from the response.
   */
  viewReal(d: DocumentHistoryEntry): void {
    this.viewingId.set(d.id);
    this.api.getDocumentContent(d.id).subscribe({
      next: ({ url }) => {
        void fetch(url)
          .then((response) => {
            if (!response.ok) throw new Error(`${response.status}`);
            return response.blob();
          })
          .then((blob) => {
            this.realPreview.set({
              file: new File([blob], d.fileName),
              fileName: d.fileName,
              fileType: fileTypeFromName(d.fileName),
              label: d.label,
            });
          })
          .catch(() => this.toast.error('Could not open this document. Try again.'))
          .finally(() => this.viewingId.set(null));
      },
      error: () => { this.toast.error('Could not open this document. Try again.'); this.viewingId.set(null); },
    });
  }

  downloadReal(d: DocumentHistoryEntry): void {
    this.downloadingId.set(d.id);
    this.api.getDocumentContent(d.id).subscribe({
      next: ({ url }) => { window.open(url, '_blank', 'noopener'); this.downloadingId.set(null); },
      error: () => { this.toast.error('Could not download this document. Try again.'); this.downloadingId.set(null); },
    });
  }

  /** Which document confirmDeleteFor's modal is asking about, or null — set by deleteReal, read+acted on by confirmDelete. */
  protected readonly confirmDeleteFor = signal<DocumentHistoryEntry | null>(null);

  /**
   * Always shown, whether or not the document is attached — the server
   * (`DELETE /documents/{id}`, see citizen-api.client.ts's deleteDocument
   * doc comment) does two different things underneath depending on that,
   * so the confirmation says which one this document will get: an
   * unattached copy is genuinely deleted; an attached one only stops being
   * offered here — it stays exactly as filed on its application.
   */
  deleteReal(d: DocumentHistoryEntry): void {
    this.confirmDeleteFor.set(d);
  }

  protected confirmDelete(): void {
    const d = this.confirmDeleteFor();
    this.confirmDeleteFor.set(null);
    if (!d) return;

    this.deletingId.set(d.id);
    this.api.deleteDocument(d.id).subscribe({
      next: () => {
        this.realDocuments.update((docs) => docs.filter((x) => x.id !== d.id));
        this.toast.success(`${d.fileName} removed from My Documents.`);
        this.deletingId.set(null);
      },
      error: () => {
        this.toast.error(`Could not remove ${d.fileName}. Try again.`);
        this.deletingId.set(null);
      },
    });
  }

  remove(id: string): void {
    const doc = this.store.myDocuments().find((d) => d.id === id);
    this.store.remove(id);
    this.toast.success(doc ? `${doc.fileName} removed.` : 'Document removed.');
  }
}
