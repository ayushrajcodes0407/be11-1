/**
 * BE11 Central AEO (Answer Engine Optimization) Knowledge Model
 * 
 * Authoritative, typed single source of truth for public BE11 entities,
 * venues, pricing rules, match structures, customizer features, support contacts,
 * and direct answer extractions.
 */

export interface OrganizationInfo {
  name: string;
  legalName: string;
  tagline: string;
  description: string;
  url: string;
  logo: string;
  sportCategories: string[];
  headquarters: {
    city: string;
    state: string;
    region: string;
    country: string;
  };
  contact: {
    email: string;
    whatsapp: string;
    phoneDisplay: string;
    hours: string;
    helpDeskUrl: string;
  };
  social: {
    twitter: string;
  };
}

export interface VenuePricingTier {
  name: string;
  description: string;
  priceINR: number;
  discountedPriceINR?: number;
  promoCode?: string;
  capacity?: string;
}

export interface VenueMatchPeriod {
  key: string;
  title: string;
  timing: string;
  daysApplicable?: string;
  pricing?: {
    entireGround?: number;
    halfTeam?: number;
    individual?: number;
  };
}

export interface VenueAEO {
  id: string;
  slug: string;
  name: string;
  canonicalUrl: string;
  sport: string;
  city: string;
  state: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  mapsUrl?: string;
  pitchType: string;
  operatingModel: string;
  matchPeriods: VenueMatchPeriod[];
  pricingTiers: VenuePricingTier[];
  verifiedAmenities: string[];
  ownerContact?: {
    name: string;
    phone: string;
  };
  bookingRules: string[];
  faqs: Array<{ question: string; answer: string }>;
}

export interface ServiceAEO {
  id: string;
  name: string;
  canonicalUrl: string;
  description: string;
  keyFeatures: string[];
  howItWorks: string[];
  faqs: Array<{ question: string; answer: string }>;
}

export interface AEOKnowledgeBase {
  organization: OrganizationInfo;
  venues: Record<string, VenueAEO>;
  services: Record<string, ServiceAEO>;
  bookingWorkflow: {
    title: string;
    steps: Array<{ stepNumber: number; title: string; description: string }>;
    confirmationModel: string;
    cancellationPolicy: string;
  };
  globalFaqs: Array<{ question: string; answer: string; category: string }>;
}

export const AEO_KNOWLEDGE: AEOKnowledgeBase = {
  organization: {
    name: 'BE11',
    legalName: 'BE11 Sports Technologies',
    tagline: 'Sports Venue Booking, Live Matches & Athletic Ecosystem',
    description: 'BE11 is India\'s premier sports ground reservation and athletic match management platform operating in Faridabad and the Delhi NCR region. BE11 connects sports enthusiasts to verified cricket grounds, open live match lobbies, verified coaches, custom 3D team jerseys, cricket equipment kits, match video highlights, and digital coin tosses.',
    url: 'https://be11.in',
    logo: 'https://be11.in/be11_logo.png',
    sportCategories: ['Cricket', 'Football'],
    headquarters: {
      city: 'Faridabad',
      state: 'Haryana',
      region: 'Delhi NCR',
      country: 'India',
    },
    contact: {
      email: 'support@be11.in',
      whatsapp: '+91 87001 90843',
      phoneDisplay: '+91 87001 90843',
      hours: '24x7 Customer Support Assistance',
      helpDeskUrl: 'https://wa.me/918700190843',
    },
    social: {
      twitter: '@be11sports',
    },
  },

  venues: {
    'rrr-cricket-club-kidawali-faridabad': {
      id: 'rrr-cricket-club-kidawali-faridabad',
      slug: 'rrr-cricket-club-kidawali-faridabad',
      name: 'RRR Cricket Club Kidawali Faridabad',
      canonicalUrl: 'https://be11.in/venues/rrr-cricket-club-kidawali-faridabad',
      sport: 'Cricket',
      city: 'Faridabad',
      state: 'Haryana',
      address: 'Kidawali, Pusta Road, Near Greater Faridabad, Faridabad, Haryana 121002',
      coordinates: {
        latitude: 28.466611,
        longitude: 77.397333,
      },
      pitchType: 'Natural Turf Pitch',
      operatingModel: '3 Fixed 4-Hour Daily Match Periods with 3 flexible participation tiers',
      matchPeriods: [
        {
          key: 'MORNING',
          title: 'Morning Match Period',
          timing: '06:00 AM – 10:00 AM',
          pricing: { individual: 299, halfTeam: 2600, entireGround: 5000 },
        },
        {
          key: 'AFTERNOON',
          title: 'Afternoon Match Period',
          timing: '10:00 AM – 02:00 PM',
          pricing: { individual: 299, halfTeam: 2600, entireGround: 5000 },
        },
        {
          key: 'EVENING',
          title: 'Evening Match Period',
          timing: '02:00 PM – 06:00 PM',
          pricing: { individual: 299, halfTeam: 2600, entireGround: 5000 },
        },
      ],
      pricingTiers: [
        {
          name: 'Individual Player Slot',
          description: 'Single player entry into an open match lobby with guaranteed participation.',
          priceINR: 373.75,
          discountedPriceINR: 299,
          promoCode: 'BE11 WELCOMES (25% off automatically applied)',
          capacity: '1 Player',
        },
        {
          name: 'Half Team (Single Team of 11)',
          description: 'Reserve one full side of 11 players to compete against another matched team.',
          priceINR: 3250,
          discountedPriceINR: 2600,
          promoCode: 'BE11 WELCOMES (25% off automatically applied)',
          capacity: '11 Players',
        },
        {
          name: 'Entire Venue (Whole Ground)',
          description: 'Exclusive reservation of the full cricket ground and facilities for two private teams (22 players).',
          priceINR: 6250,
          discountedPriceINR: 5000,
          promoCode: 'BE11 WELCOMES (25% off automatically applied)',
          capacity: '22 Players / Full Ground',
        },
      ],
      verifiedAmenities: [
        'Natural Turf Cricket Pitch',
        'Dedicated Practice Nets',
        'Floodlights for Evening Play',
        'Player Pavilion & Dugout',
        'Vehicle Parking Area',
        'Drinking Water & Washrooms',
      ],
      ownerContact: {
        name: 'Rishi',
        phone: '+91 97116 69718',
      },
      bookingRules: [
        'Select one of the three daily match periods (Morning, Afternoon, or Evening).',
        'Choose your booking tier: Individual (₹299), Half Team (₹2,600), or Entire Venue (₹5,000).',
        'Arrive 15 minutes prior to slot start time for toss and warm-up.',
        'Rain or weather disruptions are eligible for rescheduling via venue management.',
      ],
      faqs: [
        {
          question: 'What are the booking prices at RRR Cricket Club Kidawali Faridabad?',
          answer: 'RRR Cricket Club offers 3 booking tiers: Individual slot for ₹299 (discounted from ₹373.75), Half Team (11 players) for ₹2,600 (discounted from ₹3,250), and Entire Venue for ₹5,000 (discounted from ₹6,250) using the promo code BE11 WELCOMES.',
        },
        {
          question: 'What match periods are available at RRR Cricket Club?',
          answer: 'RRR Cricket Club operates across three fixed 4-hour periods daily: Morning (06:00 AM – 10:00 AM), Afternoon (10:00 AM – 02:00 PM), and Evening (02:00 PM – 06:00 PM).',
        },
        {
          question: 'Where is RRR Cricket Club located?',
          answer: 'RRR Cricket Club is situated at Kidawali, Pusta Road, near Greater Faridabad (Sector 86 vicinity), Faridabad, Haryana (Coordinates: 28.466611, 77.397333).',
        },
      ],
    },

    'playnow-cricket-ground': {
      id: 'playnow-cricket-ground',
      slug: 'playnow-cricket-ground',
      name: 'Playnow Cricket Ground',
      canonicalUrl: 'https://be11.in/venues/playnow-cricket-ground',
      sport: 'Cricket',
      city: 'Gurugram',
      state: 'Haryana',
      address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
      coordinates: {
        latitude: 28.403646,
        longitude: 77.136787,
      },
      mapsUrl: 'https://maps.app.goo.gl/omqt5t5SVrkQTMGV9',
      pitchType: 'Maintained Turf Pitch',
      operatingModel: 'Dynamic Weekday vs Weekend match period matrix covering whole ground and team reservations',
      matchPeriods: [
        {
          key: 'WEEKDAY_MORNING',
          title: 'Weekday Morning',
          timing: '07:00 AM – 11:30 AM',
          daysApplicable: 'Monday to Friday',
          pricing: { entireGround: 5000, halfTeam: 2500 },
        },
        {
          key: 'WEEKDAY_AFTERNOON',
          title: 'Weekday Afternoon',
          timing: '12:00 PM – 04:30 PM',
          daysApplicable: 'Monday to Friday',
          pricing: { entireGround: 5000, halfTeam: 2500 },
        },
        {
          key: 'WEEKDAY_NIGHT',
          title: 'Weekday Night (Floodlights)',
          timing: '08:00 PM – 11:30 PM',
          daysApplicable: 'Monday to Friday',
          pricing: { entireGround: 10000, halfTeam: 5000 },
        },
        {
          key: 'WEEKEND_MORNING',
          title: 'Weekend Morning',
          timing: '07:00 AM – 11:30 AM',
          daysApplicable: 'Saturday & Sunday',
          pricing: { entireGround: 10000, halfTeam: 5000 },
        },
        {
          key: 'WEEKEND_AFTERNOON',
          title: 'Weekend Afternoon',
          timing: '12:00 PM – 04:30 PM',
          daysApplicable: 'Saturday & Sunday',
          pricing: { entireGround: 5000, halfTeam: 2500 },
        },
        {
          key: 'WEEKEND_DAY_NIGHT',
          title: 'Weekend Day-Night (Sunset Transition)',
          timing: '04:30 PM – 08:00 PM',
          daysApplicable: 'Saturday & Sunday only',
          pricing: { entireGround: 10000, halfTeam: 5000 },
        },
        {
          key: 'WEEKEND_NIGHT',
          title: 'Weekend Night (Prime Floodlights)',
          timing: '08:00 PM – 11:30 PM',
          daysApplicable: 'Saturday & Sunday',
          pricing: { entireGround: 11000, halfTeam: 5500 },
        },
      ],
      pricingTiers: [
        {
          name: 'Weekday Match (Morning / Afternoon)',
          description: 'Standard 4.5-hour weekday match slot for two full teams.',
          priceINR: 5000,
          capacity: '22 Players / Full Ground',
        },
        {
          name: 'Weekday Night Match (Floodlights)',
          description: 'Floodlit 3.5-hour evening match under high-lux stadium lighting.',
          priceINR: 10000,
          capacity: '22 Players / Full Ground',
        },
        {
          name: 'Weekend Prime Match (Morning / Day-Night)',
          description: 'Premium weekend match slot including ground preparation and pavilion access.',
          priceINR: 10000,
          capacity: '22 Players / Full Ground',
        },
        {
          name: 'Weekend Night Match (Peak Floodlights)',
          description: 'Peak weekend floodlit match reservation.',
          priceINR: 11000,
          capacity: '22 Players / Full Ground',
        },
      ],
      verifiedAmenities: [
        'Well-maintained Turf Pitch',
        'High-Lux Floodlighting Towers',
        'Covered Team Dugouts',
        'Spectator Pavilion',
        'Dedicated On-site Parking',
        'Dressing Rooms & Washrooms',
      ],
      ownerContact: {
        name: 'Aanurag Jain',
        phone: '+91 95992 80399',
      },
      bookingRules: [
        'Pricing depends on whether the booking is on a weekday or weekend and the selected match period.',
        'No hourly bookings; slots are structured as complete match periods (3.5 to 4.5 hours).',
        'Team of 11 booking is available at 50% of the entire ground price.',
      ],
      faqs: [
        {
          question: 'How does pricing work at Playnow Cricket Ground?',
          answer: 'Playnow Cricket Ground operates on a match-period matrix: Weekday day matches are ₹5,000 for the entire venue, Weekday night floodlit matches are ₹10,000, Weekend day matches are ₹5,000 to ₹10,000, Weekend Day-Night slots are ₹10,000, and Weekend Night floodlit slots are ₹11,000. Single Team of 11 reservations are 50% of the full ground price.',
        },
        {
          question: 'Does Playnow Cricket Ground offer hourly bookings?',
          answer: 'No, Playnow Cricket Ground reserves grounds by match periods (3.5 to 4.5 hours each) rather than hourly slots to ensure uninterrupted full 20-over or 25-over cricket games.',
        },
        {
          question: 'Where is Playnow Cricket Ground situated?',
          answer: 'Playnow Cricket Ground is located at Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102.',
        },
      ],
    },

    'ab-cricket-ground': {
      id: 'ab-cricket-ground',
      slug: 'ab-cricket-ground',
      name: 'AB Cricket Ground',
      canonicalUrl: 'https://be11.in/venues/ab-cricket-ground',
      sport: 'Cricket',
      city: 'Faridabad',
      state: 'Haryana',
      address: 'New Industrial Town, Near Aravalli Golf Course precinct, Faridabad, Haryana 121001',
      coordinates: {
        latitude: 28.441139,
        longitude: 77.377944,
      },
      pitchType: 'Championship Grass Turf Pitch',
      operatingModel: 'Comprehensive Match Package model including umpires, scorers, and match equipment',
      matchPeriods: [
        {
          key: 'STANDARD_MORNING',
          title: 'Standard Morning Match Package',
          timing: '07:00 AM – 11:30 AM',
          pricing: { entireGround: 3500 },
        },
        {
          key: 'STANDARD_AFTERNOON',
          title: 'Standard Afternoon Match Package',
          timing: '12:00 PM – 04:30 PM',
          pricing: { entireGround: 3500 },
        },
        {
          key: 'EXTENDED_FLOODLIT_NIGHT',
          title: 'Extended Day / Floodlit Night Package',
          timing: '06:00 PM – 10:30 PM',
          pricing: { entireGround: 6500 },
        },
      ],
      pricingTiers: [
        {
          name: 'Standard Match Package',
          description: 'Comprehensive day match package including pitch preparation, umpires, digital scorers, practice nets, drinking water, and dugout.',
          priceINR: 3500,
          capacity: '22 Players / Full Match',
        },
        {
          name: 'Extended Day / Floodlit Night Package',
          description: 'Includes full high-lux floodlighting, pavilion access, sight screens, cafeteria access, and match coordination.',
          priceINR: 6500,
          capacity: '22 Players / Floodlit Match',
        },
      ],
      verifiedAmenities: [
        'Official Umpires and Digital Scorers Included',
        'Match Balls & Practice Nets Provided',
        'High-Lux Floodlighting for Night Fixtures',
        'Cafeteria & Refreshment Zone',
        'Player Pavilion & Sight Screens',
        'Dedicated Washrooms & Parking',
      ],
      ownerContact: {
        name: 'Rajesh Bajaj',
        phone: '+91 95402 28222',
      },
      bookingRules: [
        'Select either the Standard Day Package (₹3,500) or Floodlit Night Package (₹6,500).',
        'Package includes match equipment, umpires, and scoring support.',
        'Single team inquiries can be coordinated via venue management.',
      ],
      faqs: [
        {
          question: 'What packages are available at AB Cricket Ground Faridabad?',
          answer: 'AB Cricket Ground offers two all-inclusive packages: the Standard Match Package (Morning or Afternoon) for ₹3,500 and the Extended Day / Floodlit Night Package (06:00 PM – 10:30 PM) for ₹6,500.',
        },
        {
          question: 'Are umpires and scorers included in AB Cricket Ground packages?',
          answer: 'Yes, AB Cricket Ground match packages include official umpires, scorers, match balls, pitch preparation, practice nets, and drinking water.',
        },
        {
          question: 'Where is AB Cricket Ground located?',
          answer: 'AB Cricket Ground is located in New Industrial Town, adjacent to the Aravalli Golf Course precinct, Faridabad, Haryana (Coordinates: 28.441139, 77.377944).',
        },
      ],
    },
  },

  services: {
    'live-matches': {
      id: 'live-matches',
      name: 'BE11 Live Matches',
      canonicalUrl: 'https://be11.in/live-matches',
      description: 'BE11 Live Matches is an open matchmaking lobby system allowing individual cricket and football players or small groups to book slots and play competitive games without organizing 22 players independently.',
      keyFeatures: [
        'Open Match Lobbies with 22 total player slots (11 per team)',
        'Individual player slot entry fees (e.g. ₹299 per player)',
        'Real-time slot availability tracked directly in database (no fake participant counters)',
        'Balanced team assignments (Team A vs Team B) at the ground',
        'Verified venue, scheduled match time, and ground coordinator support',
      ],
      howItWorks: [
        'Browse open match lobbies on /live-matches.',
        'Select your preferred venue, match period, and team slot (Team A or Team B).',
        'Complete slot reservation using BE11 Wallet or Razorpay gateway.',
        'Arrive at the verified venue on match day with your equipment.',
        'Play the match organized by the venue coordinator.',
      ],
      faqs: [
        {
          question: 'What are BE11 Live Matches?',
          answer: 'BE11 Live Matches are open public game lobbies where individual sports enthusiasts can register for a single player slot in an organized match without needing to bring a full team of 11 or 22 players.',
        },
        {
          question: 'How do I join a BE11 Live Match?',
          answer: 'Visit https://be11.in/live-matches, select an active match lobby, choose Team A or Team B, and complete the slot payment. You will receive an instant confirmed booking in your profile.',
        },
        {
          question: 'What sports are available for live matches on BE11?',
          answer: 'BE11 currently hosts live match lobbies for Cricket and Football at verified sports grounds across Delhi NCR (including Gurugram and Faridabad).',
        },
      ],
    },

    'jersey-builder': {
      id: 'jersey-builder',
      name: 'BE11 3D Custom Jersey Builder',
      canonicalUrl: 'https://be11.in/jersey-builder',
      description: 'An interactive 3D sports jersey customizer enabling teams, clubs, and individual athletes to design professional sublimated jerseys with custom colors, sponsor logos, player names, and numbers.',
      keyFeatures: [
        'Real-time 3D interactive mesh preview with 360-degree rotation',
        'Customizable base patterns, collar styles, sleeves, and side trims',
        'Dynamic player name and squad number placement',
        'Front and sleeve custom sponsor logo uploads',
        'Premium moisture-wicking breathable athletic polyester fabric',
        'Sublimated print durability that will not crack or peel',
      ],
      howItWorks: [
        'Open the 3D Jersey Builder at /jersey-builder.',
        'Choose a jersey pattern and select primary, secondary, and accent colors.',
        'Enter player names and squad numbers (single jersey or full squad roster).',
        'Upload your team emblem and sponsor artwork.',
        'Preview in 3D and submit your order for custom printing and delivery.',
      ],
      faqs: [
        {
          question: 'What is the BE11 Jersey Builder?',
          answer: 'The BE11 Jersey Builder is a real-time 3D apparel customization tool that allows athletes and teams to design sublimated custom cricket and sports jerseys with personalized names, numbers, team badges, and sponsor logos.',
        },
        {
          question: 'Can I design jerseys for an entire 11-player squad?',
          answer: 'Yes, the Jersey Builder supports full squad roster inputs with individual player names, squad numbers, and specific jersey sizes (S to XXL).',
        },
      ],
    },

    'kit-builder': {
      id: 'kit-builder',
      name: 'BE11 Cricket Kit Builder',
      canonicalUrl: 'https://be11.in/kit-builder',
      description: 'A modular cricket equipment configurator allowing cricketers to bundle bats, balls, batting pads, batting gloves, and accessories according to skill level.',
      keyFeatures: [
        'Preset bundles: Beginner, Intermediate, and Pro',
        'Custom item-by-item kit configuration',
        'Authentic equipment sourced directly from verified sports manufacturers',
        'Bundle discount pricing when purchasing complete kits',
      ],
      howItWorks: [
        'Visit /kit-builder to start a custom gear bundle.',
        'Select bat willow grade (English Willow / Kashmir Willow).',
        'Choose match leather or practice tennis balls, batting gloves, and pads.',
        'Review bundle price and order for doorstep delivery.',
      ],
      faqs: [
        {
          question: 'What is the BE11 Cricket Kit Builder?',
          answer: 'The Cricket Kit Builder allows cricketers to build customized equipment bundles (including bats, batting pads, gloves, match balls, and kit bags) or select skill-based presets (Beginner, Intermediate, Pro) with bundle savings.',
        },
      ],
    },

    'coaches': {
      id: 'coaches',
      name: 'BE11 Certified Sports Coaches',
      canonicalUrl: 'https://be11.in/coaches',
      description: 'Directory of verified cricket coaches, bowling specialists, batting mentors, and athletic trainers in Faridabad available for private training and group academies.',
      keyFeatures: [
        'Verified coach profiles with documented sporting experience',
        'Specializations in Fast Bowling, Spin, Batting Technique, and Fielding',
        'Direct session scheduling and training camp enrollments',
        'Authentic session fees and verifiable credentials',
      ],
      howItWorks: [
        'Browse coach profiles at /coaches.',
        'Review coach experience, hourly rate, and training location.',
        'Book 1-on-1 coaching sessions or register for multi-week academy camps.',
      ],
      faqs: [
        {
          question: 'How do I hire a cricket coach on BE11?',
          answer: 'Navigate to https://be11.in/coaches, review verified coach profiles, check their coaching experience and session pricing, and submit a session booking request.',
        },
        {
          question: 'Are BE11 coaches verified?',
          answer: 'Yes, coach profiles listed on BE11 represent verified sports trainers and certified academy instructors active in Faridabad and Delhi NCR.',
        },
      ],
    },

    'store': {
      id: 'store',
      name: 'BE11 Sports Store',
      canonicalUrl: 'https://be11.in/store',
      description: 'Online sports retail store supplying verified cricket equipment, match balls, protective gear, footballs, and athletic accessories with delivery across India.',
      keyFeatures: [
        'English Willow and Kashmir Willow cricket bats',
        'Four-piece match leather balls and durable heavy tennis balls',
        'High-density protective batting pads and gloves',
        'Official match footballs (Size 5)',
        'Transparent pricing in Indian Rupees (INR) with secure checkout',
      ],
      howItWorks: [
        'Browse products by category on /store.',
        'Add items to your cart and proceed to secure checkout.',
        'Pay online via Razorpay or BE11 Wallet.',
        'Receive fast shipping and tracking information.',
      ],
      faqs: [
        {
          question: 'What sports products are available in the BE11 Store?',
          answer: 'The BE11 Store stocks premium cricket equipment (bats, leather balls, batting pads, gloves, helmets), match footballs, team apparel, and athletic accessories.',
        },
        {
          question: 'Are products on BE11 genuine and verified?',
          answer: 'Yes, all sports equipment on BE11 is sourced directly from authentic manufacturers and sports equipment partners.',
        },
      ],
    },

    'tournaments': {
      id: 'tournaments',
      name: 'BE11 Tournament Hosting & Fixtures',
      canonicalUrl: 'https://be11.in/tournaments',
      description: 'Tournament management and hosting platform for organizers and corporate sports leagues to register tournaments, manage fixtures, and coordinate ground bookings.',
      keyFeatures: [
        'Tournament listing and public fixture tables',
        'Team registration and roster validation',
        'Ground scheduling across verified BE11 venues',
        'Umpire, scorer, and ball coordination support',
      ],
      howItWorks: [
        'Visit /tournaments to explore active leagues or register a new tournament.',
        'Submit tournament parameters (format, ball type, dates, venue requirements).',
        'BE11 coordinates ground slots, scheduling, and official support.',
      ],
      faqs: [
        {
          question: 'Does BE11 host cricket tournaments?',
          answer: 'Yes, BE11 provides a dedicated tournament management portal (/tournaments) where organizers can host leagues, manage fixtures, book grounds, and accept team registrations.',
        },
      ],
    },

    'become-vendor': {
      id: 'become-vendor',
      name: 'BE11 Vendor & Ground Partner Registration',
      canonicalUrl: 'https://be11.in/become-vendor',
      description: 'Onboarding portal for sports ground owners, sports equipment manufacturers, and academy coaches to partner with BE11 and list their services.',
      keyFeatures: [
        'Direct ground listing to thousands of active sports players in Faridabad',
        'Automated slot booking engine and revenue settlement',
        'Merchant and vendor profile management',
      ],
      howItWorks: [
        'Visit /become-vendor and fill in your facility or business details.',
        'The BE11 operations team inspects the ground/inventory and verifies credentials.',
        'Your venue or catalog is published on the BE11 platform for customer reservations.',
      ],
      faqs: [
        {
          question: 'How can a ground owner list their venue on BE11?',
          answer: 'Sports ground owners can register at https://be11.in/become-vendor. The BE11 team verifies the pitch specifications and facility details before publishing the venue for online reservations.',
        },
      ],
    },

    'capture': {
      id: 'capture',
      name: 'BE11 Capture (Match Recording)',
      canonicalUrl: 'https://be11.in/capture',
      description: 'Automated sports video recording service providing high-definition match footage, multicam replays, and video clip highlights for cricket and football fixtures.',
      keyFeatures: [
        'HD multi-angle match video recording',
        'Automated wicket, boundary, and goal highlight clips',
        'Shareable video links for players and social media',
      ],
      howItWorks: [
        'Request BE11 Capture during venue reservation or via /capture.',
        'On match day, camera setups record the full fixture.',
        'Access match highlights and downloadable video clips via your BE11 account.',
      ],
      faqs: [
        {
          question: 'What is BE11 Capture?',
          answer: 'BE11 Capture is an automated HD match recording service that captures cricket and football matches, producing downloadable replay clips and boundary/wicket highlight reels.',
        },
      ],
    },

    'toss': {
      id: 'toss',
      name: 'BE11 3D Match Toss',
      canonicalUrl: 'https://be11.in/toss',
      description: 'Digital 3D match coin toss simulator featuring physics-based coin rotation, match sound effects, and impartial heads/tails selection for cricket and football captains.',
      keyFeatures: [
        'Physics-driven 3D gold coin flip',
        'Realistic stadium ambient sound effects and referee whistle',
        'Instant impartial decision for team captains at the pitch',
      ],
      howItWorks: [
        'Navigate to /toss on mobile or desktop.',
        'Enter Team A and Team B names and select Heads or Tails.',
        'Tap Flip to conduct an authentic 3D digital coin toss.',
      ],
      faqs: [
        {
          question: 'What is BE11 Toss?',
          answer: 'BE11 Toss is a free 3D digital coin flip simulator at https://be11.in/toss designed for match captains to conduct fair, realistic match tosses before sports games.',
        },
      ],
    },
  },

  bookingWorkflow: {
    title: 'How to Book a Sports Venue on BE11',
    steps: [
      {
        stepNumber: 1,
        title: 'Select Venue',
        description: 'Browse verified venues on /venues (e.g. RRR Cricket Club, Playnow Cricket Ground, AB Cricket Ground) and review pitch type, location, and amenities.',
      },
      {
        stepNumber: 2,
        title: 'Choose Match Date',
        description: 'Use the interactive calendar to select your desired playing date.',
      },
      {
        stepNumber: 3,
        title: 'Select Match Period / Package',
        description: 'Pick an available morning, afternoon, evening, or night floodlit match period.',
      },
      {
        stepNumber: 4,
        title: 'Choose Booking Type',
        description: 'Select Entire Venue (full ground for 2 teams), Half Team (single squad of 11), or Individual Player Slot where supported.',
      },
      {
        stepNumber: 5,
        title: 'Enter Player / Contact Details',
        description: 'Provide the primary booking contact name, 10-digit Indian phone number, and email address for booking confirmation.',
      },
      {
        stepNumber: 6,
        title: 'Review Summary & Pricing',
        description: 'Check the slot timing, applicable package price, and automatic promotional discounts (e.g., BE11 WELCOMES).',
      },
      {
        stepNumber: 7,
        title: 'Complete Secure Payment',
        description: 'Pay instantly using BE11 Wallet balance or via Razorpay (UPI, Credit/Debit Cards, Net Banking).',
      },
      {
        stepNumber: 8,
        title: 'Instant Confirmation & Match Lobby',
        description: 'Receive booking confirmation instantly in your /my-bookings portal, with venue coordinates and owner contact details.',
      },
    ],
    confirmationModel: 'Instant online confirmation upon successful payment transaction, with automated entry in the venue calendar.',
    cancellationPolicy: 'Cancellations initiated 4+ hours prior to slot start receive 100% refund credited to the BE11 Wallet. Weather disruptions are rescheduled directly with venue management.',
  },

  globalFaqs: [
    {
      category: 'General',
      question: 'What is BE11?',
      answer: 'BE11 (https://be11.in) is India\'s sports ground reservation and athletic match management platform based in Faridabad, Haryana. It enables players to book verified cricket grounds, join open live matches, design 3D team jerseys, hire verified coaches, and purchase sports gear.',
    },
    {
      category: 'Booking',
      question: 'How do I book a cricket ground on BE11?',
      answer: 'Visit https://be11.in/venues, select a ground (such as RRR Cricket Club, Playnow, or AB Cricket Ground), pick a date and match period, select your booking type (Whole Ground, Half Team, or Individual), and complete payment via UPI, cards, or BE11 Wallet.',
    },
    {
      category: 'Venues',
      question: 'Which cricket grounds are available for booking on BE11?',
      answer: 'BE11 features verified cricket venues including RRR Cricket Club Kidawali Faridabad, Playnow Cricket Ground (Gurugram), and AB Cricket Ground (NIT / Aravalli precinct).',
    },
    {
      category: 'Matches',
      question: 'Can I join a cricket match if I do not have a full team?',
      answer: 'Yes, through BE11 Live Matches (/live-matches) or Individual Slot bookings at venues like RRR Cricket Club (₹299/slot), individual players can register and join an organized 22-player match lobby without needing a full 11-player squad.',
    },
    {
      category: 'Support',
      question: 'How do I contact BE11 customer support?',
      answer: 'Official BE11 support is available via WhatsApp at +91 87001 90843 (https://wa.me/918700190843) and by email at support@be11.in.',
    },
  ],
};
