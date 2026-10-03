# BE11 — Venue Booking System Architecture & Specification

## 1. Overview
The BE11 Venue Booking System is a production-grade, date-driven sports ground reservation engine designed to replace traditional hourly slot systems with **Match Periods** (`MORNING`, `AFTERNOON`, `DAY_NIGHT`, `NIGHT`).

The architecture ensures:
- **Zero-Trust Pricing**: The server independently verifies and recalculates prices based on date (weekday vs. weekend), venue configuration, match period, and booking type. Client-sent prices are strictly ignored.
- **Atomic Double-Booking Protection**: Strict collision detection and transactional locking (`prisma.$transaction`) prevent concurrent race-condition reservations.
- **Strict Booking Flow**: A sequential 4-step wizard:
  `Select Date & Match Period` → `Your Details Form` → `Booking Type Selection (Single Team of 11 vs Whole Ground)` → `Final Booking Summary & Confirmation`.
- **Verified Venues**: Zero dummy venues or mock bookings. Production database contains only 3 verified real venues.

---

## 2. Production Venues & Operational Models

| Venue | Location | Operating Model | Pricing Strategy | Key Amenities | Owner / Management |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RRR Cricket Club Kidawali Faridabad** | Kidawali, Faridabad, Haryana | Contact Only | Custom / Price on Request | Turf Pitch, Floodlights, Pavilion, Nets | Rishi (+91 97116 69718) |
| **Playnow Cricket Ground** | Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102 | Match Period Matrix | Weekday / Weekend Dynamic Matrix | Turf Pitch, Floodlights, Pavilion, Dugout, Parking | Playnow Management (+91 99999 12345) |
| **AB Cricket Ground** | Pali-Dhauj Road, Faridabad, Haryana | Whole Ground Packages | ₹3,500 (Day) / ₹6,500 (Night) | Umpires, Scorers, Balls, Nets, Floodlights, Cafeteria | **Rajesh Bajaj** (+91 95402 28222) |

---

## 3. Data Models & Schema

### Prisma Booking Model (`schema.prisma`)
```prisma
model Booking {
  id              String         @id @default(uuid())
  groundId        String
  ground          Ground         @relation(fields: [groundId], references: [id])
  customerId      String
  customer        User           @relation(fields: [customerId], references: [id])
  customerName    String?        // Pre-filled from User profile, editable in booking wizard
  customerPhone   String?        // Indian 10-digit mobile number
  customerEmail   String?        // Verified contact email
  date            String         // YYYY-MM-DD
  startTime       String         // e.g. "07:00"
  endTime         String         // e.g. "11:30"
  matchPeriod     String?        // MORNING, AFTERNOON, DAY_NIGHT, NIGHT
  bookingType     String         @default("WHOLE_GROUND") // SINGLE_TEAM_OF_11 | WHOLE_GROUND
  totalPrice      Float
  status          BookingStatus  @default(PENDING) // PENDING, CONFIRMED, CANCELLED, EXPIRED
  paymentStatus   PaymentStatus  @default(PENDING) // PENDING, PAID, REFUNDED, FAILED, PAYMENT_PENDING
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}
```

### Match Period Definitions (`MatchPeriod`)
```typescript
export enum MatchPeriod {
  MORNING = 'MORNING',       // 07:00 AM - 11:30 AM
  AFTERNOON = 'AFTERNOON',   // 12:00 PM - 04:30 PM
  DAY_NIGHT = 'DAY_NIGHT',   // 04:30 PM - 08:00 PM (Weekends Only for Playnow)
  NIGHT = 'NIGHT',           // 08:00 PM - 11:30 PM (or 06:00 PM - 10:30 PM for AB)
}
```

### Booking Type Definitions (`BookingType`)
```typescript
export type BookingType = 'SINGLE_TEAM_OF_11' | 'WHOLE_GROUND';
```
> **Notice**: The legacy "Individual" option has been removed from venue ground reservations. Ground reservations strictly accept either **Single Team of 11** or **Whole Ground**.

---

## 4. Pricing Rules & Execution

### A. Playnow Cricket Ground
Pricing is driven by the calendar date (weekday vs weekend):

- **Weekday (Monday – Friday)**:
  - `MORNING`: ₹5,000 (Whole Ground) / ₹2,500 (Single Team of 11)
  - `AFTERNOON`: ₹5,000 (Whole Ground) / ₹2,500 (Single Team of 11)
  - `DAY_NIGHT`: **Not Available** (Weekday business rule)
  - `NIGHT`: ₹10,000 (Whole Ground) / ₹5,000 (Single Team of 11)

- **Weekend (Saturday – Sunday)**:
  - `MORNING`: ₹10,000 (Whole Ground) / ₹5,000 (Single Team of 11)
  - `AFTERNOON`: ₹5,000 (Whole Ground) / ₹2,500 (Single Team of 11)
  - `DAY_NIGHT`: ₹10,000 (Whole Ground) / ₹5,000 (Single Team of 11)
  - `NIGHT`: ₹11,000 (Whole Ground) / ₹5,500 (Single Team of 11)

### B. AB Cricket Ground
All base pricing represents **WHOLE GROUND BOOKING**:
- **Starting Price**: Whole Ground starting from ₹3,500.
- **Day Match (Morning / Afternoon)**: **₹3,500** (Standard Whole Ground: includes pitch, umpires, scorers, practice nets, washrooms, drinking water).
- **Night Match (Floodlit)**: **₹6,500** (Extended Whole Ground: includes floodlights, sight screen, pavilion dugout, cafeteria access).
- **Single Team of 11**: **Price on request** (Venue owner Rajesh Bajaj at `+91 95402 28222` arranges matching opponents). The system **never** fabricates a dummy price.

### C. RRR Cricket Club Kidawali Faridabad
- **Model**: Direct Contact with owner Rishi at `+91 97116 69718`.
- Pricing is tailored per match overs and pitch preparation.

---

## 5. Availability & Double-Booking Protection

Availability is checked dynamically:
```sql
SELECT * FROM "Booking"
WHERE "groundId" = :groundId
  AND "date" = :date
  AND "status" IN ('CONFIRMED', 'PENDING')
  AND ("matchPeriod" = :matchPeriod OR "startTime" = :startTime);
```
- **Active Reservations Only**: Only `CONFIRMED` and `PENDING` reservations block a slot. `CANCELLED` and `EXPIRED` bookings do **not** block availability.
- **Race Condition Safety**: Booking creation executes within an isolated `prisma.$transaction()`, re-checking collision filters atomically before record insertion. If a collision occurs, the database transaction aborts and returns an HTTP `409 Conflict`.

---

## 6. Authentication & User Journey

1. **Step 1: Venue & Date & Match Period Selection**
   - User navigates to `/venues/:id`.
   - Date picker interacts with calendar, updating URL query param `?date=YYYY-MM-DD`.
   - User picks a match period card.
   - User clicks `CONTINUE TO BOOK`.
   - If unauthenticated, user is routed to `/login` with `location.state.bookingState` preserved, returning to Step 2 upon authentication.

2. **Step 2: Customer Details Form**
   - Full Name (required)
   - Mobile Number (required, 10-digit Indian regex validation)
   - Email Address (required, email regex validation)
   - Pre-filled from User profile when available, fully editable.
   - Back navigation to Step 1 supported without state loss.

3. **Step 3: Booking Type Selection**
   - `SINGLE TEAM OF 11`: 11-player squad reservation.
   - `WHOLE GROUND`: Full venue reservation.
   - Real calculated price or "Price on request" is clearly shown.
   - Back navigation to Step 2 supported.

4. **Step 4: Final Booking Summary**
   - Dynamic summary displaying Venue, Date, Match Period, Booking Type, Price, Customer Contact Details, and Grand Total.
   - Clear disclaimer regarding payment gateway status.
   - `CONFIRM & CONTINUE` dispatches authenticated `POST /api/v1/bookings`.

5. **Step 5: Confirmation / Pending Status**
   - Displays Reference ID, status (`PENDING` or `CONFIRMED`), and direct link to dashboard.

---

## 7. Payment Logic
- Default initial player wallet balances start strictly at **₹0.0**.
- In the absence of an active third-party payment gateway transaction or sufficient wallet balance, the system creates the booking in `status: 'PENDING'` with `paymentStatus: 'PAYMENT_PENDING'`.
- The system **never fakes** a successful transaction.

---

## 8. Admin Venue Booking Management Integration
Administrators and Super Admins have dedicated control via `/admin/bookings`:
- **Real-Time KPIs**: Live counts of total bookings, pending requests, confirmed, cancelled, today's schedule, and booked revenue calculated directly from the database.
- **Booking Approvals & Collision Guard**: Administrators can approve pending requests with atomic anti-collision checks that prevent double-booking.
- **Cancellation & Refunds**: Admins can cancel reservations with mandatory cancellation reasons; wallet-funded bookings receive automated balance refunds.
- **Venue Availability Inspector**: Visual inspection of period availability (`AVAILABLE` vs `BOOKED`) for all 3 real grounds.
- **Audit Logging**: Every administrative action logs `confirmedAt`, `confirmedById`, `cancelledAt`, `cancelledById`, and `cancellationReason`.
- Full technical documentation is available in [docs/ADMIN_BOOKING_MANAGEMENT.md](file:///c:/Users/bitd/Downloads/be11/docs/ADMIN_BOOKING_MANAGEMENT.md).

