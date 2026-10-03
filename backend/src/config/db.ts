import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

export const prisma = new PrismaClient();

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('📚 Database successfully connected via Prisma');

    // Ensure Playnow Cricket Ground location record is updated in DB
    await prisma.ground.updateMany({
      where: { slug: 'playnow-cricket-ground' },
      data: {
        location: 'Gurugram, Haryana',
        address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
        city: 'Gurugram',
        state: 'Haryana',
        country: 'India',
        latitude: 28.403646,
        longitude: 77.136787,
        mapsUrl: 'https://maps.app.goo.gl/x6HeybuKuDvSvzDYA',
      },
    }).catch((err) => {
      logger.warn('Could not auto-update Playnow ground record in DB:', err);
    });
  } catch (error) {
    logger.error('❌ Failed to connect to the database:', error);
    process.exit(1);
  }
};
