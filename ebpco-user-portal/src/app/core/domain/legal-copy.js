import { MUNICIPAL_ENGINEER, MUNICIPAL_HALL_ADDRESS } from './lgu-contact';
/**
 * Single-sourced Terms & Conditions / Privacy Policy copy, shared by the
 * Profile page's Legal tab and the standalone /terms and /privacy pages so the
 * two never drift apart.
 *
 * F-6: the privacy policy was ONE SENTENCE, and two enforced consent
 * checkboxes on the registration form were taken against it. Registration
 * collects a citizen's name, date of birth, sex, civil status, nationality,
 * email, mobile and full address, and the permit flows then ask for OCT/TCT
 * titles, valid IDs and survey plans. RA 10173 requires a notice that names
 * the personal information controller, the purposes, the categories of data,
 * the recipients, the retention period and the citizen's rights. None of that
 * was present, so the consent obtained was not informed consent.
 *
 * TWO RULES FOR EDITING THIS FILE.
 *
 * 1. Describe what the system ACTUALLY does today, not what it will do. The
 *    original text said data "is handled in accordance with the Philippine
 *    Data Privacy Act" — an assurance, not a disclosure, so it was replaced
 *    with a concrete one. That disclosure was later overtaken the other
 *    direction: applications, documents, payments and businesses are now
 *    genuinely transmitted to and stored by the Municipality (Hardening
 *    Pass, Part 3c) — the "everything stays in your browser" claim this file
 *    made until then had itself become false, the opposite error from the
 *    one rule 1 was written to prevent, and is corrected below for the same
 *    reason.
 * 2. Never invent an LGU fact to fill a gap. Retention period, the Data
 *    Protection Officer's name and the list of recipient offices are the
 *    Municipality's to state. Where they are unknown, this notice SAYS they
 *    are not yet determined. A plausible-sounding "we keep your data for 5
 *    years" would be a fabrication with legal weight. This gap is real and
 *    independent of whether data is being collected — fixing rule 1's
 *    violation must not accidentally paper over rule 2's.
 */
export const TERMS_CONDITIONS_TEXT = "By using eBPCO, you agree to provide accurate information for every permit application and to comply with all applicable national and local regulations, including PD 1096 (National Building Code) and RA 9514 (Fire Code of the Philippines).";
/** The headline a citizen needs before anything else — see rule 1 above. */
export const PRIVACY_POLICY_TEXT = 'Your account, applications, documents, payments and businesses are genuinely created, transmitted and stored by the Municipality of Castilla — this is not a demonstration.';
export const PRIVACY_POLICY_SECTIONS = [
    {
        heading: 'What eBPCO does with your data today',
        paragraphs: [
            PRIVACY_POLICY_TEXT,
            'A document you attach is stored in full, not recorded by name only, and is retained for as long as your application or the resulting permit requires it. A permit that has genuinely been issued can be viewed on this portal and, once released, printed with its real permit number and conditions.',
            'One part remains unconnected: looking up a permit by number from the public, no-login verification page does not yet check this Municipality\'s real records. That page says so on its own.',
        ],
    },
    {
        heading: 'Who will control your data once eBPCO goes live',
        paragraphs: [
            'The personal information controller is the Local Government Unit of Castilla, Sorsogon. The Municipality states on its own permit forms that "all information we collect through this form shall be kept confidential by the Local Government Unit of Castilla and shall be used solely for legal purposes as mandated by the Data Privacy Act and other relevant laws."',
            `You can reach the ${MUNICIPAL_ENGINEER.name} at ${MUNICIPAL_ENGINEER.mobile} or ${MUNICIPAL_ENGINEER.email}, or in person at ${MUNICIPAL_HALL_ADDRESS}.`,
        ],
    },
    {
        heading: 'What eBPCO will collect',
        paragraphs: [
            'To create an account: your first, middle and last name, date of birth, sex, civil status, nationality, email address, mobile number and full address including barangay, city, province and postal code.',
            'To process a permit application: details of the project or establishment, and the documents each permit requires — which may include certified copies of land titles (OCT/TCT), deeds, survey plans, design plans, cost estimates, professional licences and a valid government ID.',
            'Your account password is required to sign in and is never shown to anyone at the Municipality.',
        ],
    },
    {
        heading: 'Why it is collected',
        paragraphs: [
            'Solely to receive, evaluate, assess, approve and release the permits you apply for, and to contact you about those applications. Your data is not used for any other purpose, and it is never shared with another citizen\'s account.',
        ],
    },
    {
        heading: 'Your rights under the Data Privacy Act of 2012 (RA 10173)',
        paragraphs: [
            'As a data subject you have the right to be informed, to object, to access your data, to correct it, to have it erased or blocked, to damages for a violation, and to data portability.',
            'You may exercise any of these rights by contacting the Municipality using the details above. If you believe your rights have been violated, you may complain to the National Privacy Commission.',
        ],
    },
    {
        heading: 'Not yet determined',
        paragraphs: [
            'Three things this notice cannot yet tell you, because the Municipality has not published them and eBPCO will not invent them: how long your data will be retained, who the Municipality\'s Data Protection Officer is, and exactly which offices your application will be shared with during evaluation.',
            'This section will be replaced with the Municipality\'s own answers once they are published. Your data is being collected and retained in the meantime — see the first section — under the general basis stated above (performance of a public task, PD 1096 permit issuance), not withheld until these specifics arrive.',
        ],
    },
];
