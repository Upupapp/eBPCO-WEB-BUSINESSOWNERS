/** Fields that may be cleared outright. Names cannot: an account needs one. */
const CLEARABLE = ['middleName', 'street', 'barangay', 'city', 'province', 'postalCode'];
const REQUIRED = ['firstName', 'lastName', 'mobileNumber'];
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
export function buildRectification(original, edited) {
    const patch = {};
    for (const key of REQUIRED) {
        const next = (edited[key] ?? '').trim();
        if (next && next !== (original[key] ?? ''))
            patch[key] = next;
    }
    for (const key of CLEARABLE) {
        const raw = edited[key];
        if (raw === undefined)
            continue;
        const next = raw.trim();
        const before = original[key];
        if (next === '') {
            // Emptied. Only a change if something was there — clearing an already
            // empty field is not a correction, and would make every save a write.
            if (before !== null && before !== undefined)
                patch[key] = null;
        }
        else if (next !== before) {
            patch[key] = next;
        }
    }
    return patch;
}
/** The server's own rules, checked here so a citizen is told before a round trip. */
export const POSTAL_CODE = /^[0-9]{4}$/;
export const MOBILE_NUMBER = /^(09\d{9}|\+639\d{9})$/;
export function rectificationProblem(patch) {
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
export function heldValue(v) {
    return v === null || v === '' ? 'Not recorded' : v;
}
