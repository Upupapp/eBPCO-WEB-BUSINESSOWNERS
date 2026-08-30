import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { BusinessStore } from '../../core/stores/business.store';
import { NotificationStore } from '../../core/stores/notification.store';
import { AuthService } from '../../core/session/auth.service';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { applicantStatusOf } from '../../core/domain/status.model';
import { fullName } from '../../core/domain/user.model';
import { formatDate } from '../../core/utils/ids';

/** Small outline-icon path set, drawn in the Lucide visual style (24x24, round caps/joins) so the dashboard doesn't need an extra icon-library dependency — lucide-angular's latest release only supports Angular up to 21.x, and this app is on 22.1. */
const ICONS = {
  filePlus: ['M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z', 'M14 3v4h4', 'M12 12v6', 'M9 15h6'],
  store: [
    'M4 9 5 4h14l1 5',
    'M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0',
    'M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9',
    'M9 20v-5h6v5',
  ],
  clipboardCheck: [
    'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z',
    'M6 6h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
    'm9 13.5 2 2 4-4.5',
  ],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3.5 2'],
  checkCircle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'm8.5 12.2 2.4 2.4 4.6-5.2'],
  chevronRight: ['m9 6 6 6-6 6'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 11v5', 'M12 8h.01'],
  building: [
    'M4 21V7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v14',
    'M15 21V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v17',
    'M4 21h17',
    'M8 9h.01',
    'M8 13h.01',
    'M8 17h.01',
    'M18 9h.01',
    'M18 13h.01',
    'M18 17h.01',
  ],
  mapPin: ['M12 18.5S5 13 5 8.5a7 7 0 0 1 14 0c0 4.5-7 10-7 10Z', 'M12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  zap: ['M13 3 5 13.5h5.5L11 21l8-10.5h-5.5L13 3Z'],
  wrench: ['M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4L15 12l-3-3 2.7-2.7Z'],
  droplet: ['M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9Z'],
  badgeCheck: [
    'm9 12 2 2 4-4',
    'M12 3.5 13.8 5l2.5-.3.6 2.5 2.3 1.1-1 2.4 1 2.4-2.3 1.1-.6 2.5-2.5-.3L12 20.5 10.2 19l-2.5.3-.6-2.5-2.3-1.1 1-2.4-1-2.4 2.3-1.1.6-2.5 2.5.3Z',
  ],
  settings: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    'M12 2v3',
    'M12 19v3',
    'M4.2 4.2l2.1 2.1',
    'M17.7 17.7l2.1 2.1',
    'M2 12h3',
    'M19 12h3',
    'M4.2 19.8l2.1-2.1',
    'M17.7 6.3l2.1-2.1',
  ],
  fileText: ['M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z', 'M14 3v4h4', 'M9 13h6', 'M9 17h6'],
  bell: ['M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z', 'M10 19a2 2 0 0 0 4 0'],
} as const;

interface DashboardKpi {
  theme: 'red' | 'blue' | 'orange' | 'green';
  label: string;
  value: number;
  helper: string;
  icon: readonly string[];
  link?: string;
}

interface ApplicationVisual {
  icon: readonly string[];
  bg: string;
  fg: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, StatusPillComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  protected readonly applications = inject(ApplicationStore);
  protected readonly businesses = inject(BusinessStore);
  protected readonly notifications = inject(NotificationStore);
  private readonly auth = inject(AuthService);

  protected readonly formatDate = formatDate;
  protected readonly icons = ICONS;

  firstName(): string {
    const u = this.auth.currentUser();
    return u ? fullName(u).split(' ')[0] : '';
  }

  statusLabel(status: Parameters<typeof applicantStatusOf>[0]): string {
    return applicantStatusOf(status);
  }

  awaitingAction(): number {
    return this.applications
      .myApplications()
      .filter((a) => ['Draft', 'Revision Required', 'Assessed'].includes(a.lifecycleStatus)).length;
  }

  readyForRelease(): number {
    return this.applications.myApplications().filter((a) => a.lifecycleStatus === 'Ready for Release').length;
  }

  get kpis(): DashboardKpi[] {
    return [
      {
        theme: 'red',
        label: 'My Businesses',
        value: this.businesses.myBusinesses().length,
        helper: 'View all businesses',
        icon: ICONS.store,
        link: '/businesses',
      },
      {
        theme: 'blue',
        label: 'Total Applications',
        value: this.applications.myApplications().length,
        helper: 'This includes all statuses',
        icon: ICONS.clipboardCheck,
      },
      {
        theme: 'orange',
        label: 'Awaiting Action',
        value: this.awaitingAction(),
        helper: 'Needs your action',
        icon: ICONS.clock,
      },
      {
        theme: 'green',
        label: 'Ready for Release',
        value: this.readyForRelease(),
        helper: 'Ready to claim / view',
        icon: ICONS.checkCircle,
      },
    ];
  }

  /** Icon + color mapping for an application row, keyed by permit type substring. */
  applicationVisual(permitType: string): ApplicationVisual {
    const value = permitType.toLowerCase();
    if (value.includes('building') || value.includes('demolition')) {
      return { icon: ICONS.building, bg: '#FFF0F3', fg: '#F0173A' };
    }
    if (value.includes('zoning') || value.includes('locational')) {
      return { icon: ICONS.mapPin, bg: '#ECF8F0', fg: '#13924B' };
    }
    if (value.includes('electrical') || value.includes('electronics')) {
      return { icon: ICONS.zap, bg: '#FFF7E8', fg: '#E58A00' };
    }
    if (value.includes('plumbing')) {
      return { icon: ICONS.wrench, bg: '#EEF6FF', fg: '#1E73D1' };
    }
    if (value.includes('sanitary')) {
      return { icon: ICONS.droplet, bg: '#ECF8F0', fg: '#13924B' };
    }
    if (value.includes('occupancy') || value.includes('fsic') || value.includes('fsec')) {
      return { icon: ICONS.badgeCheck, bg: '#FFF7E8', fg: '#E58A00' };
    }
    if (
      value.includes('mechanical') ||
      value.includes('civil') ||
      value.includes('structural') ||
      value.includes('architectural') ||
      value.includes('interior') ||
      value.includes('fencing') ||
      value.includes('sign') ||
      value.includes('excavation')
    ) {
      return { icon: ICONS.settings, bg: '#EEF6FF', fg: '#1E73D1' };
    }
    return { icon: ICONS.fileText, bg: '#F1F3F7', fg: '#4B5C74' };
  }
}
