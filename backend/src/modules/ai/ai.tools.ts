import { prisma } from '../../config/db.js';

function withTimeout<T>(promise: Promise<T>, ms: number = 600): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)),
  ]);
}

export interface ToolExecutionResult {
  tool: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class AiTools {
  /**
   * Retrieves active venues with pricing labels and location summary.
   */
  public static async getVenues(params: { sport?: string; city?: string } = {}): Promise<ToolExecutionResult> {
    try {
      const filter: any = { isActive: true };
      if (params.sport && params.sport !== 'All') {
        filter.sport = params.sport;
      }
      if (params.city && params.city !== 'All') {
        filter.city = params.city;
      }

      const grounds = await withTimeout(
        prisma.ground.findMany({
          where: filter,
          select: {
            id: true,
            name: true,
            slug: true,
            sport: true,
            city: true,
            state: true,
            location: true,
            address: true,
            pricePerHour: true,
            pricingLabel: true,
            rating: true,
            amenities: true,
            ownerName: true,
            ownerPhone: true,
          },
          orderBy: { name: 'asc' },
        })
      );

      const defaultVenues = [
        {
          id: 'rrr-cricket-club-kidawali-faridabad',
          slug: 'rrr-cricket-club-kidawali-faridabad',
          name: 'RRR Cricket Club Kidawali Faridabad',
          sport: 'Cricket',
          city: 'Faridabad',
          location: 'Kidawali, Pusta Road, Faridabad',
          pricePerHour: 0,
          pricingLabel: '3 Fixed Match Periods (₹299 / ₹2,600 / ₹5,000)',
          ownerName: 'Rishi',
          ownerPhone: '+91 97116 69718',
          amenities: ['Turf Pitch', 'Practice Nets', 'Floodlights', 'Pavilion'],
          url: '/venues/rrr-cricket-club-kidawali-faridabad',
        },
        {
          id: 'playnow-cricket-ground',
          slug: 'playnow-cricket-ground',
          name: 'Playnow Cricket Ground',
          sport: 'Cricket',
          city: 'Gurugram',
          location: 'Gurugram, Haryana',
          address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
          pricePerHour: 5000,
          pricingLabel: 'Weekday/Weekend Dynamic Matrix',
          ownerName: 'Aanurag Jain',
          ownerPhone: '+91 95992 80399',
          amenities: ['Natural Turf', 'Floodlights', 'Dugout', 'Pavilion', 'Parking'],
          url: '/venues/playnow-cricket-ground',
        },
        {
          id: 'ab-cricket-ground',
          slug: 'ab-cricket-ground',
          name: 'AB Cricket Ground',
          sport: 'Cricket',
          city: 'Faridabad',
          location: 'New Industrial Town, Aravalli Golf Course precinct, Faridabad',
          pricePerHour: 3500,
          pricingLabel: 'Match Packages (₹3,500 / ₹6,500)',
          ownerName: 'Rajesh Bajaj',
          ownerPhone: '+91 95402 28222',
          amenities: ['Umpires', 'Scorers', 'Balls', 'Floodlights', 'Cafeteria', 'Pavilion'],
          url: '/venues/ab-cricket-ground',
        },
      ];

      const venuesList =
        grounds.length > 0
          ? grounds.map((g) => ({
              id: g.id,
              slug: g.slug,
              name: g.name,
              sport: g.sport,
              city: g.city,
              location: g.location || g.address,
              pricePerHour: g.pricePerHour,
              pricingLabel: g.pricingLabel,
              ownerName: g.ownerName,
              ownerPhone: g.ownerPhone,
              amenities: g.amenities,
              url: `/venues/${g.slug || g.id}`,
            }))
          : defaultVenues;

      return {
        tool: 'getVenues',
        success: true,
        data: {
          count: venuesList.length,
          venues: venuesList,
        },
      };
    } catch (err: any) {
      const defaultVenues = [
        {
          id: 'rrr-cricket-club-kidawali-faridabad',
          slug: 'rrr-cricket-club-kidawali-faridabad',
          name: 'RRR Cricket Club Kidawali Faridabad',
          sport: 'Cricket',
          city: 'Faridabad',
          location: 'Kidawali, Pusta Road, Faridabad',
          pricePerHour: 0,
          pricingLabel: '3 Fixed Match Periods (₹299 / ₹2,600 / ₹5,000)',
          ownerName: 'Rishi',
          ownerPhone: '+91 97116 69718',
          amenities: ['Turf Pitch', 'Practice Nets', 'Floodlights', 'Pavilion'],
          url: '/venues/rrr-cricket-club-kidawali-faridabad',
        },
        {
          id: 'playnow-cricket-ground',
          slug: 'playnow-cricket-ground',
          name: 'Playnow Cricket Ground',
          sport: 'Cricket',
          city: 'Gurugram',
          location: 'Gurugram, Haryana',
          address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
          pricePerHour: 5000,
          pricingLabel: 'Weekday/Weekend Dynamic Matrix',
          ownerName: 'Aanurag Jain',
          ownerPhone: '+91 95992 80399',
          amenities: ['Natural Turf', 'Floodlights', 'Dugout', 'Pavilion', 'Parking'],
          url: '/venues/playnow-cricket-ground',
        },
        {
          id: 'ab-cricket-ground',
          slug: 'ab-cricket-ground',
          name: 'AB Cricket Ground',
          sport: 'Cricket',
          city: 'Faridabad',
          location: 'New Industrial Town, Aravalli Golf Course precinct, Faridabad',
          pricePerHour: 3500,
          pricingLabel: 'Match Packages (₹3,500 / ₹6,500)',
          ownerName: 'Rajesh Bajaj',
          ownerPhone: '+91 95402 28222',
          amenities: ['Umpires', 'Scorers', 'Balls', 'Floodlights', 'Cafeteria', 'Pavilion'],
          url: '/venues/ab-cricket-ground',
        },
      ];

      return {
        tool: 'getVenues',
        success: true,
        data: {
          count: defaultVenues.length,
          venues: defaultVenues,
        },
      };
    }
  }

  /**
   * Retrieves specific venue details, packages, and pricing rules.
   */
  public static async getVenueDetails(slugOrId: string): Promise<ToolExecutionResult> {
    const defaultData = this.getBaselineVenueData(slugOrId);
    try {
      const ground = await withTimeout(
        prisma.ground.findFirst({
          where: {
            OR: [{ id: slugOrId }, { slug: slugOrId }],
          },
        })
      );

      if (!ground) {
        if (defaultData) {
          return { tool: 'getVenueDetails', success: true, data: defaultData };
        }
        return { tool: 'getVenueDetails', success: false, error: `Venue '${slugOrId}' not found.` };
      }

      // Format custom rules for RRR, Playnow, AB
      let periodPricing: any = null;
      if (ground.slug === 'rrr-cricket-club-kidawali-faridabad') {
        periodPricing = {
          periods: ['MORNING (06:00 - 10:00 AM)', 'AFTERNOON (10:00 AM - 02:00 PM)', 'EVENING (02:00 - 06:00 PM)'],
          rates: {
            individual: '₹299 per player (with promo BE11 WELCOMES)',
            halfTeam: '₹2,600 for Single Team of 11 (with promo BE11 WELCOMES)',
            entireVenue: '₹5,000 Entire Ground (with promo BE11 WELCOMES)',
          },
          owner: 'Rishi (+91 97116 69718)',
        };
      } else if (ground.slug === 'playnow-cricket-ground') {
        periodPricing = {
          weekday: {
            morning: '₹5,000 Entire Venue / ₹2,500 Team of 11 (07:00 - 11:30 AM)',
            afternoon: '₹5,000 Entire Venue / ₹2,500 Team of 11 (12:00 - 04:30 PM)',
            night: '₹10,000 Entire Venue / ₹5,000 Team of 11 (08:00 - 11:30 PM)',
          },
          weekend: {
            morning: '₹10,000 Entire Venue / ₹5,000 Team of 11 (07:00 - 11:30 AM)',
            afternoon: '₹5,000 Entire Venue / ₹2,500 Team of 11 (12:00 - 04:30 PM)',
            dayNight: '₹10,000 Entire Venue / ₹5,000 Team of 11 (04:30 - 08:00 PM - Weekends Only)',
            night: '₹11,000 Entire Venue / ₹5,500 Team of 11 (08:00 - 11:30 PM)',
          },
          owner: 'Aanurag Jain (+91 95992 80399)',
        };
      } else if (ground.slug === 'ab-cricket-ground') {
        periodPricing = {
          packages: {
            standardDayMatch: '₹3,500 Whole Ground (Morning 07:00-11:30 AM or Afternoon 12:00-04:30 PM)',
            extendedNightMatch: '₹6,500 Whole Ground with Floodlights, Pavilion & Cafeteria (06:00-10:30 PM)',
            singleTeamOf11: 'Price on request with venue owner Rajesh Bajaj (+91 95402 28222)',
          },
          owner: 'Rajesh Bajaj (+91 95402 28222)',
        };
      }

      return {
        tool: 'getVenueDetails',
        success: true,
        data: {
          id: ground.id,
          name: ground.name,
          slug: ground.slug,
          sport: ground.sport,
          city: ground.city,
          address: ground.address || ground.location,
          coordinates: { lat: ground.latitude, lng: ground.longitude },
          amenities: ground.amenities,
          ownerName: ground.ownerName,
          ownerPhone: ground.ownerPhone,
          periodPricing,
          url: `/venues/${ground.slug || ground.id}`,
        },
      };
    } catch (err: any) {
      if (defaultData) {
        return { tool: 'getVenueDetails', success: true, data: defaultData };
      }
      return { tool: 'getVenueDetails', success: false, error: err?.message || 'Failed to fetch venue details' };
    }
  }

  private static getBaselineVenueData(slugOrId: string) {
    const key = (slugOrId || '').toLowerCase();
    if (key.includes('rrr') || key.includes('kidawali')) {
      return {
        id: 'rrr-cricket-club-kidawali-faridabad',
        slug: 'rrr-cricket-club-kidawali-faridabad',
        name: 'RRR Cricket Club Kidawali Faridabad',
        sport: 'Cricket',
        city: 'Faridabad',
        address: 'Kidawali, Pusta Road, Faridabad',
        coordinates: { lat: 28.466611, lng: 77.397333 },
        amenities: ['Turf Pitch', 'Practice Nets', 'Floodlights', 'Pavilion'],
        ownerName: 'Rishi',
        ownerPhone: '+91 97116 69718',
        periodPricing: {
          periods: ['MORNING (06:00 - 10:00 AM)', 'AFTERNOON (10:00 AM - 02:00 PM)', 'EVENING (02:00 - 06:00 PM)'],
          rates: {
            individual: '₹299 per player (with promo BE11 WELCOMES)',
            halfTeam: '₹2,600 for Single Team of 11 (with promo BE11 WELCOMES)',
            entireVenue: '₹5,000 Entire Ground (with promo BE11 WELCOMES)',
          },
          owner: 'Rishi (+91 97116 69718)',
        },
        url: '/venues/rrr-cricket-club-kidawali-faridabad',
      };
    }
    if (key.includes('playnow')) {
      return {
        id: 'playnow-cricket-ground',
        slug: 'playnow-cricket-ground',
        name: 'Playnow Cricket Ground',
        sport: 'Cricket',
        city: 'Gurugram',
        address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
        coordinates: { lat: 28.403646, lng: 77.136787 },
        amenities: ['Natural Turf', 'Floodlights', 'Dugout', 'Pavilion', 'Parking'],
        ownerName: 'Aanurag Jain',
        ownerPhone: '+91 95992 80399',
        periodPricing: {
          weekday: {
            morning: '₹5,000 Entire Venue / ₹2,500 Team of 11 (07:00 - 11:30 AM)',
            afternoon: '₹5,000 Entire Venue / ₹2,500 Team of 11 (12:00 - 04:30 PM)',
            night: '₹10,000 Entire Venue / ₹5,000 Team of 11 (08:00 - 11:30 PM)',
          },
          weekend: {
            morning: '₹10,000 Entire Venue / ₹5,000 Team of 11 (07:00 - 11:30 AM)',
            afternoon: '₹5,000 Entire Venue / ₹2,500 Team of 11 (12:00 - 04:30 PM)',
            dayNight: '₹10,000 Entire Venue / ₹5,000 Team of 11 (04:30 - 08:00 PM - Weekends Only)',
            night: '₹11,000 Entire Venue / ₹5,500 Team of 11 (08:00 - 11:30 PM)',
          },
          owner: 'Aanurag Jain (+91 95992 80399)',
        },
        url: '/venues/playnow-cricket-ground',
      };
    }
    if (key.includes('ab')) {
      return {
        id: 'ab-cricket-ground',
        slug: 'ab-cricket-ground',
        name: 'AB Cricket Ground',
        sport: 'Cricket',
        city: 'Faridabad',
        address: 'New Industrial Town, Aravalli Golf Course precinct, Faridabad',
        coordinates: { lat: 28.441139, lng: 77.377944 },
        amenities: ['Umpires', 'Scorers', 'Balls', 'Floodlights', 'Cafeteria', 'Pavilion'],
        ownerName: 'Rajesh Bajaj',
        ownerPhone: '+91 95402 28222',
        periodPricing: {
          packages: {
            standardDayMatch: '₹3,500 Whole Ground (Morning 07:00-11:30 AM or Afternoon 12:00-04:30 PM)',
            extendedNightMatch: '₹6,500 Whole Ground with Floodlights, Pavilion & Cafeteria (06:00-10:30 PM)',
            singleTeamOf11: 'Price on request with venue owner Rajesh Bajaj (+91 95402 28222)',
          },
          owner: 'Rajesh Bajaj (+91 95402 28222)',
        },
        url: '/venues/ab-cricket-ground',
      };
    }
    return null;
  }

  /**
   * Calculates live slot and match period availability for a venue on a given date.
   */
  public static async getVenueAvailability(slugOrId: string, date: string): Promise<ToolExecutionResult> {
    try {
      const ground = await withTimeout(
        prisma.ground.findFirst({
          where: { OR: [{ id: slugOrId }, { slug: slugOrId }] },
        })
      );

      if (!ground) {
        return { tool: 'getVenueAvailability', success: false, error: `Venue '${slugOrId}' not found.` };
      }

      const activeBookings = await withTimeout(
        prisma.booking.findMany({
          where: {
            groundId: ground.id,
            date,
            status: { in: ['CONFIRMED', 'PENDING'] },
          },
          select: {
            id: true,
            matchPeriod: true,
            startTime: true,
            endTime: true,
            status: true,
          },
        })
      );

      const bookedPeriods = activeBookings.map((b) => b.matchPeriod || `${b.startTime}-${b.endTime}`);

      return {
        tool: 'getVenueAvailability',
        success: true,
        data: {
          venueName: ground.name,
          date,
          activeBookingsCount: activeBookings.length,
          bookedPeriods,
          isFullyBooked: activeBookings.length >= 3,
        },
      };
    } catch (err: any) {
      return { tool: 'getVenueAvailability', success: false, error: err?.message || 'Failed to check availability' };
    }
  }

  /**
   * Queries live matches from database.
   */
  public static async getLiveMatches(params: { sport?: string; city?: string } = {}): Promise<ToolExecutionResult> {
    const defaultMatches = [
      {
        id: 'match-playnow-saturday',
        sport: 'Cricket',
        date: '2026-10-03',
        time: '10:00 AM – 2:00 PM',
        venue: 'Playnow Cricket Ground',
        venueCity: 'Faridabad',
        entryFee: 299,
        playersJoined: 0,
        totalPlayers: 22,
        spotsLeft: 22,
        skillLevel: 'Intermediate',
        hostName: 'Ayush Rajput',
        status: 'Open',
        url: '/live-matches',
      },
      {
        id: 'match-rrr-saturday',
        sport: 'Cricket',
        date: '2026-10-03',
        time: '10:00 AM – 2:00 PM',
        venue: 'RRR Cricket Club Kidawali Faridabad',
        venueCity: 'Faridabad',
        entryFee: 299,
        playersJoined: 0,
        totalPlayers: 22,
        spotsLeft: 22,
        skillLevel: 'Intermediate',
        hostName: 'Ayush Rajput',
        status: 'Open',
        url: '/live-matches',
      },
    ];

    try {
      const conditions: any[] = [{ status: { in: ['Open', 'Live'] } }];
      if (params.sport && params.sport !== 'All' && params.sport !== 'All Sports') {
        conditions.push({ sport: { equals: params.sport, mode: 'insensitive' } });
      }

      const matches = await withTimeout(
        prisma.match.findMany({
          where: { AND: conditions },
          include: {
            ground: {
              select: { name: true, slug: true, city: true, location: true },
            },
          },
          orderBy: { date: 'asc' },
        })
      );

      const list =
        matches.length > 0
          ? matches.map((m) => ({
              id: m.id,
              sport: m.sport,
              date: m.date,
              time: m.startTime,
              venue: m.ground?.name || 'BE11 Ground',
              venueCity: m.ground?.city || 'Faridabad',
              entryFee: m.entryFee,
              playersJoined: m.playersJoined,
              totalPlayers: m.totalPlayers,
              spotsLeft: Math.max(0, m.totalPlayers - m.playersJoined),
              skillLevel: m.skillLevel,
              hostName: m.hostName,
              status: m.status,
              url: '/live-matches',
            }))
          : defaultMatches;

      return {
        tool: 'getLiveMatches',
        success: true,
        data: {
          totalOpenMatches: list.length,
          matches: list,
        },
      };
    } catch (err: any) {
      return {
        tool: 'getLiveMatches',
        success: true,
        data: {
          totalOpenMatches: defaultMatches.length,
          matches: defaultMatches,
        },
      };
    }
  }

  /**
   * Gets details and participant list for a specific match.
   */
  public static async getMatchDetails(matchId: string): Promise<ToolExecutionResult> {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { ground: true },
      });

      if (!match) {
        return { tool: 'getMatchDetails', success: false, error: `Match '${matchId}' not found.` };
      }

      return {
        tool: 'getMatchDetails',
        success: true,
        data: {
          id: match.id,
          sport: match.sport,
          date: match.date,
          time: match.startTime,
          venueName: match.ground?.name,
          venueAddress: match.ground?.address || match.ground?.location,
          entryFee: match.entryFee,
          playersJoined: match.playersJoined,
          totalPlayers: match.totalPlayers,
          spotsLeft: Math.max(0, match.totalPlayers - match.playersJoined),
          status: match.status,
          hostName: match.hostName,
        },
      };
    } catch (err: any) {
      return { tool: 'getMatchDetails', success: false, error: err?.message || 'Failed to get match details' };
    }
  }

  /**
   * Queries user's personal bookings (STRICTLY scoped to authenticated userId).
   */
  public static async getUserBookings(userId: string): Promise<ToolExecutionResult> {
    try {
      if (!userId) {
        return { tool: 'getUserBookings', success: false, error: 'User is not logged in.' };
      }

      const bookings = await prisma.booking.findMany({
        where: { customerId: userId },
        include: {
          ground: {
            select: { name: true, city: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return {
        tool: 'getUserBookings',
        success: true,
        data: {
          count: bookings.length,
          bookings: bookings.map((b) => ({
            id: b.id,
            venue: b.ground?.name,
            date: b.date,
            matchPeriod: b.matchPeriod,
            time: `${b.startTime} - ${b.endTime}`,
            bookingType: b.bookingType,
            totalPrice: b.totalPrice,
            status: b.status,
            paymentStatus: b.paymentStatus,
            createdAt: b.createdAt.toISOString(),
          })),
        },
      };
    } catch (err: any) {
      return { tool: 'getUserBookings', success: false, error: err?.message || 'Failed to fetch user bookings' };
    }
  }

  /**
   * Queries user's personal wallet balance and ledger (STRICTLY scoped to authenticated userId).
   */
  public static async getUserWallet(userId: string): Promise<ToolExecutionResult> {
    try {
      if (!userId) {
        return { tool: 'getUserWallet', success: false, error: 'User is not logged in.' };
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          walletBalance: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!user) {
        return { tool: 'getUserWallet', success: false, error: 'User not found' };
      }

      return {
        tool: 'getUserWallet',
        success: true,
        data: {
          walletBalance: user.walletBalance,
          recentTransactions: user.transactions.map((t) => ({
            amount: t.amount,
            type: t.type,
            description: t.description,
            date: t.createdAt.toISOString(),
          })),
        },
      };
    } catch (err: any) {
      return { tool: 'getUserWallet', success: false, error: err?.message || 'Failed to fetch wallet info' };
    }
  }

  /**
   * Queries user's notifications (STRICTLY scoped to authenticated userId).
   */
  public static async getUserNotifications(userId: string): Promise<ToolExecutionResult> {
    try {
      if (!userId) {
        return { tool: 'getUserNotifications', success: false, error: 'User is not logged in.' };
      }

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      return {
        tool: 'getUserNotifications',
        success: true,
        data: {
          count: notifications.length,
          notifications: notifications.map((n) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            read: n.read,
            date: n.createdAt.toISOString(),
          })),
        },
      };
    } catch (err: any) {
      return { tool: 'getUserNotifications', success: false, error: err?.message || 'Failed to fetch notifications' };
    }
  }

  /**
   * Searches store merchandise catalog.
   */
  public static async searchProducts(params: { sport?: string; category?: string; query?: string } = {}): Promise<ToolExecutionResult> {
    try {
      const filter: any = {};
      if (params.sport && params.sport !== 'All') {
        filter.sport = { equals: params.sport, mode: 'insensitive' };
      }
      if (params.category && params.category !== 'All') {
        filter.category = { equals: params.category, mode: 'insensitive' };
      }
      if (params.query) {
        filter.name = { contains: params.query, mode: 'insensitive' };
      }

      const products = await prisma.product.findMany({
        where: filter,
        take: 8,
        orderBy: { price: 'asc' },
      });

      return {
        tool: 'searchProducts',
        success: true,
        data: {
          count: products.length,
          products: products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            sport: p.sport,
            price: p.price,
            stock: p.stock,
          })),
        },
      };
    } catch (err: any) {
      return { tool: 'searchProducts', success: false, error: err?.message || 'Failed to search products' };
    }
  }

  /**
   * Retrieves coaches and active coaching camps.
   */
  public static async getCoaches(): Promise<ToolExecutionResult> {
    try {
      const coaches = await prisma.coach.findMany({
        where: { status: 'APPROVED' },
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
          camps: {
            take: 2,
          },
        },
        take: 6,
      });

      return {
        tool: 'getCoaches',
        success: true,
        data: {
          count: coaches.length,
          coaches: coaches.map((c) => ({
            id: c.id,
            name: `${c.user.firstName} ${c.user.lastName}`,
            city: c.city,
            experienceYears: c.experienceYears,
            hourlyRate: c.hourlyRate,
            sports: c.sports,
            campsCount: c.camps.length,
          })),
        },
      };
    } catch (err: any) {
      return { tool: 'getCoaches', success: false, error: err?.message || 'Failed to fetch coaches' };
    }
  }
}
