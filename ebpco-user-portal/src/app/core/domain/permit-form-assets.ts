/**
 * The blank forms a citizen is asked to upload filled in, keyed by the
 * requirement that asks for them.
 *
 * Only the Building Permit asks for one (2026-10-01, the server's own
 * requirement lists): the Unified Building Permit Form, which the applicant,
 * the lot owner and the engineer or architect sign and a notary notarises,
 * and the ancillary permit forms, signed and sealed by licensed professionals.
 * Neither can be signed online, so the citizen needs the blank one to print.
 * Every other permit is filed entirely online, so it gets no form: the link
 * sits on the document row that asks for the form, and nowhere else. The
 * mobile app does the same (its `permit_forms.dart`).
 *
 * The files under `public/assets/permit-forms/` are byte for byte the admin
 * portal's `public/assets/permits/`. The Architectural form is a generic
 * reference template, as on the admin portal and the app: Castilla has not
 * published its own, and the link says so.
 */
export interface BlankForm {
  /** Relative to the site root. */
  fileName: string;
  /** The document's own title. */
  label: string;
  /** A generic reference template standing in for a form Castilla has not published. */
  isReferenceTemplate: boolean;
}

const dir = 'assets/permit-forms';

/** Requirement code (the server's) and label (shared with the static catalog), and the form each asks for. */
const BLANK_FORMS: ReadonlyArray<{ code: string; requirementLabel: string; form: BlankForm }> = [
  { code: 'bpnc-unified-form', requirementLabel: 'Unified Building Permit Form',
    form: { fileName: `${dir}/unified-application-form.pdf`, label: 'Unified Application Form for Building Permit', isReferenceTemplate: false } },
  { code: 'bpnc-ancillary-electrical', requirementLabel: 'Electrical Permit (ancillary application form)',
    form: { fileName: `${dir}/electrical-form.pdf`, label: 'Electrical Permit Form', isReferenceTemplate: false } },
  { code: 'bpnc-ancillary-fencing', requirementLabel: 'Fencing Permit (ancillary application form)',
    form: { fileName: `${dir}/fencing-permit-form.pdf`, label: 'Fencing Permit Form', isReferenceTemplate: false } },
  { code: 'bpnc-ancillary-architectural', requirementLabel: 'Architectural Permit (ancillary application form)',
    form: { fileName: `${dir}/architectural-form.pdf`, label: 'Architectural Permit Form', isReferenceTemplate: true } },
  { code: 'bpnc-ancillary-sanitary-plumbing', requirementLabel: 'Sanitary/Plumbing Permit (ancillary application form)',
    form: { fileName: `${dir}/sanitary-form.pdf`, label: 'Sanitary Permit Form', isReferenceTemplate: false } },
  { code: 'bpnc-ancillary-mechanical', requirementLabel: 'Mechanical Permit (ancillary application form)',
    form: { fileName: `${dir}/mechanical-form.pdf`, label: 'Mechanical Permit Form', isReferenceTemplate: false } },
  { code: 'bpnc-ancillary-civil-structural', requirementLabel: 'Civil/Structural Permit (ancillary application form)',
    form: { fileName: `${dir}/structural-form.pdf`, label: 'Structural Permit Form', isReferenceTemplate: false } },
  { code: 'bpnc-ancillary-excavation', requirementLabel: 'Excavation Permit (ancillary application form)',
    form: { fileName: `${dir}/excavation-form.pdf`, label: 'Excavation Permit Form', isReferenceTemplate: false } },
  { code: 'bpnc-ancillary-electronics', requirementLabel: 'Electronics Permit (ancillary application form)',
    form: { fileName: `${dir}/electronics-form.pdf`, label: 'Electronics Permit Form', isReferenceTemplate: false } },
];

/** Every form the portal serves. */
export const ALL_BLANK_FORMS: readonly BlankForm[] = BLANK_FORMS.map((entry) => entry.form);

/**
 * The blank form the requirement asks the citizen to fill in and upload, or
 * null when it asks for no form (the usual answer). By the server's code
 * first; by label for a requirement from the built-in catalog, whose ids
 * differ.
 */
export function blankFormFor(code: string | null | undefined, label?: string | null): BlankForm | null {
  return BLANK_FORMS.find((entry) => entry.code === code)?.form
    ?? BLANK_FORMS.find((entry) => label !== undefined && label !== null && entry.requirementLabel === label)?.form
    ?? null;
}
