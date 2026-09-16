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
 * Balance answers "does the Municipality still expect money". It does not
 * answer "has this citizen already sent it", and only the second question may
 * decide whether to invite a payment. No unit test could have found this,
 * because every piece was correct on its own.
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

  /** An application with an assessment still carrying a balance. */
  function payable() {
    const row = page.rows().find((r) => r.assessment.balanceCentavos > 0);
    if (row) return row.applicationId;
    // Drive a seeded application to an assessed state through the store's own
    // machinery rather than hand-building an Assessment: a fixture assembled
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
    expect(row.label).toBe('Awaiting Payment');
  });

  it('STOPS offering Pay Now once a payment is awaiting verification', () => {
    const id = payable();
    store.submitPayment(id, 'Onsite', 'ONSITE-TEST');

    const row = page.rows().find((r) => r.applicationId === id)!;
    // The balance deliberately has NOT moved — that is the office's to clear.
    expect(row.assessment.balanceCentavos).toBeGreaterThan(0);
    // ...and precisely because it has not, the old code offered Pay Now here.
    expect(row.canPay).toBe(false);
    expect(row.label).toBe('Awaiting Verification');
  });

  it('says "Awaiting Verification", not "Awaiting Payment", to someone who has paid', () => {
    const id = payable();
    store.submitPayment(id, 'Onsite', 'ONSITE-TEST');
    const row = page.rows().find((r) => r.applicationId === id)!;
    expect(row.label).not.toBe('Awaiting Payment');
  });
});
