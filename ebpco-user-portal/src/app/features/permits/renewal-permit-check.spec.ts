import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationWizardPage } from './application-wizard.page';
import { API_BASE_URL } from '../../core/api/api-config';
import { ApplicationSummary, RenewalCheckResponse, SubmitApplicationRequest } from '../../core/api/citizen-api.models';

/**
 * A typed permit number is checked by the server before step 1 lets go.
 *
 * The defect: on a business with no eBPCO permit on file, the wizard
 * silently switched to the unverified "claim" box, and anything typed
 * there — "BP", a phone number, nothing like a permit — carried the
 * citizen straight on to step 2. Now the number is checked against the
 * permits eBPCO issued to this citizen, for the selected business, of this
 * permit type, and a paper permit is an explicit, separate choice.
 */

/** Just enough of the component's surface to drive it — same cast pattern as the draft spec. */
interface Testable {
  businessId: string | null;
  isGeneric: boolean;
  permitType: string | null;
  applicationAction: string;
  relatedPermitNumber: string | null;
  priorPermitClaim: string | null;
  permitNumberInput: string;
  paperPermit: boolean;
  step(): number;
  error(): string | null;
  permitNumberError(): string | null;
  verifiedPermit(): { permitNumber: string } | null;
  toStep(next: 1 | 2 | 3 | 4): void;
  invalidatePermitCheck(): void;
  onPaperPermitChange(): void;
}

@Component({ template: '' })
class BlankPage {}

const BASE = 'https://api.example.gov.ph';

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error('condition never became true');
}

/**
 * The step advance autosaves a Draft (`POST /applications`), and the store
 * then refreshes the list (`GET /applications`) once that settles — both
 * drained here so neither is left open for `verify()`.
 */
async function drainAutosave(http: HttpTestingController, summary: ApplicationSummary): Promise<SubmitApplicationRequest> {
  const save = http.expectOne((r) => r.method === 'POST' && r.url === `${BASE}/applications`);
  const body = save.request.body as SubmitApplicationRequest;
  save.flush(summary, { status: 201, statusText: 'Created' });
  for (let i = 0; i < 50; i++) {
    const refresh = http.match((r) => r.method === 'GET' && r.url === `${BASE}/applications`);
    if (refresh.length > 0) {
      for (const r of refresh) r.flush({ data: [], nextCursor: null });
      break;
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  return body;
}

function draftSummary(renewsPermitNumber: string): ApplicationSummary {
  return {
    id: 'draft-1',
    referenceNumber: 'E-BPCO-2026-00777',
    serviceDomain: 'business-permit',
    permitType: 'Building Permit',
    applicationAction: 'Renewal',
    businessId: 'biz-1',
    businessName: 'Test Business',
    location: null,
    renewsPermitNumber,
    priorPermitClaim: null,
    lifecycleStatus: 'Draft',
    applicantStatus: 'Draft',
    requiresApplicantAction: false,
    dateSubmitted: null,
    updatedAt: '2026-09-26T00:00:00.000Z',
    openInstructionCount: 0,
    form: {},
    payment: { status: 'Not Yet Available' },
  };
}

describe('ApplicationWizardPage — a Renewal/Amendment permit number is checked before Continue', () => {
  let http: HttpTestingController;
  let page: Testable;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ApplicationWizardPage],
      providers: [
        provideRouter([{ path: 'applications/:id', component: BlankPage }]),
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
    page = fixture.componentInstance as unknown as Testable;
    page.businessId = 'biz-1';
    page.isGeneric = false;
    page.permitType = 'Building Permit';
    page.applicationAction = 'Renewal';
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('asks for the number, under the field, when none was typed', () => {
    page.toStep(2);

    expect(page.step()).toBe(1);
    expect(page.permitNumberError()).toMatch(/enter the permit number being renewed/i);
  });

  it('refuses a made-up number with the server\'s own message under the field, and stays on step 1', async () => {
    page.permitNumberInput = 'bp';

    page.toStep(2);

    const check = http.expectOne((r) => r.url.startsWith(`${BASE}/applications/renewal-check`));
    expect(check.request.method).toBe('GET');
    expect(check.request.urlWithParams).toContain('permitNumber=BP');
    expect(check.request.urlWithParams).toContain('permitType=Building+Permit');
    expect(check.request.urlWithParams).toContain('businessId=biz-1');
    const refused: RenewalCheckResponse = {
      valid: false, reason: 'permit-not-found',
      message: 'Permit number "BP" does not exist under your account. Check the number printed on your permit.',
    };
    check.flush(refused);
    await waitUntil(() => page.permitNumberError() !== null);

    expect(page.step()).toBe(1);
    expect(page.permitNumberError()).toContain('does not exist');
    expect(page.relatedPermitNumber).toBeNull();
  });

  it('continues with a confirmed number, and only the confirmed number reaches the draft', async () => {
    page.permitNumberInput = 'bp-2025-000042';

    page.toStep(2);

    const confirmed: RenewalCheckResponse = {
      valid: true,
      permit: {
        permitNumber: 'BP-2025-000042', permitType: 'Building Permit', businessName: 'Test Business',
        issuedDate: '2025-03-03T00:00:00.000Z',
      },
    };
    http.expectOne((r) => r.url.startsWith(`${BASE}/applications/renewal-check`)).flush(confirmed);
    await waitUntil(() => page.step() === 2);

    expect(page.relatedPermitNumber).toBe('BP-2025-000042');
    expect(page.verifiedPermit()?.permitNumber).toBe('BP-2025-000042');
    // The autosave the step advance fires carries the server's own spelling.
    const body = await drainAutosave(http, draftSummary('BP-2025-000042'));
    expect(body.renewsPermitNumber).toBe('BP-2025-000042');
    expect(body.priorPermitClaim).toBeNull();
  });

  it('forgets a confirmation the moment the business changes', async () => {
    page.permitNumberInput = 'BP-2025-000042';
    page.toStep(2);
    http.expectOne((r) => r.url.startsWith(`${BASE}/applications/renewal-check`)).flush({
      valid: true,
      permit: { permitNumber: 'BP-2025-000042', permitType: 'Building Permit', businessName: 'Test', issuedDate: '2025-03-03T00:00:00.000Z' },
    } satisfies RenewalCheckResponse);
    await waitUntil(() => page.step() === 2);
    await drainAutosave(http, draftSummary('BP-2025-000042'));

    page.businessId = 'biz-2';
    page.invalidatePermitCheck();

    expect(page.relatedPermitNumber).toBeNull();
    expect(page.verifiedPermit()).toBeNull();
  });

  it('never falls back to an unverified claim on its own — the paper path is an explicit choice', () => {
    // No eBPCO permit is on file for this business, which used to switch the
    // field to the unchecked claim box automatically.
    expect(page.paperPermit).toBe(false);
    page.permitNumberInput = 'BP';

    page.toStep(2);

    expect(page.priorPermitClaim).toBeNull();
    http.expectOne((r) => r.url.startsWith(`${BASE}/applications/renewal-check`)).flush({
      valid: false, reason: 'permit-not-found', message: 'Permit number "BP" does not exist under your account.',
    } satisfies RenewalCheckResponse);
  });

  it('on the paper path, sends no check and keeps the claim, clearing any checked number', async () => {
    page.paperPermit = true;
    page.onPaperPermitChange();
    page.priorPermitClaim = 'BP-1998-000042';

    page.toStep(2);

    http.expectNone((r) => r.url.startsWith(`${BASE}/applications/renewal-check`));
    expect(page.relatedPermitNumber).toBeNull();
    expect(page.step()).toBe(2);
    const body = await drainAutosave(http, draftSummary('unused'));
    expect(body.priorPermitClaim).toBe('BP-1998-000042');
    expect(body.renewsPermitNumber).toBeNull();
  });
});
