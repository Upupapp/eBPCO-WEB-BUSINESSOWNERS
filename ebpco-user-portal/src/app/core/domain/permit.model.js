export const ALL_PERMIT_TYPES = [
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
export const PERMIT_TYPE_GROUPS = [
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
const ALL_PERMIT_TYPES_SET = new Set(ALL_PERMIT_TYPES);
export function isValidPermitType(value) {
    return ALL_PERMIT_TYPES_SET.has(value);
}
const PERMIT_STANDINGS = ['Valid', 'Revoked', 'Suspended', 'Cancelled'];
export function isPermitStanding(value) {
    return typeof value === 'string' && PERMIT_STANDINGS.includes(value);
}
