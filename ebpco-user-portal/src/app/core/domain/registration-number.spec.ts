import { registrationDateProblem, registrationNumberProblem } from './registration-number';

/** QA TC-24 (2026-10-03): "x" was accepted as a DTI/SEC/CDA registration number. Same rule as the server's. */
describe('registrationNumberProblem', () => {
  it('refuses what cannot be a registration number', () => {
    for (const bad of ['x', 'abcd', 'ABC-12', '#1234-5678', '   ']) {
      expect(registrationNumberProblem(bad)).not.toBeNull();
    }
  });

  it('accepts DTI, SEC and CDA style numbers', () => {
    for (const good of ['3456789', 'CS201912345', 'DTI-2024-000123', '9520-12345678', 'A1999-1234']) {
      expect(registrationNumberProblem(good)).toBeNull();
    }
  });

  it('says why, in words a citizen can act on', () => {
    expect(registrationNumberProblem('x')).toContain('as it appears on the certificate');
    expect(registrationNumberProblem('ABCDE-12')).toContain('at least 4 digits');
  });
});

describe('registrationDateProblem', () => {
  const today = new Date('2026-10-03T08:00:00+08:00');

  it('accepts a real past day', () => {
    expect(registrationDateProblem('2024-02-29', today)).toBeNull();
  });

  it('refuses a day that does not exist, or one in the future', () => {
    expect(registrationDateProblem('2025-02-29', today)).not.toBeNull();
    expect(registrationDateProblem('2027-01-01', today)).toContain('future');
    expect(registrationDateProblem('', today)).not.toBeNull();
  });
});
