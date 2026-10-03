import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MyApplicationsPage } from './my-applications.page';
import { ApplicationStore } from '../../core/stores/application.store';
import { ApplicationRecord } from '../../core/domain/application.model';
import { ApplicationLifecycleStatus } from '../../core/domain/status.model';

/**
 * QA TC-35 (2026-10-03): a returned, withdrawn or finished application could
 * not be listed on its own. Every status a citizen sees on a row has a tab.
 */
describe('MyApplicationsPage filters', () => {
  const row = (id: string, lifecycleStatus: ApplicationLifecycleStatus) =>
    ({ id, lifecycleStatus, applicationNumber: id, permitType: 'Building Permit', businessName: 'Shop' }) as ApplicationRecord;
  const ROWS = [
    row('a', 'Draft'), row('b', 'Revision Required'), row('c', 'Completed'),
    row('d', 'Cancelled'), row('e', 'Released'), row('f', 'Ready for Release'),
  ];

  function render() {
    TestBed.configureTestingModule({
      imports: [MyApplicationsPage],
      providers: [provideRouter([]), { provide: ApplicationStore, useValue: { myApplications: () => ROWS } }],
    });
    const fixture = TestBed.createComponent(MyApplicationsPage);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('offers Completed, Cancelled and Revision Required', () => {
    const text = (render().nativeElement as HTMLElement).textContent ?? '';
    for (const label of ['Completed', 'Cancelled', 'Revision Required', 'Released']) {
      expect(text).toContain(label);
    }
  });

  it('lists only the applications in the chosen tab', () => {
    const page = render().componentInstance;
    page.filter.set('Completed');
    expect(page.filtered().map((a) => a.id)).toEqual(['c']);
    page.filter.set('Revision Required');
    expect(page.filtered().map((a) => a.id)).toEqual(['b']);
    page.filter.set('Ready for Release');
    expect(page.filtered().map((a) => a.id)).toEqual(['f']);
    page.filter.set('All');
    expect(page.filtered()).toHaveLength(ROWS.length);
  });

  it('hides Expired until an application has expired', () => {
    const text = (render().nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Expired');
  });
});
