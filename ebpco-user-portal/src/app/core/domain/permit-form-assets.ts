import { PermitType } from './permit.model';

// Maps each permit type to the real, official Municipality of
// Castilla / BFP Castilla application form it uses — sourced directly
// from assets/LGU Castilla BPCO Forms/ (the same source referenced by
// requirements-catalog.ts), bundled here at public/assets/permit-forms/.
// This is the OFFICIAL BLANK FORM for that permit type, not a generated,
// personalized certificate — the Preview action on Application Details
// must be labeled accordingly so an applicant never mistakes it for their
// actual issued permit (this app has no document-generation backend to
// produce that; see master command Section 15).
export interface PermitFormAsset {
  fileName: string;
  label: string;
  /** True when this permit type has no dedicated Castilla form on file and falls back to the generic Unified Application Form. */
  isFallback: boolean;
}

const unifiedFallback: PermitFormAsset = {
  fileName: 'assets/permit-forms/unified-application-form.pdf',
  label: 'Unified Application Form',
  isFallback: true,
};

export const PERMIT_FORM_ASSETS: Record<PermitType, PermitFormAsset> = {
  'Building Permit – New Construction': {
    fileName: 'assets/permit-forms/unified-application-form.pdf',
    label: 'Unified Application Form',
    isFallback: false,
  },
  'Building Permit – Renovation / Alteration': {
    fileName: 'assets/permit-forms/unified-application-form.pdf',
    label: 'Unified Application Form',
    isFallback: false,
  },
  'Building Permit – Addition / Extension': {
    fileName: 'assets/permit-forms/unified-application-form.pdf',
    label: 'Unified Application Form',
    isFallback: false,
  },
  'Demolition Permit': unifiedFallback,
  'Zoning / Locational Clearance': {
    fileName: 'assets/permit-forms/zoning-locational-form.pdf',
    label: 'Application for Locational Clearance (Form FM-MPD-12)',
    isFallback: false,
  },
  'Architectural Permit': unifiedFallback,
  'Civil / Structural Permit': {
    fileName: 'assets/permit-forms/structural-form.pdf',
    label: 'Structural Permit Form',
    isFallback: false,
  },
  'Electrical Permit': {
    fileName: 'assets/permit-forms/electrical-form.pdf',
    label: 'Electrical Permit Form',
    isFallback: false,
  },
  'Mechanical Permit': {
    fileName: 'assets/permit-forms/mechanical-form.pdf',
    label: 'Mechanical Permit Form',
    isFallback: false,
  },
  'Sanitary Permit': {
    fileName: 'assets/permit-forms/sanitary-form.pdf',
    label: 'Sanitary Permit Form',
    isFallback: false,
  },
  'Plumbing Permit': {
    fileName: 'assets/permit-forms/plumbing-form.pdf',
    label: 'Plumbing Permit Form',
    isFallback: false,
  },
  'Electronics Permit': {
    fileName: 'assets/permit-forms/electronics-form.pdf',
    label: 'Electronics Permit Form',
    isFallback: false,
  },
  'Interior Design Permit': unifiedFallback,
  'Fencing Permit': {
    fileName: 'assets/permit-forms/fencing-permit-form.pdf',
    label: 'Fencing Permit Form',
    isFallback: false,
  },
  'Sign Permit': unifiedFallback,
  'Excavation Permit': {
    fileName: 'assets/permit-forms/excavation-form.pdf',
    label: 'Excavation Permit Form',
    isFallback: false,
  },
  'FSEC for Building Permit (BFP)': {
    fileName: 'assets/permit-forms/fsec-building-permit-bfp.pdf',
    label: 'Fire Safety Evaluation Clearance Application Form (BFP-QSF-FSED-001)',
    isFallback: false,
  },
  'Certificate of Occupancy': {
    fileName: 'assets/permit-forms/building-permit-occupancy-checklist.pdf',
    label: 'Building Permit & Occupancy Documentary Checklist',
    isFallback: false,
  },
  'FSIC for Occupancy Permit (BFP)': {
    fileName: 'assets/permit-forms/fsic-occupancy-permit-bfp.pdf',
    label: 'Fire Safety Inspection Certificate Application Form (BFP-QSF-FSED-002)',
    isFallback: false,
  },
};

export function permitFormAssetFor(permitType: PermitType | 'General Business Permit'): PermitFormAsset {
  if (permitType === 'General Business Permit') return unifiedFallback;
  return PERMIT_FORM_ASSETS[permitType];
}
