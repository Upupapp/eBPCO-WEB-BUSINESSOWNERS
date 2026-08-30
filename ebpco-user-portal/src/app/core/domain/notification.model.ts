export type NotificationCategory = 'application' | 'payment' | 'document' | 'permit' | 'system';

export interface AppNotification {
  id: string;
  applicationId: string | null;
  category: NotificationCategory;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}
