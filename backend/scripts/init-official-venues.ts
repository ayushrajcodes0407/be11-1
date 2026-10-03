import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🏏 BE11 Production Venue Initializer');
  console.log('-------------------------------------------');

  // 1. Ensure official platform venue manager user exists (required for foreign key ground.ownerId)
  const officialOwnerEmail = 'venues@be11.in';
  let ownerUser = await prisma.user.findUnique({
    where: { email: officialOwnerEmail },
  });

  if (!ownerUser) {
    const passwordHash = await bcrypt.hash('BE11OfficialOwner@2026', 12);
    ownerUser = await prisma.user.create({
      data: {
        email: officialOwnerEmail,
        passwordHash,
        firstName: 'BE11',
        lastName: 'Venues',
        phone: '+91 97116 69718',
        role: 'OWNER',
        emailVerified: true,
        walletBalance: 0.0,
      },
    });
    console.log(`✅ Platform venue manager account created: ${ownerUser.email}`);
  } else {
    console.log(`ℹ️ Platform venue manager account exists: ${ownerUser.email}`);
  }

  // 2. Definition of the 3 Official Venues
  const officialVenues = [
    {
      name: 'RRR Cricket Club Kidawali Faridabad',
      slug: 'rrr-cricket-club-kidawali-faridabad',
      description:
        'Premier cricket facility located at Bhati House, Kidawali Gaon in Faridabad. Featuring professional turf pitches, lush outfields, night floodlighting, dugout pavilion, and dedicated practice nets.',
      location: 'Kidawali, Pusta Road, Faridabad',
      address:
        'Bhati House, Kidawali Gaon, Faridabad, Kirawali, Pusta Road, Sherpur Khadar, Faridabad - 121002, Haryana, India',
      city: 'Faridabad',
      state: 'Haryana',
      country: 'India',
      pricePerHour: 0.0,
      pricingLabel: 'Contact for pricing',
      pricingRules: { type: 'CONTACT_ONLY', label: 'Price on request' },
      sport: 'Cricket',
      amenities: [
        'Turf Pitch',
        'Flood Lights',
        'Pavilion / Dugout',
        'Practice Nets',
        'Drinking Water',
        'Washrooms',
      ],
      images: [
        '/venues/rrr/rrr-cricket-club-kidawali-sherpur-khadar-faridabad-sports-clubs-cover-photo.jpg',
        '/venues/rrr/rrr-cricket-club-kidawali-sherpur-khadar-faridabad-sports-clubs-7bf921d9yg.jpg',
        '/venues/rrr/rrr-cricket-club-kidawali-sherpur-khadar-faridabad-sports-clubs-vqt022xlpv.jpg',
        '/venues/rrr/rrr-cricket-club-kidawali-sherpur-khadar-faridabad-sports-clubs-x327wev07c.jpg',
      ],
      videos: [],
      ownerId: ownerUser.id,
      ownerName: 'Rishi',
      ownerPhone: '+91 97116 69718',
      mapsUrl: 'https://maps.google.com/?q=28.466611,77.397333',
      rating: 0.0,
      reviewsCount: 0,
      latitude: 28.466611,
      longitude: 77.397333,
      isActive: true,
    },
    {
      name: 'Playnow Cricket Ground',
      slug: 'playnow-cricket-ground',
      description:
        'Top-tier cricket arena in Gurugram designed for competitive day and night matches. Fully equipped with tournament-grade pitch, LED floodlights, player dugout, and high quality media streaming equipment.',
      location: 'Gurugram, Haryana',
      address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
      city: 'Gurugram',
      state: 'Haryana',
      country: 'India',
      pricePerHour: 5000.0,
      pricingLabel: 'From ₹5,000',
      pricingRules: {
        type: 'TIME_SLOT_MATRIX',
        weekday: {
          morning: { ENTIRE_VENUE: 5000, TEAM_OF_11: 2500, INDIVIDUAL: 250 },
          afternoon: { ENTIRE_VENUE: 5000, TEAM_OF_11: 2500, INDIVIDUAL: 250 },
          night: { ENTIRE_VENUE: 10000, TEAM_OF_11: 5000, INDIVIDUAL: 500 },
        },
        weekend: {
          morning: { ENTIRE_VENUE: 10000, TEAM_OF_11: 5000, INDIVIDUAL: 500 },
          afternoon: { ENTIRE_VENUE: 5000, TEAM_OF_11: 2500, INDIVIDUAL: 250 },
          dayNight: { ENTIRE_VENUE: 10000, TEAM_OF_11: 5000, INDIVIDUAL: 500 },
          night: { ENTIRE_VENUE: 11000, TEAM_OF_11: 5500, INDIVIDUAL: 550 },
        },
        teamCoverage: 'both teams',
      },
      sport: 'Cricket',
      amenities: [
        'Turf Pitch',
        'Flood Lights',
        'Dugout',
        'Cafeteria',
        'Parking',
        'Washrooms',
      ],
      images: ['/venues/playnow/Playnow cricket ground.png'],
      videos: [
        '/venues/playnow/Playnow cricket ground.mp4',
        '/venues/playnow/Playnow_cricket_ground.mp4',
      ],
      ownerId: ownerUser.id,
      ownerName: 'Aanurag Jain',
      ownerPhone: '+91 95992 80399',
      mapsUrl: 'https://maps.app.goo.gl/x6HeybuKuDvSvzDYA',
      rating: 0.0,
      reviewsCount: 0,
      latitude: 28.403646,
      longitude: 77.136787,
      isActive: true,
    },
    {
      name: 'AB Cricket Ground',
      slug: 'ab-cricket-ground',
      description:
        'State of the art cricket hub situated inside the Aravalli Golf Course precinct in Faridabad. Offers full match setup with umpires, scorers, sight screen, net sessions, and on-site cafeteria.',
      location: 'New Industrial Town, Faridabad',
      address:
        'New Industrial Town, Aravalli Golf Course, New Industrial Township, Faridabad, Haryana - 121001, India',
      city: 'Faridabad',
      state: 'Haryana',
      country: 'India',
      pricePerHour: 3500.0,
      pricingLabel: 'From ₹3,500',
      pricingRules: {
        type: 'PACKAGE_TIERS',
        tiers: {
          standard: {
            name: 'Standard Match Package',
            price: 3500,
            duration: '4 Hours',
          },
          extended: {
            name: 'Extended Day Match Package',
            price: 6500,
            duration: 'Full Day / Evening Match',
          },
        },
      },
      sport: 'Cricket',
      amenities: [
        'Turf Pitch',
        'Umpires & Scorers',
        'Sight Screen',
        'Net Practice',
        'Cafeteria',
        'Parking',
      ],
      images: [
        '/venues/ab/Ab-hub-Cricket-Ground-2.jpg',
        '/venues/ab/AB_Cricket_hub_logo.jpg',
        '/venues/ab/1626583807641_k3FF5LqrKL3W.jpg',
        '/venues/ab/1626583836958_9ggaKwPYBjZl.jpg',
        '/venues/ab/1712466993141_pYOd9SDtqblb.jpg',
        '/venues/ab/1712467019752_kHFtLZSKbTgO.jpg',
        '/venues/ab/1712467048874_BNvZCpX11nXk.jpg',
        '/venues/ab/1712467096971_TnkeSNVpfXS9.jpg',
        '/venues/ab/1730546083919_JY9GXVSgW6Gh.jpg',
      ],
      videos: [],
      ownerId: ownerUser.id,
      ownerName: 'Rajesh Bajaj',
      ownerPhone: '+91 95402 28222',
      mapsUrl: 'https://maps.google.com/?q=28.441139,77.377944',
      plusCode: '97PW+V69',
      rating: 0.0,
      reviewsCount: 0,
      latitude: 28.441139,
      longitude: 77.377944,
      isActive: true,
    },
  ];

  // 3. Upsert each venue idempotently
  for (const v of officialVenues) {
    const existing = await prisma.ground.findFirst({
      where: {
        OR: [{ slug: v.slug }, { name: v.name }],
      },
    });

    if (existing) {
      await prisma.ground.update({
        where: { id: existing.id },
        data: {
          ...v,
          ownerId: ownerUser.id,
        },
      });
      console.log(`🔄 Updated venue: ${v.name}`);
    } else {
      await prisma.ground.create({
        data: {
          ...v,
          ownerId: ownerUser.id,
        },
      });
      console.log(`✨ Created venue: ${v.name}`);
    }
  }

  // 4. Verify Final Database State
  const groundCount = await prisma.ground.count();
  const bookingCount = await prisma.booking.count();
  const matchCount = await prisma.match.count();
  const userCount = await prisma.user.count();

  console.log('-------------------------------------------');
  console.log(`📊 Official Venues in Database: ${groundCount}`);
  console.log(`📊 Total Bookings in Database: ${bookingCount}`);
  console.log(`📊 Live Matches in Database: ${matchCount}`);
  console.log(`📊 Total Users in Database: ${userCount}`);
  console.log('-------------------------------------------');
  console.log('✅ Official venues initialization completed successfully.');
}

main()
  .catch((err) => {
    console.error('💥 Error initializing official venues:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
