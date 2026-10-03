import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { AppError } from '../../utils/appError.js';
import { GroundCreateSchema, HttpStatus } from '@be11/shared';
import { AuthenticatedRequest } from '../../middlewares/auth.js';

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
  let location = ground.location;
  let address = ground.address;
  let city = ground.city;
  let state = ground.state;
  let country = ground.country;
  let latitude = ground.latitude;
  let longitude = ground.longitude;
  let mapsUrl = ground.mapsUrl;

  if (ground.slug === 'playnow-cricket-ground') {
    location = 'Gurugram, Haryana';
    address = 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102';
    city = 'Gurugram';
    state = 'Haryana';
    country = 'India';
    latitude = 28.403646;
    longitude = 77.136787;
    mapsUrl = 'https://maps.app.goo.gl/x6HeybuKuDvSvzDYA';
  }

  return {
    ...ground,
    location,
    address,
    city,
    state,
    country,
    latitude,
    longitude,
    mapsUrl,
    amenities: parseJsonField(ground.amenities) || [],
    images: parseJsonField(ground.images) || [],
    videos: parseJsonField(ground.videos) || [],
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
      if (city === 'Gurugram') {
        filter.OR = [
          { city: { equals: 'Gurugram' } },
          { slug: 'playnow-cricket-ground' }
        ];
      } else if (city === 'Faridabad') {
        filter.city = { equals: 'Faridabad' };
        filter.slug = { not: 'playnow-cricket-ground' };
      } else {
        filter.city = { equals: city as string };
      }
    }

    if (search) {
      filter.OR = [
        { name: { contains: search as string } },
        { location: { contains: search as string } },
        { address: { contains: search as string } },
      ];
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

