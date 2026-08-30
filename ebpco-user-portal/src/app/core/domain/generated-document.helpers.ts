import { PermitType } from './permit.model';

// Small, honest helpers for the applicant-facing generated permit document
// (features/applications/permit-document.page.ts) — deliberately leaner
// than the Admin Portal's own generated-document.config.ts (16-component
// library + per-type technical-field config), since this portal has no
// staff "technical data" intake at all: an applicant can't verify their
// own floor area/equipment schedules, so there is no genuine data source
// for those fields here. This portal's document sticks to what it can
// honestly populate — identity, property (from the linked Business
// record), assessment, and approval — never inventing the rest.

export interface AgencyHeaderInfo {
  line1: string;
  line2: string;
  line3?: string;
  officeLine: string;
  isBfp: boolean;
}

/** Republic/Province/Municipality (OBO or Zoning) vs. DILG/BFP header — decided from the same real `reviewingOffice` string requirements-catalog.ts already carries for every permit type, not a second hardcoded lookup. */
export function agencyHeaderFor(reviewingOffice: string): AgencyHeaderInfo {
  const isBfp = /fire protection|bfp/i.test(reviewingOffice);
  if (isBfp) {
    return {
      line1: 'Republic of the Philippines',
      line2: 'Department of the Interior and Local Government',
      line3: 'Bureau of Fire Protection',
      officeLine: reviewingOffice,
      isBfp: true,
    };
  }
  return {
    line1: 'Republic of the Philippines',
    line2: 'Province of Sorsogon',
    line3: 'Municipality of Castilla',
    officeLine: reviewingOffice,
    isBfp: false,
  };
}

export interface DocumentTitleInfo {
  title: string;
  subtitle: string | null;
}

/** Splits "Building Permit – New Construction" into a title + scope subtitle (matching the Admin Portal's document heading style); every other permit type's full name is already a clean standalone title. */
export function documentTitleFor(permitType: PermitType | 'General Business Permit'): DocumentTitleInfo {
  if (permitType.includes('–')) {
    const [title, subtitle] = permitType.split('–').map((s) => s.trim());
    return { title, subtitle: subtitle.toUpperCase() };
  }
  return { title: permitType, subtitle: null };
}
