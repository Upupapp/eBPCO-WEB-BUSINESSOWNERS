// The single, fixed, complete list of permit types this system supports.
// Mirrors EBPCO WEB ADMIN/E-BPCO-Software-main's core/domain/permit.model.ts
// exactly (PermitType union + ALL_PERMIT_TYPES order) — this is the shared
// contract between the Admin Portal and this User Portal. Do not add,
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

export interface GeneratedPermit {
  applicationId: string;
  permitNumber: string;
  issuedDateValue: Date;
  issuedDate: string;
  expiryDateValue: Date | null;
  expiryDate: string | null;
  approvingOfficial: string;
  approvingOffice: string;
}
