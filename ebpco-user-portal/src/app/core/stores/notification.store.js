import { __decorate } from "tslib";
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { nextId, todayIso } from '../utils/ids';
import { AuthService } from '../session/auth.service';
import { CitizenApiClient } from '../api/citizen-api.client';
/**
 * Real category names (`NotificationEntry.category`) → this portal's local,
 * narrower vocabulary. Lossy on purpose, not a bug: `notifications.page.ts`
 * never switches on category (only title/message/applicationId/createdAt/
 * isRead drive the UI), so a coarser local label costs nothing today. Do
 * not use this mapping anywhere that needs to tell 'appointments' and
 * 'account' apart — collapse either to 'system' loses that distinction.
 */
function toLocalCategory(category) {
    switch (category) {
        case 'applicationUpdates': return 'application';
        case 'payments': return 'payment';
        case 'permitStatus': return 'permit';
        case 'documentReminders': return 'document';
        default: return 'system'; // appointments, account
    }
}
function fromServerNotification(entry) {
    return {
        id: entry.id,
        applicationId: entry.applicationId,
        category: toLocalCategory(entry.category),
        title: entry.title,
        message: entry.body,
        createdAt: entry.createdAt,
        isRead: entry.readAt !== null,
    };
}
let NotificationStore = class NotificationStore {
    auth = inject(AuthService);
    api = inject(CitizenApiClient);
    /**
     * Real notifications, from `GET /notifications`. `null` means "not
     * fetched" — same pattern as `ApplicationStore.realApplications` and
     * `BusinessStore.realBusinesses`, for the same reason.
     */
    realNotifications = signal(null);
    usingReal = computed(() => this.realNotifications() !== null);
    constructor() {
        effect(() => {
            if (this.auth.isAuthenticated() && this.api.configured) {
                void this.refreshMine();
            }
            else {
                this.realNotifications.set(null);
            }
        });
    }
    async refreshMine() {
        try {
            const response = await firstValueFrom(this.api.getNotifications());
            this.realNotifications.set(response.data.map(fromServerNotification));
        }
        catch {
            // Leave whatever was there before — a transient failure should not
            // make a citizen's own notifications appear to vanish.
        }
    }
    /** `POST /notifications/{id}/read` for real. */
    async markReadReal(id) {
        try {
            await firstValueFrom(this.api.markNotificationRead(id));
            await this.refreshMine();
        }
        catch {
            // The click already felt like it worked locally in no case here —
            // there is no optimistic local flip to undo. A retry (opening the
            // notification again) is the recovery path; nothing to show inline
            // for a background refresh failure this small.
        }
    }
    /**
     * No bulk "mark all read" route exists server-side — only the one-at-a-
     * time `POST /notifications/{id}/read`. This is genuinely N requests,
     * not a shortcut standing in for one; do not "simplify" it into a single
     * call without first confirming the server grew a bulk route.
     */
    async markAllReadReal() {
        const unread = (this.realNotifications() ?? []).filter((n) => !n.isRead);
        await Promise.all(unread.map((n) => firstValueFrom(this.api.markNotificationRead(n.id)).catch(() => { })));
        await this.refreshMine();
    }
    items = signal([
        {
            id: 'notif-1',
            applicationId: null,
            category: 'system',
            title: 'Welcome to eBPCO',
            message: 'Manage your businesses, permit applications, and payments all in one place.',
            createdAt: '2026-08-20T09:00:00.000Z',
            isRead: true,
        },
        {
            id: 'notif-2',
            applicationId: null,
            category: 'document',
            title: 'Reminder: keep your documents ready',
            message: 'Upload commonly required documents (valid ID, barangay clearance) to My Documents so they are ready for any application.',
            createdAt: '2026-08-21T09:00:00.000Z',
            isRead: false,
        },
    ]);
    all = computed(() => {
        const real = this.realNotifications();
        const source = real ?? this.items();
        return [...source].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    });
    unreadCount = computed(() => this.all().filter((n) => !n.isRead).length);
    push(title, message, category, applicationId = null) {
        this.items.update((list) => [
            { id: nextId('notif'), applicationId, category, title, message, createdAt: todayIso(), isRead: false },
            ...list,
        ]);
    }
    markRead(id) {
        this.items.update((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    }
    markAllRead() {
        this.items.update((list) => list.map((n) => ({ ...n, isRead: true })));
    }
};
NotificationStore = __decorate([
    Injectable({ providedIn: 'root' })
], NotificationStore);
export { NotificationStore };
