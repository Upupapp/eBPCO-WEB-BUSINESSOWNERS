// The single, fixed, complete list of permit types this system supports.
// Mirrors EBPCO WEB ADMIN/E-BPCO-Software-main's core/domain/permit.model.ts
// exactly (PermitType union + ALL_PERMIT_TYPES order) — this is the shared
// contract between the Admin Portal and this Citizen Portal. Do not add,
// rename, reorder, or alias any entry without updating both apps.
export type PermitType =
  | 'Building Permit – New Construction'
  | 'Building Permit – Renovation / Alteration'
  | 'Building Permit – Addition / Extension'
  | 'Demolition Permit'
  | 'Zoning / Locational Clearance'
  | 'Architectural Permit'
  | 'Civil / Structural Permit'
  | 'Electrical Permit'
  | 'Mechanical Permit'
  | 'Sanitary Permit'
  | 'Plumbing Permit'
  | 'Electronics Permit'
  | 'Interior Design Permit'
  | 'Fencing Permit'
  | 'Sign Permit'
  | 'Excavation Permit'
  | 'FSEC for Building Permit (BFP)'
  | 'Certificate of Occupancy'
  | 'FSIC for Occupancy Permit (BFP)';

export const ALL_PERMIT_TYPES: PermitType[] = [
  'Building Permit – New Construction',
  'Building Permit – Renovation / Alteration',
  'Building Permit – Addition / Extension',
  'Demolition Permit',
  'Zoning / Locational Clearance',
  'Architectural Permit',
  'Civil / Structural Permit',
  'Electrical Permit',
  'Mechanical Permit',
  'Sanitary Permit',
  'Plumbing Permit',
  'Electronics Permit',
  'Interior Design Permit',
  'Fencing Permit',
  'Sign Permit',
  'Excavation Permit',
  'FSEC for Building Permit (BFP)',
  'Certificate of Occupancy',
  'FSIC for Occupancy Permit (BFP)',
];

/** Groupings used only for the Permit Services catalog UI — mirrors ebpco-mobile's applications_screen.dart grouping. Not a separate data domain. */
export const PERMIT_TYPE_GROUPS: { label: string; types: PermitType[] }[] = [
  {
    label: 'Building Permit',
    types: [
      'Building Permit – New Construction',
      'Building Permit – Renovation / Alteration',
      'Building Permit – Addition / Extension',
      'Demolition Permit',
      'Zoning / Locational Clearance',
    ],
  },
  {
    label: 'Ancillary Permits',
    types: [
      'Architectural Permit',
      'Civil / Structural Permit',
      'Electrical Permit',
      'Mechanical Permit',
      'Sanitary Permit',
      'Plumbing Permit',
      'Electronics Permit',
      'Interior Design Permit',
    ],
  },
  {
    label: 'Other Permits',
    types: ['Fencing Permit', 'Sign Permit', 'Excavation Permit'],
  },
  {
    label: 'Certificates',
    types: ['FSEC for Building Permit (BFP)', 'Certificate of Occupancy', 'FSIC for Occupancy Permit (BFP)'],
  },
];

const ALL_PERMIT_TYPES_SET: ReadonlySet<string> = new Set(ALL_PERMIT_TYPES);

export function isValidPermitType(value: string): value is PermitType {
  return ALL_PERMIT_TYPES_SET.has(value);
}

export type ApplicationAction = 'New' | 'Renewal' | 'Amendment';

/**
 * Where a permit record came from. This is the ONLY signal that may clear the
 * "not a real permit" watermark on a printed document, so it must never be
 * derivable from anything a portal user can drive themselves.
 *
 * 'demo'   — minted in-browser by the demo lifecycle advance, or seeded. No
 *            office reviewed it and no office issued it.
 * 'issued' — genuinely issued by the LGU and read back from the backend.
 *            NOTHING sets this today; it is the seam the backend will fill.
 *
 * While there is no backend, every record is 'demo' and every printed document
 * is therefore watermarked. That is the correct behaviour, not a placeholder.
 */
export type PermitProvenance = 'demo' | 'issued';

/**
 * The issuing office's own word on whether a permit is currently good.
 *
 * This exists because the public verification page must NOT compute validity.
 * It used to: given an issued permit that had not expired, it returned 'Valid'.
 * That derivation has no term for revocation, so the moment a backend sets
 * `provenance: 'issued'`, a permit the Municipality had REVOKED would have been
 * reported to the public as Valid. Nobody would have had to make a mistake for
 * that to happen — it was the default.
 *
 * A verification surface can only relay what the office says. So this is the
 * office's answer, and `null` means the office has not given one.
 *
 * The values are what this PAGE can render, not a claim about Castilla's
 * lifecycle — that belongs to the backend and has not been settled (see
 * SWEEP-2026-08-31.md, L-2). `isPermitStanding()` fails closed on anything
 * else, so a state we have not been told about renders as Unverified rather
 * than as Valid. Extend the union when the LGU's revocation model is defined;
 * do NOT widen the guard to accept unknown strings.
 */
export type PermitStanding = 'Valid' | 'Revoked' | 'Suspended' | 'Cancelled';

const PERMIT_STANDINGS: readonly string[] = ['Valid', 'Revoked', 'Suspended', 'Cancelled'];

export function isPermitStanding(value: unknown): value is PermitStanding {
  return typeof value === 'string' && PERMIT_STANDINGS.includes(value);
}

/**
 * Every permit type that can arrive on the wire — the office's nineteen
 * construction permits PLUS `'Business Permit'`. **Twenty, not nineteen.**
 *
 * D-10 made the office's nineteen names the server's keys but deliberately did
 * NOT remove `'Business Permit'`: the legacy business-permit flow still files
 * against it, and `033_permit_vocabulary.sql` says so in as many words —
 * *"Deleting it here would strand that flow."*
 *
 * The mobile lane held a nineteen-value union and hit exactly this: validation
 * failed, the type came through `null`, and those applications rendered as
 * "Not recorded" — the client claiming not to know something the server had
 * said plainly. Nothing threw. 443 tests stayed green.
 *
 * This portal was worse. It carried nineteen plus a literal
 * `'Business Permit'` — a THIRD spelling, invented here, that no server
 * has ever sent and none would accept. That is the "cast" the D-10 migration
 * complains about: a spelling with no authority, in a place no client can see.
 *
 * If a twenty-first value ever appears, add it here and nowhere else.
 */
export type PublishedPermitType = PermitType | 'Business Permit';

export interface GeneratedPermit {
  applicationId: string;
  permitNumber: string;
  provenance: PermitProvenance;
  /**
   * NOTHING sets this today, exactly like `provenance`. It is the seam the
   * backend fills, and until it does the verification page reports Unverified.
   */
  standing: PermitStanding | null;
  issuedDateValue: Date;
  issuedDate: string;
  expiryDateValue: Date | null;
  expiryDate: string | null;
  approvingOfficial: string;
  approvingOffice: string;
}
