import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationWizardPage } from './application-wizard.page';
import { API_BASE_URL } from '../../core/api/api-config';
import { ApplicationListResponse, ApplicationSummary, SubmitApplicationRequest } from '../../core/api/citizen-api.models';

/**
 * A real filing navigates to `/applications/:id` on success. `provideRouter([])`
 * (the convention every other spec in this directory uses, since none of them
 * drives an actual submit) leaves that unmatched, and the Router's resulting
 * rejection surfaces as an unhandled promise rejection outside the test's own
 * control — not a failure of anything under test, but it fails the run
 * regardless. A single matching, do-nothing route avoids that without
 * touching the routing convention anywhere else.
 */
@Component({ template: '' })
class BlankPage {}

/**
 * Regression test for a real, live-reproduced production bug: a citizen
 * registered a real business through this portal's live UI, then filed a
 * real permit application selecting that business in the wizard's step 1
 * dropdown. The application filed successfully, but `applications
 * .business_id` came back NULL in the real database — the business link was
 * silently dropped.
 *
 * Root cause: `submitReal()` (application-wizard.page.ts) hardcoded
 * `businessId: null` in the real `POST /applications` request, behind a
 * doc comment claiming businesses were "not wired to the backend yet... the
 * demo id would be refused 400." That was stale: `BusinessStore
 * .myBusinesses()` has genuinely fetched real businesses from
 * `GET /businesses` for a while, so the step-1 `<select>` (bound to
 * `this.businessId` via `[(ngModel)]`) already holds a real server UUID by
 * the time `submitReal()` runs — never a demo id. Fixed by sending
 * `businessId: this.businessId` instead.
 *
 * These tests drive `submitReal()` at its REAL call site — through the
 * component's own public `submit()` — rather than only at the
 * `ApplicationStore.fileReal()` level. The defect lived in what the WIZARD
 * sent; the store already forwarded whatever it was given faithfully. A
 * store-only test (calling `fileReal()` directly with a good `businessId`)
 * would have kept passing unchanged with the hardcoded `businessId: null`
 * still sitting in the wizard.
 *
 * No sign-in here: `submitReal()`/`ApplicationStore.fileReal()` read no auth
 * state at all (a bearer token, if present, is attached by an interceptor
 * this suite never registers), and staying signed out keeps
 * `BusinessStore`/`ApplicationStore`'s own real-fetch effects harmlessly
 * inert (`auth.isAuthenticated()` is false, so their `effect()`s take the
 * "not signed in" branch and issue no request) — the only real HTTP traffic
 * here is the filing request itself, `ApplicationWizardPage`'s own
 * constructor-time `GET /documents/me`, and `fileReal()`'s own unconditional
 * post-filing refresh.
 */
const BASE = 'https://api.example.gov.ph';

function configure(): void {
  TestBed.configureTestingModule({
    imports: [ApplicationWizardPage],
    providers: [
      provideRouter([{ path: 'applications/:id', component: BlankPage }]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: BASE },
    ],
  });
}

/**
 * `HttpClient.post`/`.get` register a request with the testing backend
 * synchronously on subscribe — but a request issued from inside a resolved
 * Promise's continuation (here, `fileReal()`'s own `refreshMine()`, which
 * runs only after the filing request's Promise has settled) needs real
 * microtasks to elapse first. Polling rather than awaiting a fixed number of
 * ticks, same reasoning as `document-resubmission.service.spec.ts`'s own
 * `waitForRequest`: a fixed guess fails on a slower machine.
 */
async function waitForRequest(http: HttpTestingController) {
  for (let i = 0; i < 50; i++) {
    const found = http.match(() => true);
    if (found.length) return found[0];
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error('no request was issued');
}

function summaryFor(businessId: string | null): ApplicationSummary {
  return {
    id: 'app-real-1',
    referenceNumber: 'E-BPCO-2026-00500',
    serviceDomain: 'business-permit',
    permitType: 'Business Permit',
    applicationAction: 'New',
    businessId,
    businessName: businessId ? 'Dela Cruz Hardware & Construction Supply' : null,
    location: '123 Rizal Street',
    lifecycleStatus: 'Submitted',
    applicantStatus: 'Submitted',
    requiresApplicantAction: false,
    dateSubmitted: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
    openInstructionCount: 0,
    form: {},
    payment: { status: 'Not Yet Available' },
  };
}

describe('ApplicationWizardPage — submitReal() sends the real business id (regression)', () => {
  let http: HttpTestingController;
  let page: ApplicationWizardPage;

  beforeEach(() => {
    configure();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ApplicationWizardPage);
    // Fired unconditionally by the constructor once api.configured is true —
    // unrelated to this bug, drained here so it is never mistaken for the
    // request under test.
    http.expectOne(`${BASE}/documents/me`).flush([]);
    fixture.detectChanges();
    page = fixture.componentInstance;
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('carries the real, selected business id on a real filing — not the hardcoded null the bug shipped', async () => {
    const REAL_BUSINESS_ID = '9f2c9b1e-7e2a-4b8e-8f2a-1a2b3c4d5e6f';
    // What choosing a real business in step 1's <select> would have left
    // `this.businessId` holding — see the class doc on `businessId`/`toStep`.
    page.businessId = REAL_BUSINESS_ID;
    page.projectAddress = '123 Rizal Street, Barangay Poblacion';
    page.scopeOfWork = 'New retail construction';
    page.understandRequirements = true;
    page.agreeTerms = true;

    const submitted = page.submit();

    const req = http.expectOne(`${BASE}/applications`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as SubmitApplicationRequest;
    // THE assertion the bug would have failed: the wizard used to send a
    // hardcoded `businessId: null` here no matter what was selected.
    expect(body.businessId).toBe(REAL_BUSINESS_ID);
    expect(body.businessId).not.toBeNull();
    req.flush(summaryFor(REAL_BUSINESS_ID), { status: 201, statusText: 'Created' });

    // fileReal() unconditionally refreshes afterward — drain it so the
    // filing promise can actually settle.
    const refresh = await waitForRequest(http);
    expect(refresh.request.method).toBe('GET');
    refresh.flush({ data: [summaryFor(REAL_BUSINESS_ID)], nextCursor: null } satisfies ApplicationListResponse);

    await submitted;
  });

  it('a generic application with no business selected still sends businessId: null cleanly — not undefined, not a throw', async () => {
    // The wizard's own toStep() guard ("Please select a business.") blocks a
    // citizen from ever reaching step 2 — and so `submit()` — without
    // picking a business, for BOTH the generic and permit-specific flows
    // (the guard does not branch on `isGeneric`). So this is not reachable
    // through the wizard's own UI. It IS reachable at submitReal()'s own
    // boundary: nothing inside submitReal() re-checks businessId, so a bare
    // call with none selected must still serialize cleanly rather than throw
    // or have `businessId` silently vanish from the JSON body as `undefined`.
    expect(page.businessId).toBeNull();
    page.projectAddress = '123 Rizal Street';
    page.scopeOfWork = 'New retail construction';
    page.understandRequirements = true;
    page.agreeTerms = true;

    const submitted = page.submit();

    const req = http.expectOne(`${BASE}/applications`);
    const body = req.request.body as SubmitApplicationRequest;
    expect('businessId' in body).toBe(true);
    expect(body.businessId).toBeNull();
    req.flush(summaryFor(null), { status: 201, statusText: 'Created' });

    const refresh = await waitForRequest(http);
    refresh.flush({ data: [], nextCursor: null } satisfies ApplicationListResponse);

    await submitted;
  });
});
