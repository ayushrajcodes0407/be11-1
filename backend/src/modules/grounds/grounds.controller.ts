import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { AppError } from '../../utils/appError.js';
import { GroundCreateSchema, HttpStatus } from '@be11/shared';
import { AuthenticatedRequest } from '../../middlewares/auth.js';

const AB_REAL_IMAGES = [
  '/venues/ab/Ab-hub-Cricket-Ground-2.jpg',
  '/venues/ab/AB_Cricket_hub_logo.jpg',
  '/venues/ab/1626583807641_k3FF5LqrKL3W.jpg',
  '/venues/ab/1626583836958_9ggaKwPYBjZl.jpg',
  '/venues/ab/1712466993141_pYOd9SDtqblb.jpg',
  '/venues/ab/1712467019752_kHFtLZSKbTgO.jpg',
  '/venues/ab/1712467048874_BNvZCpX11nXk.jpg',
  '/venues/ab/1712467096971_TnkeSNVpfXS9.jpg',
  '/venues/ab/1730546083919_JY9GXVSgW6Gh.jpg',
];

const parseJsonField = (field: any) => {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return field;
    }
  }
  return field;
};

const formatGroundResponse = (ground: any) => {
  let images = parseJsonField(ground.images) || [];
  let videos = parseJsonField(ground.videos) || [];

  const isABGround =
    ground.slug === 'ab-cricket-ground' ||
    ground.id === '2f1230f1-5219-4c01-a3cb-19fa90896188' ||
    (ground.name && ground.name.toLowerCase().includes('ab cricket'));

  if (isABGround) {
    if (!Array.isArray(images) || images.length === 0 || images.some((img: string) => typeof img === 'string' && img.includes('ab cricket ground.png'))) {
      images = AB_REAL_IMAGES;
    }
    videos = [];
  }

  const isPlaynow =
    ground.slug === 'playnow-cricket-ground' ||
    ground.id === '8597cac9-2d50-4d71-9f16-60c1c8132ed7' ||
    (ground.name && ground.name.toLowerCase().includes('playnow'));

  if (isPlaynow) {
    ground = {
      ...ground,
      slug: 'playnow-cricket-ground',
      location: 'Gurugram, Haryana',
      address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
      city: 'Gurugram',
      state: 'Haryana',
      country: 'India',
      latitude: 28.403646,
      longitude: 77.136787,
      mapsUrl: 'https://maps.app.goo.gl/omqt5t5SVrkQTMGV9',
    };
  }

  return {
    ...ground,
    amenities: parseJsonField(ground.amenities) || [],
    images,
    videos,
    pricingRules: parseJsonField(ground.pricingRules) || null,
  };
};

export const getGrounds = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sport, city, search } = req.query;

    const filter: any = { isActive: true };

    if (sport && sport !== 'All') {
      filter.sport = sport as string;
    }

    if (city && city !== 'All') {
      const cityStr = (city as string).trim();
      if (cityStr.toLowerCase() === 'haryana') {
        filter.OR = [
          { state: { equals: 'Haryana' } },
          { city: { equals: 'Haryana' } },
          { location: { contains: 'Haryana' } },
          { address: { contains: 'Haryana' } },
        ];
      } else if (cityStr.toLowerCase() === 'gurugram' || cityStr.toLowerCase() === 'gurgaon') {
        filter.OR = [
          { city: { equals: 'Gurugram' } },
          { location: { contains: 'Gurugram' } },
          { address: { contains: 'Gurugram' } },
          { slug: 'playnow-cricket-ground' },
          { name: { contains: 'Playnow', mode: 'insensitive' } },
        ];
      } else {
        filter.OR = [
          { city: { equals: cityStr } },
          { location: { contains: cityStr } },
          { address: { contains: cityStr } },
        ];
      }
    }

    if (search) {
      const searchStr = (search as string).trim();
      const searchConditions = [
        { name: { contains: searchStr } },
        { location: { contains: searchStr } },
        { address: { contains: searchStr } },
      ];
      if (filter.OR) {
        filter.AND = [
          { OR: filter.OR },
          { OR: searchConditions },
        ];
        delete filter.OR;
      } else {
        filter.OR = searchConditions;
      }
    }

    const rawGrounds = await prisma.ground.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
    });

    const grounds = rawGrounds.map(formatGroundResponse);

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Grounds retrieved successfully',
      data: { grounds },
    });
  } catch (error) {
    next(error);
  }
};

export const getGroundById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Find by ID or Slug
    const rawGround = await prisma.ground.findFirst({
      where: {
        OR: [
          { id: id as string },
          { slug: id as string },
        ],
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!rawGround) {
      throw new AppError('Ground not found', HttpStatus.NOT_FOUND);
    }

    const ground = formatGroundResponse(rawGround);

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Ground retrieved successfully',
      data: { ground },
    });
  } catch (error) {
    next(error);
  }
};

export const createGround = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = GroundCreateSchema.parse(req.body);
    const ownerId = req.user?.userId;

    if (!ownerId) {
      throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const ground = await prisma.ground.create({
      data: {
        ...validated,
        ownerId,
      },
    });

    res.status(HttpStatus.CREATED).json({
      success: true,
      message: 'Ground created successfully',
      data: { ground },
    });
  } catch (error) {
    next(error);
  }
};

export const getGroundSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { date } = req.query; // format: YYYY-MM-DD

    if (!date) {
      throw new AppError('Date query param is required (YYYY-MM-DD)', HttpStatus.BAD_REQUEST);
    }

    const ground = await prisma.ground.findFirst({
      where: {
        OR: [
          { id: id as string },
          { slug: id as string },
        ],
      },
    });

    if (!ground) {
      throw new AppError('Ground not found', HttpStatus.NOT_FOUND);
    }

    // Find confirmed/pending bookings for this ground on this date
    const bookings = await prisma.booking.findMany({
      where: {
        groundId: ground.id,
        date: date as string,
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    const [year, month, day] = (date as string).split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    const dayOfWeek = parsedDate.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const pricingRules = parseJsonField(ground.pricingRules);

    // Dynamic Match Periods for Playnow Cricket Ground
    let matchPeriods: any[] = [];
    let packages: any[] = [];

    const extractPrices = (rulesMap: any, periodKey: string) => {
      const val = rulesMap?.[periodKey];
      if (!val) return { entireVenue: 0, teamOf11: 0, individual: 0 };
      if (typeof val === 'number') {
        return {
          entireVenue: val,
          teamOf11: Math.round(val / 2),
          individual: Math.round(val / 22),
        };
      }
      const entireVenue = val.ENTIRE_VENUE ?? val.entireVenue ?? 0;
      const teamOf11 = val.TEAM_OF_11 ?? val.teamOf11 ?? Math.round(entireVenue / 2);
      const individual = val.INDIVIDUAL ?? val.individual ?? Math.round(entireVenue / 22);
      return { entireVenue, teamOf11, individual };
    };

    if (pricingRules?.type === 'TIME_SLOT_MATRIX') {
      const weekdayRules = pricingRules.weekday || {};
      const weekendRules = pricingRules.weekend || {};
      const activeRules = isWeekend ? weekendRules : weekdayRules;

      // 1. Morning Match
      const morningPricing = extractPrices(activeRules, 'morning');
      const isMorningBooked = bookings.some(
        (b) => b.matchPeriod === 'MORNING' || (b.startTime >= '06:00' && b.startTime < '12:00')
      );
      matchPeriods.push({
        id: 'MORNING',
        name: 'Morning Match',
        timeRange: '07:00 AM - 11:30 AM',
        price: morningPricing.entireVenue,
        pricing: morningPricing,
        teamCoverage: 'Both teams included',
        isAvailable: !isMorningBooked,
      });

      // 2. Afternoon Match
      const afternoonPricing = extractPrices(activeRules, 'afternoon');
      const isAfternoonBooked = bookings.some(
        (b) => b.matchPeriod === 'AFTERNOON' || (b.startTime >= '12:00' && b.startTime < '16:30')
      );
      matchPeriods.push({
        id: 'AFTERNOON',
        name: 'Afternoon Match',
        timeRange: '12:00 PM - 04:30 PM',
        price: afternoonPricing.entireVenue,
        pricing: afternoonPricing,
        teamCoverage: 'Both teams included',
        isAvailable: !isAfternoonBooked,
      });

      // 3. Day-Night Match (WEEKENDS ONLY as per business rule)
      if (isWeekend) {
        const dayNightPricing = extractPrices(activeRules, 'dayNight');
        const isDayNightBooked = bookings.some(
          (b) => b.matchPeriod === 'DAY_NIGHT' || (b.startTime >= '16:00' && b.startTime < '20:00')
        );
        matchPeriods.push({
          id: 'DAY_NIGHT',
          name: 'Day-Night Match',
          timeRange: '04:30 PM - 08:00 PM',
          price: dayNightPricing.entireVenue,
          pricing: dayNightPricing,
          teamCoverage: 'Both teams included',
          isAvailable: !isDayNightBooked,
        });
      }

      // 4. Night Match
      const nightPricing = extractPrices(activeRules, 'night');
      const isNightBooked = bookings.some(
        (b) => b.matchPeriod === 'NIGHT' || (b.startTime >= '19:30' && b.startTime <= '23:30')
      );
      matchPeriods.push({
        id: 'NIGHT',
        name: 'Night Match',
        timeRange: '08:00 PM - 11:30 PM',
        price: nightPricing.entireVenue,
        pricing: nightPricing,
        teamCoverage: 'Both teams included',
        isAvailable: !isNightBooked,
      });
    } else if (ground.slug === 'ab-cricket-ground' || pricingRules?.type === 'PACKAGE_TIERS') {
      // AB Cricket Ground Whole Ground Match Pricing
      const morningBooked = bookings.some((b) => b.matchPeriod === 'MORNING');
      const afternoonBooked = bookings.some((b) => b.matchPeriod === 'AFTERNOON');
      const nightBooked = bookings.some((b) => b.matchPeriod === 'NIGHT' || b.matchPeriod === 'DAY_NIGHT');

      matchPeriods = [
        {
          id: 'MORNING',
          name: 'Morning Match',
          timeRange: '07:00 AM - 11:30 AM',
          price: 3500,
          pricing: {
            wholeGround: 3500,
            entireVenue: 3500,
            teamOf11: 0, // Price on request / contact owner
          },
          teamCoverage: 'Whole Ground included',
          isAvailable: !morningBooked,
        },
        {
          id: 'AFTERNOON',
          name: 'Afternoon Match',
          timeRange: '12:00 PM - 04:30 PM',
          price: 3500,
          pricing: {
            wholeGround: 3500,
            entireVenue: 3500,
            teamOf11: 0, // Price on request / contact owner
          },
          teamCoverage: 'Whole Ground included',
          isAvailable: !afternoonBooked,
        },
        {
          id: 'NIGHT',
          name: 'Night / Floodlit Match',
          timeRange: '06:00 PM - 10:30 PM',
          price: 6500,
          pricing: {
            wholeGround: 6500,
            entireVenue: 6500,
            teamOf11: 0, // Price on request / contact owner
          },
          teamCoverage: 'Whole Ground with Floodlights & Pavilion',
          isAvailable: !nightBooked,
        },
      ];

      packages = [
        {
          id: 'pkg-standard',
          name: 'Standard Whole Ground',
          price: 3500,
          description: 'Complete whole ground match reservation with pitch prep, umpires, scorers & practice nets (Morning/Afternoon).',
          facilities: ['Umpires', 'Scorers', 'Balls', 'Drinking Water', 'Practice Nets', 'Pavilion/Dugout', 'Washrooms'],
          isAvailable: !morningBooked || !afternoonBooked,
        },
        {
          id: 'pkg-extended',
          name: 'Extended Day / Floodlit Whole Ground',
          price: 6500,
          description: 'Exclusive whole ground reservation with floodlights, full pavilion access & cafeteria.',
          facilities: ['Umpires', 'Scorers', 'Flood Lights', 'Balls', 'Sight Screen', 'Cafeteria', 'Pavilion/Dugout', 'Washrooms'],
          isAvailable: !nightBooked,
        },
      ];
    } else if (ground.slug === 'rrr-cricket-club-kidawali-faridabad') {
      // RRR Cricket Club: Exactly 3 fixed 4-hour booking periods per day
      const isMorningBooked = bookings.some(
        (b) => b.matchPeriod === 'MORNING' || (b.startTime >= '06:00' && b.startTime < '10:00')
      );
      const isAfternoonBooked = bookings.some(
        (b) => b.matchPeriod === 'AFTERNOON' || (b.startTime >= '10:00' && b.startTime < '14:00')
      );
      const isEveningBooked = bookings.some(
        (b) => b.matchPeriod === 'EVENING' || (b.startTime >= '14:00' && b.startTime < '18:00')
      );

      // Base prices: Individual = 299, Half Team = 2600, Entire Venue = 5000
      // 25% marked original display price: Individual = 373.75, Half Team = 3250, Entire Venue = 6250
      const rrrPricing = {
        individual: {
          base: 299,
          originalPrice: 373.75,
          discount: 74.75,
          finalPrice: 299,
        },
        halfTeam: {
          base: 2600,
          originalPrice: 3250,
          discount: 650,
          finalPrice: 2600,
        },
        entireVenue: {
          base: 5000,
          originalPrice: 6250,
          discount: 1250,
          finalPrice: 5000,
        },
        couponCode: 'BE11 WELCOMES',
        discountPercent: 25,
      };

      matchPeriods = [
        {
          id: 'MORNING',
          name: 'Morning Match',
          timeRange: '06:00 AM – 10:00 AM',
          startTime: '06:00',
          endTime: '10:00',
          price: 5000,
          pricing: rrrPricing,
          teamCoverage: 'Natural Turf Pitch & Match Setup',
          isAvailable: !isMorningBooked,
        },
        {
          id: 'AFTERNOON',
          name: 'Afternoon Match',
          timeRange: '10:00 AM – 02:00 PM',
          startTime: '10:00',
          endTime: '14:00',
          price: 5000,
          pricing: rrrPricing,
          teamCoverage: 'Natural Turf Pitch & Match Setup',
          isAvailable: !isAfternoonBooked,
        },
        {
          id: 'EVENING',
          name: 'Evening Match',
          timeRange: '02:00 PM – 06:00 PM',
          startTime: '14:00',
          endTime: '18:00',
          price: 5000,
          pricing: rrrPricing,
          teamCoverage: 'Natural Turf Pitch & Match Setup',
          isAvailable: !isEveningBooked,
        },
      ];
    }

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Venue availability and pricing retrieved successfully',
      data: {
        groundId: ground.id,
        date: date as string,
        isWeekend,
        dayType: isWeekend ? 'WEEKEND' : 'WEEKDAY',
        pricingType: pricingRules?.type || 'STANDARD',
        matchPeriods,
        packages,
        contact: pricingRules?.type === 'CONTACT_ONLY' ? {
          ownerName: ground.ownerName || 'Venue Manager',
          ownerPhone: ground.ownerPhone || '+91 97116 69718',
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

