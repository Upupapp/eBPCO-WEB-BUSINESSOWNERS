import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PaymentsListPage } from './payments-list.page';
import { ApplicationStore } from '../../core/stores/application.store';
import { AuthService } from '../../core/session/auth.service';
import { CitizenIdentityApi } from '../../core/api/citizen-identity.api';
import { FakeCitizenIdentityApi } from '../../core/testing/fake-citizen-identity-api';

/**
 * A citizen who has already paid must not be offered "Pay Now".
 *
 * Found by the end-to-end journey gate, which paid a real application and then
 * looked at the payments list: balance ₱5,250.00, status "Awaiting Payment",
 * and a Pay Now button. The store was right — a submitted payment sits at
 * 'Pending Verification' and the balance correctly does not move until the
 * Treasurer's cashier verifies it. The LIST was wrong: it derived both the
 * label and the button from `balanceCentavos > 0` alone.
 *
 * This page was later rewritten to read `ApplicationRecord.paymentStatus`/
 * `.assessedAmountCentavos` directly (real on a configured backend, and
 * ALSO correctly maintained by the local demo store's own `submitPayment`/
 * `advanceForDemo` — see `application.store.ts`), rather than the separate
 * local-only `assessmentFor`/`paymentsFor` this test originally drove. The
 * regression this test guards is unchanged; only the field names are.
 */
describe('The payments list never invites a second payment', () => {
  let store: ApplicationStore;
  let page: PaymentsListPage;

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
    page = TestBed.createComponent(PaymentsListPage).componentInstance;
  });
  afterEach(() => TestBed.resetTestingModule());

  /** An application that genuinely still offers Pay Now — not merely unpaid, since a row already 'Pending Verification' has a positive amount too but must not offer it again. */
  function payable() {
    const row = page.rows().find((r) => r.canPay);
    if (row) return row.applicationId;
    // Drive a seeded application to an assessed state through the store's own
    // machinery rather than hand-building an assessment: a fixture assembled
    // here could hold a shape the app never produces.
    const app = store.myApplications()[0];
    for (let i = 0; i < 12 && !(store.assessmentFor(app.id)?.balanceCentavos ?? 0); i++) {
      store.advanceForDemo(app.id);
    }
    return app.id;
  }

  it('offers Pay Now while nothing has been paid', () => {
    const id = payable();
    const row = page.rows().find((r) => r.applicationId === id)!;
    expect(row.canPay).toBe(true);
    expect(row.label).toBe('Not Yet Available');
  });

  it('STOPS offering Pay Now once a payment is awaiting verification', () => {
    const id = payable();
    store.submitPayment(id, 'Onsite', 'ONSITE-TEST');

    const row = page.rows().find((r) => r.applicationId === id)!;
    // ...and precisely because a real submission does not settle the amount
    // by itself, the old code — which derived this from balance alone —
    // offered Pay Now here anyway.
    expect(row.canPay).toBe(false);
    expect(row.label).toBe('Pending Verification');
  });

  it('says "Pending Verification", not "Not Yet Available", to someone who has paid', () => {
    const id = payable();
    store.submitPayment(id, 'Onsite', 'ONSITE-TEST');
    const row = page.rows().find((r) => r.applicationId === id)!;
    expect(row.label).not.toBe('Not Yet Available');
  });
});
