import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BusinessStore } from '../../core/stores/business.store';
import { ApplicationStore } from '../../core/stores/application.store';
import { AuthService } from '../../core/session/auth.service';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { FakeCitizenIdentityApi } from '../../core/testing/fake-citizen-identity-api';

/**
 * BUS-004 — editing a business changes the business, and NOTHING already filed.
 *
 * `ApplicationRecord.businessName` is denormalised: it is a snapshot of the
 * name as it stood when the application was submitted. The tempting
 * "improvement" is to keep it in step with the business record. That would let
 * a citizen change the name on an application the Municipality has already
 * assessed, after the fact, with no trace — so the test below asserts the
 * OPPOSITE of what looks tidy, and says why.
 */
describe('Editing a business', () => {
  let businesses: BusinessStore;
  let applications: ApplicationStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CitizenIdentityApi, useClass: FakeCitizenIdentityApi },
      ],
    });
    await TestBed.inject(AuthService).login('juan.delacruz@example.com', 'Password1');
    businesses = TestBed.inject(BusinessStore);
    applications = TestBed.inject(ApplicationStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  const mine = () => businesses.myBusinesses()[0];

  it('saves the citizen-owned fields', () => {
    const b = mine();
    businesses.update(b.id, {
      name: 'Dela Cruz Hardware and Supply',
      category: b.category,
      street: '14 Rizal Street',
      barangay: b.barangay,
      city: b.city,
      province: b.province,
    });
    const after = businesses.businessById(b.id)!;
    expect(after.name).toBe('Dela Cruz Hardware and Supply');
    expect(after.street).toBe('14 Rizal Street');
  });

  it('does NOT change the registration number, date registered, owner or status', () => {
    const before = mine();
    businesses.update(before.id, {
      name: 'Renamed Entirely',
      category: before.category,
      street: 'X', barangay: 'Y', city: 'Z', province: 'W',
    });
    const after = businesses.businessById(before.id)!;
    expect(after.registrationNumber).toBe(before.registrationNumber);
    expect(after.dateRegistered).toBe(before.dateRegistered);
    expect(after.ownerApplicantId).toBe(before.ownerApplicantId);
    expect(after.status).toBe(before.status);
  });

  it('does NOT rewrite the business name on an application already filed', () => {
    const b = mine();
    const app = applications.createDraft({
      businessId: b.id,
      businessName: b.name,
      permitType: 'Zoning / Locational Clearance',
      applicationAction: 'New',
      relatedPermitNumber: null,
      priorPermitClaim: null,
    });
    applications.submit(app.id);
    const filedName = applications.applicationById(app.id)!.businessName;

    businesses.update(b.id, {
      name: 'A Completely Different Name',
      category: b.category,
      street: b.street, barangay: b.barangay, city: b.city, province: b.province,
    });

    // The Municipality assessed it under the name it received.
    expect(applications.applicationById(app.id)!.businessName).toBe(filedName);
    expect(applications.applicationById(app.id)!.businessName).not.toBe('A Completely Different Name');
  });

  it('refuses a business the citizen does not own', () => {
    expect(() =>
      businesses.update('biz-does-not-exist', {
        name: 'X', category: 'Retail', street: 'X', barangay: 'Y', city: 'Z', province: 'W',
      }),
    ).toThrow(/could not be found/i);
  });
});

/**
 * Deactivating/reactivating a business — the local-demo half of the same
 * feature `edit-business.page.ts` exercises for real once a backend is
 * configured (see `business.store.ts`'s `deactivateReal`/`reactivateReal`).
 */
describe('Deactivating a business (local demo)', () => {
  let businesses: BusinessStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CitizenIdentityApi, useClass: FakeCitizenIdentityApi },
      ],
    });
    await TestBed.inject(AuthService).login('juan.delacruz@example.com', 'Password1');
    businesses = TestBed.inject(BusinessStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  it('flips status to Inactive', () => {
    const b = businesses.myBusinesses()[0];
    businesses.setStatus(b.id, 'Inactive');
    expect(businesses.businessById(b.id)!.status).toBe('Inactive');
  });

  it('is reversible', () => {
    const b = businesses.myBusinesses()[0];
    businesses.setStatus(b.id, 'Inactive');
    businesses.setStatus(b.id, 'Active');
    expect(businesses.businessById(b.id)!.status).toBe('Active');
  });

  it('refuses a business the citizen does not own', () => {
    expect(() => businesses.setStatus('biz-does-not-exist', 'Inactive')).toThrow(/could not be found/i);
  });
});
