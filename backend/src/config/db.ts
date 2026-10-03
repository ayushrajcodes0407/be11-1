import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from './logger.js';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  schemaEnsured?: boolean;
  schemaPromise?: Promise<void> | null;
  dataSynced?: boolean;
  dataPromise?: Promise<void> | null;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

globalForPrisma.prisma = prisma;

export const ensureDatabaseSchema = async (): Promise<void> => {
  if (globalForPrisma.schemaEnsured) return;
  if (globalForPrisma.schemaPromise) return globalForPrisma.schemaPromise;

  globalForPrisma.schemaPromise = (async () => {
    try {
      const isPostgres = process.env.DATABASE_URL?.includes('postgres');
      if (isPostgres) {
        const queries = [
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneOtpHash" TEXT',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneOtpExpiresAt" TIMESTAMP(3)',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneOtpAttempts" INTEGER NOT NULL DEFAULT 0',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneOtpLastSentAt" TIMESTAMP(3)',
          'CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone")',
          `CREATE TABLE IF NOT EXISTS "WalletTopUp" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            "amount" DOUBLE PRECISION NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'INR',
            "status" TEXT NOT NULL DEFAULT 'CREATED',
            "razorpayOrderId" TEXT NOT NULL,
            "razorpayPaymentId" TEXT,
            "razorpaySignature" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          'CREATE UNIQUE INDEX IF NOT EXISTS "WalletTopUp_razorpayOrderId_key" ON "WalletTopUp"("razorpayOrderId")',
          'CREATE UNIQUE INDEX IF NOT EXISTS "WalletTopUp_razorpayPaymentId_key" ON "WalletTopUp"("razorpayPaymentId")',
          'CREATE INDEX IF NOT EXISTS "WalletTopUp_userId_idx" ON "WalletTopUp"("userId")',
          'CREATE INDEX IF NOT EXISTS "WalletTopUp_status_idx" ON "WalletTopUp"("status")',
          'ALTER TABLE "WalletTransaction" ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT',
          'ALTER TABLE "WalletTransaction" ADD COLUMN IF NOT EXISTS "razorpayPaymentId" TEXT',
          'CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_razorpayPaymentId_key" ON "WalletTransaction"("razorpayPaymentId") WHERE "razorpayPaymentId" IS NOT NULL',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "city" TEXT DEFAULT \'Mumbai\'',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "state" TEXT DEFAULT \'Maharashtra\'',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "favoriteSport" TEXT DEFAULT \'Cricket\'',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cricketPlayingRole" TEXT',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "favoriteIplTeam" TEXT',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "favoriteCricketPlayer" TEXT',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "battingStyle" TEXT',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bowlingStyle" TEXT',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "footballPosition" TEXT',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "favoriteFootballClub" TEXT',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "favoriteFootballPlayer" TEXT',
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredFoot" TEXT',
          `CREATE TABLE IF NOT EXISTS "AuditLog" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "adminId" TEXT NOT NULL,
            "adminName" TEXT,
            "adminEmail" TEXT,
            "action" TEXT NOT NULL,
            "targetEntity" TEXT NOT NULL,
            "targetId" TEXT,
            "details" TEXT,
            "metadata" JSONB,
            "ip" TEXT,
            "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          'CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")',
          'CREATE INDEX IF NOT EXISTS "AuditLog_targetEntity_idx" ON "AuditLog"("targetEntity")',
          'CREATE INDEX IF NOT EXISTS "AuditLog_adminId_idx" ON "AuditLog"("adminId")',
          'CREATE INDEX IF NOT EXISTS "AuditLog_timestamp_idx" ON "AuditLog"("timestamp")',
          `CREATE TABLE IF NOT EXISTS "Visitor" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "visitorId" TEXT NOT NULL,
            "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "firstAuthenticatedAt" TIMESTAMP(3),
            "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          'CREATE UNIQUE INDEX IF NOT EXISTS "Visitor_visitorId_key" ON "Visitor"("visitorId")',
          'ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "firstAuthenticatedAt" TIMESTAMP(3)',
          'CREATE INDEX IF NOT EXISTS "Visitor_userId_idx" ON "Visitor"("userId")',
          'CREATE INDEX IF NOT EXISTS "Visitor_firstSeenAt_idx" ON "Visitor"("firstSeenAt")',
          'CREATE INDEX IF NOT EXISTS "Visitor_firstAuthenticatedAt_idx" ON "Visitor"("firstAuthenticatedAt")',
          'CREATE INDEX IF NOT EXISTS "Visitor_lastSeenAt_idx" ON "Visitor"("lastSeenAt")',
          `CREATE TABLE IF NOT EXISTS "VisitorSession" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "visitorId" TEXT NOT NULL,
            "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "endedAt" TIMESTAMP(3),
            "entryPage" TEXT,
            "exitPage" TEXT,
            "userAgent" TEXT,
            "deviceType" TEXT,
            "referrer" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          'CREATE INDEX IF NOT EXISTS "VisitorSession_visitorId_idx" ON "VisitorSession"("visitorId")',
          'CREATE INDEX IF NOT EXISTS "VisitorSession_userId_idx" ON "VisitorSession"("userId")',
          'CREATE INDEX IF NOT EXISTS "VisitorSession_startedAt_idx" ON "VisitorSession"("startedAt")',
          'CREATE INDEX IF NOT EXISTS "VisitorSession_lastSeenAt_idx" ON "VisitorSession"("lastSeenAt")',
          `CREATE TABLE IF NOT EXISTS "PageView" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "visitorId" TEXT NOT NULL,
            "sessionId" TEXT REFERENCES "VisitorSession"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            "path" TEXT NOT NULL,
            "referrer" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`,
          'CREATE INDEX IF NOT EXISTS "PageView_visitorId_idx" ON "PageView"("visitorId")',
          'CREATE INDEX IF NOT EXISTS "PageView_sessionId_idx" ON "PageView"("sessionId")',
          'CREATE INDEX IF NOT EXISTS "PageView_userId_idx" ON "PageView"("userId")',
          'CREATE INDEX IF NOT EXISTS "PageView_path_idx" ON "PageView"("path")',
          'CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView"("createdAt")',
          // Ensure orphaned sessions have matching visitor parent before adding constraint
          'INSERT INTO "Visitor" ("id", "visitorId", "firstSeenAt", "lastSeenAt", "createdAt", "updatedAt") SELECT gen_random_uuid(), vs."visitorId", vs."startedAt", vs."lastSeenAt", vs."createdAt", vs."createdAt" FROM "VisitorSession" vs WHERE NOT EXISTS (SELECT 1 FROM "Visitor" v WHERE v."visitorId" = vs."visitorId") ON CONFLICT DO NOTHING',
          `DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'VisitorSession_visitorId_fkey'
            ) THEN
              ALTER TABLE "VisitorSession" ADD CONSTRAINT "VisitorSession_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("visitorId") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
          END $$;`,
          `DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'PageView_visitorId_fkey'
            ) THEN
              ALTER TABLE "PageView" ADD CONSTRAINT "PageView_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("visitorId") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
          END $$;`,
        ];
        for (const q of queries) {
          await prisma.$executeRawUnsafe(q);
        }
        globalForPrisma.schemaEnsured = true;
        logger.info('✅ Database schema verified in PostgreSQL (Phone auth, WalletTopUp, Profile fields, AuditLog, Visitor Analytics)');
      } else {
        globalForPrisma.schemaEnsured = true;
      }

      await syncProductionData();
    } catch (err: any) {
      logger.warn('⚠️ Non-fatal schema verification notice:', err?.message || err);
      globalForPrisma.schemaEnsured = true;
    } finally {
      globalForPrisma.schemaPromise = null;
    }
  })();

  return globalForPrisma.schemaPromise;
};

export const syncProductionData = async (): Promise<void> => {
  if (globalForPrisma.dataSynced) return;
  if (globalForPrisma.dataPromise) return globalForPrisma.dataPromise;

  globalForPrisma.dataPromise = (async () => {
    try {
      // 1. Update AB Cricket Ground media to authentic repository assets
      const abImages = [
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

      const abGround = await prisma.ground.findFirst({
        where: {
          OR: [
            { slug: 'ab-cricket-ground' },
            { id: '2f1230f1-5219-4c01-a3cb-19fa90896188' },
          ],
        },
      });

      if (abGround) {
        await prisma.ground.update({
          where: { id: abGround.id },
          data: {
            images: abImages,
            videos: [],
          },
        });
        logger.info('✅ AB Cricket Ground media updated to authentic assets (9 images, 0 videos)');
      }

      // 2. Identify Grounds for October 3, 2026 matches
      const playnowGround = await prisma.ground.findFirst({
        where: {
          OR: [
            { slug: 'playnow-cricket-ground' },
            { slug: 'playnow-cricket-ground-sector-86-gurugram' },
            { id: '8597cac9-2d50-4d71-9f16-60c1c8132ed7' },
            { name: { contains: 'Playnow', mode: 'insensitive' } },
          ],
        },
      });

      if (playnowGround) {
        if (
          playnowGround.city !== 'Gurugram' ||
          playnowGround.location !== 'Gurugram, Haryana' ||
          playnowGround.mapsUrl !== 'https://maps.app.goo.gl/omqt5t5SVrkQTMGV9' ||
          playnowGround.address !== 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102'
        ) {
          await prisma.ground.update({
            where: { id: playnowGround.id },
            data: {
              slug: 'playnow-cricket-ground',
              location: 'Gurugram, Haryana',
              address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
              city: 'Gurugram',
              state: 'Haryana',
              country: 'India',
              latitude: 28.403646,
              longitude: 77.136787,
              mapsUrl: 'https://maps.app.goo.gl/omqt5t5SVrkQTMGV9',
            },
          });
          logger.info('✅ Synchronized Playnow Cricket Ground location to Gurugram in database');
        }
      }

      const rrrGround = await prisma.ground.findFirst({
        where: {
          OR: [
            { slug: 'rrr-cricket-club-kidawali-faridabad' },
            { id: '04b615ea-c1a6-4a60-9b06-926d3b3b020c' },
            { name: { contains: 'RRR', mode: 'insensitive' } },
          ],
        },
      });

      // Determine official host user
      let hostUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: '2080c161-0d9a-46e1-9d2b-6aed4d8b1b67' },
            { email: 'venues@be11.in' },
          ],
        },
      });

      if (!hostUser) {
        hostUser = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
        });
      }

      const hostId = hostUser?.id || '2080c161-0d9a-46e1-9d2b-6aed4d8b1b67';
      const hostName = hostUser
        ? `${hostUser.firstName || ''} ${hostUser.lastName || ''}`.trim() || 'Ayush Rajput'
        : 'Ayush Rajput';

      // 3. Ensure Playnow Match for Saturday, October 3, 2026
      if (playnowGround) {
        const existingPlaynowMatch = await prisma.match.findFirst({
          where: {
            groundId: playnowGround.id,
            date: '2026-10-03',
          },
        });

        if (!existingPlaynowMatch) {
          await prisma.match.create({
            data: {
              groundId: playnowGround.id,
              sport: 'Cricket',
              date: '2026-10-03',
              startTime: '10:00 AM – 2:00 PM',
              entryFee: 299,
              playersJoined: 0,
              totalPlayers: 22,
              skillLevel: 'Intermediate',
              hostId,
              hostName,
              verifiedHost: true,
              status: 'Open',
              teamA: JSON.stringify([]),
              teamB: JSON.stringify([]),
            },
          });
          logger.info('✅ Created Playnow match for Saturday, October 3, 2026');
        }
      }

      // 4. Ensure RRR Match for Saturday, October 3, 2026
      if (rrrGround) {
        const existingRrrMatch = await prisma.match.findFirst({
          where: {
            groundId: rrrGround.id,
            date: '2026-10-03',
          },
        });

        if (!existingRrrMatch) {
          await prisma.match.create({
            data: {
              groundId: rrrGround.id,
              sport: 'Cricket',
              date: '2026-10-03',
              startTime: '10:00 AM – 2:00 PM',
              entryFee: 299,
              playersJoined: 0,
              totalPlayers: 22,
              skillLevel: 'Intermediate',
              hostId,
              hostName,
              verifiedHost: true,
              status: 'Open',
              teamA: JSON.stringify([]),
              teamB: JSON.stringify([]),
            },
          });
          logger.info('✅ Created RRR match for Saturday, October 3, 2026');
        }
      }

      // 5. Ensure Official Admin Accounts Exist (skip expensive bcrypt if user exists)
      const adminEmail = (process.env.ADMIN_EMAIL || 'admin@be11.com').trim().toLowerCase();
      const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

      if (!existingAdmin) {
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
        const adminHash = await bcrypt.hash(adminPassword, 10);
        await prisma.user.create({
          data: {
            email: adminEmail,
            passwordHash: adminHash,
            firstName: process.env.ADMIN_FIRST_NAME || 'System',
            lastName: process.env.ADMIN_LAST_NAME || 'Administrator',
            phone: process.env.ADMIN_PHONE || '+919876543212',
            role: 'ADMIN',
            walletBalance: 0.0,
            emailVerified: true,
          },
        });
      }

      const superAdminEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@be11.com').trim().toLowerCase();
      const existingSuperAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } });

      if (!existingSuperAdmin) {
        const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
        const superAdminHash = await bcrypt.hash(superAdminPassword, 10);
        await prisma.user.create({
          data: {
            email: superAdminEmail,
            passwordHash: superAdminHash,
            firstName: 'Super',
            lastName: 'Admin',
            phone: '+919876543211',
            role: 'SUPER_ADMIN',
            walletBalance: 0.0,
            emailVerified: true,
          },
        });
      }
      logger.info('✅ Official Admin accounts verified and synchronized.');

      globalForPrisma.dataSynced = true;
    } catch (err: any) {
      logger.warn('⚠️ Non-fatal syncProductionData notice:', err?.message || err);
      globalForPrisma.dataSynced = true;
    } finally {
      globalForPrisma.dataPromise = null;
    }
  })();

  return globalForPrisma.dataPromise;
};

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('📚 Database successfully connected via Prisma');
    await ensureDatabaseSchema();
  } catch (error) {
    logger.error('❌ Failed to connect to the database:', error);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
};
