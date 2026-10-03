import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { AppError } from '../../utils/appError.js';
import { HttpStatus } from '@be11/shared';
import { AuthenticatedRequest } from '../../middlewares/auth.js';
import { sendNotification, broadcastMatchUpdate } from '../notifications/notifications.controller.js';
import {
  createRazorpayOrder as createServerOrder,
  verifyRazorpaySignature,
  fetchRazorpayPayment,
  getRazorpayPublicKey,
  isRazorpayConfigured,
} from '../../services/razorpay.service.js';
import { logger } from '../../config/logger.js';

const formatGroundResponse = (ground: any) => {
  if (!ground) return ground;
  const isPlaynow =
    ground.slug === 'playnow-cricket-ground' ||
    ground.slug === 'playnow-cricket-ground-sector-86-gurugram' ||
    ground.id === '8597cac9-2d50-4d71-9f16-60c1c8132ed7' ||
    (ground.name && ground.name.toLowerCase().includes('playnow'));

  if (isPlaynow) {
    return {
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
  return ground;
};

export const formatMatchResponse = (match: any) => {
  if (!match) return match;
  return {
    ...match,
    ground: match.ground ? formatGroundResponse(match.ground) : match.ground,
  };
};

// GET /api/v1/matches
export const getMatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sport, city, search } = req.query;
    const conditions: any[] = [];

    if (sport && sport !== 'All' && sport !== 'All Sports') {
      const sportStr = (sport as string).trim();
      conditions.push({
        sport: { equals: sportStr, mode: 'insensitive' },
      });
    }

    const cityLower = city && city !== 'All' && city !== 'All Cities' ? (city as string).trim().toLowerCase() : null;

    if (cityLower) {
      if (cityLower === 'haryana') {
        conditions.push({
          ground: {
            OR: [
              { state: { equals: 'Haryana', mode: 'insensitive' } },
              { city: { equals: 'Haryana', mode: 'insensitive' } },
              { city: { equals: 'Faridabad', mode: 'insensitive' } },
              { city: { equals: 'Gurugram', mode: 'insensitive' } },
              { city: { equals: 'Gurgaon', mode: 'insensitive' } },
              { location: { contains: 'Haryana', mode: 'insensitive' } },
              { address: { contains: 'Haryana', mode: 'insensitive' } },
              { location: { contains: 'Faridabad', mode: 'insensitive' } },
              { address: { contains: 'Faridabad', mode: 'insensitive' } },
              { location: { contains: 'Gurugram', mode: 'insensitive' } },
              { address: { contains: 'Gurugram', mode: 'insensitive' } },
              { slug: { contains: 'playnow', mode: 'insensitive' } },
              { name: { contains: 'playnow', mode: 'insensitive' } },
              { slug: { contains: 'rrr', mode: 'insensitive' } },
              { name: { contains: 'rrr', mode: 'insensitive' } },
              { slug: { contains: 'ab-cricket', mode: 'insensitive' } },
              { name: { contains: 'ab cricket', mode: 'insensitive' } },
            ],
          },
        });
      } else if (cityLower === 'gurugram' || cityLower === 'gurgaon') {
        conditions.push({
          ground: {
            OR: [
              { city: { equals: 'Gurugram', mode: 'insensitive' } },
              { city: { equals: 'Gurgaon', mode: 'insensitive' } },
              { location: { contains: 'Gurugram', mode: 'insensitive' } },
              { location: { contains: 'Gurgaon', mode: 'insensitive' } },
              { address: { contains: 'Gurugram', mode: 'insensitive' } },
              { address: { contains: 'Gurgaon', mode: 'insensitive' } },
              { slug: { equals: 'playnow-cricket-ground', mode: 'insensitive' } },
              { slug: { equals: 'playnow-cricket-ground-sector-86-gurugram', mode: 'insensitive' } },
              { name: { contains: 'Playnow', mode: 'insensitive' } },
              { id: { equals: '8597cac9-2d50-4d71-9f16-60c1c8132ed7' } },
            ],
          },
        });
      } else if (cityLower === 'faridabad') {
        conditions.push({
          ground: {
            AND: [
              {
                OR: [
                  { city: { equals: 'Faridabad', mode: 'insensitive' } },
                  { location: { contains: 'Faridabad', mode: 'insensitive' } },
                  { address: { contains: 'Faridabad', mode: 'insensitive' } },
                  { slug: { contains: 'rrr', mode: 'insensitive' } },
                  { name: { contains: 'rrr', mode: 'insensitive' } },
                  { slug: { contains: 'ab-cricket', mode: 'insensitive' } },
                  { name: { contains: 'ab cricket', mode: 'insensitive' } },
                ],
              },
              {
                NOT: [
                  { slug: { contains: 'playnow', mode: 'insensitive' } },
                  { name: { contains: 'playnow', mode: 'insensitive' } },
                  { id: { equals: '8597cac9-2d50-4d71-9f16-60c1c8132ed7' } },
                ],
              },
            ],
          },
        });
      } else if (cityLower === 'delhi' || cityLower === 'delhi ncr' || cityLower === 'ncr') {
        conditions.push({
          ground: {
            OR: [
              { city: { equals: 'Delhi', mode: 'insensitive' } },
              { state: { equals: 'Delhi', mode: 'insensitive' } },
              { city: { equals: 'Noida', mode: 'insensitive' } },
              { city: { equals: 'Gurugram', mode: 'insensitive' } },
              { city: { equals: 'Faridabad', mode: 'insensitive' } },
              { location: { contains: 'Delhi', mode: 'insensitive' } },
              { address: { contains: 'Delhi', mode: 'insensitive' } },
              { location: { contains: 'Gurugram', mode: 'insensitive' } },
              { address: { contains: 'Gurugram', mode: 'insensitive' } },
              { location: { contains: 'Faridabad', mode: 'insensitive' } },
              { address: { contains: 'Faridabad', mode: 'insensitive' } },
              { slug: { contains: 'playnow', mode: 'insensitive' } },
              { name: { contains: 'playnow', mode: 'insensitive' } },
            ],
          },
        });
      } else {
        const cityStr = (city as string).trim();
        conditions.push({
          ground: {
            OR: [
              { city: { equals: cityStr, mode: 'insensitive' } },
              { state: { equals: cityStr, mode: 'insensitive' } },
              { location: { contains: cityStr, mode: 'insensitive' } },
              { address: { contains: cityStr, mode: 'insensitive' } },
            ],
          },
        });
      }
    }

    if (search) {
      const searchStr = (search as string).trim();
      conditions.push({
        OR: [
          { sport: { contains: searchStr, mode: 'insensitive' } },
          { ground: { name: { contains: searchStr, mode: 'insensitive' } } },
          { ground: { location: { contains: searchStr, mode: 'insensitive' } } },
          { ground: { city: { contains: searchStr, mode: 'insensitive' } } },
          { ground: { address: { contains: searchStr, mode: 'insensitive' } } },
        ],
      });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};

    let matches = await prisma.match.findMany({
      where,
      include: {
        ground: true,
      },
      orderBy: { date: 'asc' },
    });

    // Auto-seed/ensure official Playnow open match if none exists in database
    if (matches.length === 0 && (!cityLower || cityLower === 'gurugram' || cityLower === 'gurgaon' || cityLower === 'haryana')) {
      let playnowGround = await prisma.ground.findFirst({
        where: {
          OR: [
            { slug: 'playnow-cricket-ground' },
            { slug: 'playnow-cricket-ground-sector-86-gurugram' },
            { id: '8597cac9-2d50-4d71-9f16-60c1c8132ed7' },
            { name: { contains: 'Playnow', mode: 'insensitive' } },
          ],
        },
      });

      if (!playnowGround) {
        const ownerUser = await prisma.user.findFirst();
        if (ownerUser) {
          playnowGround = await prisma.ground.create({
            data: {
              id: '8597cac9-2d50-4d71-9f16-60c1c8132ed7',
              name: 'Playnow Cricket Ground',
              slug: 'playnow-cricket-ground',
              description: 'Premier cricket facility located at Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102. Features professional turf pitch, pavilion, dugout, floodlights, and parking.',
              sport: 'Cricket',
              location: 'Gurugram, Haryana',
              address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
              city: 'Gurugram',
              state: 'Haryana',
              country: 'India',
              latitude: 28.403646,
              longitude: 77.136787,
              mapsUrl: 'https://maps.app.goo.gl/omqt5t5SVrkQTMGV9',
              pricePerHour: 1500,
              rating: 4.8,
              ownerId: ownerUser.id,
              amenities: JSON.stringify(['Turf Pitch', 'Floodlights', 'Pavilion', 'Dugout', 'Parking']),
              images: JSON.stringify([
                '/venues/playnow/unnamed (1).webp',
                '/venues/playnow/unnamed (2).webp',
                '/venues/playnow/unnamed (3).webp',
                '/venues/playnow/unnamed.webp',
              ]),
              videos: JSON.stringify([]),
              isActive: true,
            },
          });
        }
      }

      if (playnowGround) {
        let playnowMatch = await prisma.match.findFirst({
          where: {
            groundId: playnowGround.id,
            status: 'Open',
          },
          include: { ground: true },
        });

        if (!playnowMatch) {
          const hostUser = await prisma.user.findFirst();
          if (hostUser) {
            playnowMatch = await prisma.match.create({
              data: {
                groundId: playnowGround.id,
                sport: 'Cricket',
                date: '2026-10-03',
                startTime: '10:00 AM – 2:00 PM',
                entryFee: 299,
                playersJoined: 0,
                totalPlayers: 22,
                skillLevel: 'Intermediate',
                hostId: hostUser.id,
                hostName: `${hostUser.firstName || 'Ayush'} ${hostUser.lastName || 'Rajput'}`.trim(),
                verifiedHost: true,
                status: 'Open',
                teamA: JSON.stringify([]),
                teamB: JSON.stringify([]),
              },
              include: { ground: true },
            });
          }
        }

        if (playnowMatch) {
          matches.push(playnowMatch);
        }
      }
    }

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Matches retrieved successfully',
      data: { matches: matches.map(formatMatchResponse) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/matches/:id
export const getMatchById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        ground: true,
      },
    });

    if (!match) {
      throw new AppError('Match not found', HttpStatus.NOT_FOUND);
    }

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Match retrieved successfully',
      data: { match: formatMatchResponse(match) },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/matches
export const createMatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const { groundId, sport, date, startTime, entryFee, totalPlayers, skillLevel } = req.body;

    const ground = await prisma.ground.findUnique({
      where: { id: groundId },
    });
    if (!ground) {
      throw new AppError('Ground not found', HttpStatus.NOT_FOUND);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new AppError('Host user not found', HttpStatus.NOT_FOUND);
    }

    const match = await prisma.match.create({
      data: {
        groundId,
        sport,
        date,
        startTime,
        entryFee: parseFloat(entryFee || 0),
        totalPlayers: parseInt(totalPlayers || 10, 10),
        skillLevel: skillLevel || 'Intermediate',
        hostId: userId,
        hostName: `${user.firstName} ${user.lastName}`,
        verifiedHost: user.role === 'OWNER' || user.role === 'ADMIN',
        status: 'Open',
        teamA: JSON.stringify([]),
        teamB: JSON.stringify([]),
      },
      include: {
        ground: true,
      },
    });

    const formattedMatch = formatMatchResponse(match);

    // Broadcast update
    broadcastMatchUpdate(match.id, 'CREATED', formattedMatch);

    res.status(HttpStatus.CREATED).json({
      success: true,
      message: 'Match created successfully',
      data: { match: formattedMatch },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/matches/:id/join
export const joinMatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const id = req.params.id as string;
    const { team } = req.body; // 'A' or 'B'

    if (team !== 'A' && team !== 'B') {
      throw new AppError('Invalid team choice. Must be team A or team B.', HttpStatus.BAD_REQUEST);
    }

    const match = await prisma.match.findUnique({
      where: { id },
      include: { ground: true },
    }) as any;
    if (!match) {
      throw new AppError('Match not found', HttpStatus.NOT_FOUND);
    }

    if (match.playersJoined >= match.totalPlayers) {
      throw new AppError('Match is already full', HttpStatus.BAD_REQUEST);
    }

    // Parse team arrays
    const teamA = typeof match.teamA === 'string' ? JSON.parse(match.teamA) : (match.teamA || []);
    const teamB = typeof match.teamB === 'string' ? JSON.parse(match.teamB) : (match.teamB || []);

    // Check if user already joined
    const existsA = teamA.some((p: any) => p.id === userId);
    const existsB = teamB.some((p: any) => p.id === userId);
    if (existsA || existsB) {
      throw new AppError('You have already joined this match', HttpStatus.BAD_REQUEST);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND);
    }

    if (user.walletBalance < match.entryFee) {
      throw new AppError('Insufficient wallet balance to join this match', HttpStatus.BAD_REQUEST);
    }

    const updatedMatch = await prisma.$transaction(async (tx) => {
      // 1. Deduct wallet balance
      if (match.entryFee > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { walletBalance: { decrement: match.entryFee } },
        });

        // Log transaction
        await tx.walletTransaction.create({
          data: {
            userId,
            amount: match.entryFee,
            type: 'DEBIT',
            description: `Joined Match for ${match.sport} at ${match.ground.name}`,
          },
        });
      }

      // 2. Add player to team roster
      const playerDetails = { id: user.id, firstName: user.firstName, lastName: user.lastName };
      if (team === 'A') {
        teamA.push(playerDetails);
      } else {
        teamB.push(playerDetails);
      }

      const nextPlayersJoined = match.playersJoined + 1;
      let nextStatus = 'Open';

      const ratio = nextPlayersJoined / match.totalPlayers;
      if (nextPlayersJoined >= match.totalPlayers) {
        nextStatus = 'Match Full';
      } else if (ratio >= 0.95) {
        nextStatus = 'Almost Full';
      } else if (ratio >= 0.8) {
        nextStatus = 'Filling Fast';
      }

      const updated = await tx.match.update({
        where: { id },
        data: {
          playersJoined: nextPlayersJoined,
          status: nextStatus,
          teamA: JSON.stringify(teamA),
          teamB: JSON.stringify(teamB),
        },
        include: {
          ground: true,
        },
      });

      return updated;
    });

    // Send notifications & websockets broadcast
    await sendNotification(userId, {
      title: 'Joined Match!',
      message: `You successfully joined the ${match.sport} match at ${match.ground.name} on Team ${team}!`,
    });

    broadcastMatchUpdate(id, 'JOINED', updatedMatch);

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Joined match successfully',
      data: { match: updatedMatch },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/matches/:id
export const updateSlotCount = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { totalPlayers, date, startTime, entryFee, skillLevel, status, sport } = req.body;

    const match = await prisma.match.findUnique({
      where: { id },
    });
    if (!match) {
      throw new AppError('Match not found', HttpStatus.NOT_FOUND);
    }

    const updateData: any = {};
    if (date !== undefined) updateData.date = String(date).trim();
    if (startTime !== undefined) updateData.startTime = String(startTime).trim();
    if (entryFee !== undefined) updateData.entryFee = Number(entryFee);
    if (skillLevel !== undefined) updateData.skillLevel = String(skillLevel).trim();
    if (status !== undefined) updateData.status = String(status).trim();
    if (sport !== undefined) updateData.sport = String(sport).trim();

    if (totalPlayers !== undefined) {
      const nextTotalPlayers = parseInt(String(totalPlayers), 10);
      if (nextTotalPlayers < match.playersJoined) {
        throw new AppError('Cannot reduce slots below currently joined players count', HttpStatus.BAD_REQUEST);
      }
      updateData.totalPlayers = nextTotalPlayers;
      if (!status) {
        let nextStatus = 'Open';
        const ratio = match.playersJoined / nextTotalPlayers;
        if (match.playersJoined >= nextTotalPlayers) {
          nextStatus = 'Match Full';
        } else if (ratio >= 0.95) {
          nextStatus = 'Almost Full';
        } else if (ratio >= 0.8) {
          nextStatus = 'Filling Fast';
        }
        updateData.status = nextStatus;
      }
    }

    const updated = await prisma.match.update({
      where: { id },
      data: updateData,
      include: {
        ground: true,
      },
    });

    const formattedUpdated = formatMatchResponse(updated);
    broadcastMatchUpdate(id, 'UPDATED', formattedUpdated);

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Match updated successfully',
      data: { match: formattedUpdated },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/matches/:id/leave
export const leaveMatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const id = req.params.id as string;

    const match = await prisma.match.findUnique({
      where: { id },
      include: { ground: true },
    }) as any;
    if (!match) {
      throw new AppError('Match not found', HttpStatus.NOT_FOUND);
    }

    // Parse team arrays
    let teamA = typeof match.teamA === 'string' ? JSON.parse(match.teamA) : (match.teamA || []);
    let teamB = typeof match.teamB === 'string' ? JSON.parse(match.teamB) : (match.teamB || []);

    const inA = teamA.some((p: any) => p.id === userId);
    const inB = teamB.some((p: any) => p.id === userId);

    if (!inA && !inB) {
      throw new AppError('You have not joined this match', HttpStatus.BAD_REQUEST);
    }

    // Remove player
    teamA = teamA.filter((p: any) => p.id !== userId);
    teamB = teamB.filter((p: any) => p.id !== userId);

    const nextPlayersJoined = Math.max(0, match.playersJoined - 1);
    let nextStatus = 'Open';
    const ratio = nextPlayersJoined / match.totalPlayers;
    if (nextPlayersJoined >= match.totalPlayers) {
      nextStatus = 'Match Full';
    } else if (ratio >= 0.95) {
      nextStatus = 'Almost Full';
    } else if (ratio >= 0.8) {
      nextStatus = 'Filling Fast';
    }

    const updatedMatch = await prisma.$transaction(async (tx) => {
      // 1. Refund wallet balance
      if (match.entryFee > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { walletBalance: { increment: match.entryFee } },
        });

        // Log transaction
        await tx.walletTransaction.create({
          data: {
            userId,
            amount: match.entryFee,
            type: 'CREDIT',
            description: `Refund for leaving match at ${match.ground.name}`,
          },
        });
      }

      // 2. Update match roster
      const updated = await tx.match.update({
        where: { id },
        data: {
          playersJoined: nextPlayersJoined,
          status: nextStatus,
          teamA: JSON.stringify(teamA),
          teamB: JSON.stringify(teamB),
        },
        include: {
          ground: true,
        },
      });

      return updated;
    });

    const formattedUpdatedMatch = formatMatchResponse(updatedMatch);

    // Send notifications & websockets broadcast
    await sendNotification(userId, {
      title: 'Left Match',
      message: `You successfully left the ${match.sport} match at ${match.ground.name}.`,
    });

    broadcastMatchUpdate(id, 'LEFT', formattedUpdatedMatch);

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Left match successfully',
      data: { match: formattedUpdatedMatch },
    });
  } catch (error) {
    next(error);
  }
};

// Helper to calculate authoritative match price (isolated RRR / Playnow / 299 promo vs other grounds)
export const calculateMatchPrice = (match: any, bookingType: string, playerCount: number = 1, durationHours: number = 2) => {
  const isRRR =
    match.ground?.slug === 'rrr-cricket-club-kidawali-faridabad' ||
    match.groundId === '04b615ea-c1a6-4a60-9b06-926d3b3b020c' ||
    (match.ground?.name && match.ground.name.includes('RRR'));

  const isPlaynow =
    match.ground?.slug === 'playnow-cricket-ground' ||
    match.ground?.slug === 'playnow-cricket-ground-sector-86-gurugram' ||
    match.groundId === '8597cac9-2d50-4d71-9f16-60c1c8132ed7' ||
    (match.ground?.name && match.ground.name.includes('Playnow'));

  const isFixed299 = isRRR || isPlaynow || match.entryFee === 299 || match.date === '2026-10-03';

  const bType = (bookingType || 'INDIVIDUAL').toUpperCase().trim().replace('-', '_');

  if (isFixed299) {
    if (bType === 'INDIVIDUAL' || bType === 'SINGLE') {
      return {
        markedPrice: 373.75,
        discount: 74.75,
        finalPrice: 299,
        couponCode: 'BE11 WELCOMES',
      };
    } else if (bType === 'HALF_TEAM' || bType === 'TEAM') {
      return {
        markedPrice: 3250,
        discount: 650,
        finalPrice: 2600,
        couponCode: 'BE11 WELCOMES',
      };
    } else {
      return {
        markedPrice: 6250,
        discount: 1250,
        finalPrice: 5000,
        couponCode: 'BE11 WELCOMES',
      };
    }
  }

  // Generic / non-RRR match pricing
  let basePrice = 0;
  if (bType === 'INDIVIDUAL' || bType === 'SINGLE') {
    basePrice = match.entryFee;
  } else if (bType === 'TEAM' || bType === 'HALF_TEAM') {
    basePrice = match.entryFee * (playerCount || 11);
  } else {
    basePrice = (match.ground?.pricePerHour || 0) * (durationHours || 2);
  }

  const gst = basePrice * 0.18;
  const platformFee = 20.0;
  const finalPrice = Math.max(0, basePrice + gst + platformFee);

  return {
    markedPrice: basePrice,
    discount: 0,
    finalPrice,
    couponCode: undefined,
  };
};

// POST /api/v1/matches/:id/booking (Wallet Payment)
export const createPlayroomBooking = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const id = req.params.id as string;
    const { bookingType, playerCount, captainName, teamName, teamChoice, durationHours } = req.body;

    const match = await prisma.match.findUnique({
      where: { id },
      include: { ground: true },
    }) as any;

    if (!match) {
      throw new AppError('Match not found', HttpStatus.NOT_FOUND);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND);
    }

    const effectiveBookingType = (bookingType === 'SINGLE' ? 'INDIVIDUAL' : bookingType) || 'INDIVIDUAL';
    const count = parseInt(playerCount || '1', 10);
    const duration = parseInt(durationHours || '2', 10);

    if (match.date === '2026-10-03' && effectiveBookingType !== 'INDIVIDUAL') {
      throw new AppError('This match is open for Individual Player bookings only', HttpStatus.BAD_REQUEST);
    }

    // Check capacity and duplicate joining for individual/team bookings
    if (effectiveBookingType !== 'FULL_GROUND' && effectiveBookingType !== 'ENTIRE_VENUE') {
      if (match.playersJoined >= match.totalPlayers) {
        throw new AppError('Match is already full', HttpStatus.BAD_REQUEST);
      }
      const teamA = typeof match.teamA === 'string' ? JSON.parse(match.teamA) : (match.teamA || []);
      const teamB = typeof match.teamB === 'string' ? JSON.parse(match.teamB) : (match.teamB || []);
      const existsA = teamA.some((p: any) => p.id === userId);
      const existsB = teamB.some((p: any) => p.id === userId);
      if (existsA || existsB) {
        throw new AppError('You have already joined this match', HttpStatus.BAD_REQUEST);
      }
    }

    // Authoritative pricing
    const pricing = calculateMatchPrice(match, effectiveBookingType, count, duration);
    const finalPrice = pricing.finalPrice;

    if (user.walletBalance < finalPrice) {
      throw new AppError(
        `Insufficient wallet balance. Balance: ₹${user.walletBalance}, Required: ₹${finalPrice}`,
        HttpStatus.BAD_REQUEST
      );
    }

    const isRRR =
      match.ground?.slug === 'rrr-cricket-club-kidawali-faridabad' ||
      match.groundId === '04b615ea-c1a6-4a60-9b06-926d3b3b020c' ||
      (match.ground?.name && match.ground.name.includes('RRR'));

    // Process atomic checkout booking transaction
    const booking = await prisma.$transaction(async (tx) => {
      // 1. Deduct wallet
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { decrement: finalPrice } },
      });

      // 2. Create Transaction receipt log
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: finalPrice,
          type: 'DEBIT',
          description: isRRR
            ? `RRR Match Booking`
            : `Match Booking [${effectiveBookingType}] - ${match.ground.name}`,
        },
      });

      // 3. Create Booking DB entry with extended fields
      const newBooking = await tx.booking.create({
        data: {
          groundId: match.groundId,
          customerId: userId,
          customerName: `${user.firstName} ${user.lastName}`,
          customerPhone: user.phone,
          customerEmail: user.email,
          date: match.date,
          startTime: match.startTime,
          endTime: match.startTime,
          totalPrice: finalPrice,
          status: 'PENDING',
          paymentStatus: 'PAID',
          bookingType: effectiveBookingType,
          playerCount: count,
          captainName,
          teamName,
          groundReserved: effectiveBookingType === 'FULL_GROUND' || effectiveBookingType === 'ENTIRE_VENUE',
          invoice: `inv_m_${Math.floor(100000 + Math.random() * 900000)}`,
          transactionId: `tx_w_${Math.floor(10000000 + Math.random() * 90000000)}`,
          qrCode: `qr_m_${Math.floor(100000 + Math.random() * 900000)}`,
        },
        include: {
          ground: true,
        },
      });

      // 4. Update match rosters if not booking the entire ground
      if (effectiveBookingType !== 'FULL_GROUND' && effectiveBookingType !== 'ENTIRE_VENUE') {
        const teamA = typeof match.teamA === 'string' ? JSON.parse(match.teamA) : (match.teamA || []);
        const teamB = typeof match.teamB === 'string' ? JSON.parse(match.teamB) : (match.teamB || []);
        const playerDetails = { id: user.id, firstName: user.firstName, lastName: user.lastName };

        // Auto assign or teamChoice
        const choice = teamChoice || (teamA.length <= teamB.length ? 'A' : 'B');
        if (effectiveBookingType === 'INDIVIDUAL' || effectiveBookingType === 'SINGLE') {
          if (choice === 'A') teamA.push(playerDetails);
          else teamB.push(playerDetails);
        } else if (effectiveBookingType === 'TEAM' || effectiveBookingType === 'HALF_TEAM') {
          teamA.push({ id: user.id, firstName: user.firstName, lastName: `(Captain - ${teamName || 'Squad'})` });
          for (let i = 1; i < count; i++) {
            if (i % 2 === 0) {
              teamA.push({ id: `team-member-${i}`, firstName: `Squad Member ${i}`, lastName: '' });
            } else {
              teamB.push({ id: `team-member-${i}`, firstName: `Squad Member ${i}`, lastName: '' });
            }
          }
        }

        const nextPlayersJoined = Math.min(match.totalPlayers, match.playersJoined + count);
        let nextStatus = 'Open';
        const ratio = nextPlayersJoined / match.totalPlayers;
        if (nextPlayersJoined >= match.totalPlayers) {
          nextStatus = 'Match Full';
        } else if (ratio >= 0.95) {
          nextStatus = 'Almost Full';
        } else if (ratio >= 0.8) {
          nextStatus = 'Filling Fast';
        }

        await tx.match.update({
          where: { id },
          data: {
            playersJoined: nextPlayersJoined,
            status: nextStatus,
            teamA: JSON.stringify(teamA),
            teamB: JSON.stringify(teamB),
          },
        });
      } else {
        // Mark match as reserved
        await tx.match.update({
          where: { id },
          data: {
            status: 'Reserved',
          },
        });
      }

      // 5. System Notification
      await tx.notification.create({
        data: {
          userId,
          title: `Match Booking Payment Successful!`,
          message: `Your booking for ${match.ground.name} on ${match.date} has been paid from wallet (Status: PENDING ADMIN CONFIRMATION).`,
        },
      });

      return newBooking;
    });

    const updatedMatch = await prisma.match.findUnique({
      where: { id },
      include: { ground: true },
    });
    const formattedUpdatedMatch = formatMatchResponse(updatedMatch);
    if (formattedUpdatedMatch) {
      broadcastMatchUpdate(id, 'JOINED', formattedUpdatedMatch);
    }

    res.status(HttpStatus.CREATED).json({
      success: true,
      message: 'Booking paid from wallet successfully',
      data: { booking, match: formattedUpdatedMatch },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/matches/:id/create-order (Razorpay Order for Live Match)
export const createMatchPaymentOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const id = req.params.id as string;
    const { bookingType, playerCount, durationHours } = req.body;

    const match = await prisma.match.findUnique({
      where: { id },
      include: { ground: true },
    }) as any;

    if (!match) {
      throw new AppError('Match not found', HttpStatus.NOT_FOUND);
    }

    const effectiveBookingType = (bookingType === 'SINGLE' ? 'INDIVIDUAL' : bookingType) || 'INDIVIDUAL';
    const count = parseInt(playerCount || '1', 10);
    const duration = parseInt(durationHours || '2', 10);

    if (match.date === '2026-10-03' && effectiveBookingType !== 'INDIVIDUAL') {
      throw new AppError('This match is open for Individual Player bookings only', HttpStatus.BAD_REQUEST);
    }

    // Check capacity and duplicate joining
    if (effectiveBookingType !== 'FULL_GROUND' && effectiveBookingType !== 'ENTIRE_VENUE') {
      if (match.playersJoined >= match.totalPlayers) {
        throw new AppError('Match is already full', HttpStatus.BAD_REQUEST);
      }
      const teamA = typeof match.teamA === 'string' ? JSON.parse(match.teamA) : (match.teamA || []);
      const teamB = typeof match.teamB === 'string' ? JSON.parse(match.teamB) : (match.teamB || []);
      const existsA = teamA.some((p: any) => p.id === userId);
      const existsB = teamB.some((p: any) => p.id === userId);
      if (existsA || existsB) {
        throw new AppError('You have already joined this match', HttpStatus.BAD_REQUEST);
      }
    }

    // Authoritative pricing
    const pricing = calculateMatchPrice(match, effectiveBookingType, count, duration);
    const finalPrice = pricing.finalPrice;
    const amountPaise = Math.round(finalPrice * 100);

    if (!amountPaise || amountPaise <= 0) {
      throw new AppError('Invalid match entry amount for payment', HttpStatus.BAD_REQUEST);
    }

    let razorpayOrderId: string;
    if (isRazorpayConfigured()) {
      const order = await createServerOrder({
        amountPaise,
        currency: 'INR',
        receipt: `match_${match.id.slice(0, 8)}_${Date.now()}`,
        notes: {
          matchId: match.id,
          groundId: match.groundId,
          groundName: match.ground?.name || 'Cricket Ground',
          bookingType: effectiveBookingType,
          userId,
          date: match.date,
          startTime: match.startTime,
        },
      });
      razorpayOrderId = order.id;
    } else {
      razorpayOrderId = `order_sim_${Math.random().toString(36).substring(2, 15)}`;
    }

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Razorpay order created successfully for match booking',
      data: {
        orderId: razorpayOrderId,
        amount: amountPaise,
        currency: 'INR',
        keyId: getRazorpayPublicKey(),
        matchId: match.id,
        finalPrice,
        markedPrice: pricing.markedPrice,
        discount: pricing.discount,
        couponCode: pricing.couponCode,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/matches/:id/verify-payment (Verify Razorpay Payment for Live Match)
export const verifyMatchPayment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const id = req.params.id as string;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingType, playerCount, teamChoice, captainName, teamName } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new AppError(
        'Missing required payment credentials (razorpayOrderId, razorpayPaymentId, razorpaySignature)',
        HttpStatus.BAD_REQUEST
      );
    }

    const match = await prisma.match.findUnique({
      where: { id },
      include: { ground: true },
    }) as any;

    if (!match) {
      throw new AppError('Match not found', HttpStatus.NOT_FOUND);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND);
    }

    const effectiveBookingType = (bookingType === 'SINGLE' ? 'INDIVIDUAL' : bookingType) || 'INDIVIDUAL';
    const count = parseInt(playerCount || '1', 10);
    const pricing = calculateMatchPrice(match, effectiveBookingType, count);
    const expectedAmountPaise = Math.round(pricing.finalPrice * 100);

    // Cryptographic verification of HMAC-SHA256 signature
    if (isRazorpayConfigured()) {
      const isValidSignature = verifyRazorpaySignature({
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
      });

      if (!isValidSignature) {
        throw new AppError('Payment signature verification failed. Invalid credentials.', HttpStatus.BAD_REQUEST);
      }

      // Authoritative verification with Razorpay API
      const paymentDetails = await fetchRazorpayPayment(razorpayPaymentId);
      if (paymentDetails.amount !== expectedAmountPaise) {
        logger.error('Payment amount manipulation detected in match payment', {
          matchId: match.id,
          expectedPaise: expectedAmountPaise,
          receivedPaise: paymentDetails.amount,
        });
        throw new AppError(
          'Payment amount mismatch. Transaction rejected.',
          HttpStatus.BAD_REQUEST
        );
      }

      if (paymentDetails.currency !== 'INR') {
        throw new AppError('Invalid payment currency', HttpStatus.BAD_REQUEST);
      }

      if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
        throw new AppError(
          `Payment is not in an authorized or captured state (Status: ${paymentDetails.status})`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Protect against reusing payment ID
    const existingPayment = await prisma.booking.findFirst({
      where: {
        transactionId: razorpayPaymentId,
        paymentStatus: 'PAID',
      },
    });
    if (existingPayment) {
      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Payment has already been confirmed for this booking',
        data: {
          booking: existingPayment,
          match: formatMatchResponse(match),
        },
      });
    }

    const isRRR =
      match.ground?.slug === 'rrr-cricket-club-kidawali-faridabad' ||
      match.groundId === '04b615ea-c1a6-4a60-9b06-926d3b3b020c' ||
      (match.ground?.name && match.ground.name.includes('RRR'));

    // Atomic transaction: add player to match & create booking record
    const result = await prisma.$transaction(async (tx) => {
      // Create Booking DB entry with PENDING status, PAID paymentStatus
      const newBooking = await tx.booking.create({
        data: {
          groundId: match.groundId,
          customerId: userId,
          customerName: `${user.firstName} ${user.lastName}`,
          customerPhone: user.phone,
          customerEmail: user.email,
          date: match.date,
          startTime: match.startTime,
          endTime: match.startTime,
          totalPrice: pricing.finalPrice,
          status: 'PENDING',
          paymentStatus: 'PAID',
          bookingType: effectiveBookingType,
          playerCount: count,
          captainName,
          teamName,
          groundReserved: effectiveBookingType === 'FULL_GROUND' || effectiveBookingType === 'ENTIRE_VENUE',
          invoice: `inv_m_${Math.floor(100000 + Math.random() * 900000)}`,
          transactionId: razorpayPaymentId,
          qrCode: `qr_m_${Math.floor(100000 + Math.random() * 900000)}`,
        },
        include: {
          ground: true,
        },
      });

      // Update match rosters if not booking the entire ground
      if (effectiveBookingType !== 'FULL_GROUND' && effectiveBookingType !== 'ENTIRE_VENUE') {
        const teamA = typeof match.teamA === 'string' ? JSON.parse(match.teamA) : (match.teamA || []);
        const teamB = typeof match.teamB === 'string' ? JSON.parse(match.teamB) : (match.teamB || []);
        const playerDetails = { id: user.id, firstName: user.firstName, lastName: user.lastName };

        const choice = teamChoice || (teamA.length <= teamB.length ? 'A' : 'B');
        if (effectiveBookingType === 'INDIVIDUAL' || effectiveBookingType === 'SINGLE') {
          if (choice === 'A') teamA.push(playerDetails);
          else teamB.push(playerDetails);
        } else if (effectiveBookingType === 'TEAM' || effectiveBookingType === 'HALF_TEAM') {
          teamA.push({ id: user.id, firstName: user.firstName, lastName: `(Captain - ${teamName || 'Squad'})` });
          for (let i = 1; i < count; i++) {
            if (i % 2 === 0) {
              teamA.push({ id: `team-member-${i}`, firstName: `Squad Member ${i}`, lastName: '' });
            } else {
              teamB.push({ id: `team-member-${i}`, firstName: `Squad Member ${i}`, lastName: '' });
            }
          }
        }

        const nextPlayersJoined = Math.min(match.totalPlayers, match.playersJoined + count);
        let nextStatus = 'Open';
        const ratio = nextPlayersJoined / match.totalPlayers;
        if (nextPlayersJoined >= match.totalPlayers) {
          nextStatus = 'Match Full';
        } else if (ratio >= 0.95) {
          nextStatus = 'Almost Full';
        } else if (ratio >= 0.8) {
          nextStatus = 'Filling Fast';
        }

        const updated = await tx.match.update({
          where: { id },
          data: {
            playersJoined: nextPlayersJoined,
            status: nextStatus,
            teamA: JSON.stringify(teamA),
            teamB: JSON.stringify(teamB),
          },
          include: {
            ground: true,
          },
        });

        // Notification
        await tx.notification.create({
          data: {
            userId,
            title: `Payment Verified! Spot Confirmed`,
            message: `Your payment of ₹${pricing.finalPrice} for ${match.ground.name} on ${match.date} (${match.startTime}) was verified. Status: PENDING ADMIN CONFIRMATION.`,
          },
        });

        return { booking: newBooking, match: updated };
      } else {
        const updated = await tx.match.update({
          where: { id },
          data: {
            status: 'Reserved',
          },
          include: {
            ground: true,
          },
        });

        await tx.notification.create({
          data: {
            userId,
            title: `Payment Verified! Full Ground Reserved`,
            message: `Your payment of ₹${pricing.finalPrice} for ${match.ground.name} on ${match.date} was verified. Status: PENDING ADMIN CONFIRMATION.`,
          },
        });

        return { booking: newBooking, match: updated };
      }
    });

    const formattedMatchResult = result.match ? formatMatchResponse(result.match) : result.match;
    broadcastMatchUpdate(id, 'JOINED', formattedMatchResult);

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Payment verified and match spot reserved successfully',
      data: {
        booking: result.booking,
        match: formattedMatchResult,
      },
    });
  } catch (error) {
    next(error);
  }
};
