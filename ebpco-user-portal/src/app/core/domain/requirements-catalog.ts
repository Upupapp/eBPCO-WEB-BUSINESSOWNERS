import { ALL_PERMIT_TYPES, PermitType } from './permit.model';

// The single source of truth for "what documents does permit type X need."
// Transcribed directly from the Admin Portal's
// core/domain/requirements-catalog.ts — same 19 entries, same document
// labels/required flags, same verification-status honesty convention. Do
// not invent or drop a document here without updating the Admin Portal's
// copy too; the two must stay in sync until a shared backend serves both.
export interface RequirementDocument {
  id: string;
  label: string;
  required: boolean;
  description?: string;
}

export type SourceVerificationStatus = 'CASTILLA_OFFICIAL_FORM_VERIFIED' | 'PENDING_CASTILLA_VERIFICATION';

export interface ApplicationTypeRequirements {
  permitType: PermitType;
  requiredForm: string;
  documents: RequirementDocument[];
  reviewingOffice: string;
  validityMonths: number | null;
  validityRules: string;
  verificationStatus: SourceVerificationStatus;
  sourceNote: string;
}

function doc(id: string, label: string, required: boolean, description?: string): RequirementDocument {
  return { id, label, required, description };
}

const COMMON_DOCS: RequirementDocument[] = [
  doc('land-title', 'Land Title or Tax Declaration of the property', true),
  doc('owner-consent', "Owner's Written Consent (if applicant is not the lot owner)", false),
  doc('brgy-clearance', 'Barangay Clearance', true),
  doc('locational', 'Locational Clearance / Zoning Certification', true),
  doc('valid-id', 'Valid Government-Issued ID of Applicant/Owner', true),
];

const COMMON_DOCS_NO_LOCATIONAL: RequirementDocument[] = COMMON_DOCS.filter((d) => d.id !== 'locational');

const PENDING_NOTE =
  "Documentary requirements follow the generic national-law/reference format (PD 1096 for building-related permits, RA 9514 for fire-safety permits); the Municipality of Castilla's own confirmed checklist for this specific permit type is still pending verification with the OBO — confirm before production launch.";

export const REQUIREMENTS_CATALOG: Record<PermitType, ApplicationTypeRequirements> = {
  'Building Permit – New Construction': {
    permitType: 'Building Permit – New Construction',
    requiredForm: 'Unified Building Permit Form',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance; work must commence within one year or the permit lapses and must be renewed.',
    verificationStatus: 'CASTILLA_OFFICIAL_FORM_VERIFIED',
    sourceNote: "Transcribed directly from the Municipality of Castilla Office of the Municipal Engineer's own \"Building Permit Documentary Requirements\" checklist.",
    documents: [
      doc('bpnc-oct-tct', 'Certified True Copy of OCT/TCT', true, 'Or Deed of Sale, Deed of Donation, Lease Contract, or Assignment of Rights if not the registered owner.'),
      doc('bpnc-survey-plan', 'Survey Plan', true),
      doc('bpnc-design-plans', 'Design Plans (duly signed and sealed)', true, 'Architectural, Civil/Structural, Electrical, Sanitary/Plumbing, and Mechanical as applicable.'),
      doc('bpnc-unified-form', 'Unified Building Permit Form', true),
      doc('bpnc-ancillary-electrical', 'Electrical Permit (ancillary application form)', false, 'If the project scope includes electrical work.'),
      doc('bpnc-ancillary-fencing', 'Fencing Permit (ancillary application form)', false, 'If the project scope includes fencing.'),
      doc('bpnc-ancillary-architectural', 'Architectural Permit (ancillary application form)', false),
      doc('bpnc-ancillary-sanitary-plumbing', 'Sanitary/Plumbing Permit (ancillary application form)', false, 'If the project scope includes sanitary/plumbing work.'),
      doc('bpnc-ancillary-mechanical', 'Mechanical Permit (ancillary application form)', false, 'If the project scope includes mechanical work.'),
      doc('bpnc-ancillary-civil-structural', 'Civil/Structural Permit (ancillary application form)', false),
      doc('bpnc-ancillary-excavation', 'Excavation Permit (ancillary application form)', false, 'If the project scope includes excavation.'),
      doc('bpnc-ancillary-electronics', 'Electronics Permit (ancillary application form)', false, 'If the project scope includes electronics/communications installation.'),
      doc('bpnc-cost-estimate', 'Cost Estimate (duly signed and sealed)', true),
      doc('bpnc-technical-specs', 'Technical Specifications (duly signed and sealed)', true),
      doc('bpnc-structural-design-analysis', 'Structural Design and Analysis', true),
      doc('bpnc-soil-analysis', 'Soil Analysis / Plate Load Test / Seismic Analysis', true),
      doc('bpnc-professional-licenses', 'Valid Licenses (PRC) of all involved professionals', true),
      doc('bpnc-valid-id', 'Valid ID of Applicant and Owner of Lot', true),
      doc('bpnc-zoning-locational', 'Zoning / Locational Clearance', true, 'Issued by MPDC.'),
      doc('bpnc-fire-safety-clearance', 'Fire Safety Evaluation Clearance', true, 'Issued by BFP.'),
      doc('bpnc-construction-safety-health', 'Approved Construction Safety and Health Program', true, 'Issued by DOLE.'),
      doc('bpnc-road-clearance', 'Road Clearance', true, 'Issued by DPWH/PEO.'),
    ],
  },
  'Building Permit – Renovation / Alteration': {
    permitType: 'Building Permit – Renovation / Alteration',
    requiredForm: 'Application for Building Permit (Renovation / Alteration)',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('renovation-plan', 'Renovation/Alteration Plans (signed and sealed)', true),
      doc('renovation-existing-permit', 'Copy of Original Building Permit (if available)', false),
      doc('renovation-bom', 'Bill of Materials and Specifications', true),
      doc('renovation-prc', 'PRC License and PTR of Engineer/Architect of Record', true),
    ],
  },
  'Building Permit – Addition / Extension': {
    permitType: 'Building Permit – Addition / Extension',
    requiredForm: 'Application for Building Permit (Addition / Extension)',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('addition-plan', 'Addition / Extension Plans (signed and sealed)', true),
      doc('addition-struct-plan', 'Structural Analysis for the added load (signed and sealed)', true),
      doc('addition-bom', 'Bill of Materials and Specifications', true),
      doc('addition-prc', 'PRC License and PTR of Engineer/Architect of Record', true),
    ],
  },
  'Demolition Permit': {
    permitType: 'Demolition Permit',
    requiredForm: 'Application for Demolition Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 6,
    validityRules: 'Valid for six (6) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('demolition-method', 'Method of Demolition / Work Plan', true),
      doc('demolition-safety', 'Structural Safety Assessment and Safety Measures Plan', true),
      doc('demolition-prc', 'PRC License and PTR of Engineer of Record', true),
      doc('demolition-utility-clearance', 'Utility Disconnection Clearance (water/power)', false),
    ],
  },
  'Zoning / Locational Clearance': {
    permitType: 'Zoning / Locational Clearance',
    requiredForm: 'Application for Locational Clearance / Certificate of Zoning Compliance (Form FM-MPD-12)',
    reviewingOffice: 'Municipal Planning and Development Office (MPDO / Zoning)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance, per standard LGU clearance practice.',
    verificationStatus: 'CASTILLA_OFFICIAL_FORM_VERIFIED',
    sourceNote: "Transcribed directly from the Municipality of Castilla's own MPDO form FM-MPD-12. This clearance is itself a prerequisite document for most other permit types.",
    documents: [
      ...COMMON_DOCS_NO_LOCATIONAL,
      doc('zoning-letter-request', 'Notarized Letter Request addressed to the Zoning Administrator', true),
      doc('zoning-site-plan', 'Site Development Plan', true),
      doc('zoning-vicinity-map', 'Vicinity Map', true),
      doc('zoning-sketch-plan', 'Sketch Plan of the House', true),
      doc('zoning-bom', 'Bill of Materials', true),
      doc('zoning-ownership', 'Proof of Ownership', true),
      doc('zoning-tax-dec', 'Tax Declaration / Certificate of Title (COT) / OCT', true),
      doc('zoning-land-tax', 'Land Tax Receipt (Current Year)', true),
      doc('zoning-brgy-building-clearance', 'Barangay Building Clearance', true),
      doc('zoning-cedula', 'Cedula (Photocopy)', true),
      doc('zoning-dpwh', 'DPWH Clearance (if applicable)', false),
      doc('zoning-ecc', 'Environmental Compliance Certificate / ECC (if applicable)', false),
    ],
  },
  'Architectural Permit': {
    permitType: 'Architectural Permit',
    requiredForm: 'Application for Architectural Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('arch-plan', 'Architectural Plans (signed and sealed)', true),
      doc('arch-prc', 'PRC License and PTR of Architect of Record', true),
    ],
  },
  'Civil / Structural Permit': {
    permitType: 'Civil / Structural Permit',
    requiredForm: 'Application for Civil / Structural Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('struct-plan', 'Structural Plans (signed and sealed)', true),
      doc('struct-analysis', 'Structural Design Analysis', true),
      doc('struct-prc', 'PRC License and PTR of Civil Engineer of Record', true),
    ],
  },
  'Electrical Permit': {
    permitType: 'Electrical Permit',
    requiredForm: 'Application for Electrical Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('elec-plan', 'Electrical Plans (signed and sealed)', true),
      doc('elec-prc', 'PRC License and PTR of Professional Electrical Engineer of Record', true),
    ],
  },
  'Mechanical Permit': {
    permitType: 'Mechanical Permit',
    requiredForm: 'Application for Mechanical Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('mech-plan', 'Mechanical Plans (signed and sealed)', true),
      doc('mech-prc', 'PRC License and PTR of Professional Mechanical Engineer of Record', true),
    ],
  },
  'Sanitary Permit': {
    permitType: 'Sanitary Permit',
    requiredForm: 'Application for Sanitary Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('sanplumb-plan', 'Sanitary / Plumbing Plans (signed and sealed)', true),
      doc('sanplumb-prc', 'PRC License and PTR of Sanitary Engineer/Master Plumber of Record', true),
    ],
  },
  'Plumbing Permit': {
    permitType: 'Plumbing Permit',
    requiredForm: 'Application for Plumbing Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('plumb-plan', 'Plumbing Layout Plans (signed and sealed)', true),
      doc('plumb-prc', 'PRC License and PTR of Master Plumber of Record', true),
    ],
  },
  'Electronics Permit': {
    permitType: 'Electronics Permit',
    requiredForm: 'Application for Electronics Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('electronics-plan', 'Electronics/Communications Layout Plans (signed and sealed)', true),
      doc('electronics-prc', 'PRC License and PTR of Professional Electronics Engineer of Record', true),
    ],
  },
  'Interior Design Permit': {
    permitType: 'Interior Design Permit',
    requiredForm: 'Application for Interior Design Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('interior-plan', 'Interior Design Layout Plans (signed and sealed)', true),
      doc('interior-prc', 'PRC License and PTR of Interior Designer of Record', true),
    ],
  },
  'Fencing Permit': {
    permitType: 'Fencing Permit',
    requiredForm: 'Application for Fencing Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 6,
    validityRules: 'Valid for six (6) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [...COMMON_DOCS, doc('fencing-plan', 'Fence Plan / Site Development Plan', true)],
  },
  'Sign Permit': {
    permitType: 'Sign Permit',
    requiredForm: 'Application for Signboard/Billboard Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 12,
    validityRules: 'Valid for twelve (12) months from issuance; subject to annual renewal.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('sign-plan', 'Sign Design and Structural Detail (if elevated or free-standing)', true),
      doc('sign-prc', 'PRC License and PTR of Engineer of Record (required for elevated/structural signs)', false),
    ],
  },
  'Excavation Permit': {
    permitType: 'Excavation Permit',
    requiredForm: 'Application for Excavation Permit',
    reviewingOffice: 'Office of the Building Official (OBO)',
    validityMonths: 6,
    validityRules: 'Valid for six (6) months from issuance.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('excavation-plan', 'Excavation/Site Development Plan', true),
      doc('excavation-geotech', 'Geotechnical/Soil Assessment (if excavation exceeds regulated depth)', false),
      doc('excavation-prc', 'PRC License and PTR of Engineer of Record', true),
    ],
  },
  'FSEC for Building Permit (BFP)': {
    permitType: 'FSEC for Building Permit (BFP)',
    requiredForm: 'Fire Safety Evaluation Clearance Application Form (BFP-QSF-FSED-001, BFP Castilla Fire Station)',
    reviewingOffice: 'Bureau of Fire Protection — Castilla Fire Station',
    validityMonths: 12,
    validityRules: 'Serves as a prerequisite to Building Permit issuance under RA 9514; the form itself prints no fixed validity/expiry period.',
    verificationStatus: 'CASTILLA_OFFICIAL_FORM_VERIFIED',
    sourceNote: 'Transcribed directly from the actual BFP Castilla Fire Station FSEC application form (BFP-QSF-FSED-001). An authorized representative must present an authorization letter and a copy of the owner\'s ID.',
    documents: [
      ...COMMON_DOCS,
      doc('fsec-plan-set', 'Three (3) complete sets of proposed plans: Architectural, Civil/Structural, Electrical, Mechanical, Plumbing, Electronics, Sanitary, and Fire Protection documents', true),
      doc('fsec-fscr', 'Fire Safety Compliance Report (FSCR), one (1) set (if necessary)', false),
      doc('fsec-cost-estimate', 'Cost Estimate of the building, including labor cost, signed, sealed, and notarized, one (1) set', true),
      doc('fsec-hotworks-clearance', 'Fire Safety Clearance for Welding, Cutting, and other Hot Work Operations (if required)', false),
    ],
  },
  'Certificate of Occupancy': {
    permitType: 'Certificate of Occupancy',
    requiredForm: 'Application for Certificate of Occupancy',
    reviewingOffice: 'Office of the Building Official (OBO) / BFP',
    validityMonths: null,
    validityRules: 'Valid for the life of the structure unless a change in use, occupancy, or ownership requires re-certification.',
    verificationStatus: 'PENDING_CASTILLA_VERIFICATION',
    sourceNote: PENDING_NOTE,
    documents: [
      ...COMMON_DOCS,
      doc('coo-asbuilt', 'As-Built Plans', true),
      doc('coo-completion', 'Certificate of Completion', true),
      doc('coo-fsic', 'Fire Safety Inspection Certificate (final)', true),
      doc('coo-electrical-final', 'Certificate of Final Electrical Inspection', true),
    ],
  },
  'FSIC for Occupancy Permit (BFP)': {
    permitType: 'FSIC for Occupancy Permit (BFP)',
    requiredForm: 'Fire Safety Inspection Certificate Application Form — FSIC for Certificate of Occupancy (BFP-QSF-FSED-002, BFP Castilla Fire Station)',
    reviewingOffice: 'Bureau of Fire Protection — Castilla Fire Station',
    validityMonths: 12,
    validityRules: 'A final FSIC is a statutory prerequisite to a Certificate of Occupancy under RA 9514 Sec. 5(g)/7(a); the form prints no fixed validity/expiry period.',
    verificationStatus: 'CASTILLA_OFFICIAL_FORM_VERIFIED',
    sourceNote: 'Transcribed directly from the actual BFP Castilla Fire Station FSIC application form (BFP-QSF-FSED-002), "FSIC FOR CERTIFICATE OF OCCUPANCY" section.',
    documents: [
      ...COMMON_DOCS,
      doc('fsic-asbuilt', 'As-Built Plan (if necessary)', false),
      doc('fsic-obo-endorsement', 'Endorsement from the Office of the Building Official (OBO)', true),
      doc('fsic-completion-cert', 'Certificate of Completion', true),
      doc('fsic-assessment-copy', 'Certified True Copy of the Assessment Fee for securing the Certificate of Occupancy from OBO', true),
      doc('fsic-fsccr', 'Fire Safety Compliance and Commissioning Report (FSCCR), one (1) set (if necessary)', false),
    ],
  },
};

export function requirementsFor(permitType: PermitType): ApplicationTypeRequirements {
  return REQUIREMENTS_CATALOG[permitType];
}

/** The simpler, fixed 3-item checklist used only by the generic New Application wizard (Section 8 of the master command) — kept separate from the 19-type catalog above, never merged into it. */
export const GENERIC_APPLICATION_DOCUMENTS: RequirementDocument[] = [
  doc('generic-valid-id', 'Valid Government ID', true),
  doc('generic-brgy-clearance', 'Barangay Clearance', true),
  doc('generic-proof-address', 'Proof of Business Address', true),
];

export function assertCatalogComplete(): void {
  for (const type of ALL_PERMIT_TYPES) {
    if (!REQUIREMENTS_CATALOG[type]) {
      throw new Error(`REQUIREMENTS_CATALOG is missing an entry for permit type "${type}"`);
    }
  }
}
