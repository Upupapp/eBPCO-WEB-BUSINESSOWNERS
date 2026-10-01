import { paymentAttemptView } from './payments-list.page';
import { PaymentHistoryEntry } from '../../core/api/citizen-api.models';

function entry(overrides: Partial<PaymentHistoryEntry> = {}): PaymentHistoryEntry {
  return {
    id: 'pay-1', referenceNumber: 'ONSITE-1', method: 'Onsite', amountCentavos: 525000,
    status: 'Pending Verification', submittedAt: '2026-10-01T02:00:00.000Z',
    verifiedAt: null, officialReceiptNumber: null, rejectionReason: null, rejectedAt: null,
    exceptionReason: null, exceptionAt: null,
    ...overrides,
  };
}

/** The payment history on the Payments page (2026-10-01): each payment sent, in the citizen's words. */
describe('paymentAttemptView', () => {
  it('a payment still being checked says so, and that nothing more is needed', () => {
    const view = paymentAttemptView(entry());
    expect(view.label).toBe('Pending Verification');
    expect(view.tone).toBe('amber');
  });

  it('a confirmed payment shows its Official Receipt number', () => {
    const view = paymentAttemptView(entry({
      status: 'Paid', officialReceiptNumber: 'OR-2026-123456', verifiedAt: '2026-10-01T05:00:00.000Z',
    }));
    expect(view.label).toBe('Paid');
    expect(view.tone).toBe('green');
    expect(view.detail).toContain('OR-2026-123456');
  });

  it('a rejected payment is told by its reason, since the server keeps no Rejected status', () => {
    const view = paymentAttemptView(entry({
      status: 'Not Yet Available', rejectionReason: 'The reference number does not match.',
      rejectedAt: '2026-10-01T04:00:00.000Z',
    }));
    expect(view.label).toBe('Rejected');
    expect(view.tone).toBe('red');
    expect(view.detail).toBe('The reference number does not match.');
  });

  it('a refunded payment says so, with the office reason', () => {
    const view = paymentAttemptView(entry({
      status: 'Refunded', exceptionReason: 'Paid twice; the second payment was returned.',
      exceptionAt: '2026-10-01T06:00:00.000Z', officialReceiptNumber: 'OR-1', verifiedAt: '2026-10-01T05:00:00.000Z',
    }));
    expect(view.label).toBe('Refunded');
    expect(view.detail).toContain('returned');
  });
});
