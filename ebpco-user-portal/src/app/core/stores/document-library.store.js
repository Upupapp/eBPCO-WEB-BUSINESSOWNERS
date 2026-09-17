import { __decorate } from "tslib";
import { Injectable, computed, signal } from '@angular/core';
import { nextId, todayIso } from '../utils/ids';
let DocumentLibraryStore = class DocumentLibraryStore {
    auth;
    items = signal([
        {
            id: 'doc-1',
            ownerId: 'user-demo',
            file: null, // seeded demo row — there was never a file behind it
            fileName: 'Juan_Dela_Cruz_Valid_ID.pdf',
            fileType: 'pdf',
            category: 'validGovernmentId',
            uploadedAt: '2026-07-01T10:00:00.000Z',
            sizeBytes: 482_000,
        },
        {
            id: 'doc-2',
            ownerId: 'user-demo',
            file: null, // seeded demo row — there was never a file behind it
            fileName: 'Barangay_Clearance_2026.jpg',
            fileType: 'jpg',
            category: 'barangayClearance',
            uploadedAt: '2026-07-01T10:05:00.000Z',
            sizeBytes: 1_240_000,
        },
    ]);
    constructor(auth) {
        this.auth = auth;
    }
    myDocuments = computed(() => {
        const ownerId = this.auth.currentUser()?.id;
        if (!ownerId)
            return [];
        return [...this.items()]
            .filter((d) => d.ownerId === ownerId)
            .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
    });
    add(input) {
        const ownerId = this.auth.currentUser().id;
        const item = { id: nextId('savedoc'), ownerId, uploadedAt: todayIso(), ...input };
        this.items.update((list) => [item, ...list]);
        return item;
    }
    remove(id) {
        this.items.update((list) => list.filter((d) => d.id !== id));
    }
};
DocumentLibraryStore = __decorate([
    Injectable({ providedIn: 'root' })
], DocumentLibraryStore);
export { DocumentLibraryStore };
