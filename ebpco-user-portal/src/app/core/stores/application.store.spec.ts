import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationStore } from './application.store';
import { API_BASE_URL } from '../api/api-config';

/**
 * Guards: no seed/fake/demo data reachable once a real API is configured.
 *
 * `seed()` used to run unconditionally, so `applicationById('app-seed-1')`
 * returned "Dela Cruz Hardware & Construction Supply"'s fake, non-existent
 * application on a real deployment -- reachable by anyone who opened that
 * URL, since the id is a hardcoded, publicly-visible constant in this file's
 * own source, not something a citizen would need to discover through any
 * real navigation path.
 */
describe('ApplicationStore demo seed', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('seeds the local demo applications when no real API is configured', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const store = TestBed.inject(ApplicationStore);

    expect(store.applicationById('app-seed-1')).toBeDefined();
    expect(store.applicationById('app-seed-2')).toBeDefined();
  });

  it('does not seed fake applications once a real API is configured', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.example.gov.ph' },
      ],
    });
    const store = TestBed.inject(ApplicationStore);

    expect(store.applicationById('app-seed-1')).toBeUndefined();
    expect(store.applicationById('app-seed-2')).toBeUndefined();
    expect(store.myApplications()).toEqual([]);
  });
});
