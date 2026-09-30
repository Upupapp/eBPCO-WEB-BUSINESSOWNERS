import { applicantStatusLabel, applicantStatusOf } from './status.model';

describe('applicantStatusLabel', () => {
  it('says the payment is verified once the Cashier has verified it', () => {
    // Found live 2026-09-28: the Admin Portal showed For Approval with an
    // Official Receipt recorded, while the citizen still read "Payment
    // Verification", as if the payment were still being checked.
    expect(applicantStatusLabel('Payment Verified')).toBe('Payment Verified');
    expect(applicantStatusLabel('For Approval')).toBe('Payment Verified');
  });

  it('keeps a submitted, unverified payment as Payment Verification', () => {
    for (const s of ['Payment Submitted', 'Payment Under Verification'] as const) {
      expect(applicantStatusLabel(s)).toBe('Payment Verification');
    }
  });

  it('says when the application is waiting on the citizen', () => {
    expect(applicantStatusLabel('Revision Required')).toBe('Revision Required');
    expect(applicantStatusLabel('Assessed')).toBe('Awaiting Payment');
    expect(applicantStatusOf('Revision Required')).toBe('Under Review');
    expect(applicantStatusOf('Assessed')).toBe('Payment Verification');
  });

  it('leaves the filter category unchanged', () => {
    expect(applicantStatusOf('For Approval')).toBe('Payment Verification');
    expect(applicantStatusOf('Payment Verified')).toBe('Payment Verification');
  });
});
