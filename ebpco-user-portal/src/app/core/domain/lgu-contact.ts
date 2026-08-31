/**
 * The Municipality of Castilla's real contact details — the SINGLE source of
 * truth for every screen that tells a user how to reach the LGU.
 *
 * Every value below is transcribed from a document bundled in this repository,
 * and the source is named beside it. Nothing here may be invented, guessed or
 * "filled in for now": the screens that previously did so shipped a phone
 * number of zeroes and a support mailbox that does not exist, while the real
 * details sat two directories away in `assets/`. If a value is not in a source
 * document, it does not belong in this file — leave it out and say so on the
 * screen rather than inventing a plausible one.
 */

export interface LguOffice {
  /** Full office name exactly as the LGU's own form letterhead writes it. */
  readonly name: string;
  readonly shortName: string;
  readonly email: string;
  /** Null where no published number exists — render nothing, never a placeholder. */
  readonly mobile: string | null;
  readonly handles: string;
}

/**
 * Source: assets/LGU Castilla BPCO Forms/Checklist (Building Permit & Occupancy).pdf
 * Letterhead: "OFFICE OF THE MUNICIPAL ENGINEER".
 * Footer: "please call MEO at 09054818572 (cellphone) or send an email at
 *          meocastilla@gmail.com within 3 working days."
 */
export const MUNICIPAL_ENGINEER: LguOffice = {
  name: 'Office of the Municipal Engineer',
  shortName: 'MEO',
  email: 'meocastilla@gmail.com',
  mobile: '09054818572',
  handles: 'Building permits, ancillary permits and certificates of occupancy',
};

/**
 * Source: assets/LGU Castilla BPCO Forms/Zoning Checklist.pdf (FM-MPD-12,
 * updated as of August 2024). Letterhead: "Municipal Planning and Development
 * Office". Footer: "Castilla Town Hall, Cumadcad, Castilla, Sorsogon" and
 * "castillampdo@gmail.com". No telephone number is published on the form.
 */
export const PLANNING_AND_DEVELOPMENT: LguOffice = {
  name: 'Municipal Planning and Development Office',
  shortName: 'MPDO',
  email: 'castillampdo@gmail.com',
  mobile: null,
  handles: 'Locational clearance and certificates of zoning compliance',
};

/** Source: Zoning Checklist.pdf footer — "Castilla Town Hall, Cumadcad, Castilla, Sorsogon". */
export const MUNICIPAL_HALL_ADDRESS = 'Castilla Town Hall, Cumadcad, Castilla, Sorsogon';

/** Source: Checklist (Building Permit & Occupancy).pdf footer — "within 3 working days". */
export const INQUIRY_TURNAROUND = 'Inquiries are answered within 3 working days.';

/**
 * Deliberately absent: OFFICE HOURS. No bundled LGU document publishes them.
 * The Help screen previously stated "Monday to Friday, 8:00 AM – 5:00 PM" —
 * plausible, and entirely unsourced. Add it here only once a Castilla document
 * or the LGU states it.
 */
