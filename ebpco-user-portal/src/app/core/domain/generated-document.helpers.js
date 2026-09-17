/** Republic/Province/Municipality (OBO or Zoning) vs. DILG/BFP header — decided from the same real `reviewingOffice` string requirements-catalog.ts already carries for every permit type, not a second hardcoded lookup. */
export function agencyHeaderFor(reviewingOffice) {
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
/** Splits "Building Permit – New Construction" into a title + scope subtitle (matching the Admin Portal's document heading style); every other permit type's full name is already a clean standalone title. */
export function documentTitleFor(permitType) {
    if (permitType.includes('–')) {
        const [title, subtitle] = permitType.split('–').map((s) => s.trim());
        return { title, subtitle: subtitle.toUpperCase() };
    }
    return { title: permitType, subtitle: null };
}
