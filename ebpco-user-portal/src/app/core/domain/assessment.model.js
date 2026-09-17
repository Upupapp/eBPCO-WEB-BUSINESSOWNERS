export function pesos(centavos) {
    return (centavos / 100).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
}
/**
 * F-19: what the permit document prints in its AUTHORITY column.
 *
 * Every fee amount in this build is invented — ₱5,250 filing, ₱850 zoning,
 * ₱3,200 renewal, ₱1,500 amendment. They used to be labelled
 * "LGU Fee Schedule": a named legal basis, printed in an AUTHORITY column on a
 * document carrying the Republic of the Philippines letterhead and the
 * municipal seal. A citizen would budget on that, and the ATTRIBUTION is
 * precisely what made an invented number credible — an unsourced figure invites
 * a phone call, a sourced one does not.
 *
 * The amounts stay, because the assessment and payment flow needs numbers to
 * demonstrate anything at all. The false attribution does not.
 *
 * Checked before filing as blocked: no bundled LGU document carries Castilla's
 * fee schedule. The peso figures under docs/ are formatting examples in a
 * microcopy style guide, not rates. Replace this with the real basis — the
 * ordinance title and number — when the Municipality supplies the schedule.
 */
export const ILLUSTRATIVE_FEE_BASIS = 'Illustrative amount — not a Castilla rate';
