import crypto from 'crypto';
import { prisma } from '../../../config/db.js';
import { KnowledgeItem } from './knowledge.types.js';

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

function withTimeout<T>(promise: Promise<T>, ms: number = 600): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)),
  ]);
}

export class KnowledgeExtractor {
  private static instance: KnowledgeExtractor;

  public static getInstance(): KnowledgeExtractor {
    if (!KnowledgeExtractor.instance) {
      KnowledgeExtractor.instance = new KnowledgeExtractor();
    }
    return KnowledgeExtractor.instance;
  }

  /**
   * Performs an autonomous read-only extraction of the entire BE11 application.
   */
  public async extractAll(): Promise<KnowledgeItem[]> {
    const items: KnowledgeItem[] = [];

    // 1. General BE11 Platform Knowledge
    items.push(...this.extractGeneralPlatformKnowledge());

    // 2. Platform Routes & Navigation Architecture
    items.push(...this.extractRouteKnowledge());

    // 3. Database Schema & Capability Knowledge
    items.push(...this.extractDatabaseCapabilities());

    // 4. Live Venue Knowledge (Direct from Prisma DB)
    items.push(...await this.extractLiveVenueKnowledge());

    // 5. Live Match System & Match Rules
    items.push(...await this.extractLiveMatchKnowledge());

    // 6. Booking System Architecture & Business Logic
    items.push(...this.extractBookingLogicKnowledge());

    // 7. Payments & Wallet System Knowledge
    items.push(...this.extractPaymentAndWalletKnowledge());

    // 8. Authentication & Account Management Knowledge
    items.push(...this.extractAuthAndAccountKnowledge());

    // 9. Interactive Sports Features (Jersey Builder, Kit Builder, Toss, Capture)
    items.push(...this.extractSpecialFeaturesKnowledge());

    // 10. Store & Merch Catalog Knowledge
    items.push(...await this.extractShopKnowledge());

    // 11. Coaches, Academies & Camps Knowledge
    items.push(...await this.extractCoachingKnowledge());

    // 12. Legal, Cancellation, Refund & Privacy Policies
    items.push(...this.extractPoliciesKnowledge());

    // 13. Human Support & Escalation Procedures
    items.push(...this.extractSupportEscalationKnowledge());

    return items;
  }

  private extractGeneralPlatformKnowledge(): KnowledgeItem[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'gen-platform-overview',
        category: 'General BE11',
        title: 'What is BE11?',
        content: `BE11 (https://be11.in) is India's premium sports ground reservation and athletic match management platform, primarily serving Haryana and the NCR region (Faridabad, Gurugram, Delhi NCR). BE11 enables sports enthusiasts, teams, and organizers to book verified cricket grounds and multi-sport venues, discover and join open live matches, customize 3D IPL-grade team jerseys, purchase cricket gear and kits, conduct 3D coin tosses, record games with BE11 Capture AI cameras, and hire verified professional sports coaches.`,
        source: 'BE11 codebase - README & Frontend Home',
        sourceType: 'application-data',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 platform overview'),
        tags: ['what is be11', 'about', 'overview', 'features', 'sports platform', 'haryana', 'faridabad', 'gurugram', 'cricket ground booking']
      },
      {
        id: 'gen-key-capabilities',
        category: 'General BE11',
        title: 'What can I do on BE11?',
        content: `On BE11, you can:
1. **Book Cricket Grounds & Venues**: Reserve verified real grounds (RRR Cricket Club, Playnow Cricket Ground, AB Cricket Ground) across morning, afternoon, day-night, and floodlit night match periods.
2. **Join Live Matches**: Discover open match lobbies and join as an individual player or team without needing an entire 22-player squad.
3. **3D Jersey Builder**: Customize team jerseys in interactive 3D with custom colors, textures, names, numbers, and sponsor logos.
4. **Cricket Kit Builder**: Assemble tailored kit bundles (Bats, Balls, Gloves, Pads) or choose Beginner, Intermediate, or Pro presets.
5. **3D Toss**: Conduct authentic IPL-style 3D coin tosses with match audio and sound effects.
6. **BE11 Capture**: AI-powered match recording, multicam replay clips, and automated highlight reels.
7. **Find Coaches & Academies**: Book 1-on-1 coaching sessions or enroll in academy training camps.
8. **Digital Wallet**: Manage prepaid credits for instantaneous booking confirmations.`,
        source: 'BE11 codebase - Features Registry',
        sourceType: 'application-data',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 platform capabilities'),
        tags: ['what can i do', 'capabilities', 'features list', 'services', 'venues', 'live matches', 'jerseys', 'kits', 'coaches', 'toss']
      }
    ];
  }

  private extractRouteKnowledge(): KnowledgeItem[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'routes-catalog',
        category: 'Navigation',
        title: 'BE11 Website Routes & Page Navigation',
        content: `BE11 route directory:
- Home: /
- Venues Catalog: /venues
- Venue Details & Booking: /venues/:id (e.g., /venues/rrr-cricket-club-kidawali-faridabad, /venues/playnow-cricket-ground, /venues/ab-cricket-ground)
- Live Matches: /live-matches
- Store & Shop: /store
- 3D Jersey Builder: /jersey-builder
- Cricket Kit Builder: /kit-builder
- 3D IPL Toss: /toss
- BE11 Capture: /capture
- Coaches Directory: /coaches
- Coach Profile: /coaches/:id
- Student Training: /my-training (Authenticated)
- Coach Dashboard: /coach-dashboard (Coach role)
- Tournaments: /tournaments
- Become a Vendor: /become-vendor
- Customer Bookings: /my-bookings (Authenticated)
- User Profile & Sports Settings: /profile or /settings (Authenticated)
- Admin Portal: /admin and /admin/bookings (Admin role)
- Authentication: /login, /signup, /forgot-password, /verify-email, /verify-phone
- Legal Policies: /privacy, /terms`,
        source: 'frontend/src/App.tsx',
        sourceType: 'route-metadata',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 routes catalog'),
        tags: ['routes', 'pages', 'urls', 'navigation', 'where to find', 'links']
      }
    ];
  }

  private extractDatabaseCapabilities(): KnowledgeItem[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'db-capabilities',
        category: 'System Architecture',
        title: 'BE11 Database Entities and Models',
        content: `The BE11 backend operates on PostgreSQL via Prisma ORM 6.2.1. Key models include:
- User: Authentication, phone/email verification, roles (CUSTOMER, OWNER, ADMIN, COACH), wallet balance, cricket & football sports profiles.
- Ground: Real-world venues, GPS coordinates, amenities, match pricing rules (Matrix, Packages, Contact).
- Booking: Reservation dates, match periods (MORNING, AFTERNOON, DAY_NIGHT, NIGHT), booking types (SINGLE_TEAM_OF_11, WHOLE_GROUND, INDIVIDUAL), status (PENDING, CONFIRMED, CANCELLED).
- Match: Live match lobbies, host info, teams (Team A, Team B), playersJoined, totalPlayers, entryFee.
- Product & Order: Sports merchandise, custom designs, transactions.
- Coach, Camp, Session, Certificate: Professional athletic training and student enrollments.
- WalletTransaction & WalletTopUp: Prepaid ledger and Razorpay payment tracking.`,
        source: 'backend/prisma/schema.prisma',
        sourceType: 'database-schema',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 database capabilities'),
        tags: ['database', 'models', 'prisma', 'schema', 'entities', 'architecture']
      }
    ];
  }

  private async extractLiveVenueKnowledge(): Promise<KnowledgeItem[]> {
    const now = new Date().toISOString();
    const items: KnowledgeItem[] = [];

    try {
      const grounds = await withTimeout(
        prisma.ground.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        })
      );

      for (const g of grounds) {
        let pricingSummary = '';
        if (g.slug === 'rrr-cricket-club-kidawali-faridabad') {
          pricingSummary = `Operating Model: 3 Fixed 4-hour match periods daily:
- Morning Match: 06:00 AM – 10:00 AM
- Afternoon Match: 10:00 AM – 02:00 PM
- Evening Match: 02:00 PM – 06:00 PM
Pricing tiers (Promo code: BE11 WELCOMES):
- Individual Booking: ₹299 (Display price ₹373.75 with ₹74.75 discount)
- Half Team (Single Team of 11): ₹2,600 (Display price ₹3,250 with ₹650 discount)
- Entire Venue: ₹5,000 (Display price ₹6,250 with ₹1,250 discount)
Venue Owner Contact: Rishi (+91 97116 69718).`;
        } else if (g.slug === 'playnow-cricket-ground') {
          pricingSummary = `Operating Model: Dynamic Weekday vs Weekend Match Period Matrix (Coverage: Both Teams):
- Weekday Morning (07:00 – 11:30 AM): ₹5,000 Entire Venue / ₹2,500 Team of 11
- Weekday Afternoon (12:00 – 04:30 PM): ₹5,000 Entire Venue / ₹2,500 Team of 11
- Weekday Night (08:00 – 11:30 PM): ₹10,000 Entire Venue / ₹5,000 Team of 11
- Weekend Morning (07:00 – 11:30 AM): ₹10,000 Entire Venue / ₹5,000 Team of 11
- Weekend Afternoon (12:00 – 04:30 PM): ₹5,000 Entire Venue / ₹2,500 Team of 11
- Weekend Day-Night (04:30 – 08:00 PM, WEEKENDS ONLY): ₹10,000 Entire Venue / ₹5,000 Team of 11
- Weekend Night (08:00 – 11:30 PM): ₹11,000 Entire Venue / ₹5,500 Team of 11
Venue Owner: Aanurag Jain (+91 95992 80399). No hourly slots.`;
        } else if (g.slug === 'ab-cricket-ground') {
          pricingSummary = `Operating Model: Package-Based Whole Ground Match Reservations:
- Standard Match Package (Morning 07:00-11:30 AM or Afternoon 12:00-04:30 PM): ₹3,500 (Includes pitch prep, umpires, scorers, practice nets, drinking water, dugout).
- Extended Day / Floodlit Night Match Package (06:00-10:30 PM): ₹6,500 (Includes floodlights, pavilion, sight screen, cafeteria access).
- Single Team of 11: Price on request / arranged directly by venue owner Rajesh Bajaj (+91 95402 28222).
Location: New Industrial Town, Aravalli Golf Course precinct, Faridabad. Plus Code: 97PW+V69.`;
        } else {
          pricingSummary = `Price per hour: ₹${g.pricePerHour}. Sport: ${g.sport}. City: ${g.city}, ${g.state}.`;
        }

        const amenitiesList = Array.isArray(g.amenities) ? (g.amenities as any[]).join(', ') : '';

        items.push({
          id: `venue-${g.slug || g.id}`,
          category: 'Venues',
          title: `Venue: ${g.name}`,
          content: `${g.name} is an official BE11 verified sports facility located at ${g.address || g.location}, ${g.city}, ${g.state}.
Sport: ${g.sport}
Location / Coordinates: ${g.latitude}, ${g.longitude}
Amenities: ${amenitiesList || 'Turf pitch, practice nets, pavilion, parking'}
${pricingSummary}
Page URL: /venues/${g.slug || g.id}`,
          source: 'Prisma Ground model (database)',
          sourceType: 'application-data',
          lastUpdated: now,
          version: '1.0.0',
          active: true,
          hash: computeHash(g.name + pricingSummary),
          route: `/venues/${g.slug || g.id}`,
          tags: [g.name.toLowerCase(), g.slug || '', g.city.toLowerCase(), 'venue', 'ground', 'pricing', 'cricket ground', 'faridabad', 'haryana']
        });
      }
    } catch (err) {
      console.error('Non-fatal error reading grounds for knowledge:', err);
    }

    if (items.length === 0) {
      // Baseline verified BE11 venues
      items.push(
        {
          id: 'venue-rrr-cricket-club-kidawali-faridabad',
          category: 'Venues',
          title: 'Venue: RRR Cricket Club Kidawali Faridabad',
          content: `RRR Cricket Club Kidawali Faridabad is an official BE11 verified sports facility located at Kidawali, Pusta Road, Faridabad, Haryana.
Sport: Cricket
Location / Coordinates: 28.466611, 77.397333
Amenities: Natural turf pitch, practice nets, floodlights, pavilion, parking
Operating Model: 3 Fixed 4-hour match periods daily:
- Morning Match: 06:00 AM – 10:00 AM
- Afternoon Match: 10:00 AM – 02:00 PM
- Evening Match: 02:00 PM – 06:00 PM
Pricing tiers (Includes 25% discount with promo code BE11 WELCOMES):
- Individual Booking: ₹299 (Display price ₹373.75 with ₹74.75 discount)
- Half Team (Single Team of 11): ₹2,600 (Display price ₹3,250 with ₹650 discount)
- Entire Venue: ₹5,000 (Display price ₹6,250 with ₹1,250 discount)
Venue Owner Contact: Rishi (+91 97116 69718).
Page URL: /venues/rrr-cricket-club-kidawali-faridabad`,
          source: 'BE11 Verified Venues Registry',
          sourceType: 'application-data',
          lastUpdated: now,
          version: '1.0.0',
          active: true,
          hash: computeHash('RRR Cricket Club Kidawali Faridabad baseline'),
          route: '/venues/rrr-cricket-club-kidawali-faridabad',
          tags: ['rrr', 'rrr cricket club', 'kidawali', 'faridabad', 'venue', 'ground', 'pricing', 'cricket ground', 'haryana'],
        },
        {
          id: 'venue-playnow-cricket-ground',
          category: 'Venues',
          title: 'Venue: Playnow Cricket Ground',
          content: `Playnow Cricket Ground is an official BE11 verified sports facility located at Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102.
Sport: Cricket
Amenities: Natural turf pitch, floodlights, dugout, pavilion, parking
Operating Model: Dynamic Weekday vs Weekend Match Period Matrix (Coverage: Both Teams):
- Weekday Morning (07:00 – 11:30 AM): ₹5,000 Entire Venue / ₹2,500 Team of 11
- Weekday Afternoon (12:00 – 04:30 PM): ₹5,000 Entire Venue / ₹2,500 Team of 11
- Weekday Night (08:00 – 11:30 PM): ₹10,000 Entire Venue / ₹5,000 Team of 11
- Weekend Morning (07:00 – 11:30 AM): ₹10,000 Entire Venue / ₹5,000 Team of 11
- Weekend Afternoon (12:00 – 04:30 PM): ₹5,000 Entire Venue / ₹2,500 Team of 11
- Weekend Day-Night (04:30 – 08:00 PM, WEEKENDS ONLY): ₹10,000 Entire Venue / ₹5,000 Team of 11
- Weekend Night (08:00 – 11:30 PM): ₹11,000 Entire Venue / ₹5,500 Team of 11
Venue Owner: Aanurag Jain (+91 95992 80399). No hourly slots.
Page URL: /venues/playnow-cricket-ground`,
          source: 'BE11 Verified Venues Registry',
          sourceType: 'application-data',
          lastUpdated: now,
          version: '1.0.0',
          active: true,
          hash: computeHash('Playnow Cricket Ground baseline'),
          route: '/venues/playnow-cricket-ground',
          tags: ['playnow', 'playnow cricket ground', 'faridabad', 'venue', 'ground', 'pricing', 'cricket ground', 'haryana'],
        },
        {
          id: 'venue-ab-cricket-ground',
          category: 'Venues',
          title: 'Venue: AB Cricket Ground',
          content: `AB Cricket Ground is an official BE11 verified sports facility located at New Industrial Town, Aravalli Golf Course precinct, Faridabad, Haryana.
Sport: Cricket
Location Coordinates: 28.441139, 77.377944 (Plus Code: 97PW+V69)
Amenities: Umpires, Scorers, Balls, Practice Nets, Floodlights, Cafeteria, Pavilion/Dugout, Washrooms
Operating Model: Package-Based Whole Ground Match Reservations:
- Standard Match Package (Morning 07:00-11:30 AM or Afternoon 12:00-04:30 PM): ₹3,500 (Includes pitch prep, umpires, scorers, practice nets, drinking water, dugout).
- Extended Day / Floodlit Night Match Package (06:00-10:30 PM): ₹6,500 (Includes floodlights, pavilion, sight screen, cafeteria access).
- Single Team of 11: Price on request / arranged directly by venue owner Rajesh Bajaj (+91 95402 28222).
Page URL: /venues/ab-cricket-ground`,
          source: 'BE11 Verified Venues Registry',
          sourceType: 'application-data',
          lastUpdated: now,
          version: '1.0.0',
          active: true,
          hash: computeHash('AB Cricket Ground baseline'),
          route: '/venues/ab-cricket-ground',
          tags: ['ab', 'ab cricket ground', 'rajesh bajaj', 'faridabad', 'venue', 'ground', 'pricing', 'cricket ground', 'haryana'],
        }
      );
    }

    return items;
  }

  private async extractLiveMatchKnowledge(): Promise<KnowledgeItem[]> {
    const now = new Date().toISOString();
    const items: KnowledgeItem[] = [];

    try {
      const openMatches = await withTimeout(
        prisma.match.findMany({
          where: { status: { in: ['Open', 'Live'] } },
          include: {
            ground: { select: { name: true, location: true, city: true } },
          },
          orderBy: { date: 'asc' },
          take: 5,
        })
      );

      items.push({
        id: 'live-matches-overview',
        category: 'Live Matches',
        title: 'How Live Matches Work on BE11',
        content: `Live Matches on BE11 (/live-matches) enable individual players or small groups to play competitive cricket without needing to organize two full teams of 11 players.
- Open Match Lobbies: A host creates an open match lobby with a verified venue, scheduled date, match time, and entry fee (e.g., ₹299 per player).
- Individual Joining: Players join open slots in Team A or Team B directly from the match card.
- Player Capacity: Standard cricket lobbies have 22 total player slots (11 per team).
- Transparency: All match cards display real-time joined slots (e.g., 0/22 or 12/22) directly from the database. BE11 never fabricates dummy participants or fake countdowns.
- Real-time updates: Match board connects via Socket.IO for live slot changes.`,
        source: 'BE11 Live Match Engine',
        sourceType: 'business-rule',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 live matches overview'),
        tags: ['live matches', 'join match', 'play match', 'cricket match', 'spots', 'capacity', 'entry fee', 'individual player']
      });

      for (const m of openMatches) {
        items.push({
          id: `match-${m.id}`,
          category: 'Live Matches',
          title: `Open Match at ${m.ground?.name || 'BE11 Ground'} (${m.date})`,
          content: `Match ID: ${m.id}
Sport: ${m.sport}
Venue: ${m.ground?.name} (${m.ground?.city}, ${m.ground?.location})
Date: ${m.date}
Time: ${m.startTime}
Entry Fee: ₹${m.entryFee} per player
Slots Status: ${m.playersJoined} of ${m.totalPlayers} spots filled (${m.totalPlayers - m.playersJoined} spots available)
Host: ${m.hostName || 'BE11 Community'}
Status: ${m.status}`,
          source: 'Prisma Match model (database)',
          sourceType: 'application-data',
          lastUpdated: now,
          version: '1.0.0',
          active: true,
          hash: computeHash(m.id + m.date + m.playersJoined),
          tags: ['live match', m.sport.toLowerCase(), m.date, m.ground?.name?.toLowerCase() || '', 'open match']
        });
      }
    } catch (err) {
      console.error('Non-fatal error extracting match knowledge:', err);
    }

    return items;
  }

  private extractBookingLogicKnowledge(): KnowledgeItem[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'booking-flow-guide',
        category: 'Venue Booking',
        title: 'How to Book a Venue on BE11',
        content: `BE11 uses a sequential 4-step booking process:
1. **Select Venue & Match Period**: Navigate to /venues, select your desired venue (RRR, Playnow, or AB Ground), pick a calendar date, and choose an available match period (MORNING, AFTERNOON, DAY_NIGHT, or NIGHT).
2. **Customer Details**: Enter full name, 10-digit Indian mobile number, and email. (Automatically pre-filled if logged in).
3. **Select Booking Type**:
   - Single Team of 11: Half-team match reservation.
   - Whole Ground: Complete ground reservation for both sides.
   - Individual: Available at RRR Cricket Club for solo players.
4. **Summary & Submit**: Review the server-calculated total price. Submit booking.
5. **Admin Confirmation**: Newly submitted bookings enter 'PENDING' status awaiting admin verification. Once confirmed by venue admin, it updates to 'CONFIRMED' in your '/my-bookings' dashboard.
Notice: Server-side validation strictly prevents double-booking. If a slot is already confirmed or pending, the system disallows overlapping bookings.`,
        source: 'backend/src/modules/bookings/bookings.controller.ts',
        sourceType: 'business-rule',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 booking flow guide'),
        tags: ['how to book', 'booking flow', 'steps to book', 'reserve venue', 'match period', 'single team', 'whole ground', 'pending status']
      }
    ];
  }

  private extractPaymentAndWalletKnowledge(): KnowledgeItem[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'payments-overview',
        category: 'Payments',
        title: 'How Payments Work on BE11',
        content: `BE11 supports secure payments via Razorpay and the integrated BE11 Wallet.
- Payment Gateway: Integrates with Razorpay for UPI (Google Pay, PhonePe, Paytm), Credit/Debit cards, and Net Banking.
- Zero-Trust Settlement: Server cryptographically verifies the HMAC SHA-256 signature before marking any transaction as PAID. The platform never fakes payment completion.
- Ground Arrival / On-Ground Settlement: For venues where payment status is PAYMENT_PENDING, players can settle dues directly at the ground in coordination with venue management.
- Failed Payments: If an online payment is deducted from your bank account while your booking remains PENDING, the Razorpay webhook or admin verification reconciles it, or funds are credited to your BE11 Wallet.`,
        source: 'backend/src/modules/payments/payments.controller.ts',
        sourceType: 'business-rule',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 payments overview'),
        tags: ['payments', 'razorpay', 'upi', 'cards', 'failed payment', 'deducted', 'payment pending', 'refund']
      },
      {
        id: 'wallet-overview',
        category: 'Wallet',
        title: 'BE11 Digital Wallet',
        content: `BE11 Digital Wallet allows users to maintain prepaid funds for instant bookings:
- Check Balance: Viewable in /profile or header wallet badge.
- Instant Checkout: If your wallet balance covers the total booking price, funds are deducted automatically and your reservation is immediately queued for admin confirmation.
- Top-Ups: Top up your wallet in INR via Razorpay UPI or cards under /profile settings.
- Automated Refunds: Cancellations approved under platform policy are refunded directly to the user's BE11 Wallet balance.`,
        source: 'backend/src/modules/wallet/wallet.routes.ts',
        sourceType: 'business-rule',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 wallet overview'),
        tags: ['wallet', 'wallet balance', 'add money', 'topup', 'credits', 'refund to wallet']
      }
    ];
  }

  private extractAuthAndAccountKnowledge(): KnowledgeItem[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'auth-guide',
        category: 'Account',
        title: 'Account Registration, Login & Verification',
        content: `BE11 User Account Guidelines:
- **Signup Requirements**: Full Name, valid Email address, 10-digit Indian Mobile Phone number, and Password.
- **Email Verification**: REQUIRED. Upon signup, a verification link/code is emailed. You must verify your email before placing venue reservations.
- **Phone Number Requirement**: Phone number is REQUIRED on registration for venue security and contact. Phone OTP verification is currently optional.
- **Google Sign-In**: Supported via Google OAuth for 1-click registration and login.
- **Forgot / Reset Password**: Visit /forgot-password to receive a secure password reset link via email.
- **Sports Profile**: In /settings, users can customize their Cricket Profile (role, batting style, bowling style, favorite IPL team, favorite player) and Football Profile.`,
        source: 'backend/src/modules/auth/auth.controller.ts',
        sourceType: 'business-rule',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 auth guide'),
        tags: ['account', 'signup', 'login', 'email verification', 'phone', 'phone number', 'verify phone', 'phone verification', 'phone required', 'google login', 'forgot password', 'sports profile']
      }
    ];
  }

  private extractSpecialFeaturesKnowledge(): KnowledgeItem[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'feat-jersey-builder',
        category: 'Jersey Builder',
        title: '3D Jersey Builder',
        content: `BE11 Jersey Builder (/jersey-builder) is an interactive 3D studio powered by Three.js that allows cricket and football teams to design custom team jerseys:
- 3D Interactive Canvas: Orbit, zoom, and rotate the 3D jersey model in real-time.
- Customizations: Choose body colors, collar styles, sleeve trims, pattern decals, custom player name, squad number, and upload high-resolution team/sponsor logos.
- Save & Order: Save designs to your account or place batch team orders delivered within 7 business days.`,
        source: 'frontend/src/pages/JerseyBuilder/',
        sourceType: 'application-data',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 jersey builder guide'),
        tags: ['jersey builder', '3d jersey', 'custom jersey', 'team uniform', 'jersey design', 'name and number']
      },
      {
        id: 'feat-kit-builder',
        category: 'Kit Builder',
        title: 'Cricket Kit Builder',
        content: `BE11 Kit Builder (/kit-builder) allows players to assemble tailored cricket equipment sets:
- **Preset Bundles**:
  1. Beginner Starter Kit (₹5,499): Kashmir willow bat, club leather ball, starter gloves, and protection pads.
  2. Intermediate Performance Kit (₹8,999): Grade 3 English willow bat, match seam ball, leather gloves, and impact guard pads.
  3. Elite Professional Kit (₹14,999): Top Grade 1 English willow bat, alum-tanned leather ball, pro batting gloves, pro pads, and wheeled kitbag.
- **Custom Kit**: Mix and match individual bats, balls, gloves, and pads according to your preference.`,
        source: 'frontend/src/pages/KitBuilder.tsx',
        sourceType: 'application-data',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 kit builder guide'),
        tags: ['kit builder', 'cricket kit', 'starter kit', 'pro kit', 'equipment bundle', 'bat', 'pads', 'gloves']
      },
      {
        id: 'feat-toss',
        category: 'Toss',
        title: '3D IPL-Style Toss Simulator',
        content: `BE11 Toss (/toss) is an interactive 3D coin toss tool designed for captains and match umpires:
- 3D Coin Physics: Realistic flipping animation with Heads/Tails outcome.
- Authentic Audio: Features IPL-style toss sound effects and crisp coin landing acoustics.
- Impartiality: Cryptographically fair randomized flip generator for fair cricket match starts.`,
        source: 'frontend/src/pages/Toss.tsx',
        sourceType: 'application-data',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 toss guide'),
        tags: ['toss', 'coin toss', 'ipl toss', 'coin flip', 'match toss', 'heads or tails']
      },
      {
        id: 'feat-capture',
        category: 'Add Ons',
        title: 'BE11 Capture (AI Match Recording)',
        content: `BE11 Capture (/capture) is an advanced multi-camera match broadcast and highlight generation system available as an Add-on:
- Automated Recording: Multi-camera optical tracking installed across BE11 grounds.
- AI Highlight Reels: Automatically detects and cuts boundaries, sixes, wickets, and milestones into shareable reels within minutes of match completion.
- Replay & Analysis: High-definition video replay for players and coaches to evaluate performance.`,
        source: 'frontend/src/pages/Capture.tsx',
        sourceType: 'application-data',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 capture guide'),
        tags: ['capture', 'be11 capture', 'match recording', 'highlights', 'video replay', 'ai camera', 'add ons']
      }
    ];
  }

  private async extractShopKnowledge(): Promise<KnowledgeItem[]> {
    const now = new Date().toISOString();
    const items: KnowledgeItem[] = [];

    try {
      const products = await withTimeout(
        prisma.product.findMany({
          where: { stock: { gt: 0 } },
          take: 6,
        })
      );

      const categories = Array.from(new Set(products.map((p) => p.category))).join(', ');

      items.push({
        id: 'shop-catalog-overview',
        category: 'Store',
        title: 'BE11 Sports Merchandise & Store',
        content: `BE11 Store (/store) offers authentic sports gear for Cricket and Football:
- Categories: Bats, Leather Balls, Batting Gloves, Leg Guards/Pads, Helmets, Sports Shoes, Footballs, Goalkeeper Gloves.
- Delivery: Standard merchandise delivered across India in 3-5 business days; custom jerseys delivered in 7 business days.
- Available Categories: ${categories || 'BATS, BALLS, GLOVES, PADS, JERSEYS, FOOTBALLS'}.`,
        source: 'Prisma Product model',
        sourceType: 'application-data',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 store catalog overview'),
        tags: ['store', 'shop', 'cricket equipment', 'buy bats', 'merchandise', 'products']
      });
    } catch (err) {
      console.error('Non-fatal error reading shop knowledge:', err);
    }

    return items;
  }

  private async extractCoachingKnowledge(): Promise<KnowledgeItem[]> {
    const now = new Date().toISOString();
    return [
      {
        id: 'coaching-program-overview',
        category: 'Coaches',
        title: 'Coaches, Academies & Training Camps',
        content: `BE11 Coaching (/coaches) connects aspiring athletes with certified cricket and football coaches:
- 1-on-1 Personal Training: Book direct private sessions with verified coaches.
- Academy Camps: Enroll in weekend and seasonal camps with defined duration, curriculum, and seat limits.
- Coach Registration: Certified coaches can apply at /coaches to join the BE11 Coaching Network.`,
        source: 'backend/src/modules/coaches/coaches.routes.ts',
        sourceType: 'application-data',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 coaching program overview'),
        tags: ['coaches', 'cricket coaching', 'football coaching', 'training', 'academies', 'camps']
      }
    ];
  }

  private extractPoliciesKnowledge(): KnowledgeItem[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'policy-cancellation-refund',
        category: 'Cancellations & Refunds',
        title: 'Cancellation and Refund Policy',
        content: `BE11 Cancellation and Refund Rules:
- Cancellation Window: Reservations must be cancelled prior to the scheduled slot start time through the /my-bookings dashboard or by contacting venue support.
- Wallet Refund: Prepaid reservations cancelled with 4+ hours advance notice receive a 100% refund credited directly to the user's BE11 Wallet.
- Weather Disruptions: If unplayable ground conditions occur due to rain or severe weather, sessions are rescheduled in coordination with the venue administrator without penalty.
- No-Shows: Failure to arrive for a confirmed reservation without prior cancellation forfeits rescheduling privileges.`,
        source: 'frontend/src/pages/TermsOfService.tsx & Footer.tsx',
        sourceType: 'policy',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 cancellation and refund policy'),
        tags: ['cancellation', 'refund', 'reschedule', 'weather', 'rain policy', 'wallet refund', 'terms']
      },
      {
        id: 'policy-privacy',
        category: 'Privacy',
        title: 'BE11 Privacy Policy Highlights',
        content: `BE11 Privacy Policy (/privacy):
- Data Collection: We collect only strictly necessary information: Full Name, Email Address, 10-digit Indian Mobile Phone, and ground booking history.
- Security: User passwords are encrypted using Bcrypt (cost factor 10). Authentication tokens are securely signed JWTs.
- No Third-Party Selling: Personal data is never sold or leased to third-party marketing brokers.
- Official Contact for Privacy: support@be11.in.`,
        source: 'frontend/src/pages/PrivacyPolicy.tsx',
        sourceType: 'policy',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 privacy policy highlights'),
        tags: ['privacy', 'data protection', 'security', 'personal info', 'cookies', 'gdpr']
      }
    ];
  }

  private extractSupportEscalationKnowledge(): KnowledgeItem[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'support-contact-info',
        category: 'Admin/Support',
        title: 'Human Support & Escalation Contact',
        content: `Official BE11 Support Contact Channels:
- **WhatsApp Support**: +91 87001 90843 (Link: https://wa.me/918700190843)
- **Email Support**: support@be11.in
- **Operating Hours**: 24x7 Customer Support Assistance
- **Resolution Guarantee**: Inquiries regarding venue bookings, payment reconciliation, and custom jersey orders receive prompt response from the support desk.`,
        source: 'BE11 Support Configuration',
        sourceType: 'policy',
        lastUpdated: now,
        version: '1.0.0',
        active: true,
        hash: computeHash('BE11 human support contact'),
        tags: ['support', 'human support', 'whatsapp support', 'email support', 'contact support', 'help desk', 'customer care', 'reach team']
      }
    ];
  }
}
