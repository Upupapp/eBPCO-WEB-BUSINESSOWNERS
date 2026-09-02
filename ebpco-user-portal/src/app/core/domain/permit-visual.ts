// Icon + accent-color mapping for a permit type, keyed by substring — shared
// between the dashboard's "Recent Applications" list and the Permit Services
// catalog so the same permit type always reads with the same icon/color in
// both places. Paths are drawn in the Lucide visual style (24x24, round
// caps/joins) rather than pulling in lucide-angular, which doesn't yet
// support this app's Angular version.
export const PERMIT_VISUAL_ICONS = {
  building: [
    'M4 21V7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v14',
    'M15 21V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v17',
    'M4 21h17',
    'M8 9h.01',
    'M8 13h.01',
    'M8 17h.01',
    'M18 9h.01',
    'M18 13h.01',
    'M18 17h.01',
  ],
  mapPin: ['M12 18.5S5 13 5 8.5a7 7 0 0 1 14 0c0 4.5-7 10-7 10Z', 'M12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  zap: ['M13 3 5 13.5h5.5L11 21l8-10.5h-5.5L13 3Z'],
  wrench: ['M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4L15 12l-3-3 2.7-2.7Z'],
  droplet: ['M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9Z'],
  badgeCheck: [
    'm9 12 2 2 4-4',
    'M12 3.5 13.8 5l2.5-.3.6 2.5 2.3 1.1-1 2.4 1 2.4-2.3 1.1-.6 2.5-2.5-.3L12 20.5 10.2 19l-2.5.3-.6-2.5-2.3-1.1 1-2.4-1-2.4 2.3-1.1.6-2.5 2.5.3Z',
  ],
  settings: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    'M12 2v3',
    'M12 19v3',
    'M4.2 4.2l2.1 2.1',
    'M17.7 17.7l2.1 2.1',
    'M2 12h3',
    'M19 12h3',
    'M4.2 19.8l2.1-2.1',
    'M17.7 6.3l2.1-2.1',
  ],
  fileText: ['M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z', 'M14 3v4h4', 'M9 13h6', 'M9 17h6'],
} as const;

export interface PermitVisual {
  icon: readonly string[];
  bg: string;
  fg: string;
}

/** Icon + color mapping for a permit, keyed by permit type substring. */
export function permitVisual(permitType: string): PermitVisual {
  const value = permitType.toLowerCase();
  if (value.includes('building') || value.includes('demolition')) {
    return { icon: PERMIT_VISUAL_ICONS.building, bg: '#FFF0F3', fg: '#F0173A' };
  }
  if (value.includes('zoning') || value.includes('locational')) {
    return { icon: PERMIT_VISUAL_ICONS.mapPin, bg: '#ECF8F0', fg: '#13924B' };
  }
  if (value.includes('electrical') || value.includes('electronics')) {
    return { icon: PERMIT_VISUAL_ICONS.zap, bg: '#FFF7E8', fg: '#E58A00' };
  }
  if (value.includes('plumbing')) {
    return { icon: PERMIT_VISUAL_ICONS.wrench, bg: '#EEF6FF', fg: '#1E73D1' };
  }
  if (value.includes('sanitary')) {
    return { icon: PERMIT_VISUAL_ICONS.droplet, bg: '#ECF8F0', fg: '#13924B' };
  }
  if (value.includes('occupancy') || value.includes('fsic') || value.includes('fsec')) {
    return { icon: PERMIT_VISUAL_ICONS.badgeCheck, bg: '#FFF7E8', fg: '#E58A00' };
  }
  if (
    value.includes('mechanical') ||
    value.includes('civil') ||
    value.includes('structural') ||
    value.includes('architectural') ||
    value.includes('interior') ||
    value.includes('fencing') ||
    value.includes('sign') ||
    value.includes('excavation')
  ) {
    return { icon: PERMIT_VISUAL_ICONS.settings, bg: '#EEF6FF', fg: '#1E73D1' };
  }
  return { icon: PERMIT_VISUAL_ICONS.fileText, bg: '#F1F3F7', fg: '#4B5C74' };
}
