import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ Seeding database aborted: NODE_ENV is set to production. Seed demo users are blocked from production.');
    return;
  }
  console.log('🌱 Starting database seeding with detailed Indian style tournaments across all cities...');

  // Clear existing data
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.match.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.ground.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.product.deleteMany();
  await prisma.order.deleteMany();
  await prisma.tournamentRegistration.deleteMany();
  await prisma.tournamentMatch.deleteMany();
  await prisma.tournamentFavorite.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.user.deleteMany();

  // Create hash passwords
  const superAdminPasswordHash = await bcrypt.hash('SuperAdmin@123', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const playerPasswordHash = await bcrypt.hash('Player@123', 10);
  const ownerPasswordHash = await bcrypt.hash('Ground@123', 10);
  const vendorPasswordHash = await bcrypt.hash('Vendor@123', 10);
  const storePasswordHash = await bcrypt.hash('Store@123', 10);
  const organizerPasswordHash = await bcrypt.hash('Organizer@123', 10);
  const supportPasswordHash = await bcrypt.hash('Support@123', 10);
  const demoPlayerPasswordHash = await bcrypt.hash('BE11Player@2026!', 10);

  // 1. Create Users
  const superadmin = await prisma.user.create({
    data: {
      email: 'superadmin@be11.com',
      passwordHash: superAdminPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+919876543209',
      role: 'SUPER_ADMIN',
      walletBalance: 0.0,
      emailVerified: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@be11.com',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'System',
      phone: '+919876543212',
      role: 'ADMIN',
      walletBalance: 0.0,
      emailVerified: true,
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'player@be11.com',
      passwordHash: playerPasswordHash,
      firstName: 'Rahul',
      lastName: 'Sharma',
      phone: '+919876543210',
      role: 'PLAYER',
      walletBalance: 0.0,
      emailVerified: true,
    },
  });

  const owner = await prisma.user.create({
    data: {
      email: 'groundowner@be11.com',
      passwordHash: ownerPasswordHash,
      firstName: 'Vikram',
      lastName: 'Singh',
      phone: '+919876543211',
      role: 'OWNER',
      walletBalance: 0.0,
      emailVerified: true,
    },
  });

  const vendor = await prisma.user.create({
    data: {
      email: 'vendor@be11.com',
      passwordHash: vendorPasswordHash,
      firstName: 'Vendor',
      lastName: 'Pro',
      phone: '+919876543213',
      role: 'VENDOR',
      walletBalance: 0.0,
      emailVerified: true,
    },
  });

  const store = await prisma.user.create({
    data: {
      email: 'store@be11.com',
      passwordHash: storePasswordHash,
      firstName: 'Store',
      lastName: 'Manager',
      phone: '+919876543214',
      role: 'STORE_MANAGER',
      walletBalance: 0.0,
      emailVerified: true,
    },
  });

  const organizer = await prisma.user.create({
    data: {
      email: 'organizer@be11.com',
      passwordHash: organizerPasswordHash,
      firstName: 'Organizer',
      lastName: 'System',
      phone: '+919876543215',
      role: 'ORGANIZER',
      walletBalance: 0.0,
      emailVerified: true,
    },
  });

  const support = await prisma.user.create({
    data: {
      email: 'support@be11.com',
      passwordHash: supportPasswordHash,
      firstName: 'Support',
      lastName: 'Help',
      phone: '+919876543216',
      role: 'SUPPORT',
      walletBalance: 0.0,
      emailVerified: true,
    },
  });

  // Dedicated Official Demo Player for Development & Testing
  const demoPlayer = await prisma.user.upsert({
    where: { email: 'player.demo@be11.local' },
    update: {
      passwordHash: demoPlayerPasswordHash,
      firstName: 'Demo',
      lastName: 'Player',
      role: 'PLAYER',
      walletBalance: 0.0,
      emailVerified: true,
    },
    create: {
      email: 'player.demo@be11.local',
      passwordHash: demoPlayerPasswordHash,
      firstName: 'Demo',
      lastName: 'Player',
      phone: '+919876543200',
      role: 'PLAYER',
      walletBalance: 0.0,
      emailVerified: true,
    },
  });

  console.log('✅ Users created successfully including official demo player (player.demo@be11.local)!');

  // Seed 3 REAL PRODUCTION VENUES in Faridabad
  const rrrGround = await prisma.ground.create({
    data: {
      name: 'RRR Cricket Club Kidawali Faridabad',
      slug: 'rrr-cricket-club-kidawali-faridabad',
      description: 'Premier cricket facility located at Bhati House, Kidawali Gaon in Faridabad. Featuring professional turf pitches, lush outfields, night floodlighting, dugout pavilion, and dedicated practice nets.',
      location: 'Kidawali, Pusta Road, Faridabad',
      address: 'Bhati House, Kidawali Gaon, Faridabad, Kirawali, Pusta Road, Sherpur Khadar, Faridabad - 121002, Haryana, India',
      city: 'Faridabad',
      state: 'Haryana',
      country: 'India',
      pricePerHour: 0.0,
      pricingLabel: 'Contact for pricing',
      pricingRules: JSON.stringify({ type: 'CONTACT_ONLY', label: 'Price on request' }),
      sport: 'Cricket',
      amenities: JSON.stringify(['Turf Pitch', 'Flood Lights', 'Pavilion / Dugout', 'Practice Nets', 'Drinking Water', 'Washrooms']),
      images: JSON.stringify([
        '/venues/rrr/rrr-cricket-club-kidawali-sherpur-khadar-faridabad-sports-clubs-cover-photo.jpg',
        '/venues/rrr/rrr-cricket-club-kidawali-sherpur-khadar-faridabad-sports-clubs-7bf921d9yg.jpg',
        '/venues/rrr/rrr-cricket-club-kidawali-sherpur-khadar-faridabad-sports-clubs-vqt022xlpv.jpg',
        '/venues/rrr/rrr-cricket-club-kidawali-sherpur-khadar-faridabad-sports-clubs-x327wev07c.jpg'
      ]),
      videos: JSON.stringify([]),
      ownerId: owner.id,
      ownerName: 'Rishi',
      ownerPhone: '+91 97116 69718',
      mapsUrl: 'https://maps.google.com/?q=28.466611,77.397333',
      rating: 0.0,
      reviewsCount: 0,
      latitude: 28.466611,
      longitude: 77.397333,
      isActive: true
    }
  });

  const playnowGround = await prisma.ground.create({
    data: {
      name: 'Playnow Cricket Ground',
      slug: 'playnow-cricket-ground',
      description: 'Top-tier cricket arena in Gurugram designed for competitive day and night matches. Fully equipped with tournament-grade pitch, LED floodlights, player dugout, and high quality media streaming equipment.',
      location: 'Gurugram, Haryana',
      address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
      city: 'Gurugram',
      state: 'Haryana',
      country: 'India',
      pricePerHour: 5000.0,
      pricingLabel: 'From ₹5,000',
      pricingRules: JSON.stringify({
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
        teamCoverage: 'both teams'
      }),
      sport: 'Cricket',
      amenities: JSON.stringify(['Turf Pitch', 'Flood Lights', 'Dugout', 'Cafeteria', 'Parking', 'Washrooms']),
      images: JSON.stringify([
        '/venues/playnow/Playnow cricket ground.png'
      ]),
      videos: JSON.stringify([
        '/venues/playnow/Playnow cricket ground.mp4',
        '/venues/playnow/Playnow_cricket_ground.mp4'
      ]),
      ownerId: owner.id,
      ownerName: 'Aanurag Jain',
      ownerPhone: '+91 95992 80399',
      mapsUrl: 'https://maps.app.goo.gl/x6HeybuKuDvSvzDYA',
      rating: 0.0,
      reviewsCount: 0,
      latitude: 28.403646,
      longitude: 77.136787,
      isActive: true
    }
  });

  const abGround = await prisma.ground.create({
    data: {
      name: 'AB Cricket Ground',
      slug: 'ab-cricket-ground',
      description: 'State of the art cricket hub situated inside the Aravalli Golf Course precinct in Faridabad. Offers full match setup with umpires, scorers, sight screen, net sessions, and on-site cafeteria.',
      location: 'New Industrial Town, Faridabad',
      address: 'New Industrial Town, Aravalli Golf Course, New Industrial Township, Faridabad, Haryana - 121001, India',
      city: 'Faridabad',
      state: 'Haryana',
      country: 'India',
      pricePerHour: 3500.0,
      pricingLabel: 'From ₹3,500',
      pricingRules: JSON.stringify({
        type: 'PACKAGE_TIERS',
        options: [
          {
            id: 'pkg-standard',
            name: 'Standard Match Package',
            price: 3500,
            description: 'Half-day match setup with umpires, scorers, practice nets, and pavilion dugout.',
            facilities: ['Umpires', 'Scorers', 'Balls', 'Drinking Water', 'Practice Nets', 'Pavilion/Dugout', 'Washrooms']
          },
          {
            id: 'pkg-extended',
            name: 'Extended Day Match Package',
            price: 6500,
            description: 'Full-day tournament match setup with floodlights, cafeteria access, sight screen, and media scoreboards.',
            facilities: ['Umpires', 'Scorers', 'Flood Lights', 'Balls', 'Sight Screen', 'Cafeteria', 'Pavilion/Dugout', 'Washrooms']
          }
        ]
      }),
      sport: 'Cricket',
      amenities: JSON.stringify([
        'Umpires',
        'Scorers',
        'Drinking Water',
        'Practice Nets',
        'Flood Lights',
        'Balls',
        'Washrooms',
        'Pavilion/Dugout',
        'Sight Screen',
        'Cafeteria'
      ]),
      images: JSON.stringify([
        '/venues/ab/Ab-hub-Cricket-Ground-2.jpg',
        '/venues/ab/AB_Cricket_hub_logo.jpg',
        '/venues/ab/1626583807641_k3FF5LqrKL3W.jpg',
        '/venues/ab/1626583836958_9ggaKwPYBjZl.jpg',
        '/venues/ab/1712466993141_pYOd9SDtqblb.jpg',
        '/venues/ab/1712467019752_kHFtLZSKbTgO.jpg',
        '/venues/ab/1712467048874_BNvZCpX11nXk.jpg',
        '/venues/ab/1712467096971_TnkeSNVpfXS9.jpg',
        '/venues/ab/1730546083919_JY9GXVSgW6Gh.jpg'
      ]),
      videos: JSON.stringify([]),
      ownerId: owner.id,
      ownerName: 'Rajesh Bajaj',
      ownerPhone: '+91 95402 28222',
      mapsUrl: 'https://maps.google.com/?q=28.441139,77.377944',
      plusCode: '97PW+V69',
      rating: 0.0,
      reviewsCount: 0,
      latitude: 28.441139,
      longitude: 77.377944,
      isActive: true
    }
  });

  const realGrounds = [rrrGround, playnowGround, abGround];

  const citiesData = [
    { name: 'Faridabad', lat: 28.4089, lng: 77.3178 },
    { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
    { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
    { name: 'Pune', lat: 18.5204, lng: 73.8567 },
    { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
    { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
    { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
    { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
    { name: 'Ranchi', lat: 23.3441, lng: 85.3096 },
    { name: 'Deoghar', lat: 24.4820, lng: 86.7001 },
    { name: 'Dhanbad', lat: 23.7957, lng: 86.4304 },
    { name: 'Patna', lat: 25.5941, lng: 85.1376 },
    { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
    { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
    { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
    { name: 'Indore', lat: 22.7196, lng: 75.8577 }
  ];

  const groundsMap: Record<string, any[]> = {};
  for (const c of citiesData) {
    groundsMap[c.name] = realGrounds;
  }

  console.log(`✅ 3 Real Grounds created successfully!`);

  // 3. Create Seed Products
  const products = [
    {
      name: 'be11 English Willow Bat',
      description: 'Grade 1 English Willow cricket bat, hand-crafted with sweet middle profiles, suitable for professional league matches.',
      price: 9499.0,
      image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=300&q=80',
      category: 'BATS',
      sport: 'Cricket',
      stock: 15,
    },
    {
      name: 'be11 Leather Seam Ball',
      description: 'Hand-stitched premium alum-tanned leather cricket ball, built for maximum longevity and seam stability.',
      price: 499.0,
      image: 'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&w=300&q=80',
      category: 'BALLS',
      sport: 'Cricket',
      stock: 50,
    },
    {
      name: 'be11 Professional Batting Gloves',
      description: 'High-density foam fingers with ergonomic flex designs, providing maximum sweat absorption and impact protection.',
      price: 1299.0,
      image: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=300&q=80',
      category: 'GLOVES',
      sport: 'Cricket',
      stock: 25,
    },
    {
      name: 'be11 Pro Batting Pads',
      description: 'Ultra-lightweight protective leg guards with wide straps and foam padded knee rolls for superior comfort.',
      price: 2499.0,
      image: 'https://images.unsplash.com/photo-1544045560-723f63933a3e?auto=format&fit=crop&w=300&q=80',
      category: 'PADS',
      sport: 'Cricket',
      stock: 20,
    },
    {
      name: 'be11 Classic Cricket Jersey',
      description: 'Moisture-wicking, highly breathable team jersey with sublimated side stripes, ready for custom printing.',
      price: 799.0,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDeAq8x7ZDx6hTr6C_oRuRW92H-lKMNP94o2CxewKPp6GQuIdup7YpAhUmSKCPChq9Zgnl5aSdkgjlAiydDRj_aZ3VZVDdF1DJ7K9nRPluYhDYMvZPz0tonY2hkRkDR8I0_qH6DWh8dsAJ9vXAutDemEFc6fykh5ygbXvN0oAKC_L9lKNoVhJH1UYkodZaU1KbLWjdedihdGFRE4cPS6gX_wmaZcWFCZwy19qVeyhIEAbFXPc6ay3jj',
      category: 'JERSEYS',
      sport: 'Cricket',
      stock: 100,
    },
    {
      name: 'be11 FIFA-Star Football',
      description: 'Thermally bonded seamless match football, engineered with aerodynamic grooves for true flight precision.',
      price: 1899.0,
      image: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&w=300&q=80',
      category: 'FOOTBALLS',
      sport: 'Football',
      stock: 40,
    },
    {
      name: 'be11 Striker FG Shoes',
      description: 'Firm-ground football boots with molded TPU studs for excellent speed grip and synthetic upper durability.',
      price: 3499.0,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=300&q=80',
      category: 'SHOES',
      sport: 'Football',
      stock: 30,
    },
    {
      name: 'be11 Impact Shin Guards',
      description: 'Hard outer shield plates with thick EVA foam padding backings to absorb heavy slide tackles.',
      price: 399.0,
      image: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=300&q=80',
      category: 'SHIN_GUARDS',
      sport: 'Football',
      stock: 60,
    },
    {
      name: 'be11 Grip Goalkeeper Gloves',
      description: 'Super-cohesive latex palms with negative cut stitching for superior ball handling security.',
      price: 1599.0,
      image: 'https://images.unsplash.com/photo-1516287985838-70215a3d76e8?auto=format&fit=crop&w=300&q=80',
      category: 'GLOVES',
      sport: 'Football',
      stock: 15,
    }
  ];

  await prisma.product.createMany({ data: products });
  console.log('✅ Seed Products created successfully!');

  // Seed active coupons
  await prisma.coupon.deleteMany();
  await prisma.coupon.createMany({
    data: [
      { code: 'WELCOME10', discountPercent: 10 },
      { code: 'BE11SUPER', discountPercent: 20 },
      { code: 'FESTIVAL15', discountPercent: 15 },
    ]
  });
  console.log('✅ Seed Coupons created successfully!');

  // Define comprehensive Indian-style tournament data covering all cities, sports, statuses, and pricing filters
  const tournamentSeeds = [
    // --- MUMBAI ---
    {
      name: 'be11 Mumbai Monsoon Cricket League',
      description: 'The premium T20 cricket league in Mumbai. Teams compete across round-robin fixtures to win the grand champion trophy.',
      sport: 'Cricket',
      status: 'UPCOMING',
      startDate: '2026-08-15',
      endDate: '2026-08-30',
      registrationDeadline: '2026-08-12',
      teamsLimit: 8,
      entryFee: 1500.0,
      prizePool: 50000.0,
      organizerId: admin.id,
      groundId: groundsMap['Mumbai'][0].id,
      city: 'Mumbai',
      rules: 'Standard T20 rules. Max 15 players per squad.',
      sponsors: JSON.stringify(['CEAT', 'Gatorade']),
      gallery: JSON.stringify([])
    },
    {
      name: 'Bandra Soccer Blitz Championship',
      description: 'Fast-paced 5v5 soccer cup held under the lights on Skyline Turf Bandra.',
      sport: 'Football',
      status: 'ONGOING',
      startDate: '2026-07-28',
      endDate: '2026-08-08',
      registrationDeadline: '2026-07-25',
      teamsLimit: 12,
      entryFee: 800.0,
      prizePool: 25000.0,
      organizerId: admin.id,
      groundId: groundsMap['Mumbai'][1].id,
      city: 'Mumbai',
      rules: '5v5 rolling subs, 15-minute halves.',
      sponsors: JSON.stringify(['Nike India']),
      gallery: JSON.stringify([])
    },
    {
      name: 'Worli Gully Cricket Carnival',
      description: 'Traditional style gully cricket rules with soft tennis ball. Celebrated tournament across Worli sea-face.',
      sport: 'Cricket',
      status: 'COMPLETED',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      registrationDeadline: '2026-07-08',
      teamsLimit: 16,
      entryFee: 0.0, // Free entry filter test
      prizePool: 15000.0,
      organizerId: admin.id,
      groundId: groundsMap['Mumbai'][0].id,
      city: 'Mumbai',
      rules: 'Soft tennis ball, 6-overs matches.',
      sponsors: JSON.stringify(['Local Merchants']),
      gallery: JSON.stringify([])
    },

    // --- DELHI ---
    {
      name: 'be11 Delhi Winter Soccer Cup',
      description: 'The major 5v5 soccer challenge on Skyline Turf Delhi. 16 teams face off in direct knockout slots.',
      sport: 'Football',
      status: 'UPCOMING',
      startDate: '2026-09-01',
      endDate: '2026-09-07',
      registrationDeadline: '2026-08-28',
      teamsLimit: 16,
      entryFee: 800.0,
      prizePool: 25000.0,
      organizerId: admin.id,
      groundId: groundsMap['Delhi'][1].id,
      city: 'Delhi',
      rules: 'Knockout matches, penalty shootouts on tie.',
      sponsors: JSON.stringify(['RedBull']),
      gallery: JSON.stringify([])
    },
    {
      name: 'Delhi Capital Cricket Cup',
      description: 'High-voltage ongoing T20 league featuring academies across the National Capital Region.',
      sport: 'Cricket',
      status: 'ONGOING',
      startDate: '2026-07-20',
      endDate: '2026-08-05',
      registrationDeadline: '2026-07-18',
      teamsLimit: 10,
      entryFee: 0.0, // Free entry filter test
      prizePool: 40000.0,
      organizerId: admin.id,
      groundId: groundsMap['Delhi'][0].id,
      city: 'Delhi',
      rules: 'Red leather ball, ICC standard parameters.',
      sponsors: JSON.stringify(['Jio']),
      gallery: JSON.stringify([])
    },
    {
      name: 'Connaught Place Futsal Fiesta',
      description: 'Completed indoor-style futsal league attracting top amateur clubs.',
      sport: 'Football',
      status: 'COMPLETED',
      startDate: '2026-07-05',
      endDate: '2026-07-08',
      registrationDeadline: '2026-07-03',
      teamsLimit: 8,
      entryFee: 500.0,
      prizePool: 12000.0,
      organizerId: admin.id,
      groundId: groundsMap['Delhi'][1].id,
      city: 'Delhi',
      rules: 'Standard futsal rules.',
      sponsors: JSON.stringify([]),
      gallery: JSON.stringify([])
    },

    // --- PUNE ---
    {
      name: 'Deccan Gymkhana Cricket League',
      description: 'Elite corporate cricket tournament held at Pune Pavilion Arena.',
      sport: 'Cricket',
      status: 'UPCOMING',
      startDate: '2026-08-20',
      endDate: '2026-08-26',
      registrationDeadline: '2026-08-18',
      teamsLimit: 12,
      entryFee: 1200.0,
      prizePool: 35000.0,
      organizerId: admin.id,
      groundId: groundsMap['Pune'][0].id,
      city: 'Pune',
      rules: 'T15 format with semi-leather balls.',
      sponsors: JSON.stringify(['Serum Institute']),
      gallery: JSON.stringify([])
    },
    {
      name: 'Hinjawadi IT Soccer Cup',
      description: 'The ultimate soccer clash for IT professionals in Pune. Free entry for tech companies.',
      sport: 'Football',
      status: 'ONGOING',
      startDate: '2026-07-29',
      endDate: '2026-08-04',
      registrationDeadline: '2026-07-27',
      teamsLimit: 16,
      entryFee: 0.0,
      prizePool: 20000.0,
      organizerId: admin.id,
      groundId: groundsMap['Pune'][1].id,
      city: 'Pune',
      rules: '5v5 matches. Only company employees allowed.',
      sponsors: JSON.stringify(['Infosys Sport Club']),
      gallery: JSON.stringify([])
    },

    // --- BENGALURU ---
    {
      name: 'Silicon Valley Cricket League',
      description: 'The largest amateur cricket cup in Bengaluru. High-end match streaming and live scores.',
      sport: 'Cricket',
      status: 'UPCOMING',
      startDate: '2026-08-22',
      endDate: '2026-09-05',
      registrationDeadline: '2026-08-19',
      teamsLimit: 10,
      entryFee: 2500.0,
      prizePool: 100000.0,
      organizerId: admin.id,
      groundId: groundsMap['Bengaluru'][0].id,
      city: 'Bengaluru',
      rules: 'T20 league with white leather ball.',
      sponsors: JSON.stringify(['Zomato', 'Cred']),
      gallery: JSON.stringify([])
    },
    {
      name: 'Koramangala Football Faceoff',
      description: 'High energy 7v7 soccer league at Koramangala Skyline Turf.',
      sport: 'Football',
      status: 'ONGOING',
      startDate: '2026-07-24',
      endDate: '2026-08-02',
      registrationDeadline: '2026-07-22',
      teamsLimit: 12,
      entryFee: 1000.0,
      prizePool: 30000.0,
      organizerId: admin.id,
      groundId: groundsMap['Bengaluru'][1].id,
      city: 'Bengaluru',
      rules: '7v7 match layout, 25-min halves.',
      sponsors: JSON.stringify(['Decathlon']),
      gallery: JSON.stringify([])
    },

    // --- HYDERABAD ---
    {
      name: 'Charminar Cricket Championship',
      description: 'Completed premier T20 tournament in the heart of Hyderabad.',
      sport: 'Cricket',
      status: 'COMPLETED',
      startDate: '2026-07-01',
      endDate: '2026-07-10',
      registrationDeadline: '2026-06-28',
      teamsLimit: 12,
      entryFee: 1500.0,
      prizePool: 75000.0,
      organizerId: admin.id,
      groundId: groundsMap['Hyderabad'][0].id,
      city: 'Hyderabad',
      rules: 'Standard ICC T20 rules.',
      sponsors: JSON.stringify(['Hyderabad Biryani Club']),
      gallery: JSON.stringify([])
    },

    // --- RANCHI ---
    {
      name: 'M.S. Dhoni Fan Club Cricket Trophy',
      description: 'Upcoming cricket tournament celebrating Jharkhand cricket spirit. Cash awards for best wicket-keeper.',
      sport: 'Cricket',
      status: 'UPCOMING',
      startDate: '2026-08-18',
      endDate: '2026-08-22',
      registrationDeadline: '2026-08-15',
      teamsLimit: 8,
      entryFee: 500.0,
      prizePool: 30000.0,
      organizerId: admin.id,
      groundId: groundsMap['Ranchi'][0].id,
      city: 'Ranchi',
      rules: 'T20 matches, leather ball format.',
      sponsors: JSON.stringify(['JSCA Associate']),
      gallery: JSON.stringify([])
    },

    // --- DEOGHAR ---
    {
      name: 'Deoghar Shivratri Cricket Cup',
      description: 'Ongoing cricket tournament attracting players from across Santhal Pargana region.',
      sport: 'Cricket',
      status: 'ONGOING',
      startDate: '2026-07-29',
      endDate: '2026-08-05',
      registrationDeadline: '2026-07-26',
      teamsLimit: 10,
      entryFee: 0.0,
      prizePool: 20000.0,
      organizerId: admin.id,
      groundId: groundsMap['Deoghar'][0].id,
      city: 'Deoghar',
      rules: 'Tennis ball tournament.',
      sponsors: JSON.stringify(['Baba Dham Trust']),
      gallery: JSON.stringify([])
    },

    // --- DHANBAD ---
    {
      name: 'Coal Capital Soccer Cup',
      description: 'Completed 5v5 soccer league at Dhanbad Skyline Turf.',
      sport: 'Football',
      status: 'COMPLETED',
      startDate: '2026-07-12',
      endDate: '2026-07-16',
      registrationDeadline: '2026-07-09',
      teamsLimit: 12,
      entryFee: 600.0,
      prizePool: 18000.0,
      organizerId: admin.id,
      groundId: groundsMap['Dhanbad'][1].id,
      city: 'Dhanbad',
      rules: 'Knockout matches.',
      sponsors: JSON.stringify([]),
      gallery: JSON.stringify([])
    },

    // --- PATNA ---
    {
      name: 'Patliputra Football League',
      description: 'Knockout soccer tourney in Patna for amateur clubs and schools.',
      sport: 'Football',
      status: 'UPCOMING',
      startDate: '2026-09-02',
      endDate: '2026-09-08',
      registrationDeadline: '2026-08-30',
      teamsLimit: 16,
      entryFee: 400.0,
      prizePool: 15000.0,
      organizerId: admin.id,
      groundId: groundsMap['Patna'][1].id,
      city: 'Patna',
      rules: 'Standard knockout soccer.',
      sponsors: JSON.stringify(['Bihar Sports Authority']),
      gallery: JSON.stringify([])
    }
  ];

  // Insert all tournaments
  for (const seed of tournamentSeeds) {
    const t = await prisma.tournament.create({
      data: seed
    });

    // Generate random registrations for upcoming/ongoing ones
    if (t.status === 'UPCOMING' || t.status === 'ONGOING') {
      await prisma.tournamentRegistration.create({
        data: {
          tournamentId: t.id,
          teamName: 'Patna Kings',
          captainName: 'Vivek Singh',
          contactPhone: '+919999900001',
          playersList: JSON.stringify(['Vivek Singh', 'Abhishek Jha', 'Niranjan Roy', 'Manish Lal']),
          status: 'APPROVED'
        }
      });
      await prisma.tournamentRegistration.create({
        data: {
          tournamentId: t.id,
          teamName: 'Ganga Gladiators',
          captainName: 'Aman Raj',
          contactPhone: '+919999900002',
          playersList: JSON.stringify(['Aman Raj', 'Rishav Verma', 'Piyush Sahay', 'Sunny Sinha']),
          status: 'APPROVED'
        }
      });
    }

    // Generate live match scoreboards for ongoing tournaments
    if (t.status === 'ONGOING') {
      await prisma.tournamentMatch.create({
        data: {
          tournamentId: t.id,
          homeTeam: 'Team Saffron',
          awayTeam: 'Team Green',
          date: '2026-07-31',
          time: '19:00',
          status: 'LIVE',
          score: t.sport === 'Cricket' ? '124/2 (11.2 overs) vs 180' : '2 - 1',
          overs: t.sport === 'Cricket' ? '11.2 overs' : null,
          result: t.sport === 'Cricket' ? 'Need 57 runs in 52 balls' : 'Second half ongoing'
        }
      });
    }

    // Generate completed match details for completed tournaments
    if (t.status === 'COMPLETED') {
      await prisma.tournamentMatch.create({
        data: {
          tournamentId: t.id,
          homeTeam: 'Challengers XI',
          awayTeam: 'Royals FC',
          date: '2026-07-15',
          time: '21:00',
          status: 'COMPLETED',
          score: t.sport === 'Cricket' ? '165/4 vs 164/8' : '3 - 2',
          result: t.sport === 'Cricket' ? 'Challengers XI won by 6 wickets' : 'Challengers XI won by penalty shootout'
        }
      });
    }
  }

  // No dummy/fake matches seeded — real matches must be created by users or real database records.

  console.log(`✅ ${tournamentSeeds.length} Indian tournaments seeded successfully across various cities!`);

  // --- SEED COACHES MARKETPLACE ---
  console.log('🌱 Seeding Coaches Marketplace data...');

  // 1. Create Academies
  const academy1 = await prisma.academy.create({
    data: {
      name: 'be11 Elite Cricket Academy',
      logo: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=150&q=80',
      city: 'Mumbai',
      sports: JSON.stringify(['Cricket']),
      rating: 4.9,
    },
  });

  const academy2 = await prisma.academy.create({
    data: {
      name: 'Mumbai Football School',
      logo: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&w=150&q=80',
      city: 'Mumbai',
      sports: JSON.stringify(['Football']),
      rating: 4.7,
    },
  });

  const academy3 = await prisma.academy.create({
    data: {
      name: 'National Sports & Badminton Club',
      logo: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=150&q=80',
      city: 'Delhi',
      sports: JSON.stringify(['Badminton', 'Basketball']),
      rating: 4.8,
    },
  });

  console.log('✅ Academies seeded successfully!');

  // 2. Create Coach Users
  const coachPasswordHash = await bcrypt.hash('Coach@123', 10);

  const coachUser1 = await prisma.user.create({
    data: {
      email: 'coach@be11.com',
      passwordHash: coachPasswordHash,
      firstName: 'Suresh',
      lastName: 'Raina',
      phone: '+919876543220',
      role: 'COACH',
      walletBalance: 0.0,
    },
  });

  const coachUser2 = await prisma.user.create({
    data: {
      email: 'coach2@be11.com',
      passwordHash: coachPasswordHash,
      firstName: 'Sunil',
      lastName: 'Chhetri',
      phone: '+919876543221',
      role: 'COACH',
      walletBalance: 0.0,
    },
  });

  const coachUser3 = await prisma.user.create({
    data: {
      email: 'coach3@be11.com',
      passwordHash: coachPasswordHash,
      firstName: 'Pullela',
      lastName: 'Gopichand',
      phone: '+919876543222',
      role: 'COACH',
      walletBalance: 0.0,
    },
  });

  console.log('✅ Coach users created successfully!');

  // 3. Create Coach Profiles
  const coach1 = await prisma.coach.create({
    data: {
      userId: coachUser1.id,
      academyId: academy1.id,
      experienceYears: 12,
      certifications: JSON.stringify(['BCCI Level 3 Certified Coach', 'ICC High Performance Coach Certificate']),
      sports: JSON.stringify(['Cricket']),
      languages: JSON.stringify(['English', 'Hindi', 'Gujarati']),
      city: 'Mumbai',
      about: 'Former Indian national team player specializing in batting technique, aggressive middle-overs strategy, and athletic fielding drills.',
      achievements: JSON.stringify(['Won IPL Trophy 4 times', 'Represented India in 226 ODIs', 'Known as Mr. IPL for batting stability']),
      gallery: JSON.stringify([
        'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1544045560-723f63933a3e?auto=format&fit=crop&w=400&q=80'
      ]),
      videos: JSON.stringify(['https://www.w3schools.com/html/mov_bbb.mp4']),
      trainingStyle: 'Focuses heavily on footwork, middle-overs stroke-play, and high-intensity match scenario simulations.',
      hourlyRate: 2500.0,
      status: 'APPROVED',
    },
  });

  const coach2 = await prisma.coach.create({
    data: {
      userId: coachUser2.id,
      academyId: academy2.id,
      experienceYears: 15,
      certifications: JSON.stringify(['AFC Pro Coaching License', 'UEFA A Coaching Certificate']),
      sports: JSON.stringify(['Football']),
      languages: JSON.stringify(['English', 'Hindi', 'Bengali', 'Nepali']),
      city: 'Mumbai',
      about: 'Legendary Indian national football team captain focusing on forward positioning, striking precision, penalty execution, and mindset coaching.',
      achievements: JSON.stringify(['Most capped Indian international football player', 'AIFF Player of the Year 6 times', 'Padma Shri Awardee']),
      gallery: JSON.stringify([
        'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80'
      ]),
      videos: JSON.stringify(['https://www.w3schools.com/html/mov_bbb.mp4']),
      trainingStyle: 'Emphasis on positional attack tactics, target shooting, sprint mechanics, and off-the-ball runs.',
      hourlyRate: 3000.0,
      status: 'APPROVED',
    },
  });

  const coach3 = await prisma.coach.create({
    data: {
      userId: coachUser3.id,
      academyId: academy3.id,
      experienceYears: 20,
      certifications: JSON.stringify(['BWF Level 3 Coach License', 'Dronacharya Award for Sports Coaching']),
      sports: JSON.stringify(['Badminton']),
      languages: JSON.stringify(['English', 'Hindi', 'Telugu']),
      city: 'Delhi',
      about: 'Mastermind badminton coach who mentored multiple Olympic medalists. Specializes in singles tactics, court coverage, and psychological focus.',
      achievements: JSON.stringify(['Mentored Saina Nehwal to Olympic Bronze', 'Mentored PV Sindhu to Olympic Silver/Gold', 'All England Open Champion']),
      gallery: JSON.stringify([
        'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=400&q=80'
      ]),
      videos: JSON.stringify(['https://www.w3schools.com/html/mov_bbb.mp4']),
      trainingStyle: 'Rigorous physical training, footwork agility drills, drop-shot precision, and strategic court placement.',
      hourlyRate: 4000.0,
      status: 'APPROVED',
    },
  });

  console.log('✅ Coach profiles seeded successfully!');

  // 4. Create Availability Slots for Coaches
  // Sunday (0), Tuesday (2), Thursday (4) availability
  const days = [0, 2, 4];
  const slots = [
    { start: '08:00', end: '09:00' },
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' }
  ];

  for (const c of [coach1, coach2, coach3]) {
    for (const day of days) {
      for (const slot of slots) {
        await prisma.availability.create({
          data: {
            coachId: c.id,
            dayOfWeek: day,
            startTime: slot.start,
            endTime: slot.end,
            isBooked: false,
          },
        });
      }
    }
  }

  console.log('✅ Coach availability slots seeded successfully!');

  // 5. Create Training Camps
  const mumbaiNet = await prisma.ground.findFirst({ where: { city: 'Mumbai', sport: 'Cricket' } });
  const mumbaiTurf = await prisma.ground.findFirst({ where: { city: 'Mumbai', sport: 'Football' } });

  await prisma.camp.create({
    data: {
      coachId: coach1.id,
      academyId: academy1.id,
      name: 'Monsoon Cricket Boot Camp',
      description: 'Comprehensive 4-week indoor & outdoor camp focusing on spin batting technique, power-hitting in death overs, and dynamic fielding drills.',
      sport: 'Cricket',
      venue: mumbaiNet ? mumbaiNet.name : 'Sector 3 Pavilion nets',
      city: 'Mumbai',
      startDate: '2026-08-15',
      durationWeeks: 4,
      skillLevel: 'Intermediate',
      seatsLimit: 20,
      seatsLeft: 18, // Seeded with 2 enrolled slots
      fee: 4999.0,
      timings: 'Weekend 08:00 - 10:00',
      banner: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=600&q=80',
    },
  });

  await prisma.camp.create({
    data: {
      coachId: coach2.id,
      academyId: academy2.id,
      name: 'Elite Football Striker Camp',
      description: 'Masterclass camp targeting offensive players who want to build elite goalscoring instincts, sprint mechanics, and set-piece headers.',
      sport: 'Football',
      venue: mumbaiTurf ? mumbaiTurf.name : 'Mumbai Skyline Turf',
      city: 'Mumbai',
      startDate: '2026-08-20',
      durationWeeks: 6,
      skillLevel: 'Advanced',
      seatsLimit: 15,
      seatsLeft: 15,
      fee: 5999.0,
      timings: 'Weekdays 17:00 - 19:00',
      banner: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
    },
  });

  await prisma.camp.create({
    data: {
      coachId: coach3.id,
      academyId: academy3.id,
      name: 'Olympic Path Badminton Clinic',
      description: 'High intensity drills targeting court speed footwork, wrist placement drops, backhand clears, and match tactics.',
      sport: 'Badminton',
      venue: 'National Sports Club Indoor Courts',
      city: 'Delhi',
      startDate: '2026-08-22',
      durationWeeks: 3,
      skillLevel: 'Professional',
      seatsLimit: 10,
      seatsLeft: 10,
      fee: 7999.0,
      timings: 'Weekend 10:00 - 12:00',
      banner: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80',
    },
  });

  console.log('✅ Training camps seeded successfully!');

  // Seed reviews for coaches
  await prisma.review.create({
    data: {
      coachId: coach1.id,
      userId: customer.id,
      rating: 5,
      comment: 'Suresh Raina’s sessions are incredibly engaging! His tips on middle-overs stroke-play completely changed my game.',
    },
  });

  await prisma.review.create({
    data: {
      coachId: coach2.id,
      userId: customer.id,
      rating: 5,
      comment: 'Excellent striker training. Sunil’s instructions on positioning and footwork when receiving long balls are world-class.',
    },
  });

  console.log('✅ Coach reviews seeded successfully!');

  // --- SEED JERSEY TEMPLATES ---
  console.log('🌱 Seeding default Jersey templates...');
  await prisma.jerseyTemplate.create({
    data: {
      name: 'National Pride India Blue',
      sport: 'Cricket',
      popularity: 120,
      config: JSON.stringify({
        primaryColor: '#004F98',
        secondaryColor: '#FF9933',
        accentColor: '#138808',
        pattern: 'Gradient',
        collar: 'V Neck',
        sleeves: 'Half',
        font: 'Modern',
        numberStyle: 'Bold',
        fabric: 'Professional Match Fabric',
      }),
    },
  });

  await prisma.jerseyTemplate.create({
    data: {
      name: 'Neon Strike Lightning',
      sport: 'Football',
      popularity: 95,
      config: JSON.stringify({
        primaryColor: '#0F172A',
        secondaryColor: '#38BDF8',
        accentColor: '#FACC15',
        pattern: 'Lightning',
        collar: 'Round Neck',
        sleeves: 'Half',
        font: 'Bold',
        numberStyle: 'Shadow',
        fabric: 'Premium Dry Fit',
      }),
    },
  });

  await prisma.jerseyTemplate.create({
    data: {
      name: 'Vintage Stripe Classic',
      sport: 'Cricket',
      popularity: 78,
      config: JSON.stringify({
        primaryColor: '#FFFFFF',
        secondaryColor: '#0A2E6E',
        accentColor: '#E11D48',
        pattern: 'Stripes',
        collar: 'Polo',
        sleeves: 'Half',
        font: 'Classic',
        numberStyle: 'Outline',
        fabric: 'Standard',
      }),
    },
  });

  console.log('✅ Jersey templates seeded successfully!');
  console.log('🌱 Seeding process complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
