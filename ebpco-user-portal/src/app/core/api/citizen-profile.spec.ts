import {
  buildRectification, rectificationProblem, heldValue, CitizenProfile,
  POSTAL_CODE, MOBILE_NUMBER,
} from './citizen-profile';

const held: CitizenProfile = {
  firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz',
  mobileNumber: '09171234567',
  street: 'Purok 3, Zone 2', barangay: 'Poblacion', city: 'Castilla',
  province: 'Sorsogon', postalCode: '4713',
  mobileVerifiedAt: '2026-08-01T00:00:00.000Z',
};

const form = (over: Record<string, string> = {}) => ({
  firstName: held.firstName!, middleName: held.middleName!, lastName: held.lastName!,
  mobileNumber: held.mobileNumber!, street: held.street!, barangay: held.barangay!,
  city: held.city!, province: held.province!, postalCode: held.postalCode!,
  ...over,
});

/**
 * `null` and absent mean different things, and the difference is the feature.
 *
 * Absent leaves a field alone; null clears it. A citizen who typed a middle
 * name by mistake, or has none, must be able to remove it — a right to correct
 * that cannot remove is half a right. The backend break-checked this on their
 * side (treating null as absent fails a test there); these are the same
 * property asserted from the client.
 */
describe('Building a rectification', () => {
  it('sends nothing at all when nothing changed', () => {
    expect(buildRectification(held, form())).toEqual({});
  });

  it('sends ONLY the field that changed', () => {
    expect(buildRectification(held, form({ city: 'Sorsogon City' }))).toEqual({ city: 'Sorsogon City' });
  });

  it('CLEARS an emptied optional field with null, never by omitting it', () => {
    const patch = buildRectification(held, form({ middleName: '' }));
    // The distinction under test: `{}` would leave "Santos" in place for ever.
    expect(patch).toEqual({ middleName: null });
    expect('middleName' in patch).toBe(true);
    expect(patch.middleName).toBeNull();
  });

  it("never sends '' — the server's min(1) would reject it", () => {
    const patch = buildRectification(held, form({ street: '', barangay: '' }));
    expect(Object.values(patch)).not.toContain('');
    expect(patch).toEqual({ street: null, barangay: null });
  });

  it('does not send a clear for a field that was already not recorded', () => {
    const blank: CitizenProfile = { ...held, middleName: null, street: null };
    // Clearing nothing is not a correction, and would make every save a write.
    expect(buildRectification(blank, form({ middleName: '', street: '' }))).toEqual({});
  });

  it('refuses to blank a required field by omitting it rather than sending empty', () => {
    // An account needs a name. Emptying it is not a correction the server accepts,
    // so the patch must simply not carry it.
    expect(buildRectification(held, form({ firstName: '' }))).toEqual({});
  });

  it('trims, so a stray space is not mistaken for a change', () => {
    expect(buildRectification(held, form({ city: '  Castilla  ' }))).toEqual({});
  });
});

describe("The server's own rules, checked before the round trip", () => {
  it('a Philippine postal code is four digits', () => {
    // "An address the office cannot post to is worse than none, because it
    // gets acted on."
    expect(rectificationProblem({ postalCode: '4713' })).toBeNull();
    expect(rectificationProblem({ postalCode: '471' })).toMatch(/four digits/i);
    expect(rectificationProblem({ postalCode: '47134' })).toMatch(/four digits/i);
    expect(rectificationProblem({ postalCode: '47a3' })).toMatch(/four digits/i);
    // Clearing it is allowed — null is not a malformed code.
    expect(rectificationProblem({ postalCode: null })).toBeNull();
  });

  it('a mobile number is 09XXXXXXXXX or +639XXXXXXXXX', () => {
    expect(MOBILE_NUMBER.test('09171234567')).toBe(true);
    expect(MOBILE_NUMBER.test('+639171234567')).toBe(true);
    expect(MOBILE_NUMBER.test('0917123456')).toBe(false);
    expect(MOBILE_NUMBER.test('639171234567')).toBe(false);
    expect(rectificationProblem({ mobileNumber: '12345' })).toMatch(/09XXXXXXXXX/);
  });

  it('the patterns match the server schema byte for byte', () => {
    expect(POSTAL_CODE.source).toBe('^[0-9]{4}$');
    expect(MOBILE_NUMBER.source).toBe('^(09\\d{9}|\\+639\\d{9})$');
  });
});

describe('A value the office does not hold', () => {
  it('reads as NOT RECORDED, never as an empty answer the citizen gave', () => {
    // Nobody has ever been asked for these fields. Rendering null as "left
    // empty" reports a decision the citizen was never offered.
    expect(heldValue(null)).toBe('Not recorded');
    expect(heldValue('')).toBe('Not recorded');
    expect(heldValue('Purok 3')).toBe('Purok 3');
  });
});
