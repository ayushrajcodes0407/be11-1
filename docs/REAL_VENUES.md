# BE11 — Production Real Venue Architecture & Integration Guide

This document details the production-ready venue infrastructure for BE11, fully replacing sample/dummy venues with verified real sports grounds.

---

## 1. Approved Production Venues

### Venue 1: RRR Cricket Club Kidawali Faridabad
- **Slug**: `rrr-cricket-club-kidawali-faridabad`
- **Decimal Coordinates**: Latitude `28.466611`, Longitude `77.397333`
- **DMS Input**: 28°27'59.8"N, 77°23'50.4"E
- **Address**: Bhati House, Kidawali Gaon, Faridabad, Kirawali, Pusta Road, Sherpur Khadar, Faridabad - 121002, Haryana, India
- **Owner**: Rishi (`+91 97116 69718`)
- **Pricing Strategy**: Displayed as `"Contact for pricing"` / `"Price on request"`. No fake rates are published.
- **Media**: Real photos uploaded to `/venues/rrr/`.

### Venue 2: Playnow Cricket Ground
- **Slug**: `playnow-cricket-ground`
- **Location**: Gurugram, Haryana
- **Address**: Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102
- **Decimal Coordinates**: Latitude `28.403646`, Longitude `77.136787`
- **Maps Link**: `https://maps.app.goo.gl/omqt5t5SVrkQTMGV9`
- **Owner**: Aanurag Jain (`+91 95992 80399`)
- **Pricing Strategy**: Dynamic Weekday vs Weekend Time-Slot Matrix (Coverage: Both Teams):
  - **Weekday Morning** (06:00 - 12:00): ₹5,000
  - **Weekday Afternoon** (12:00 - 16:00): ₹5,000
  - **Weekday Night** (19:00 - 23:00): ₹10,000
  - **Weekend Morning** (06:00 - 12:00): ₹10,000
  - **Weekend Afternoon** (12:00 - 16:00): ₹5,000
  - **Weekend Day-Night** (16:00 - 19:00): ₹10,000
  - **Weekend Night** (19:00 - 23:00): ₹11,000
- **Media**: Real photos and HD video tour uploaded to `/venues/playnow/`.

### Venue 3: AB Cricket Ground
- **Slug**: `ab-cricket-ground`
- **Decimal Coordinates**: Latitude `28.441139`, Longitude `77.377944`
- **Plus Code**: `97PW+V69`
- **Address**: New Industrial Town, Aravalli Golf Course, New Industrial Township, Faridabad, Haryana - 121001, India
- **Owner**: Rajesh Bajaj (`+91 95402 28222`)
- **Verified Facilities**:
  - Umpires
  - Scorers
  - Drinking Water
  - Practice Nets
  - Flood Lights
  - Balls
  - Washrooms
  - Pavilion/Dugout
  - Sight Screen
  - Cafeteria
- **Pricing Strategy**: Selectable package options:
  - Standard Match Slot: ₹3,500
  - Extended Day Match Slot: ₹6,500
- **Media**: 9 real images and brand logo uploaded to `/venues/ab/`.

---

## 2. Technical Architecture

```text
Prisma SQLite Database (Ground Model)
        │
        ▼
Backend Express API (/api/v1/grounds)
├── GET /api/v1/grounds (Supports sport, city, search query parameters)
├── GET /api/v1/grounds/:id (Supports UUID or Slug lookup)
└── GET /api/v1/grounds/:id/slots (Calculates dynamic Weekday/Weekend pricing matrix)
        │
        ▼
Zustand Location Store (locationStore.ts -> Default: Faridabad)
        │
        ▼
Frontend React Pages & Components
├── Venues.tsx (Search, Filters, List View, Leaflet Map View)
├── VenueDetail.tsx (Media Carousel, HTML5 Video, Owner Contact, Map Directions, Booking Slot Matrix)
└── Home.tsx (Curated Popular Venues Showcase)
```

---

## 3. How to Add Future Real Venues

1. **Upload Assets**:
   - Save photos/videos in `frontend/public/venues/<venue-slug>/`.

2. **Add Record to Database / Seed**:
   - Insert new `prisma.ground.create()` entry in `backend/prisma/seed/seed.ts` with:
     - `name`, `slug`, `location`, `address`, `city`, `state`, `country`
     - `latitude`, `longitude`, `mapsUrl`, `plusCode`
     - `ownerName`, `ownerPhone`
     - `amenities` (JSON string array)
     - `images`, `videos` (JSON string arrays)
     - `pricingLabel`, `pricingRules` (JSON object)

3. **Run Seed**:
   - Execute `npx prisma db seed` inside `backend/`.
