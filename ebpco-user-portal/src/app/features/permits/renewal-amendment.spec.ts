import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationStore } from '../../core/stores/application.store';
import { ApplicationWizardPage } from './application-wizard.page';
import { AuthService } from '../../core/session/auth.service';
import {
  actionNeedsExistingPermit,
  actionReferenceIsComplete,
} from '../../core/domain/application.model';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { FakeCitizenIdentityApi } from '../../core/testing/fake-citizen-identity-api';

/**
 * A Renewal must say WHAT it renews.
 *
 * Before this, the wizard offered "Renewal" and "Amendment" in a dropdown and
 * then showed the identical form as "New". The resulting record said
 * `applicationAction: 'Renewal'` and carried nothing else — the office would
 * receive an application asserting that an existing permit was involved, with
 * no way to tell which one, and the citizen had no field in which to say.
 *
 * These tests assert on the RECORD the store produces and on the wizard's
 * refusal, not on whether a <select> is on screen. A visible dropdown was
 * exactly what made the original defect invisible: the screen looked complete.
 */
describe('A Renewal or Amendment names the permit it acts on', () => {
  let store: ApplicationStore;

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
    store = TestBed.inject(ApplicationStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  const base = {
    businessId: 'biz-1',
    businessName: 'Test',
    permitType: 'Zoning / Locational Clearance' as const,
    priorPermitClaim: null,
  };

  it('the store REFUSES a Renewal that names no permit', () => {
    expect(() =>
      store.createDraft({ ...base, applicationAction: 'Renewal', relatedPermitNumber: null }),
    ).toThrow(/must name the permit/i);
  });

  it('the store REFUSES an Amendment that names no permit', () => {
    expect(() =>
      store.createDraft({ ...base, applicationAction: 'Amendment', relatedPermitNumber: null }),
    ).toThrow(/must name the permit/i);
  });

  it('the store REFUSES a New application that names one — a relationship never claimed', () => {
    expect(() =>
      store.createDraft({ ...base, applicationAction: 'New', relatedPermitNumber: 'BP-2025-00001' }),
    ).toThrow(/must name the permit/i);
  });

  it('a Renewal that names a permit is kept ON THE RECORD, not just validated away', () => {
    const record = store.createDraft({
      ...base,
      applicationAction: 'Renewal',
      relatedPermitNumber: 'BP-2025-00042',
      priorPermitClaim: null,
    });
    // Read back through the store, not from the returned object: a value the
    // creator holds but the store drops is the defect this whole file is about.
    expect(store.applicationById(record.id)?.relatedPermitNumber).toBe('BP-2025-00042');
  });

  it('only permits ISSUED to the signed-in citizen are offered', () => {
    const offered = store.renewablePermits();
    const uid = TestBed.inject(AuthService).currentUser()!.id;
    for (const p of offered) {
      const app = store.applicationById(p.applicationId)!;
      expect(app.applicantId).toBe(uid);
      expect(app.permitNumber).not.toBeNull();
    }
    // The list is drawn from real issued permits, so it cannot offer a permit
    // number that no application actually holds.
    const known = new Set(
      store.myApplications().map((a) => a.permitNumber).filter((n): n is string => n !== null),
    );
    for (const p of offered) expect(known.has(p.permitNumber)).toBe(true);
  });

  it('the WIZARD refuses to advance, so the citizen is told before step 4', () => {
    // The store's throw is a backstop, not the citizen's experience. If only
    // the store guarded this, a citizen would fill in three more steps and
    // meet an exception at Submit.
    const fixture = TestBed.createComponent(ApplicationWizardPage);
    const page = fixture.componentInstance;
    page.businessId = 'biz-1';
    page.applicationAction = 'Renewal';
    page.relatedPermitNumber = null;

    page.toStep(2);

    expect(page.step()).toBe(1);
    expect(page.error()).toMatch(/renew/i);
  });

  it('the wizard advances once the permit is named', () => {
    const fixture = TestBed.createComponent(ApplicationWizardPage);
    const page = fixture.componentInstance;
    page.businessId = 'biz-1';
    page.applicationAction = 'Renewal';
    page.relatedPermitNumber = 'BP-2025-00042';

    page.toStep(2);

    expect(page.step()).toBe(2);
    expect(page.error()).toBeNull();
  });

  it('the predicate is what both the form and the store consult', () => {
    expect(actionNeedsExistingPermit('New')).toBe(false);
    expect(actionNeedsExistingPermit('Renewal')).toBe(true);
    expect(actionNeedsExistingPermit('Amendment')).toBe(true);

    expect(actionReferenceIsComplete('New', null)).toBe(true);
    expect(actionReferenceIsComplete('New', 'BP-1')).toBe(false);
    expect(actionReferenceIsComplete('Renewal', null)).toBe(false);
    expect(actionReferenceIsComplete('Renewal', 'BP-1')).toBe(true);
    expect(actionReferenceIsComplete('Amendment', null)).toBe(false);
    expect(actionReferenceIsComplete('Amendment', 'BP-1')).toBe(true);
  });
});

/**
 * A permit eBPCO never issued — 053. Most real renewals launch into this:
 * the Municipality's paper permits predate the system, so `renewablePermits()`
 * is empty for them, not fraudulent. The claim path is the honest alternative
 * to blocking them outright or lying and filing as 'New'.
 */
describe('a Renewal/Amendment claiming a permit eBPCO has no record of', () => {
  let store: ApplicationStore;

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
    store = TestBed.inject(ApplicationStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  it('the predicate accepts a claim in place of a matched permit, and refuses both at once', () => {
    expect(actionReferenceIsComplete('Renewal', null, 'OLD-BP-1998-042')).toBe(true);
    expect(actionReferenceIsComplete('Renewal', 'BP-2025-00042', 'OLD-BP-1998-042')).toBe(false);
    expect(actionReferenceIsComplete('New', null, 'OLD-BP-1998-042')).toBe(false);
  });

  it('the wizard advances on a claim alone, with no matched permit selected', () => {
    const fixture = TestBed.createComponent(ApplicationWizardPage);
    const page = fixture.componentInstance;
    page.businessId = 'biz-1';
    page.applicationAction = 'Renewal';
    page.relatedPermitNumber = null;
    page.priorPermitClaim = 'OLD-BP-1998-042';

    page.toStep(2);

    expect(page.step()).toBe(2);
    expect(page.error()).toBeNull();
  });

  it('the store keeps the claim on the record, verified path untouched', () => {
    const record = store.createDraft({
      businessId: 'biz-1', businessName: 'Test', permitType: 'Zoning / Locational Clearance',
      applicationAction: 'Renewal', relatedPermitNumber: null, priorPermitClaim: 'OLD-BP-1998-042',
    });

    expect(store.applicationById(record.id)?.priorPermitClaim).toBe('OLD-BP-1998-042');
    expect(store.applicationById(record.id)?.relatedPermitNumber).toBeNull();
  });

  it('the proof document is required on the claim path even though the catalog marks it optional', () => {
    const fixture = TestBed.createComponent(ApplicationWizardPage);
    const page = fixture.componentInstance;
    page.documents = [{ id: 'prior-permit-proof', label: 'Copy of your existing/prior permit', required: false }];

    expect(page['isRequired'](page.documents[0])).toBe(false);
    page.priorPermitClaim = 'OLD-BP-1998-042';
    expect(page['isRequired'](page.documents[0])).toBe(true);
  });
});
