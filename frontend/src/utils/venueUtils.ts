import type { GroundDTO } from '@be11/shared';

export const PLAYNOW_CANONICAL_DATA = {
  name: 'Playnow Cricket Ground',
  slug: 'playnow-cricket-ground',
  city: 'Gurugram',
  state: 'Haryana',
  country: 'India',
  location: 'Gurugram, Haryana',
  address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
  latitude: 28.403646,
  longitude: 77.136787,
  mapsUrl: 'https://maps.app.goo.gl/omqt5t5SVrkQTMGV9',
};

/**
 * Normalizes ground objects to ensure canonical location metadata for verified venues.
 */
export function normalizeVenue<T extends Record<string, any>>(ground: T): T {
  if (!ground) return ground;
  const g = ground as Record<string, any>;
  const isPlaynow =
    g.slug === 'playnow-cricket-ground' ||
    g.slug === 'playnow-cricket-ground-sector-86-gurugram' ||
    g.id === '8597cac9-2d50-4d71-9f16-60c1c8132ed7' ||
    (typeof g.name === 'string' && g.name.toLowerCase().includes('playnow'));

  if (isPlaynow) {
    return {
      ...ground,
      name: PLAYNOW_CANONICAL_DATA.name,
      slug: PLAYNOW_CANONICAL_DATA.slug,
      location: PLAYNOW_CANONICAL_DATA.location,
      address: PLAYNOW_CANONICAL_DATA.address,
      city: PLAYNOW_CANONICAL_DATA.city,
      state: PLAYNOW_CANONICAL_DATA.state,
      country: PLAYNOW_CANONICAL_DATA.country,
      latitude: PLAYNOW_CANONICAL_DATA.latitude,
      longitude: PLAYNOW_CANONICAL_DATA.longitude,
      mapsUrl: PLAYNOW_CANONICAL_DATA.mapsUrl,
    };
  }
  return ground;
}

/**
 * Normalizes an array of grounds.
 */
export function normalizeVenuesList<T extends Record<string, any>>(grounds: T[]): T[] {
  if (!Array.isArray(grounds)) return [];
  return grounds.map((g) => normalizeVenue(g));
}

export type { GroundDTO };
