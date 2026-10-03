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
  mapsUrl: 'https://maps.app.goo.gl/x6HeybuKuDvSvzDYA',
};

/**
 * Normalizes ground objects to ensure canonical location metadata for verified venues.
 */
export function normalizeVenue<T extends Record<string, any>>(ground: T): T {
  if (!ground) return ground;
  const g = ground as Record<string, any>;
  if (g.slug === 'playnow-cricket-ground' || g.name === 'Playnow Cricket Ground') {
    return {
      ...ground,
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
