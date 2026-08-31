import { ILLUSTRATIVE_FEE_BASIS } from './assessment.model';

/**
 * Guards F-19: every fee amount in this build is invented, and each one used to
 * print "LGU Fee Schedule" in the AUTHORITY column of a document carrying the
 * Republic of the Philippines letterhead.
 *
 * The attribution is what made the invented number credible. An unsourced
 * figure invites a phone call to the Municipality; a sourced one does not.
 */
describe('Fee basis (F-19: no invented amount may cite a legal authority)', () => {
  it('does not name a legal or municipal authority', () => {
    for (const claim of ['LGU Fee Schedule', 'Ordinance', 'Schedule of Fees', 'Municipal Ordinance']) {
      expect(ILLUSTRATIVE_FEE_BASIS).not.toContain(claim);
    }
  });

  it('says on its face that the amount is not a real rate', () => {
    expect(ILLUSTRATIVE_FEE_BASIS.toLowerCase()).toContain('illustrative');
    expect(ILLUSTRATIVE_FEE_BASIS.toLowerCase()).toContain('not a castilla rate');
  });
});
