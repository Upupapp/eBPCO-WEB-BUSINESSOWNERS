import { PRIVACY_POLICY_SECTIONS, PRIVACY_POLICY_TEXT } from './legal-copy';

const ALL = PRIVACY_POLICY_SECTIONS.flatMap((s) => [s.heading, ...s.paragraphs]).join('\n');

/**
 * Guards F-6: two enforced consent checkboxes on the registration form point at
 * this copy, so what it says IS the consent a citizen gives. It was one
 * sentence.
 */
describe('Privacy notice (F-6: informed consent needs a real notice)', () => {
  it('leads with what this build actually does, not an assurance', () => {
    expect(PRIVACY_POLICY_TEXT).toContain('demonstration build');
    expect(PRIVACY_POLICY_TEXT).toContain('not transmitted');
  });

  it('names the personal information controller', () => {
    expect(ALL).toContain('Local Government Unit of Castilla');
  });

  it('enumerates the categories of data actually collected', () => {
    for (const field of ['date of birth', 'civil status', 'mobile number', 'OCT/TCT']) {
      expect(ALL).toContain(field);
    }
  });

  it('states the citizen rights RA 10173 confers, and the route to complain', () => {
    for (const right of ['right to be informed', 'object', 'access', 'correct', 'erased', 'damages', 'portability']) {
      expect(ALL.toLowerCase()).toContain(right.toLowerCase());
    }
    expect(ALL).toContain('National Privacy Commission');
  });

  it('declares the gaps instead of inventing LGU facts to fill them', () => {
    // Retention period, DPO identity and recipient offices are the
    // Municipality's to state. A plausible "we keep your data for 5 years"
    // would be a fabrication with legal weight.
    expect(ALL).toContain('Not yet determined');
    expect(ALL).toContain('how long your data will be retained');
    expect(ALL).toContain('Data Protection Officer');
  });

  it('does not assert bare DPA compliance in place of disclosing anything', () => {
    expect(PRIVACY_POLICY_TEXT).not.toContain('in accordance with the Philippine Data Privacy Act');
  });
});
