import { Injectable, computed, signal } from '@angular/core';
import { AuthService } from '../session/auth.service';
import { SavedDocument, SavedDocumentCategory, SavedDocumentFileType } from '../domain/document.model';
import { nextId, todayIso } from '../utils/ids';

export interface AddSavedDocumentInput {
  fileName: string;
  fileType: SavedDocumentFileType;
  category: SavedDocumentCategory;
  sizeBytes: number;
}

@Injectable({ providedIn: 'root' })
export class DocumentLibraryStore {
  private readonly items = signal<SavedDocument[]>([
    {
      id: 'doc-1',
      ownerId: 'user-demo',
      fileName: 'Juan_Dela_Cruz_Valid_ID.pdf',
      fileType: 'pdf',
      category: 'validGovernmentId',
      uploadedAt: '2026-07-01T10:00:00.000Z',
      sizeBytes: 482_000,
    },
    {
      id: 'doc-2',
      ownerId: 'user-demo',
      fileName: 'Barangay_Clearance_2026.jpg',
      fileType: 'jpg',
      category: 'barangayClearance',
      uploadedAt: '2026-07-01T10:05:00.000Z',
      sizeBytes: 1_240_000,
    },
  ]);

  constructor(private readonly auth: AuthService) {}

  readonly myDocuments = computed(() => {
    const ownerId = this.auth.currentUser()?.id;
    if (!ownerId) return [];
    return [...this.items()]
      .filter((d) => d.ownerId === ownerId)
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  });

  add(input: AddSavedDocumentInput): SavedDocument {
    const ownerId = this.auth.currentUser()!.id;
    const item: SavedDocument = { id: nextId('savedoc'), ownerId, uploadedAt: todayIso(), ...input };
    this.items.update((list) => [item, ...list]);
    return item;
  }

  remove(id: string): void {
    this.items.update((list) => list.filter((d) => d.id !== id));
  }
}
