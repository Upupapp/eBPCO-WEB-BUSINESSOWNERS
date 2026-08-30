import { Component, inject, signal } from '@angular/core';
import { DocumentLibraryStore } from '../../core/stores/document-library.store';
import { SAVED_DOCUMENT_CATEGORY_LABELS, SavedDocumentCategory, SavedDocumentFileType } from '../../core/domain/document.model';
import { formatDate } from '../../core/utils/ids';
import { ToastService } from '../../shared/ui/toast.service';

function fileTypeFromName(name: string): SavedDocumentFileType {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'pdf') return ext as SavedDocumentFileType;
  return 'pdf';
}

@Component({
  selector: 'app-my-documents',
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>My Documents</h1>
          <div class="subtitle">A reusable library of documents you can attach to any permit application.</div>
        </div>
        <label class="btn btn-primary" style="cursor:pointer;">
          + Upload Document
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none;" (change)="onFileSelected($event)" />
        </label>
      </div>

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
                <button class="btn btn-ghost btn-sm" style="padding-left:0;" (click)="remove(d.id)">Remove</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class MyDocumentsPage {
  private readonly store = inject(DocumentLibraryStore);
  private readonly toast = inject(ToastService);

  protected readonly labels = SAVED_DOCUMENT_CATEGORY_LABELS;
  protected readonly categories = Object.keys(SAVED_DOCUMENT_CATEGORY_LABELS) as SavedDocumentCategory[];
  readonly filter = signal<SavedDocumentCategory | null>(null);
  protected readonly formatDate = formatDate;

  filtered() {
    const f = this.filter();
    const all = this.store.myDocuments();
    return f ? all.filter((d) => d.category === f) : all;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.store.add({ fileName: file.name, fileType: fileTypeFromName(file.name), category: 'uncategorized', sizeBytes: file.size });
    this.toast.success(`${file.name} added to My Documents.`);
    input.value = '';
  }

  remove(id: string): void {
    this.store.remove(id);
  }
}
