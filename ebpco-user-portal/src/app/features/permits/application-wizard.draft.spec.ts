import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { ApplicationWizardPage } from './application-wizard.page';
import { API_BASE_URL } from '../../core/api/api-config';
import { ApplicationDocumentResponse, ApplicationSummary } from '../../core/api/citizen-api.models';

/** Just enough of the component's surface to drive it from a test — mirrors application-wizard.page.spec.ts's own cast pattern for reaching protected members. */
interface Testable {
  businessId: string | null;
  projectAddress: string;
  scopeOfWork: string;
  prcNumber: string;
  isGeneric: boolean;
  permitType: string | null;
  applicationAction: string;
  relatedPermitNumber: string | null;
  attached: Record<string, { kind: string }>;
  understandRequirements: boolean;
  agreeTerms: boolean;
  draftId(): string | null;
  uploadedDocumentIds(): Record<string, string>;
  toStep(next: 1 | 2 | 3 | 4): void;
  submit(): Promise<void>;
  saveAndExit(): Promise<void>;
}
function testable(instance: ApplicationWizardPage): Testable {
  return instance as unknown as Testable;
}

/**
 * Save-as-draft: the wizard autosaves as a citizen advances through it,
 * offers an explicit Save & Exit, and can resume a Draft from a
 * `?draft=<id>` link — My Applications' own "Continue" action, or the
 * wizard's own Save & Exit returning here later.
 *
 * Same reasoning as application-wizard.page.real-submit.spec.ts for staying
 * signed out: nothing exercised here reads auth state, and staying signed
 * out keeps BusinessStore/ApplicationStore's real-fetch effects inert.
 */
@Component({ template: '' })
class BlankPage {}

const BASE = 'https://api.example.gov.ph';

function summaryFor(overrides: Partial<ApplicationSummary> = {}): ApplicationSummary {
  return {
    id: 'draft-1',
    referenceNumber: 'E-BPCO-2026-00777',
    serviceDomain: 'business-permit',
    permitType: 'Business Permit',
    applicationAction: 'New',
    businessId: 'biz-1',
    businessName: 'Test Business',
    location: '123 Rizal Street',
    renewsPermitNumber: null,
    priorPermitClaim: null,
    lifecycleStatus: 'Draft',
    applicantStatus: 'Draft',
    requiresApplicantAction: false,
    dateSubmitted: null,
    updatedAt: '2026-09-17T00:00:00.000Z',
    openInstructionCount: 0,
    form: {},
    payment: { status: 'Not Yet Available' },
    ...overrides,
  };
}

async function waitForRequest(http: HttpTestingController) {
  for (let i = 0; i < 50; i++) {
    const found = http.match(() => true);
    if (found.length) return found[0];
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error('no request was issued');
}

/**
 * `fileReal()`'s own success path awaits a SECOND request (`refreshMine()`)
 * after the one under test, and flushing that one only starts its promise
 * chain unwinding — it does not finish within the same microtask a bare
 * `await flush(...)` observes. Polls the same way `waitForRequest` does,
 * for the same reason.
 */
async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error('condition never became true');
}

describe('ApplicationWizardPage — save as draft', () => {
  let http: HttpTestingController;

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  function configureFresh(): { page: Testable } {
    TestBed.configureTestingModule({
      imports: [ApplicationWizardPage],
      providers: [
        provideRouter([{ path: 'applications/:id', component: BlankPage }, { path: 'applications', component: BlankPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ApplicationWizardPage);
    http.expectOne(`${BASE}/documents/me`).flush([]);
    http.expectOne((r) => r.url.startsWith(`${BASE}/requirements/`)).flush({ documents: [] });
    fixture.detectChanges();
    return { page: testable(fixture.componentInstance) };
  }

  it('autosaves a Draft on the first step advance, then PATCHes the same id on the next', async () => {
    const { page } = configureFresh();
    page.businessId = 'biz-1';
    page.projectAddress = '123 Rizal Street';
    page.scopeOfWork = 'New retail construction';

    page.toStep(2);

    const created = http.expectOne(`${BASE}/applications`);
    expect(created.request.method).toBe('POST');
    expect((created.request.body as { saveAsDraft?: boolean }).saveAsDraft).toBe(true);
    created.flush(summaryFor(), { status: 201, statusText: 'Created' });
    const createdRefresh = await waitForRequest(http);
    createdRefresh.flush({ data: [summaryFor()], nextCursor: null });
    await waitUntil(() => page.draftId() !== null);

    expect(page.draftId()).toBe('draft-1');

    page.toStep(3);
    const patched = await waitForRequest(http);
    expect(patched.request.method).toBe('PATCH');
    expect(patched.request.url).toBe(`${BASE}/applications/draft-1`);
    patched.flush(summaryFor());
  });

  it('Save & Exit saves immediately and returns to My Applications', async () => {
    const { page } = configureFresh();
    page.businessId = 'biz-1';
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const exited = page.saveAndExit();

    const created = http.expectOne(`${BASE}/applications`);
    expect((created.request.body as { saveAsDraft?: boolean }).saveAsDraft).toBe(true);
    created.flush(summaryFor(), { status: 201, statusText: 'Created' });
    // fileReal() unconditionally refreshes afterward.
    const refresh = await waitForRequest(http);
    refresh.flush({ data: [summaryFor()], nextCursor: null });

    await exited;
    expect(navigateSpy).toHaveBeenCalledWith(['/applications']);
  });

  it('resuming pre-fills every field from the server, not from local state', async () => {
    TestBed.configureTestingModule({
      imports: [ApplicationWizardPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: ActivatedRoute, useValue: {
            snapshot: { queryParamMap: convertToParamMap({ draft: 'draft-1' }) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ApplicationWizardPage);

    const appReq = http.expectOne(`${BASE}/applications/draft-1`);
    const docsReq = http.expectOne(`${BASE}/applications/draft-1/documents`);
    http.expectOne(`${BASE}/documents/me`).flush([]);

    appReq.flush(summaryFor({
      permitType: 'Fencing Permit', applicationAction: 'Renewal', renewsPermitNumber: 'BP-2020-000001',
      location: '45 Bonifacio Ave', form: { scopeOfWork: 'Replace boundary fence', prcNumber: '0012345' },
    }));
    const attachedDoc: ApplicationDocumentResponse = {
      id: 'doc-1', label: 'Lot Plan', fileName: 'lot-plan.pdf', contentType: 'application/pdf',
      byteSize: '2048', sha256: 'a'.repeat(64), uploadedAt: '2026-09-10T00:00:00.000Z', expiresOn: null,
      reviewStatus: null, reviewedAt: null, reviewReason: null, reviewRemark: null,
      supersedesDocumentId: null, supersededByDocumentId: null, scanCleared: true, quarantined: false,
      requirementCode: 'lot-plan',
    };
    docsReq.flush([attachedDoc]);

    const requirementsReq = await waitForRequest(http);
    expect(requirementsReq.request.url).toContain(`${BASE}/requirements/Fencing%20Permit`);
    requirementsReq.flush({
      documents: [{ code: 'lot-plan', label: 'Lot Plan', description: '', required: true }],
    });

    fixture.detectChanges();
    const page = testable(fixture.componentInstance);

    expect(page.draftId()).toBe('draft-1');
    expect(page.businessId).toBe('biz-1');
    expect(page.isGeneric).toBe(false);
    expect(page.permitType).toBe('Fencing Permit');
    expect(page.applicationAction).toBe('Renewal');
    expect(page.relatedPermitNumber).toBe('BP-2020-000001');
    expect(page.projectAddress).toBe('45 Bonifacio Ave');
    expect(page.scopeOfWork).toBe('Replace boundary fence');
    expect(page.prcNumber).toBe('0012345');

    const slot = page.attached['lot-plan'];
    expect(slot?.kind).toBe('attached');
    expect(page.uploadedDocumentIds()['lot-plan']).toBe('doc-1');
  });

  it('finalizing an already-autosaved draft PATCHes then POSTs .../submit — never a second POST /applications', async () => {
    const { page } = configureFresh();
    page.businessId = 'biz-1';
    page.projectAddress = '123 Rizal Street';
    page.scopeOfWork = 'New retail construction';
    page.toStep(2);
    http.expectOne(`${BASE}/applications`).flush(summaryFor(), { status: 201, statusText: 'Created' });
    const createdRefresh = await waitForRequest(http);
    createdRefresh.flush({ data: [summaryFor()], nextCursor: null });
    await waitUntil(() => page.draftId() !== null);

    expect(page.draftId()).toBe('draft-1');
    page.understandRequirements = true;
    page.agreeTerms = true;

    const submitted = page.submit();

    const sync = await waitForRequest(http);
    expect(sync.request.method).toBe('PATCH');
    expect(sync.request.url).toBe(`${BASE}/applications/draft-1`);
    sync.flush(summaryFor());

    const finalize = await waitForRequest(http);
    expect(finalize.request.method).toBe('POST');
    expect(finalize.request.url).toBe(`${BASE}/applications/draft-1/submit`);
    finalize.flush(summaryFor({ lifecycleStatus: 'Submitted', applicantStatus: 'Submitted' }));

    const refresh = await waitForRequest(http);
    refresh.flush({ data: [summaryFor()], nextCursor: null });

    await submitted;
    http.expectNone(`${BASE}/applications`);
  });
});
