import { Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { HttpStatus } from '@be11/shared';
import { AppError } from '../../utils/appError.js';
import { AuthenticatedRequest } from '../../middlewares/auth.js';
import { broadcastMatchUpdate } from '../notifications/notifications.controller.js';
import { adminAuditService } from './admin.audit.service.js';
import { formatMatchResponse } from '../matches/matches.controller.js';

export const getAdminMatches = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '15',
      status,
      sport,
      groundId,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const takeNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 15));
    const skipNum = (pageNum - 1) * takeNum;

    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    if (sport && sport !== 'ALL') {
      where.sport = { equals: sport as string, mode: 'insensitive' };
    }

    if (groundId && groundId !== 'ALL') {
      const gId = groundId as string;
      const ground = await prisma.ground.findFirst({
        where: { OR: [{ id: gId }, { slug: gId }] },
      });
      if (ground) {
        where.groundId = ground.id;
      } else {
        where.groundId = gId;
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { hostName: { contains: q, mode: 'insensitive' } },
        { sport: { contains: q, mode: 'insensitive' } },
        { ground: { name: { contains: q, mode: 'insensitive' } } },
        { ground: { city: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, matches] = await Promise.all([
      prisma.match.count({ where }),
      prisma.match.findMany({
        where,
        include: {
          ground: {
            select: {
              id: true,
              name: true,
              slug: true,
              city: true,
              location: true,
              ownerName: true,
              ownerPhone: true,
            },
          },
        },
        orderBy: { date: 'asc' },
        skip: skipNum,
        take: takeNum,
      }),
    ]);

    const totalPages = Math.ceil(total / takeNum) || 1;

    // Overview metrics
    const [openCount, liveCount, completedCount, cancelledCount] = await Promise.all([
      prisma.match.count({ where: { status: 'Open' } }),
      prisma.match.count({ where: { status: 'Live' } }),
      prisma.match.count({ where: { status: 'Completed' } }),
      prisma.match.count({ where: { status: 'Cancelled' } }),
    ]);

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Admin live matches retrieved successfully',
      data: {
        matches: matches.map((rawM) => {
          const m = formatMatchResponse(rawM);
          let teamA: any[] = [];
          let teamB: any[] = [];
          try {
            teamA = typeof m.teamA === 'string' ? JSON.parse(m.teamA) : (m.teamA || []);
            teamB = typeof m.teamB === 'string' ? JSON.parse(m.teamB) : (m.teamB || []);
          } catch (_) {}

          return {
            id: m.id,
            sport: m.sport,
            date: m.date,
            startTime: m.startTime,
            entryFee: m.entryFee,
            playersJoined: m.playersJoined,
            totalPlayers: m.totalPlayers,
            spotsLeft: Math.max(0, m.totalPlayers - m.playersJoined),
            skillLevel: m.skillLevel,
            hostId: m.hostId,
            hostName: m.hostName,
            verifiedHost: m.verifiedHost,
            status: m.status,
            groundId: m.groundId,
            groundName: m.ground?.name,
            groundSlug: m.ground?.slug,
            groundCity: m.ground?.city,
            groundLocation: m.ground?.location,
            teamACount: teamA.length,
            teamBCount: teamB.length,
            createdAt: m.createdAt.toISOString(),
          };
        }),
        pagination: {
          page: pageNum,
          limit: takeNum,
          total,
          totalPages,
        },
        stats: {
          totalMatches: total,
          openMatches: openCount,
          liveMatches: liveCount,
          completedMatches: completedCount,
          cancelledMatches: cancelledCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminMatchById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const rawMatch = await prisma.match.findUnique({
      where: { id },
      include: {
        ground: true,
      },
    });

    if (!rawMatch) {
      throw new AppError('Match not found', HttpStatus.NOT_FOUND);
    }

    const match = formatMatchResponse(rawMatch);

    let teamA: any[] = [];
    let teamB: any[] = [];
    try {
      teamA = typeof match.teamA === 'string' ? JSON.parse(match.teamA) : (match.teamA || []);
      teamB = typeof match.teamB === 'string' ? JSON.parse(match.teamB) : (match.teamB || []);
    } catch (_) {}

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Match details retrieved successfully',
      data: {
        match: {
          ...match,
          teamA,
          teamB,
          spotsLeft: Math.max(0, match.totalPlayers - match.playersJoined),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createAdminMatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adminUserId = req.user?.userId;
    if (!adminUserId) {
      throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const {
      groundId,
      sport = 'Cricket',
      date,
      startTime,
      entryFee = 299,
      totalPlayers = 22,
      skillLevel = 'Intermediate',
    } = req.body;

    // 1. Validation
    if (!groundId) {
      throw new AppError('Venue (groundId) is required', HttpStatus.BAD_REQUEST);
    }
    if (!date) {
      throw new AppError('Match date (YYYY-MM-DD) is required', HttpStatus.BAD_REQUEST);
    }
    if (!startTime) {
      throw new AppError('Match start time is required', HttpStatus.BAD_REQUEST);
    }

    const parsedFee = parseFloat(entryFee);
    if (isNaN(parsedFee) || parsedFee < 0) {
      throw new AppError('Entry fee must be a valid non-negative number', HttpStatus.BAD_REQUEST);
    }

    const parsedCapacity = parseInt(totalPlayers, 10);
    if (isNaN(parsedCapacity) || parsedCapacity < 2 || parsedCapacity > 50) {
      throw new AppError('Total player capacity must be between 2 and 50', HttpStatus.BAD_REQUEST);
    }

    // 2. Lookup Ground
    const ground = await prisma.ground.findFirst({
      where: {
        OR: [{ id: groundId }, { slug: groundId }],
        isActive: true,
      },
    });

    if (!ground) {
      throw new AppError('Selected ground was not found or is currently inactive', HttpStatus.NOT_FOUND);
    }

    // 3. Lookup Host User (Admin)
    const hostUser = await prisma.user.findUnique({
      where: { id: adminUserId },
    });

    const hostName = hostUser ? `${hostUser.firstName} ${hostUser.lastName}` : 'BE11 Administrator';

    // 4. Anti-Collision Duplicate Check
    const existingConflict = await prisma.match.findFirst({
      where: {
        groundId: ground.id,
        date: date as string,
        startTime: startTime as string,
        status: { in: ['Open', 'Live'] },
      },
    });

    if (existingConflict) {
      throw new AppError(
        `A live match is already scheduled for ${ground.name} on ${date} at ${startTime}.`,
        HttpStatus.CONFLICT
      );
    }

    // 5. Create Match in Database
    const newMatch = await prisma.match.create({
      data: {
        groundId: ground.id,
        sport,
        date,
        startTime,
        entryFee: parsedFee,
        totalPlayers: parsedCapacity,
        playersJoined: 0,
        skillLevel,
        hostId: adminUserId,
        hostName,
        verifiedHost: true,
        status: 'Open',
        teamA: JSON.stringify([]),
        teamB: JSON.stringify([]),
      },
      include: {
        ground: true,
      },
    });

    // 6. Record Audit Log
    await adminAuditService.recordAction({
      adminId: adminUserId,
      adminName: hostName,
      adminEmail: req.user?.email,
      action: 'MATCH_CREATED',
      targetEntity: 'Match',
      targetId: newMatch.id,
      details: `Created live match at ${ground.name} on ${date} (${startTime}) with fee ₹${parsedFee} and capacity ${parsedCapacity}`,
      metadata: { entryFee: parsedFee, totalPlayers: parsedCapacity, groundId: ground.id },
    });

    const formattedMatch = formatMatchResponse(newMatch);

    // 7. Broadcast Socket.IO update
    try {
      broadcastMatchUpdate(newMatch.id, 'CREATED', formattedMatch);
    } catch (_) {}

    res.status(HttpStatus.CREATED).json({
      success: true,
      message: 'Live match created successfully',
      data: { match: formattedMatch },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelAdminMatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adminUserId = req.user?.userId;
    if (!adminUserId) {
      throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const id = req.params.id as string;
    const { reason = 'Cancelled by administrator' } = req.body;

    const match = await prisma.match.findUnique({
      where: { id },
      include: { ground: true },
    });

    if (!match) {
      throw new AppError('Match not found', HttpStatus.NOT_FOUND);
    }

    if (match.status === 'Cancelled') {
      throw new AppError('Match is already cancelled', HttpStatus.BAD_REQUEST);
    }

    const updatedMatch = await prisma.$transaction(async (tx) => {
      // 1. Update status
      const cancelled = await tx.match.update({
        where: { id },
        data: { status: 'Cancelled' },
        include: { ground: true },
      });

      // 2. Refund wallet if players had joined
      let teamA: any[] = [];
      let teamB: any[] = [];
      try {
        teamA = typeof match.teamA === 'string' ? JSON.parse(match.teamA) : (match.teamA || []);
        teamB = typeof match.teamB === 'string' ? JSON.parse(match.teamB) : (match.teamB || []);
      } catch (_) {}

      const allPlayers = [...teamA, ...teamB];
      if (match.entryFee > 0 && allPlayers.length > 0) {
        for (const player of allPlayers) {
          if (player.id) {
            await tx.user.update({
              where: { id: player.id },
              data: { walletBalance: { increment: match.entryFee } },
            });

            await tx.walletTransaction.create({
              data: {
                userId: player.id,
                amount: match.entryFee,
                type: 'CREDIT',
                description: `Refund for cancelled live match: ${match.ground?.name} (${match.date} - ${match.startTime})`,
              },
            });

            await tx.notification.create({
              data: {
                userId: player.id,
                title: 'Live Match Cancelled',
                message: `The live match at ${match.ground?.name} on ${match.date} was cancelled. Entry fee of ₹${match.entryFee} has been refunded to your BE11 Wallet.`,
              },
            });
          }
        }
      }

      return cancelled;
    });

    await adminAuditService.recordAction({
      adminId: adminUserId,
      adminName: req.user?.email || 'Admin',
      adminEmail: req.user?.email,
      action: 'MATCH_CANCELLED',
      targetEntity: 'Match',
      targetId: id,
      details: `Cancelled match at ${match.ground?.name} (${match.date}). Reason: ${reason}`,
      metadata: { reason, groundId: match.groundId, date: match.date },
    });

    try {
      broadcastMatchUpdate(id, 'UPDATED', updatedMatch);
    } catch (_) {}

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Live match successfully cancelled and participants refunded',
      data: { match: updatedMatch },
    });
  } catch (error) {
    next(error);
  }
};
