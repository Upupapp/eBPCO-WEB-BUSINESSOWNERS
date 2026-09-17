import { __decorate } from "tslib";
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
};
let DashboardPage = class DashboardPage {
    applications = inject(ApplicationStore);
    businesses = inject(BusinessStore);
    notifications = inject(NotificationStore);
    auth = inject(AuthService);
    formatDate = formatDate;
    icons = ICONS;
    firstName() {
        const u = this.auth.currentUser();
        return u ? fullName(u).split(' ')[0] : '';
    }
    statusLabel(status) {
        return applicantStatusOf(status);
    }
    awaitingAction() {
        return this.applications
            .myApplications()
            .filter((a) => ['Draft', 'Revision Required', 'Assessed'].includes(a.lifecycleStatus)).length;
    }
    readyForRelease() {
        return this.applications.myApplications().filter((a) => a.lifecycleStatus === 'Ready for Release').length;
    }
    get kpis() {
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
};
DashboardPage = __decorate([
    Component({
        selector: 'app-dashboard',
        imports: [RouterLink, StatusPillComponent],
        templateUrl: './dashboard.page.html',
        styleUrl: './dashboard.page.scss',
    })
], DashboardPage);
export { DashboardPage };
