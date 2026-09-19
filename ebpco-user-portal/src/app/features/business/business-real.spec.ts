import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BusinessStore } from '../../core/stores/business.store';
import { CitizenApiClient } from '../../core/api/citizen-api.client';
import { ApiError } from '../../core/api/problem';
import { BusinessSummary } from '../../core/api/citizen-api.models';

/**
 * `BusinessStore.updateReal`/`deactivateReal`/`reactivateReal` — the real
 * counterparts to `update`/`setStatus`, added once `PATCH /businesses/:id`
 * and its two status routes existed server-side. Before these, a business
 * fetched from the real backend had no way to be changed at all: the Edit
 * Business link was hidden whenever `usingReal()` was true, and `update()`
 * only ever wrote to the local demo signal.
 */
describe('BusinessStore — real edit/deactivate/reactivate', () => {
  const SUMMARY: BusinessSummary = {
    id: 'biz-real-1', name: 'Cafe', category: 'Food Service',
    street: '1 Rizal Street', barangay: 'Mayon', city: 'Castilla', province: 'Sorsogon',
    registrationNumber: 'a2323', dateRegistered: '2020-09-09', status: 'Active',
  };

  function mount(api: Partial<CitizenApiClient>) {
    TestBed.configureTestingModule({
      providers: [{ provide: CitizenApiClient, useValue: api }],
    });
    return TestBed.inject(BusinessStore);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('updateReal sends the owner-editable fields and refreshes the real list', async () => {
    let sent: unknown = null;
    const store = mount({
      configured: true,
      listBusinesses: () => of({ data: [{ ...SUMMARY, name: 'Cafe Renamed' }] }),
      updateBusiness: (id, body) => { sent = { id, body }; return of({ ...SUMMARY, ...body }); },
    } as Partial<CitizenApiClient>);

    const result = await store.updateReal('biz-real-1', {
      name: 'Cafe Renamed', category: 'Food Service',
      street: '1 Rizal Street', barangay: 'Mayon', city: 'Castilla', province: 'Sorsogon',
    });

    expect(result.ok).toBe(true);
    expect(sent).toEqual({
      id: 'biz-real-1',
      body: {
        name: 'Cafe Renamed', category: 'Food Service',
        street: '1 Rizal Street', barangay: 'Mayon', city: 'Castilla', province: 'Sorsogon',
      },
    });
    expect(store.businessById('biz-real-1')?.name).toBe('Cafe Renamed');
  });

  it('updateReal reports the server\'s refusal rather than pretending it saved', async () => {
    const store = mount({
      configured: true,
      listBusinesses: () => of({ data: [SUMMARY] }),
      updateBusiness: () => throwError(() => new ApiError(422, { detail: 'That could not be saved.' }, false)),
    } as Partial<CitizenApiClient>);

    const result = await store.updateReal('biz-real-1', {
      name: '', category: 'Food Service', street: '', barangay: '', city: '', province: '',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('That could not be saved.');
  });

  it('deactivateReal marks it Inactive via the real endpoint, never a hard delete', async () => {
    let calledWith: string | null = null;
    const store = mount({
      configured: true,
      listBusinesses: () => of({ data: [{ ...SUMMARY, status: 'Inactive' }] }),
      deactivateBusiness: (id) => { calledWith = id; return of({ ...SUMMARY, status: 'Inactive' }); },
    } as Partial<CitizenApiClient>);

    const result = await store.deactivateReal('biz-real-1');

    expect(result.ok).toBe(true);
    expect(calledWith).toBe('biz-real-1');
    expect(store.businessById('biz-real-1')?.status).toBe('Inactive');
  });

  it('deactivateReal surfaces the server\'s in-progress-application refusal', async () => {
    const store = mount({
      configured: true,
      listBusinesses: () => of({ data: [SUMMARY] }),
      deactivateBusiness: () => throwError(() =>
        new ApiError(422, { detail: 'This business has an application still in progress.' }, false)),
    } as Partial<CitizenApiClient>);

    const result = await store.deactivateReal('biz-real-1');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('still in progress');
  });

  it('reactivateReal marks it Active again', async () => {
    const store = mount({
      configured: true,
      listBusinesses: () => of({ data: [{ ...SUMMARY, status: 'Active' }] }),
      reactivateBusiness: () => of({ ...SUMMARY, status: 'Active' }),
    } as Partial<CitizenApiClient>);

    const result = await store.reactivateReal('biz-real-1');

    expect(result.ok).toBe(true);
    expect(store.businessById('biz-real-1')?.status).toBe('Active');
  });
});
