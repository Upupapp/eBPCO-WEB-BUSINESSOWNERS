/**
 * The LGU's deposit account, once the Municipality supplies it.
 *
 * `null` means "not supplied", and the payment screen must render an honest
 * "not yet available" state rather than anything an applicant could copy.
 *
 * This was previously a fabricated literal — a real bank ("Land Bank of the
 * Philippines"), a real branch ("Castilla, Sorsogon Branch") and an invented
 * account number ("1234-5678-90"), unmarked, presented as the account to send
 * permit fees to. Every other invented value in this build is either seeded
 * demo data behind a login or explicitly labelled; that one was an instruction
 * to move money, which is why it is null and not a marked placeholder: a
 * labelled fake account number can still be copied, and a partially-real one
 * (right bank, wrong number) is the most dangerous form of all.
 *
 * Checked before filing as blocked, per standing rule: no bundled LGU document
 * carries these details. `docs/08-Reusable-Stitch/10-Payment-Stitch.md` names
 * the FIELDS only. This genuinely awaits the Municipality.
 */
export const DEFAULT_BANK_INFO = null;
