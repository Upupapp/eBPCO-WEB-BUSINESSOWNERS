import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApplicationStore } from '../../core/stores/application.store';
import { BusinessStore } from '../../core/stores/business.store';
import { NotificationStore } from '../../core/stores/notification.store';
import { AuthService } from '../../core/session/auth.service';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { applicantStatusLabel, applicantStatusOf } from '../../core/domain/status.model';
import { fullName } from '../../core/domain/user.model';
import { formatDate } from '../../core/utils/ids';
import { permitVisual } from '../../core/domain/permit-visual';

/** Small outline-icon path set, drawn in the Lucide visual style (24x24, round caps/joins) so the dashboard doesn't need an extra icon-library dependency — lucide-angular's latest release only supports Angular up to 21.x, and this app is on 22.1. Per-permit-type icon/color mapping lives in core/domain/permit-visual.ts, shared with the Permit Services catalog. */
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
    return applicantStatusLabel(status);
  }

  /**
   * Both counts read the server's own projection (`applicantStatus`,
   * `requiresApplicantAction`) and fall back to the local projection only for
   * a row the server did not supply — the same rule `statusLabel` uses for
   * the list, so a card and the rows beside it can never disagree. Found
   * live: an application whose permit had been released showed "Ready for
   * Release" in the list while this card, counting only the exact server
   * status, said 0.
   */
  awaitingAction(): number {
    return this.applications
      .myApplications()
      .filter((a) => a.requiresApplicantAction
        ?? ['Draft', 'Revision Required', 'Assessed'].includes(a.lifecycleStatus)).length;
  }

  readyForRelease(): number {
    return this.applications
      .myApplications()
      .filter((a) => (a.applicantStatus ?? applicantStatusOf(a.lifecycleStatus)) === 'Ready for Release').length;
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
  applicationVisual = permitVisual;
}
