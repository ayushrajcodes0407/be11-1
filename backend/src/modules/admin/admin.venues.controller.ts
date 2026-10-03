import { Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { HttpStatus } from '@be11/shared';
import { AuthenticatedRequest } from '../../middlewares/auth.js';
import { adminAuditService } from './admin.audit.service.js';

export const getAdminVenues = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const grounds = await prisma.ground.findMany({
      include: {
        bookings: {
          select: {
            id: true,
            status: true,
            totalPrice: true,
            date: true,
          },
        },
        matches: {
          where: { status: { in: ['Open', 'Live'] } },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const venueList = grounds.map((g) => {
      const confirmed = g.bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED');
      const pending = g.bookings.filter((b) => b.status === 'PENDING');
      const cancelled = g.bookings.filter((b) => b.status === 'CANCELLED');
      const totalRevenue = confirmed.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

      const isPlaynow =
        g.slug === 'playnow-cricket-ground' ||
        g.slug === 'playnow-cricket-ground-sector-86-gurugram' ||
        g.id === '8597cac9-2d50-4d71-9f16-60c1c8132ed7' ||
        (typeof g.name === 'string' && g.name.toLowerCase().includes('playnow'));

      return {
        id: g.id,
        name: isPlaynow ? 'Playnow Cricket Ground' : g.name,
        slug: isPlaynow ? 'playnow-cricket-ground' : g.slug,
        sport: g.sport,
        city: isPlaynow ? 'Gurugram' : g.city,
        state: isPlaynow ? 'Haryana' : g.state,
        location: isPlaynow ? 'Gurugram, Haryana' : g.location,
        address: isPlaynow ? 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102' : g.address,
        pricePerHour: g.pricePerHour,
        pricingLabel: g.pricingLabel,
        ownerName: g.ownerName,
        ownerPhone: g.ownerPhone,
        amenities: g.amenities,
        rating: g.rating,
        reviewsCount: g.reviewsCount,
        isActive: g.isActive,
        stats: {
          totalBookings: g.bookings.length,
          confirmedBookings: confirmed.length,
          pendingBookings: pending.length,
          cancelledBookings: cancelled.length,
          revenue: totalRevenue,
          activeLiveMatches: g.matches.length,
        },
        url: `/venues/${isPlaynow ? 'playnow-cricket-ground' : (g.slug || g.id)}`,
      };
    });

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Admin venues retrieved successfully',
      data: {
        venues: venueList,
        total: venueList.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleAdminVenueStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const adminUserId = req.user?.userId;

    const ground = await prisma.ground.findUnique({
      where: { id },
    });

    if (!ground) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Venue not found',
      });
    }

    const newStatus = !ground.isActive;
    const updated = await prisma.ground.update({
      where: { id },
      data: { isActive: newStatus },
    });

    await adminAuditService.recordAction({
      adminId: adminUserId || 'system',
      adminName: req.user?.email || 'Admin',
      adminEmail: req.user?.email,
      action: 'VENUE_STATUS_TOGGLED',
      targetEntity: 'Ground',
      targetId: id,
      details: `Venue ${ground.name} status changed to ${newStatus ? 'ACTIVE' : 'INACTIVE'}`,
      metadata: { previousStatus: ground.isActive, newStatus },
    });

    res.status(HttpStatus.OK).json({
      success: true,
      message: `Venue ${ground.name} is now ${newStatus ? 'active' : 'inactive'}`,
      data: { venue: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminAuditLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { action, limit = '50', search } = req.query;
    const logs = await adminAuditService.getLogs({
      action: action as string,
      limit: parseInt(limit as string, 10) || 50,
      search: search as string,
    });

    res.status(HttpStatus.OK).json({
      success: true,
      message: 'Admin audit logs retrieved successfully',
      data: {
        logs,
        total: logs.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
