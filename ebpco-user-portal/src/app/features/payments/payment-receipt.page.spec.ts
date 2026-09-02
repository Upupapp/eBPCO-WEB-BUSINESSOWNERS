import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { PaymentReceiptPage } from './payment-receipt.page';
import { ApplicationStore } from '../../core/stores/application.store';
import { AuthService } from '../../core/session/auth.service';

/**
 * Guards task 8: an application could be "Paid" with NO payment record.
 *
 * `advanceForDemo` marked the assessment Paid and the application
 * paymentStatus 'Paid' while creating no PaymentTransaction — so Payments
 * showed "Paid" and the receipt for the same application said "No payment has
 * been submitted for this application yet." Two screens, two answers, one fact.
 */
describe('Payment state is one fact (task 8)', () => {
  let store: ApplicationStore;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(AuthService).login('juan.delacruz@example.com', 'Password1');
    store = TestBed.inject(ApplicationStore);
  });
  afterEach(() => TestBed.resetTestingModule());

  const advanceTo = (id: string, status: string) => {
    for (let i = 0; i < 20; i++) {
      if (store.applicationById(id)?.lifecycleStatus === status) return;
      store.advanceForDemo(id);
    }
  };

  it('an application marked Paid always has a payment record behind it', () => {
    advanceTo('app-seed-1', 'Payment Verified');
    const app = store.applicationById('app-seed-1')!;
    expect(app.paymentStatus).toBe('Paid');
    // The assertion that used to fail silently: the money side of the same fact.
    expect(store.paymentsFor('app-seed-1').length).toBeGreaterThan(0);
  });

  it('the recorded payment is verified and matches the assessed total', () => {
    advanceTo('app-seed-1', 'Payment Verified');
    const assessment = store.assessmentFor('app-seed-1')!;
    const tx = store.paymentsFor('app-seed-1').at(-1)!;
    expect(tx.status).toBe('Verified');
    expect(tx.amountCentavos).toBe(assessment.totalCentavos);
  });

  it('carries no OR number — only a cashier assigns one', () => {
    advanceTo('app-seed-1', 'Payment Verified');
    // This is what keeps the receipt watermarked. An OR number here would clear
    // a document that no Treasurer's Office ever issued.
    expect(store.paymentsFor('app-seed-1').at(-1)!.orNumber).toBeNull();
  });

  it('does not invent a second payment when the citizen already paid', () => {
    store.advanceForDemo('app-seed-1');                       // -> Assessed
    store.submitPayment('app-seed-1', 'Onsite', 'REF-1');     // citizen pays
    const before = store.paymentsFor('app-seed-1').length;
    advanceTo('app-seed-1', 'Payment Verified');              // office verifies
    expect(store.paymentsFor('app-seed-1').length).toBe(before);
    expect(store.paymentsFor('app-seed-1').at(-1)!.status).toBe('Verified');
  });
});

/**
 * Guards task 11: the receipt's cleared state must be EARNED, not inherited
 * from missing data.
 *
 * `watermarkText()` returned null when there was no payment — the same value
 * that means "genuine, no watermark" — so `gateCleared` was true precisely when
 * the data was absent. It is dead through the rendered page, because the
 * document sits inside @if (payment(); as tx), which is why a render-level test
 * cannot fail on it. So this asserts the gate itself: one refactor moving that
 * @if is all it takes for a receipt with no payment behind it to claim it is a
 * "system-generated Official Receipt issued by the Municipality".
 */
describe('PaymentReceiptPage (task 11: cleared is earned, not inherited)', () => {
  function gate(hasPayment: boolean) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PaymentReceiptPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ applicationId: 'app-x' }) } } },
        { provide: ApplicationStore, useValue: {
            applicationById: () => ({ id: 'app-x', permitType: 'Zoning / Locational Clearance',
                                      applicationNumber: 'ZLC-1', businessId: 'biz-1', businessName: 'T' }),
            assessmentFor: () => undefined,
            paymentsFor: () => (hasPayment
              ? [{ id: 'p1', applicationId: 'app-x', status: 'Verified', orNumber: null,
                   amountCentavos: 1000, method: 'Onsite', submittedAt: '', verifiedAt: '' }]
              : []),
          } },
      ],
    });
    const fixture = TestBed.createComponent(PaymentReceiptPage);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as { gateCleared(): boolean; watermarkText(): string | null };
  }
  afterEach(() => TestBed.resetTestingModule());

  it('is NOT cleared when there is no payment at all', () => {
    const page = gate(false);
    expect(page.gateCleared()).toBe(false);
    // And absence must not produce the "genuine" watermark value either.
    expect(page.watermarkText()).not.toBeNull();
  });

  it('is not cleared for a payment with no OR number — only a cashier assigns one', () => {
    expect(gate(true).gateCleared()).toBe(false);
  });
});
