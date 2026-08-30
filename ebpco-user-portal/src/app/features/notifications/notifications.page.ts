import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationStore } from '../../core/stores/notification.store';
import { formatDateTime } from '../../core/utils/ids';

type Filter = 'All' | 'Unread';

@Component({
  selector: 'app-notifications',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Notifications</h1>
          <div class="subtitle">{{ store.unreadCount() }} unread</div>
        </div>
        <button class="btn btn-secondary" (click)="store.markAllRead()">Mark all as read</button>
      </div>

      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <button class="btn btn-sm" [class.btn-primary]="filter() === 'All'" [class.btn-secondary]="filter() !== 'All'" (click)="filter.set('All')">All</button>
        <button class="btn btn-sm" [class.btn-primary]="filter() === 'Unread'" [class.btn-secondary]="filter() !== 'Unread'" (click)="filter.set('Unread')">Unread</button>
      </div>

      @if (filtered().length === 0) {
        <div class="card empty-state">You're all caught up.</div>
      } @else {
        <div class="card" style="padding:0;">
          @for (n of filtered(); track n.id) {
            <div style="padding:14px 20px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between; gap:12px; cursor:pointer;" (click)="store.markRead(n.id)">
              <div>
                <div style="font-weight:600;" [class.muted]="n.isRead">{{ n.title }}</div>
                <div class="small muted">{{ n.message }}</div>
                @if (n.applicationId) {
                  <a [routerLink]="['/applications', n.applicationId]" class="small" (click)="$event.stopPropagation()">View Application</a>
                }
              </div>
              <div class="small muted" style="white-space:nowrap;">{{ formatDateTime(n.createdAt) }}</div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class NotificationsPage {
  protected readonly store = inject(NotificationStore);
  protected readonly formatDateTime = formatDateTime;
  readonly filter = signal<Filter>('All');

  filtered() {
    return this.filter() === 'Unread' ? this.store.all().filter((n) => !n.isRead) : this.store.all();
  }
}
