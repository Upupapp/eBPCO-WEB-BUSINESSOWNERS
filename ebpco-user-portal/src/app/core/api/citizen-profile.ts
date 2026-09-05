/**
 * The citizen's own profile — `GET /me` and `PATCH /me`.
 *
 * RA 10173 s.16(d), the right to rectification. Field names are the SERVER's,
 * taken from its schema rather than from ours: `street`, not `address`, because
 * `businesses` already calls it street and a second spelling of one idea inside
 * one service is the defect D-10 spent a migration undoing. `postalCode` is
 * ours only because no server field existed to match. Where the server has a
 * name, the server's name wins.
 */
/** The profile fields both responses carry. */
export interface CitizenProfile {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  mobileNumber: string | null;
  street: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}

/**
 * `GET /me`. Identity fields, and NO mobileVerifiedAt.
 *
 * The two /me responses have DIFFERENT shapes and this one is not a superset:
 * GET carries `id`, `kind`, `email` and `emailVerifiedAt`; PATCH carries
 * `mobileVerifiedAt` and `mobileVerificationCleared` and none of the identity
 * fields. Typing one interface for both — which is what this file did until the
 * recorded samples were read — declares a field that is simply absent at
 * runtime, and `undefined` would have rendered as a verified-looking blank.
 *
 * `email` is present here and MUST NOT be offered for editing: PATCH refuses it
 * with a 400 because it is the sign-in identity.
 */
export interface MeResponse extends CitizenProfile {
  id: string;
  kind: string;
  email: string;
  emailVerifiedAt: string | null;
}

/** What PATCH /me answers with: the new profile, plus what the change cost. */
export interface RectificationResult extends CitizenProfile {
  /** Null means the number has not been verified — not that there is no number. */
  mobileVerifiedAt: string | null;
  /**
   * True when this change un-verified the mobile number.
   *
   * Stated by the server rather than inferred, and it must be shown. The
   * verification belonged to the OLD number, where a code was sent and
   * answered; a client that does not re-prompt leaves a citizen holding an
   * unverified contact they believe is verified.
   */
  mobileVerificationCleared: boolean;
}

/** Fields a citizen may correct. `null` CLEARS; absent LEAVES ALONE. */
export type ProfileRectification = Partial<{
  firstName: string;
  middleName: string | null;
  lastName: string;
  mobileNumber: string;
  street: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}>;

/** Fields that may be cleared outright. Names cannot: an account needs one. */
const CLEARABLE = ['middleName', 'street', 'barangay', 'city', 'province', 'postalCode'] as const;
const REQUIRED = ['firstName', 'lastName', 'mobileNumber'] as const;

/**
 * Build the patch from what the citizen actually changed.
 *
 * `null` and absent are DIFFERENT and the difference is the feature: absent
 * leaves a field alone, null clears it. A citizen who typed a middle name by
 * mistake, or has none, must be able to remove it — a right to correct that
 * cannot remove is half a right. So an emptied optional field becomes `null`,
 * never an omission and never `''` (the server's `.min(1)` would reject that).
 *
 * Unchanged fields are omitted rather than echoed back. Sending the whole
 * profile every time would overwrite a field a second device changed in the
 * meantime with a value this screen loaded before it happened.
 */
export function buildRectification(
  original: CitizenProfile,
  edited: Record<string, string>,
): ProfileRectification {
  const patch: Record<string, string | null> = {};

  for (const key of REQUIRED) {
    const next = (edited[key] ?? '').trim();
    if (next && next !== (original[key] ?? '')) patch[key] = next;
  }

  for (const key of CLEARABLE) {
    const raw = edited[key];
    if (raw === undefined) continue;
    const next = raw.trim();
    const before = original[key];
    if (next === '') {
      // Emptied. Only a change if something was there — clearing an already
      // empty field is not a correction, and would make every save a write.
      if (before !== null && before !== undefined) patch[key] = null;
    } else if (next !== before) {
      patch[key] = next;
    }
  }

  return patch as ProfileRectification;
}

/** The server's own rules, checked here so a citizen is told before a round trip. */
export const POSTAL_CODE = /^[0-9]{4}$/;
export const MOBILE_NUMBER = /^(09\d{9}|\+639\d{9})$/;

export function rectificationProblem(patch: ProfileRectification): string | null {
  if (patch.postalCode != null && !POSTAL_CODE.test(patch.postalCode)) {
    // "An address the office cannot post to is worse than none, because it
    // gets acted on."
    return 'A Philippine postal code is four digits.';
  }
  if (patch.mobileNumber != null && !MOBILE_NUMBER.test(patch.mobileNumber)) {
    return 'Enter a mobile number as 09XXXXXXXXX or +639XXXXXXXXX.';
  }
  return null;
}

/**
 * How to show a value the office does not hold.
 *
 * Null means NOT RECORDED, not blank. Nobody has ever been asked for these
 * fields, so rendering null as "the citizen left it empty" would report a
 * decision they were never given the chance to make.
 */
export function heldValue(v: string | null): string {
  return v === null || v === '' ? 'Not recorded' : v;
}
