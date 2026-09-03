import { documentValidity, EXPIRY_WARNING_DAYS } from './document-chains';

/**
 * A document's expiry date, finally compared to something.
 *
 * The office has been sending `expiresOn` on every document since the contract
 * was written. This portal carried it in the model, mapped it faithfully in the
 * adapter, and never once asked whether the date had passed — no screen showed
 * it, nothing compared it. A citizen whose sanitary clearance expired three
 * months ago saw "Uploaded" and found out when the office rejected them.
 *
 * These tests pin the two things this kind of check normally gets wrong: what
 * happens ON the expiry day, and what happens when there is no date at all.
 */
describe('Document validity', () => {
  const at = (iso: string) => new Date(iso);
  const NOW = at('2026-09-03T10:00:00.000Z');

  it('says nothing at all when the office set no expiry', () => {
    // Most documents have none. Inventing a validity the issuing office never
    // stated would be worse than silence.
    expect(documentValidity(null, NOW).state).toBe('no-expiry');
    expect(documentValidity('', NOW).state).toBe('no-expiry');
    expect(documentValidity('not-a-date', NOW).state).toBe('no-expiry');
  });

  it('a document is VALID THROUGH its expiry day, not expired at midnight', () => {
    // The trap: comparing instants makes a clearance "valid until 3 September"
    // expired at 00:00 on the 3rd — a day the office still accepts it. A
    // citizen would be told to replace a document that is still good.
    const today = documentValidity('2026-09-03T00:00:00.000Z', NOW);
    expect(today.state).not.toBe('expired');
    expect(today.state).toBe('expiring');
    if (today.state === 'expiring') expect(today.daysLeft).toBe(0);
  });

  it('is expired the day AFTER, and counts the days honestly', () => {
    const yesterday = documentValidity('2026-09-02T00:00:00.000Z', NOW);
    expect(yesterday.state).toBe('expired');
    if (yesterday.state === 'expired') expect(yesterday.daysAgo).toBe(1);

    const old = documentValidity('2026-06-05T00:00:00.000Z', NOW);
    expect(old.state).toBe('expired');
    if (old.state === 'expired') expect(old.daysAgo).toBe(90);
  });

  it('warns inside the window and stays quiet outside it', () => {
    const inside = documentValidity('2026-10-15T00:00:00.000Z', NOW); // 42 days
    expect(inside.state).toBe('expiring');

    const outside = documentValidity('2027-09-03T00:00:00.000Z', NOW); // a year
    expect(outside.state).toBe('valid');

    // The boundary itself, both sides of it.
    const onBoundary = new Date(Date.UTC(2026, 8, 3 + EXPIRY_WARNING_DAYS));
    expect(documentValidity(onBoundary.toISOString(), NOW).state).toBe('expiring');
    const pastBoundary = new Date(Date.UTC(2026, 8, 3 + EXPIRY_WARNING_DAYS + 1));
    expect(documentValidity(pastBoundary.toISOString(), NOW).state).toBe('valid');
  });

  it('does not drift across a month or year boundary', () => {
    // Day arithmetic done with getDate() rather than UTC days breaks here.
    const nyEve = at('2026-12-31T23:00:00.000Z');
    const jan1 = documentValidity('2027-01-01T00:00:00.000Z', nyEve);
    expect(jan1.state).toBe('expiring');
    if (jan1.state === 'expiring') expect(jan1.daysLeft).toBe(1);

    const dec31 = documentValidity('2026-12-31T00:00:00.000Z', nyEve);
    expect(dec31.state).toBe('expiring');
    if (dec31.state === 'expiring') expect(dec31.daysLeft).toBe(0);
  });
});
