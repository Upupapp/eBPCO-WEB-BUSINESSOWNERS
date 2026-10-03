import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardPage } from './dashboard.page';
import { ApplicationStore } from '../../core/stores/application.store';
import { BusinessStore } from '../../core/stores/business.store';
import { NotificationStore } from '../../core/stores/notification.store';
import { AuthService } from '../../core/session/auth.service';
import { ApplicationRecord } from '../../core/domain/application.model';
import { ApplicationLifecycleStatus } from '../../core/domain/status.model';

/**
 * QA TC-33 (2026-10-03): a permit already collected still counted as "Ready
 * for Release — Ready to claim", and a completed application was listed
 * under Active Applications.
 */
describe('DashboardPage', () => {
  const row = (id: string, lifecycleStatus: ApplicationLifecycleStatus) =>
    ({ id, lifecycleStatus, applicantStatus: 'Ready for Release' }) as ApplicationRecord;

  function page(rows: ApplicationRecord[]): DashboardPage {
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        { provide: ApplicationStore, useValue: { myApplications: () => rows } },
        { provide: BusinessStore, useValue: { myBusinesses: () => [] } },
        { provide: NotificationStore, useValue: { all: () => [] } },
        { provide: AuthService, useValue: { currentUser: () => null } },
      ],
    });
    return TestBed.createComponent(DashboardPage).componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('counts only permits waiting to be collected as Ready for Release', () => {
    const dashboard = page([row('a', 'Ready for Release'), row('b', 'Released'), row('c', 'Completed')]);
    expect(dashboard.readyForRelease()).toBe(1);
  });

  it('keeps finished and withdrawn applications out of Active Applications', () => {
    const dashboard = page([
      row('a', 'Under Evaluation'), row('b', 'Completed'), row('c', 'Cancelled'), row('d', 'Rejected'), row('e', 'Released'),
    ]);
    expect(dashboard.activeApplications().map((a) => a.id)).toEqual(['a', 'e']);
  });
});
