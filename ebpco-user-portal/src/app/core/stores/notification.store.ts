import { Injectable, computed, signal } from '@angular/core';
import { AppNotification, NotificationCategory } from '../domain/notification.model';
import { nextId, todayIso } from '../utils/ids';

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly items = signal<AppNotification[]>([
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

  readonly all = computed(() => [...this.items()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
  readonly unreadCount = computed(() => this.items().filter((n) => !n.isRead).length);

  push(title: string, message: string, category: NotificationCategory, applicationId: string | null = null): void {
    this.items.update((list) => [
      { id: nextId('notif'), applicationId, category, title, message, createdAt: todayIso(), isRead: false },
      ...list,
    ]);
  }

  markRead(id: string): void {
    this.items.update((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  markAllRead(): void {
    this.items.update((list) => list.map((n) => ({ ...n, isRead: true })));
  }
}
