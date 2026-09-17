import { __decorate } from "tslib";
import { Component, inject, signal } from '@angular/core';
import { DocumentLibraryStore } from '../../core/stores/document-library.store';
import { SAVED_DOCUMENT_CATEGORY_LABELS } from '../../core/domain/document.model';
import { DocumentPreviewComponent } from '../../shared/ui/document-preview.component';
import { formatDate } from '../../core/utils/ids';
import { ToastService } from '../../shared/ui/toast.service';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { toBase64 } from '../../core/api/document-resubmission.service';
function fileTypeFromName(name) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'pdf')
        return ext;
    return 'pdf';
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
let MyDocumentsPage = class MyDocumentsPage {
    /** The document being previewed, or null. DOC-003. Demo path only — the real path opens the signed URL directly. */
    preview = signal(null);
    store = inject(DocumentLibraryStore);
    toast = inject(ToastService);
    api = inject(CitizenApiClient);
    labels = SAVED_DOCUMENT_CATEGORY_LABELS;
    categories = Object.keys(SAVED_DOCUMENT_CATEGORY_LABELS);
    filter = signal(null);
    formatDate = formatDate;
    Number = Number;
    realChecked = signal(false);
    realDocuments = signal([]);
    opening = signal(null);
    uploading = signal(false);
    constructor() {
        if (this.api.configured)
            this.refreshReal();
    }
    refreshReal() {
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
    async onFileSelected(event) {
        const input = event.target;
        const file = input.files?.[0];
        if (!file)
            return;
        if (this.api.configured) {
            this.uploading.set(true);
            try {
                await new Promise((resolve, reject) => {
                    void (async () => {
                        const contentBase64 = await toBase64(file);
                        this.api.uploadDocument({ fileName: file.name, label: file.name, contentBase64 }).subscribe({
                            next: () => { this.toast.success(`${file.name} uploaded.`); this.refreshReal(); resolve(); },
                            error: (e) => reject(e),
                        });
                    })();
                });
            }
            catch {
                this.toast.error(`Could not upload ${file.name}. Try again.`);
            }
            finally {
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
    openReal(d) {
        this.opening.set(d.id);
        this.api.getDocumentContent(d.id).subscribe({
            next: ({ url }) => { window.open(url, '_blank', 'noopener'); this.opening.set(null); },
            error: () => { this.toast.error('Could not open this document. Try again.'); this.opening.set(null); },
        });
    }
    remove(id) {
        const doc = this.store.myDocuments().find((d) => d.id === id);
        this.store.remove(id);
        this.toast.success(doc ? `${doc.fileName} removed.` : 'Document removed.');
    }
};
MyDocumentsPage = __decorate([
    Component({
        selector: 'app-my-documents',
        imports: [DocumentPreviewComponent],
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
          <div class="grid grid-3">
            @for (d of realDocuments(); track d.id) {
              <div class="card card-fill">
                @if (d.applicationReference) {
                  <div class="badge badge-secondary" style="align-self:flex-start; margin-bottom:8px;">Attached — {{ d.applicationReference }}</div>
                } @else {
                  <div class="badge badge-primary" style="align-self:flex-start; margin-bottom:8px;">Available to reuse</div>
                }
                <div style="font-weight:600; word-break:break-word;">{{ d.fileName }}</div>
                <div class="small muted">{{ d.label }}</div>
                <div class="small muted">{{ (Number(d.byteSize) / 1024).toFixed(0) }} KB &middot; {{ formatDate(d.uploadedAt) }}</div>
                @if (d.expiresOn) {
                  <div class="small muted">Expires {{ formatDate(d.expiresOn) }}</div>
                }
                <div class="card-footer">
                  <button class="btn btn-secondary btn-sm" [disabled]="opening() === d.id" (click)="openReal(d)">
                    {{ opening() === d.id ? 'Opening…' : 'Open' }}
                  </button>
                </div>
              </div>
            }
          </div>
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
          <div class="grid grid-3">
            @for (d of filtered(); track d.id) {
              <div class="card card-fill">
                <div class="badge badge-primary" style="align-self:flex-start; margin-bottom:8px;">{{ labels[d.category] }}</div>
                <div style="font-weight:600; word-break:break-word;">{{ d.fileName }}</div>
                <div class="small muted">{{ (d.sizeBytes / 1024).toFixed(0) }} KB · {{ formatDate(d.uploadedAt) }}</div>
                <div class="card-footer">
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
    </div>
  `,
    })
], MyDocumentsPage);
export { MyDocumentsPage };
