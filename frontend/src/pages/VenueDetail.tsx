import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';
import { useLocationStore } from '../store/locationStore.js';
import { GroundDTO, ReviewDTO, formatCurrency, normalizePhone } from '@be11/shared';
import { normalizeVenue } from '../utils/venueUtils.js';
import { loadRazorpaySdk } from '../lib/razorpay.js';
import { SEO } from '../components/common/SEO.js';
import { FAQSection } from '../components/common/FAQSection.js';
import { AEO_KNOWLEDGE } from '../config/aeoKnowledge.js';
import {
  trackGA4VenueView,
  trackGA4SelectBookingDate,
  trackGA4SelectBookingPeriod,
  trackGA4BeginBooking,
  trackGA4BookingPaymentStarted,
  trackGA4BookingCompleted,
} from '../lib/analytics/ga4.js';

type WizardStep = 'PERIOD' | 'DETAILS' | 'TYPE' | 'SUMMARY' | 'SUCCESS';
type BookingTypeChoice = 'SINGLE_TEAM_OF_11' | 'WHOLE_GROUND' | 'INDIVIDUAL' | 'HALF_TEAM' | 'ENTIRE_VENUE';
type PaymentState = 'idle' | 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled';

const canonicalPeriod = (p?: string | null): string => {
  if (!p) return 'MORNING';
  const u = p.toUpperCase().trim().replace('-', '_');
  if (['MORNING', 'AFTERNOON', 'EVENING', 'DAY_NIGHT', 'NIGHT'].includes(u)) {
    return u;
  }
  return 'MORNING';
};

const extractSubscriberPhone = (phone?: string | null): string => {
  if (!phone) return '';
  let str = phone.trim();
  if (/^\+?91[\s\-\+]/.test(str) || str.startsWith('+91') || str.startsWith('91 ')) {
    let rest = str.replace(/^(\+?91[\s\-\+]*)+/, '').replace(/[^\d]/g, '');
    if (rest) return rest;
  }
  let digits = str.replace(/[^\d]/g, '');
  while (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }
  return digits;
};

export const VenueDetail: React.FC = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated, user, updateWalletBalance } = useAuthStore();
  const { setCity } = useLocationStore();

  const initialDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const initialPeriod = canonicalPeriod(searchParams.get('period'));

  const [date, setDate] = useState(initialDate);
  const [calendarYear, setCalendarYear] = useState(() => Number(initialDate.split('-')[0]) || new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => Number(initialDate.split('-')[1]) - 1 || new Date().getMonth());
  const [ground, setGround] = useState<GroundDTO | null>(null);
  const [matchPeriods, setMatchPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(initialPeriod);
  const [bookingType, setBookingType] = useState<BookingTypeChoice>('WHOLE_GROUND');
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [showPhone, setShowPhone] = useState(false);

  // Wizard state
  const [bookingStep, setBookingStep] = useState<WizardStep>('PERIOD');
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [paymentError, setPaymentError] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'RAZORPAY'>('WALLET');
  const [topupLoading, setTopupLoading] = useState(false);

  // Customer Details Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [formErrors, setFormErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  const [reviews, setReviews] = useState<ReviewDTO[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-populate customer fields when authenticated user is available
  useEffect(() => {
    if (user) {
      if (!customerName) {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        if (fullName) setCustomerName(fullName);
      }
      if (!customerPhone && user.phone) {
        setCustomerPhone(extractSubscriberPhone(user.phone));
      }
      if (!customerEmail && user.email) {
        setCustomerEmail(user.email);
      }
    }
  }, [user]);

  // Synchronize URL and state for date and period
  const updateUrlParams = (newDate: string, newPeriod: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('date', newDate);
      next.set('period', newPeriod);
      return next;
    }, { replace: true });
  };

  // Sync state when URL searchParams changes (e.g. Back/Forward navigation, direct links)
  useEffect(() => {
    const urlDate = searchParams.get('date');
    if (urlDate && urlDate !== date) {
      setDate(urlDate);
      const [y, m] = urlDate.split('-').map(Number);
      if (y && m) {
        setCalendarYear(y);
        setCalendarMonth(m - 1);
      }
    }
    const urlPeriod = searchParams.get('period');
    if (urlPeriod) {
      const canonical = canonicalPeriod(urlPeriod);
      if (canonical !== selectedPeriod) {
        setSelectedPeriod(canonical);
      }
    }
  }, [searchParams]);

  // Restore booking selections if redirected back from login
  useEffect(() => {
    if (location.state?.bookingState) {
      const bs = location.state.bookingState;
      if (bs.date) setDate(bs.date);
      if (bs.selectedPeriod) setSelectedPeriod(canonicalPeriod(bs.selectedPeriod));
      if (bs.bookingType) setBookingType(bs.bookingType);
      // Auto-advance to details step if user was redirected back from login
      if (isAuthenticated) {
        setBookingStep('DETAILS');
      }
    }
  }, [location.state, isAuthenticated]);

  const fetchDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const [groundRes, slotsRes, reviewsRes] = await Promise.all([
        api.get(`/grounds/${id}`),
        api.get(`/grounds/${id}/slots`, { params: { date } }),
        api.get(`/reviews/ground/${id}`),
      ]);

      const rawG = groundRes.data.data.ground;
      const g = normalizeVenue(rawG);
      setGround(g);
      if (g?.city) {
        setCity(g.city);
      }
      setMatchPeriods(slotsRes.data.data.matchPeriods || []);
      setReviews(reviewsRes.data.data.reviews || []);

      if (g) {
        trackGA4VenueView(g.id, g.name);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch venue details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetails();
    }
  }, [id, date]);

  // Dynamic Document Title and Structured JSON-LD Data
  useEffect(() => {
    if (!ground) return;
    document.title = `${ground.name} | ${ground.city || 'Gurugram'}, ${ground.state || 'Haryana'} | BE11`;

    const isPlaynow = ground.slug === 'playnow-cricket-ground';
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SportsActivityLocation',
      name: ground.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: isPlaynow ? 'Bandhwari Road, Balola' : ground.address,
        addressLocality: isPlaynow ? 'Gurugram' : ground.city || 'Faridabad',
        addressRegion: ground.state || 'Haryana',
        postalCode: isPlaynow ? '122102' : '121002',
        addressCountry: 'IN',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: ground.latitude || 28.403646,
        longitude: ground.longitude || 77.136787,
      },
      url: window.location.href,
    };

    let script = document.getElementById('venue-jsonld') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'venue-jsonld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      const el = document.getElementById('venue-jsonld');
      if (el) el.remove();
    };
  }, [ground]);

  // If selectedPeriod is DAY_NIGHT and user switches to weekday, switch to MORNING
  useEffect(() => {
    const [y, m, d] = date.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (!isWeekend && selectedPeriod === 'DAY_NIGHT') {
      setSelectedPeriod('MORNING');
      updateUrlParams(date, 'MORNING');
    }
  }, [date, selectedPeriod]);

  // Set appropriate default bookingType when ground loads
  useEffect(() => {
    if (ground?.slug === 'rrr-cricket-club-kidawali-faridabad') {
      if (bookingType === 'SINGLE_TEAM_OF_11' || bookingType === 'WHOLE_GROUND') {
        setBookingType('INDIVIDUAL');
      }
    }
  }, [ground?.slug]);

  // Date selection handler with URL query sync
  const handleDateSelect = (selectedDateStr: string) => {
    setDate(selectedDateStr);
    updateUrlParams(selectedDateStr, selectedPeriod || 'MORNING');
    if (ground) {
      trackGA4SelectBookingDate(ground.id, ground.name, selectedDateStr);
    }
    setError('');
  };

  // Period selection handler with URL query sync
  const handlePeriodSelect = (periodId: string) => {
    const canonical = canonicalPeriod(periodId);
    setSelectedPeriod(canonical);
    updateUrlParams(date, canonical);
    if (ground) {
      trackGA4SelectBookingPeriod(ground.id, ground.name, canonical);
    }
    setError('');
  };

  // Calendar month navigation
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeekIndex = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 is Sun
  const startDayOffset = (firstDayOfWeekIndex + 6) % 7; // Monday-first index: 0=Mon, 6=Sun

  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  // Selected date properties
  const [selectedY, selectedM, selectedD] = date.split('-').map(Number);
  const selectedDateObj = new Date(selectedY, selectedM - 1, selectedD);
  const selectedDayOfWeek = selectedDateObj.getDay(); // 0 = Sun, 6 = Sat
  const isSelectedWeekend = selectedDayOfWeek === 0 || selectedDayOfWeek === 6;

  const formattedSelectedDate = selectedDateObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const pricingRules = typeof ground?.pricingRules === 'string'
    ? JSON.parse(ground.pricingRules)
    : ground?.pricingRules;

  const isPlaynow = ground?.slug === 'playnow-cricket-ground' || pricingRules?.type === 'TIME_SLOT_MATRIX';
  const isAB = ground?.slug === 'ab-cricket-ground' || pricingRules?.type === 'PACKAGE_TIERS';
  const isRRR = ground?.slug === 'rrr-cricket-club-kidawali-faridabad';
  const isContactOnly = !isRRR && (ground?.pricingLabel === 'Contact for pricing' || ground?.pricePerHour === 0 || pricingRules?.type === 'CONTACT_ONLY');

  // Playnow Dynamic Pricing Rules from database
  const playnowWeekdayRules = pricingRules?.weekday || {};
  const playnowWeekendRules = pricingRules?.weekend || {};

  // Periods list based on venue
  const availablePeriods = isRRR
    ? [
        { id: 'MORNING', name: 'Morning', icon: 'wb_twilight', timeRange: '6:00 AM – 10:00 AM', coverage: 'Fixed 4-Hour Period' },
        { id: 'AFTERNOON', name: 'Afternoon', icon: 'wb_sunny', timeRange: '10:00 AM – 2:00 PM', coverage: 'Fixed 4-Hour Period' },
        { id: 'EVENING', name: 'Evening', icon: 'nights_stay', timeRange: '2:00 PM – 6:00 PM', coverage: 'Fixed 4-Hour Period' },
      ]
    : isPlaynow
    ? isSelectedWeekend
      ? [
          { id: 'MORNING', name: 'Morning Match', timeRange: '07:00 AM - 11:30 AM', coverage: 'Both Teams Included' },
          { id: 'AFTERNOON', name: 'Afternoon Match', timeRange: '12:00 PM - 04:30 PM', coverage: 'Both Teams Included' },
          { id: 'DAY_NIGHT', name: 'Day-Night Match', timeRange: '04:30 PM - 08:00 PM', coverage: 'Both Teams Included' },
          { id: 'NIGHT', name: 'Night Match', timeRange: '08:00 PM - 11:30 PM', coverage: 'Both Teams Included' },
        ]
      : [
          { id: 'MORNING', name: 'Morning Match', timeRange: '07:00 AM - 11:30 AM', coverage: 'Both Teams Included' },
          { id: 'AFTERNOON', name: 'Afternoon Match', timeRange: '12:00 PM - 04:30 PM', coverage: 'Both Teams Included' },
          { id: 'NIGHT', name: 'Night Match', timeRange: '08:00 PM - 11:30 PM', coverage: 'Both Teams Included' },
        ]
    : isAB
    ? [
        { id: 'MORNING', name: 'Morning Match', timeRange: '07:00 AM - 11:30 AM', coverage: 'Whole Ground included' },
        { id: 'AFTERNOON', name: 'Afternoon Match', timeRange: '12:00 PM - 04:30 PM', coverage: 'Whole Ground included' },
        { id: 'NIGHT', name: 'Night / Floodlit Match', timeRange: '06:00 PM - 10:30 PM', coverage: 'Whole Ground with Floodlights & Pavilion' },
      ]
    : [];

  const currentPeriodObj = availablePeriods.find((p) => p.id === selectedPeriod) || availablePeriods[0];

  // Price calculation helper for any period & booking type
  const calculatePrice = (periodId: string, bType: BookingTypeChoice): {
    amount: number | null;
    label: string;
    originalPrice?: number;
    discount?: number;
    couponCode?: string;
  } => {
    if (isRRR) {
      if (bType === 'INDIVIDUAL') {
        return {
          amount: 299,
          label: '₹299',
          originalPrice: 373.75,
          discount: 74.75,
          couponCode: 'BE11 WELCOMES',
        };
      }
      if (bType === 'HALF_TEAM') {
        return {
          amount: 2600,
          label: '₹2,600',
          originalPrice: 3250,
          discount: 650,
          couponCode: 'BE11 WELCOMES',
        };
      }
      // ENTIRE_VENUE or default
      return {
        amount: 5000,
        label: '₹5,000',
        originalPrice: 6250,
        discount: 1250,
        couponCode: 'BE11 WELCOMES',
      };
    }

    if (isAB) {
      if (bType === 'SINGLE_TEAM_OF_11') {
        return { amount: null, label: 'Price on request' };
      }
      // Whole Ground
      const isNight = periodId === 'NIGHT' || periodId === 'DAY_NIGHT';
      const wholePrice = isNight ? 6500 : 3500;
      return { amount: wholePrice, label: formatCurrency(wholePrice) };
    }

    if (isPlaynow) {
      const rules = isSelectedWeekend ? playnowWeekendRules : playnowWeekdayRules;
      const key = periodId === 'DAY_NIGHT' ? 'dayNight' : periodId.toLowerCase();
      const val = rules?.[key];
      const wholeGround = typeof val === 'number'
        ? val
        : val?.ENTIRE_VENUE || (isSelectedWeekend && periodId === 'NIGHT' ? 11000 : (periodId === 'NIGHT' || (isSelectedWeekend && (periodId === 'MORNING' || periodId === 'DAY_NIGHT')) ? 10000 : 5000));
      
      if (bType === 'SINGLE_TEAM_OF_11') {
        const teamPrice = Math.round(wholeGround / 2);
        return { amount: teamPrice, label: formatCurrency(teamPrice) };
      }
      return { amount: wholeGround, label: formatCurrency(wholeGround) };
    }

    return { amount: null, label: 'Price on request' };
  };

  // Step 1 -> Step 2 validation
  const handleContinueToBook = () => {
    if (!selectedPeriod) {
      setError('Please select a match period to continue.');
      return;
    }

    if (ground) {
      trackGA4BeginBooking(ground.id, ground.name, date, selectedPeriod, bookingType);
    }

    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          from: location.pathname + location.search,
          bookingState: { date, selectedPeriod, bookingType },
        },
      });
      return;
    }

    setError('');
    setBookingStep('DETAILS');
  };

  // Step 2 Form validation
  const validateCustomerDetails = (): boolean => {
    const errors: { name?: string; phone?: string; email?: string } = {};

    if (!customerName.trim()) {
      errors.name = 'Full name is required.';
    }

    let cleanPhone = customerPhone.replace(/[\s\-\+\(\)]/g, '');
    while (cleanPhone.startsWith('91') && cleanPhone.length > 10) {
      cleanPhone = cleanPhone.slice(2);
    }
    const phonePattern = /^(?:91)?[6789]\d{9}$/;
    if (!customerPhone.trim()) {
      errors.phone = 'Mobile number is required.';
    } else if (!phonePattern.test(cleanPhone)) {
      errors.phone = 'Please enter a valid 10-digit Indian mobile number.';
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerEmail.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailPattern.test(customerEmail.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceedToBookingType = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateCustomerDetails()) {
      setError('');
      setBookingStep('TYPE');
    }
  };

  // Step 3 -> Step 4 validation
  const handleProceedToSummary = () => {
    setError('');
    setBookingStep('SUMMARY');
  };

  // Top Up Wallet with Razorpay
  const handleTopupWallet = async (shortfallAmount: number) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const topupAmount = Math.max(1, Math.ceil(shortfallAmount));

    setTopupLoading(true);
    setError('');
    setPaymentError('');
    try {
      const isSdkLoaded = await loadRazorpaySdk();
      if (!isSdkLoaded || !window.Razorpay) {
        throw new Error('Razorpay Checkout SDK could not be loaded. Please check your internet connection.');
      }

      const orderRes = await api.post('/wallet/topup/create-order', {
        amount: topupAmount,
      });

      const { orderId, amount, keyId } = orderRes.data.data;

      const options = {
        key: keyId,
        amount: amount,
        currency: 'INR',
        name: 'BE11 Sports',
        description: `Wallet Top-Up (₹${topupAmount})`,
        order_id: orderId,
        handler: async function (response: any) {
          try {
            const verifyRes = await api.post('/wallet/topup/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            const newBal = verifyRes.data.data.walletBalance;
            updateWalletBalance(newBal);
            setPaymentError('');
            alert(`Wallet topped up successfully by ₹${topupAmount}! Current balance: ₹${newBal}. You can now complete your booking from wallet.`);
          } catch (verifyErr: any) {
            console.error('Wallet top-up verification error:', verifyErr);
            setPaymentError(verifyErr.response?.data?.message || 'Top-up verification failed.');
          }
        },
        modal: {
          ondismiss: function () {
            setPaymentError('Wallet top-up was cancelled.');
          },
        },
        prefill: {
          name: customerName.trim() || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          email: customerEmail.trim() || user?.email || '',
          contact: normalizePhone(customerPhone) || normalizePhone(user?.phone) || '',
        },
        theme: {
          color: '#ea580c',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error(err);
      setPaymentError(err.response?.data?.message || err.message || 'Failed to initiate wallet top-up.');
    } finally {
      setTopupLoading(false);
    }
  };

  // Step 4: Final Booking Submission (Wallet or Razorpay)
  const handleFinalBookingSubmit = async () => {
    if (isAB && bookingType === 'SINGLE_TEAM_OF_11') {
      setError('Single Team of 11 pricing for AB Cricket Ground is on request. Please call venue owner Rajesh Bajaj at +91 95402 28222.');
      return;
    }

    setBookingLoading(true);
    setError('');
    setPaymentError('');
    setSuccess('');

    try {
      let b = confirmedBooking;

      // 1. Create booking atomically if not already created
      if (!b || !b.id) {
        const res = await api.post('/bookings', {
          venueId: ground?.id || id,
          date,
          matchPeriod: selectedPeriod,
          bookingType,
          customerName: customerName.trim(),
          customerPhone: normalizePhone(customerPhone),
          customerEmail: customerEmail.trim(),
        });

        b = res.data.data.booking;
        const serverPrice = res.data.data.serverCalculatedPrice || b.totalPrice;
        setConfirmedBooking({
          ...b,
          serverPrice,
        });
      }

      // 2. If already paid (or if paid with wallet during creation), complete instantly
      if (b.paymentStatus === 'PAID') {
        const finalAmt = b.totalPrice || b.serverPrice || 0;
        if (user) {
          updateWalletBalance(user.walletBalance - finalAmt);
        }
        if (ground) {
          trackGA4BookingCompleted({
            bookingId: b.id,
            venueId: ground.id,
            venueName: ground.name,
            bookingType: b.bookingType || bookingType,
            bookingPeriod: b.matchPeriod || selectedPeriod,
            amount: finalAmt,
            currency: 'INR',
          });
        }
        setPaymentState('successful');
        setBookingStep('SUCCESS');
        fetchDetails();
        return;
      }

      // 3. If user selected WALLET CREDITS but wallet is insufficient
      if (paymentMethod === 'WALLET') {
        const reqAmount = b.totalPrice || b.serverPrice || 0;
        if ((user?.walletBalance ?? 0) < reqAmount) {
          setPaymentState('failed');
          setPaymentError(`Insufficient wallet balance. Balance: ₹${(user?.walletBalance ?? 0).toFixed(2)}, Required: ₹${reqAmount}`);
          setBookingLoading(false);
          return;
        }
      }

      // 4. Request authoritative Razorpay order from backend
      setPaymentState('pending');
      const orderRes = await api.post('/payments/booking/create-order', {
        bookingId: b.id,
      });

      const { orderId, amount, currency, keyId } = orderRes.data.data;

      if (ground) {
        trackGA4BookingPaymentStarted(ground.id, ground.name, (amount || 0) / 100, paymentMethod);
      }

      // 5. Ensure Razorpay Standard Checkout SDK is loaded
      const isSdkLoaded = await loadRazorpaySdk();
      if (!isSdkLoaded || !window.Razorpay) {
        throw new Error('Razorpay Checkout SDK could not be loaded. Please check your internet connection.');
      }

      // 6. Trigger Razorpay Standard Checkout Modal
      const options = {
        key: keyId,
        amount: amount, // authoritative amount in paise
        currency: currency || 'INR',
        name: 'BE11 Sports',
        description: `${ground?.name || 'Cricket Ground'} (${b.matchPeriod || selectedPeriod || 'Match Slot'})`,
        image: '/favicon.ico',
        order_id: orderId,
        handler: async function (response: any) {
          setPaymentState('processing');
          setBookingLoading(true);
          try {
            const verifyRes = await api.post('/payments/booking/verify', {
              bookingId: b.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            const verifiedBooking = verifyRes.data.data.booking;
            setConfirmedBooking({
              ...verifiedBooking,
              serverPrice: verifiedBooking.totalPrice,
            });

            if (ground) {
              trackGA4BookingCompleted({
                bookingId: verifiedBooking.id,
                venueId: ground.id,
                venueName: ground.name,
                bookingType: verifiedBooking.bookingType || bookingType,
                bookingPeriod: verifiedBooking.matchPeriod || selectedPeriod,
                amount: verifiedBooking.totalPrice,
                currency: 'INR',
              });
            }

            setPaymentState('successful');
            setBookingStep('SUCCESS');
            fetchDetails();
          } catch (verifyErr: any) {
            console.error('Payment verification error:', verifyErr);
            setPaymentState('failed');
            setPaymentError(
              verifyErr.response?.data?.message ||
                'Payment signature verification failed. Please contact support with payment ID ' +
                  response.razorpay_payment_id
            );
          } finally {
            setBookingLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPaymentState('cancelled');
            setBookingLoading(false);
          },
        },
        prefill: {
          name: customerName.trim() || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          email: customerEmail.trim() || user?.email || '',
          contact: normalizePhone(customerPhone) || normalizePhone(user?.phone) || '',
        },
        theme: {
          color: '#ea580c',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        console.error('Razorpay payment failed:', resp.error);
        setPaymentState('failed');
        setPaymentError(resp.error?.description || 'Payment was declined by your bank or gateway.');
        setBookingLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      console.error(err);
      setPaymentState('failed');
      const errorMsg = err.response?.data?.message || err.message || 'Booking creation or payment initiation failed.';
      setError(errorMsg);
      setPaymentError(errorMsg);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setError('Please log in to leave a review.');
      return;
    }

    try {
      await api.post('/reviews', {
        groundId: ground?.id || id,
        rating: reviewRating,
        comment: reviewComment,
      });
      setReviewComment('');
      fetchDetails();
    } catch (err: any) {
      console.error(err);
      setError('Failed to post review.');
    }
  };

  if (loading && !ground) {
    return (
      <div className="pt-24 text-center py-20 font-bold text-primary flex flex-col items-center gap-3">
        <svg className="animate-spin h-8 w-8 text-[#0a2e6e]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>Loading venue details...</span>
      </div>
    );
  }

  if (!ground) {
    return (
      <div className="pt-24 text-center py-20 text-error font-bold">
        Venue not found. <button onClick={() => navigate('/venues')} className="underline ml-2">View All Venues</button>
      </div>
    );
  }

  const rawImages = Array.isArray(ground.images)
    ? ground.images
    : typeof ground.images === 'string'
    ? JSON.parse(ground.images)
    : [];

  const isABGround =
    ground.slug === 'ab-cricket-ground' ||
    ground.id === '2f1230f1-5219-4c01-a3cb-19fa90896188' ||
    (ground.name && ground.name.toLowerCase().includes('ab cricket'));

  const AB_FALLBACK_IMAGES = [
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

  const imagesList: string[] = isABGround && (rawImages.length === 0 || rawImages.some((img: string) => typeof img === 'string' && img.includes('ab cricket ground.png')))
    ? AB_FALLBACK_IMAGES
    : rawImages;

  const videosList: string[] = isABGround
    ? []
    : Array.isArray(ground.videos)
    ? ground.videos
    : typeof ground.videos === 'string'
    ? JSON.parse(ground.videos)
    : [];

  const amenitiesList: string[] = Array.isArray(ground.amenities)
    ? ground.amenities
    : typeof ground.amenities === 'string'
    ? JSON.parse(ground.amenities)
    : [];

  const heroMedia = imagesList[activeMediaIndex] || imagesList[0] || (isABGround ? '/venues/ab/Ab-hub-Cricket-Ground-2.jpg' : 'https://images.unsplash.com/photo-1540747737956-37872f84a62f?auto=format&fit=crop&w=600&q=80');
  const directionsUrl = ground.mapsUrl || `https://maps.google.com/?q=${ground.latitude},${ground.longitude}`;

  const currentSummaryPrice = calculatePrice(selectedPeriod || 'MORNING', bookingType);
  const venueCanonical = `/venues/${ground.slug || id}`;
  const venueJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'SportsActivityLocation',
      name: ground.name,
      description: ground.description || `Cricket ground and sports venue booking in ${ground.city || 'Haryana'}`,
      url: `https://be11.in${venueCanonical}`,
      image: heroMedia.startsWith('http') ? heroMedia : `https://be11.in${heroMedia}`,
      telephone: ground.ownerPhone || '+919711669718',
      address: {
        '@type': 'PostalAddress',
        streetAddress: ground.address || ground.location || `${ground.city || 'Gurugram'}, ${ground.state || 'Haryana'}`,
        addressLocality: ground.city || 'Gurugram',
        addressRegion: ground.state || 'Haryana',
        addressCountry: 'IN',
      },
      ...(ground.latitude && ground.longitude
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: String(ground.latitude),
              longitude: String(ground.longitude),
            },
          }
        : {}),
      priceRange: '₹299 - ₹6250',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://be11.in/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Venues',
          item: 'https://be11.in/venues',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: ground.name,
          item: `https://be11.in${venueCanonical}`,
        },
      ],
    },
  ];

  const venueAEO = (ground.slug && AEO_KNOWLEDGE.venues[ground.slug]) || undefined;
  const venueFaqs = venueAEO?.faqs || [
    {
      question: `How do I book ${ground.name} on BE11?`,
      answer: `Select a match date, choose an available match period or package, select your booking type (Entire Ground or Half Team), and complete payment via UPI, card, or BE11 Wallet.`,
    },
    {
      question: `Where is ${ground.name} located?`,
      answer: `${ground.name} is located at ${ground.address || ground.location || `${ground.city || 'Gurugram'}, ${ground.state || 'Haryana'}`}.`,
    },
  ];

  return (
    <div className="pt-24 pb-16 min-h-screen bg-surface-container-low text-left font-poppins">
      <SEO
        title={`${ground.name} | Cricket Ground Booking in ${ground.city || 'Gurugram'} | BE11`}
        description={`${ground.name} located at ${ground.address || ground.location || ground.city || 'Gurugram'}. Book match periods, compare slot availability, and check ground facilities on BE11.`}
        canonical={venueCanonical}
        ogImage={heroMedia}
        jsonLd={venueJsonLd}
        faqJsonLd={venueFaqs}
      />
      <div className="max-w-7xl mx-auto px-container-padding">
        {/* Breadcrumb Navigation */}
        <nav className="text-xs text-on-surface-variant mb-4 flex items-center gap-1.5" aria-label="Breadcrumb">
          <a href="/" className="hover:text-primary transition-colors">Home</a>
          <span>/</span>
          <a href="/venues" className="hover:text-primary transition-colors">Venues</a>
          <span>/</span>
          <span className="text-primary font-semibold truncate max-w-xs">{ground.name}</span>
        </nav>

        {error && (
          <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm font-semibold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-100 text-emerald-900 border border-emerald-300 p-4 rounded-xl text-sm font-semibold mb-6 flex items-center gap-2 shadow-sm">
            <span className="material-symbols-outlined text-base text-emerald-700">check_circle</span>
            <span>{success}</span>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Info & Media Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-24 overflow-hidden shadow-sm border border-outline-variant/30">
              {/* Hero Image View */}
              <div className="relative h-96 bg-black overflow-hidden">
                <img
                  className="w-full h-full object-cover"
                  alt={ground.name}
                  src={heroMedia}
                  onError={(e) => {
                    if (isABGround) {
                      e.currentTarget.src = '/venues/ab/Ab-hub-Cricket-Ground-2.jpg';
                    } else {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1540747737956-37872f84a62f?auto=format&fit=crop&w=600&q=80';
                    }
                  }}
                />
                {ground.rating > 0 ? (
                  <div className="absolute top-4 right-4 glass-panel px-3 py-1.5 rounded-full flex items-center gap-1">
                    <span
                      className="material-symbols-outlined text-secondary-container"
                      style={{ fontVariationSettings: '"FILL" 1' }}
                    >
                      star
                    </span>
                    <span className="text-label-bold text-primary">{ground.rating}</span>
                  </div>
                ) : (
                  <div className="absolute top-4 right-4 bg-primary/90 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                    Verified Venue
                  </div>
                )}
              </div>

              {/* Gallery Lightbox Row */}
              {imagesList.length > 1 && (
                <div className="p-4 bg-[#F8FAFC] border-b border-outline-variant/20 flex gap-3 overflow-x-auto">
                  {imagesList.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveMediaIndex(idx)}
                      className={`relative w-20 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                        activeMediaIndex === idx ? 'border-primary shadow-md scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`${ground.name} thumb ${idx}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/venues/ab/Ab-hub-Cricket-Ground-2.jpg';
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Venue Header & Description */}
              <div className="p-8">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-6 gap-4 border-b border-outline-variant/20 pb-6">
                  <div>
                    <h1 className="font-poppins font-bold text-3xl text-primary mb-1">{ground.name}</h1>
                    <p className="text-on-surface-variant flex items-center gap-1 text-sm font-semibold">
                      <span className="material-symbols-outlined text-sm text-secondary-container">location_on</span>
                      {ground.location}
                    </p>
                    {ground.address && (
                      <p className="text-xs text-outline mt-1 leading-relaxed">
                        {ground.address}
                      </p>
                    )}
                    {ground.plusCode && (
                      <div className="inline-block mt-2 px-2.5 py-1 bg-surface-container text-primary text-[11px] font-bold rounded-md">
                        Plus Code: {ground.plusCode}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-xl bg-primary text-white font-label-bold text-xs btn-primary-premium flex items-center justify-center gap-2 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-base">directions</span>
                      Get Directions
                    </a>
                  </div>
                </div>

                {/* Ground Description */}
                <h3 className="font-poppins font-bold text-lg text-primary mb-2">About Venue</h3>
                <p className="text-on-surface-variant leading-relaxed text-sm mb-6">
                  {ground.description}
                </p>

                {/* Verified Facilities Chips */}
                <h3 className="font-poppins font-bold text-lg text-primary mb-3">Verified Facilities & Amenities</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                  {amenitiesList.map((am) => (
                    <div
                      key={am}
                      className="bg-[#EDF2F7] px-4 py-2.5 rounded-xl text-primary font-semibold text-xs flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base text-secondary-container">check_circle</span>
                      {am}
                    </div>
                  ))}
                </div>

                {/* Video Integration if Video Exists */}
                {videosList.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-poppins font-bold text-lg text-primary mb-3">Venue Video Tour</h3>
                    <div className="rounded-24 overflow-hidden bg-black shadow-md">
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-h-[400px]"
                        src={videosList[0]}
                      >
                        Your browser does not support HTML5 video playback.
                      </video>
                    </div>
                  </div>
                )}

                {/* Contact Owner Section */}
                <div className="bg-[#F8FAFC] rounded-24 p-6 border border-outline-variant/30 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase text-outline tracking-wider block mb-1">
                      Venue Management
                    </span>
                    <h4 className="font-poppins font-bold text-base text-primary">
                      Owner: {ground.ownerName || 'Verified Ground Owner'}
                    </h4>
                    <p className="text-xs text-on-surface-variant">Direct phone support & match inquiries</p>
                  </div>
                  <div>
                    {showPhone ? (
                      <a
                        href={`tel:${ground.ownerPhone}`}
                        className="px-5 py-3 rounded-xl bg-secondary-container text-white font-bold text-xs flex items-center gap-2 shadow"
                      >
                        <span className="material-symbols-outlined text-sm">call</span>
                        {ground.ownerPhone}
                      </a>
                    ) : (
                      <button
                        onClick={() => setShowPhone(true)}
                        className="px-5 py-3 rounded-xl bg-primary text-white font-bold text-xs flex items-center gap-2 btn-primary-premium shadow cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">phone</span>
                        Contact Venue / Owner
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="bg-white rounded-24 p-8 shadow-sm border border-outline-variant/30">
              <h3 className="font-poppins font-bold text-xl text-primary mb-6">User Reviews & Ratings</h3>

              {isAuthenticated && (
                <form onSubmit={handleReviewSubmit} className="mb-8 p-4 bg-[#F8FAFC] rounded-xl space-y-4">
                  <h4 className="font-poppins font-semibold text-sm text-primary">Write a Verified Review</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Rating:</span>
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="bg-white border rounded-lg px-2 py-1 focus:ring-primary focus:border-primary text-sm font-semibold"
                    >
                      <option value="5">5 Stars</option>
                      <option value="4">4 Stars</option>
                      <option value="3">3 Stars</option>
                      <option value="2">2 Stars</option>
                      <option value="1">1 Star</option>
                    </select>
                  </div>
                  <textarea
                    required
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={3}
                    placeholder="Share your match experience playing at this venue..."
                    className="w-full bg-white rounded-lg p-3 border focus:ring-primary focus:border-primary text-sm font-body-md"
                  ></textarea>
                  <button
                    type="submit"
                    className="bg-[#0A2E6E] text-white px-6 py-2 rounded-xl font-label-bold text-xs btn-primary-premium shadow-md cursor-pointer"
                  >
                    Submit Review
                  </button>
                </form>
              )}

              <div className="space-y-6">
                {reviews.length === 0 ? (
                  <p className="text-on-surface-variant text-sm">No reviews submitted yet for this venue.</p>
                ) : (
                  reviews.map((rev) => (
                    <div key={rev.id} className="border-b border-[#E5E7EB] pb-6 last:border-none last:pb-0">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-primary text-sm">{rev.userName}</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <span
                              key={i}
                              className="material-symbols-outlined text-secondary-container text-sm"
                              style={{ fontVariationSettings: '"FILL" 1' }}
                            >
                              star
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-on-surface-variant text-sm mt-1">{rev.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Booking Sidebar Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-24 p-6 sm:p-7 shadow-sm border border-outline-variant/30 sticky top-24">
              
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-poppins font-bold text-xl text-primary">Book Your Match</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Verified Ground Reservation</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-secondary-container/10 text-secondary-container rounded-full">
                  {isRRR ? 'Fixed 4-Hr Slots from ₹299 (25% OFF)' : isAB ? 'WHOLE GROUND Starting from ₹3,500' : ground.pricingLabel || (ground.pricePerHour > 0 ? `₹${ground.pricePerHour}/hr` : 'Price on request')}
                </span>
              </div>

              {error && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 animate-fadeIn">
                  <span className="material-symbols-outlined text-base text-red-600 shrink-0">error</span>
                  <span className="font-medium leading-tight">{error}</span>
                </div>
              )}

              {/* ROUTE 1: RRR Cricket Club (Contact Only) */}
              {isContactOnly ? (
                <div className="bg-[#F8FAFC] p-6 rounded-24 border border-outline-variant/30 text-center space-y-4">
                  <span className="material-symbols-outlined text-4xl text-secondary-container">contact_support</span>
                  <h4 className="font-bold text-primary text-base">Price on Request</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    RRR Cricket Club provides customized match pricing depending on overs, turf pitch configuration, and floodlight requirements.
                  </p>
                  <a
                    href={`tel:${ground.ownerPhone}`}
                    className="w-full py-3.5 rounded-xl bg-secondary-container hover:bg-[#e07f24] text-white font-label-bold btn-primary-premium shadow-md flex justify-center items-center gap-2 cursor-pointer text-xs"
                  >
                    <span className="material-symbols-outlined text-sm">call</span>
                    Call Owner ({ground.ownerPhone})
                  </a>
                </div>
              ) : (
                /* PRODUCTION BOOKING WIZARD (Playnow & AB Cricket Ground) */
                <div className="space-y-6">

                  {/* STEP 1: SELECT DATE & MATCH PERIOD */}
                  {bookingStep === 'PERIOD' && (
                    <div className="space-y-5 animate-fadeIn">
                      
                      {/* Step Indicator */}
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <span className="w-5 h-5 rounded-full bg-[#0a2e6e] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                        <span className="text-xs font-bold text-[#0a2e6e] uppercase tracking-wider">Select Date & Match Period</span>
                      </div>

                      {/* Interactive Calendar Date Picker */}
                      <div className="bg-[#F8FAFC] p-4 sm:p-5 rounded-2xl border border-outline-variant/30">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[11px] font-black text-primary uppercase tracking-wider">
                            Select Match Date
                          </span>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            isSelectedWeekend ? 'bg-orange-100 text-[#ea580c]' : 'bg-blue-100 text-[#0a2e6e]'
                          }`}>
                            {isSelectedWeekend ? 'Weekend Rates (Sat/Sun)' : 'Weekday Rates (Mon-Fri)'}
                          </span>
                        </div>

                        {/* Month Navigator Header */}
                        <div className="flex items-center justify-between mb-3 px-1">
                          <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-primary cursor-pointer border border-transparent hover:border-slate-200 transition-all"
                            aria-label="Previous Month"
                          >
                            <span className="material-symbols-outlined text-base">chevron_left</span>
                          </button>

                          <div className="font-bold text-xs text-primary tracking-wide">
                            {monthNames[calendarMonth]} {calendarYear}
                          </div>

                          <button
                            type="button"
                            onClick={handleNextMonth}
                            className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-primary cursor-pointer border border-transparent hover:border-slate-200 transition-all"
                            aria-label="Next Month"
                          >
                            <span className="material-symbols-outlined text-base">chevron_right</span>
                          </button>
                        </div>

                        {/* Day Names Header */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                          {dayNames.map((dName) => (
                            <div key={dName} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">
                              {dName}
                            </div>
                          ))}
                        </div>

                        {/* Calendar Days Grid */}
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {Array.from({ length: startDayOffset }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-8"></div>
                          ))}

                          {Array.from({ length: daysInMonth }).map((_, i) => {
                            const dayNum = i + 1;
                            const dateString = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                            const isPast = dateString < todayStr;
                            const isSelected = date === dateString;
                            const isToday = dateString === todayStr;

                            return (
                              <button
                                key={dayNum}
                                type="button"
                                disabled={isPast}
                                onClick={() => handleDateSelect(dateString)}
                                className={`h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                                  isPast
                                    ? 'text-slate-300 cursor-not-allowed bg-transparent'
                                    : isSelected
                                    ? 'bg-[#0a2e6e] text-white font-black shadow-md ring-2 ring-[#f97316]'
                                    : isToday
                                    ? 'bg-orange-50 text-[#ea580c] font-bold border border-orange-200 hover:bg-orange-100'
                                    : 'text-slate-700 hover:bg-white hover:shadow-xs hover:border-slate-200'
                                }`}
                              >
                                {dayNum}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Match Periods Section */}
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <label className="text-[11px] font-black text-primary uppercase tracking-wider block">
                            {isRRR ? 'Choose Your Match Time' : 'Select Match Period'}
                          </label>
                          <span className="text-[10px] text-slate-500">
                            {isRRR ? '3 Fixed 4-Hour Periods' : isAB ? 'Morning / Afternoon / Night' : isSelectedWeekend ? '4 Periods Available' : '3 Periods Available (Day-Night Weekend Only)'}
                          </span>
                        </div>

                        <div className={`grid gap-3 ${isRRR ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                          {availablePeriods.map((period) => {
                            const isChosen = selectedPeriod === period.id;
                            const serverPeriodInfo = matchPeriods.find((p) => p.id === period.id);
                            const isAvailable = serverPeriodInfo ? serverPeriodInfo.isAvailable : true;
                            const periodPriceInfo = calculatePrice(period.id, isRRR ? 'INDIVIDUAL' : 'WHOLE_GROUND');

                            // Icons for RRR periods
                            const getPeriodEmoji = (pid: string) => {
                              if (pid === 'MORNING') return '🌅';
                              if (pid === 'AFTERNOON') return '☀️';
                              if (pid === 'EVENING') return '🌇';
                              return '🏏';
                            };

                            return (
                              <button
                                key={period.id}
                                type="button"
                                disabled={!isAvailable}
                                onClick={() => handlePeriodSelect(period.id)}
                                className={`p-3.5 rounded-2xl text-left border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                                  !isAvailable
                                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                    : isChosen
                                    ? 'bg-[#0a2e6e] text-white border-[#f97316] shadow-lg scale-[1.02]'
                                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <div>
                                  <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-1.5">
                                      {isRRR && (
                                        <span className="text-base" role="img" aria-label={period.name}>
                                          {getPeriodEmoji(period.id)}
                                        </span>
                                      )}
                                      <span className={`font-black text-xs block ${isChosen ? 'text-white' : 'text-primary'}`}>
                                        {period.name}
                                      </span>
                                    </div>
                                    {isChosen && (
                                      <span className="material-symbols-outlined text-sm text-[#f97316]">check_circle</span>
                                    )}
                                  </div>
                                  <span className={`text-[11px] font-semibold block ${isChosen ? 'text-blue-100' : 'text-slate-600'}`}>
                                    {period.timeRange}
                                  </span>
                                  <span className={`text-[9px] font-bold block mt-0.5 ${isChosen ? 'text-orange-300' : 'text-slate-400'}`}>
                                    {period.coverage}
                                  </span>
                                </div>

                                <div className="mt-3 pt-2 border-t border-slate-200/30 flex justify-between items-center">
                                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-md ${
                                    !isAvailable
                                      ? 'bg-red-50 text-red-600'
                                      : isChosen
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}>
                                    {isAvailable ? 'Available' : 'Booked'}
                                  </span>
                                  <span className={`text-xs font-black ${isChosen ? 'text-[#f97316]' : 'text-[#ea580c]'}`}>
                                    {isRRR ? 'From ₹299' : periodPriceInfo.label}
                                  </span>
                                </div>

                                {!isAvailable && (
                                  <div className="absolute inset-0 bg-slate-100/90 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                                      Already Booked
                                    </span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Selected Period Preview */}
                      {currentPeriodObj && (
                        <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Selected Match Period</span>
                            <span className="font-bold text-[#0a2e6e]">{currentPeriodObj.name} ({currentPeriodObj.timeRange})</span>
                          </div>
                          <span className="text-[11px] font-black text-[#ea580c]">
                            {formattedSelectedDate}
                          </span>
                        </div>
                      )}

                      {/* STEP 4: CONTINUE TO BOOK BUTTON */}
                      <button
                        type="button"
                        onClick={handleContinueToBook}
                        disabled={!selectedPeriod}
                        className="w-full py-4 rounded-xl bg-[#f97316] hover:bg-[#ea580c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider text-center cursor-pointer transition-all shadow-lg active:scale-98 duration-150 flex items-center justify-center gap-2"
                      >
                        <span>CONTINUE TO BOOK</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>

                      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                        Step 1 of 4 • Select match period to proceed to customer details
                      </p>
                    </div>
                  )}

                  {/* STEP 2: YOUR DETAILS FORM */}
                  {bookingStep === 'DETAILS' && (
                    <form onSubmit={handleProceedToBookingType} className="space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#0a2e6e] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                          <span className="text-xs font-bold text-[#0a2e6e] uppercase tracking-wider">Your Details</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBookingStep('PERIOD')}
                          className="text-xs font-semibold text-slate-500 hover:text-primary flex items-center gap-0.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_back</span>
                          Back
                        </button>
                      </div>

                      <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-200 text-xs">
                        <span className="text-slate-500">Selected Match:</span>{' '}
                        <strong className="text-primary">{currentPeriodObj?.name}</strong> on <strong>{formattedSelectedDate}</strong>
                      </div>

                      {/* Full Name */}
                      <div>
                        <label className="block text-xs font-bold text-primary mb-1">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                          }}
                          placeholder="e.g. Ayush Raj"
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                            formErrors.name ? 'border-red-400 bg-red-50/50' : 'border-slate-300 focus:border-[#0a2e6e]'
                          }`}
                        />
                        {formErrors.name && (
                          <p className="text-[11px] text-red-600 mt-1 font-medium">{formErrors.name}</p>
                        )}
                      </div>

                      {/* Mobile Number */}
                      <div>
                        <label className="block text-xs font-bold text-primary mb-1">
                          Mobile Number <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-semibold">+91</span>
                          <input
                            type="tel"
                            required
                            value={customerPhone}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d]/g, '');
                              setCustomerPhone(raw);
                              if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: undefined }));
                            }}
                            placeholder="98765 43210"
                            maxLength={10}
                            className={`w-full pl-12 pr-3.5 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                              formErrors.phone ? 'border-red-400 bg-red-50/50' : 'border-slate-300 focus:border-[#0a2e6e]'
                            }`}
                          />
                        </div>
                        {formErrors.phone && (
                          <p className="text-[11px] text-red-600 mt-1 font-medium">{formErrors.phone}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">10-digit Indian mobile number for match pass & updates</p>
                      </div>

                      {/* Email Address */}
                      <div>
                        <label className="block text-xs font-bold text-primary mb-1">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={customerEmail}
                          onChange={(e) => {
                            setCustomerEmail(e.target.value);
                            if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                          }}
                          placeholder="e.g. player@example.com"
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${
                            formErrors.email ? 'border-red-400 bg-red-50/50' : 'border-slate-300 focus:border-[#0a2e6e]'
                          }`}
                        />
                        {formErrors.email && (
                          <p className="text-[11px] text-red-600 mt-1 font-medium">{formErrors.email}</p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setBookingStep('PERIOD')}
                          className="w-1/3 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs uppercase hover:bg-slate-50 cursor-pointer"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          className="w-2/3 py-3 rounded-xl bg-[#0a2e6e] hover:bg-[#082252] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer shadow-md"
                        >
                          <span>CHOOSE BOOKING TYPE</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                      </div>

                      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                        Step 2 of 4 • Pre-filled from your profile when logged in
                      </p>
                    </form>
                  )}

                  {/* STEP 3: BOOKING TYPE SELECTION */}
                  {bookingStep === 'TYPE' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#0a2e6e] text-white text-[10px] font-bold flex items-center justify-center">3</span>
                          <span className="text-xs font-bold text-[#0a2e6e] uppercase tracking-wider">How Would You Like To Book?</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBookingStep('DETAILS')}
                          className="text-xs font-semibold text-slate-500 hover:text-primary flex items-center gap-0.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_back</span>
                          Back
                        </button>
                      </div>

                      <p className="text-xs text-slate-600">
                        Choose reservation type for <strong>{ground.name}</strong> on <strong>{formattedSelectedDate}</strong>:
                      </p>

                      <div className="grid grid-cols-1 gap-3">
                        {isRRR ? (
                          /* RRR CRICKET CLUB: EXACTLY THREE BOOKING TYPES */
                          <>
                            {/* A. BOOK AS INDIVIDUAL */}
                            {(() => {
                              const isSelected = bookingType === 'INDIVIDUAL';
                              return (
                                <div
                                  onClick={() => setBookingType('INDIVIDUAL')}
                                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                                    isSelected
                                      ? 'bg-blue-50/70 border-[#0a2e6e] shadow-md ring-2 ring-[#0a2e6e]/20'
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                                        isSelected ? 'border-[#0a2e6e] bg-[#0a2e6e]' : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="font-black text-xs text-primary tracking-wide">BOOK AS INDIVIDUAL</h4>
                                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                            Single Player Slot
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium mt-1">
                                          For players who want to join individually
                                        </p>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                            ✓ BE11 WELCOMES
                                          </span>
                                          <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                                            ✓ 25% OFF
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                      <span className="text-xs text-slate-400 line-through font-semibold block">
                                        ₹373.75
                                      </span>
                                      <span className="text-base font-black text-[#ea580c] block">
                                        ₹299
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setBookingType('INDIVIDUAL');
                                        }}
                                        className={`mt-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                                          isSelected ? 'bg-[#0a2e6e] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        {isSelected ? 'SELECTED' : 'SELECT'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* B. BOOK HALF TEAM FOR A MATCH */}
                            {(() => {
                              const isSelected = bookingType === 'HALF_TEAM';
                              return (
                                <div
                                  onClick={() => setBookingType('HALF_TEAM')}
                                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                                    isSelected
                                      ? 'bg-blue-50/70 border-[#0a2e6e] shadow-md ring-2 ring-[#0a2e6e]/20'
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                                        isSelected ? 'border-[#0a2e6e] bg-[#0a2e6e]' : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="font-black text-xs text-primary tracking-wide">BOOK HALF TEAM FOR A MATCH</h4>
                                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                            Half Team Match
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium mt-1">
                                          For organizing a match with half a team
                                        </p>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                            ✓ BE11 WELCOMES
                                          </span>
                                          <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                                            ✓ 25% OFF
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                      <span className="text-xs text-slate-400 line-through font-semibold block">
                                        ₹3,250
                                      </span>
                                      <span className="text-base font-black text-[#ea580c] block">
                                        ₹2,600
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setBookingType('HALF_TEAM');
                                        }}
                                        className={`mt-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                                          isSelected ? 'bg-[#0a2e6e] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        {isSelected ? 'SELECTED' : 'SELECT'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* C. BOOK ENTIRE VENUE (Visually Emphasized Premium Option) */}
                            {(() => {
                              const isSelected = bookingType === 'ENTIRE_VENUE' || bookingType === 'WHOLE_GROUND';
                              return (
                                <div
                                  onClick={() => setBookingType('ENTIRE_VENUE')}
                                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden ${
                                    isSelected
                                      ? 'bg-gradient-to-r from-blue-50/90 to-amber-50/50 border-[#f97316] shadow-lg ring-2 ring-[#f97316]/30'
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                                        isSelected ? 'border-[#f97316] bg-[#f97316]' : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="font-black text-xs text-primary tracking-wide">BOOK ENTIRE VENUE</h4>
                                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white shadow-xs">
                                            ⭐ Premium Full Ground
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium mt-1">
                                          Reserve the complete ground
                                        </p>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                            ✓ BE11 WELCOMES
                                          </span>
                                          <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                                            ✓ 25% OFF
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                      <span className="text-xs text-slate-400 line-through font-semibold block">
                                        ₹6,250
                                      </span>
                                      <span className="text-base font-black text-[#ea580c] block">
                                        ₹5,000
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setBookingType('ENTIRE_VENUE');
                                        }}
                                        className={`mt-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                                          isSelected ? 'bg-[#f97316] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        {isSelected ? 'SELECTED' : 'SELECT'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          /* EXISTING VENUES (PLAYNOW & AB CRICKET GROUND - UNTOUCHED) */
                          <>
                            {/* Option A: SINGLE TEAM OF 11 */}
                            {(() => {
                              const isSelected = bookingType === 'SINGLE_TEAM_OF_11';
                              const teamPriceInfo = calculatePrice(selectedPeriod || 'MORNING', 'SINGLE_TEAM_OF_11');

                              return (
                                <div
                                  onClick={() => setBookingType('SINGLE_TEAM_OF_11')}
                                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                                    isSelected
                                      ? 'bg-blue-50/70 border-[#0a2e6e] shadow-md ring-2 ring-[#0a2e6e]/20'
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                                        isSelected ? 'border-[#0a2e6e] bg-[#0a2e6e]' : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-black text-xs text-primary">SINGLE TEAM OF 11</h4>
                                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                            11 Players
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-700 font-medium mt-1">
                                          Reserve the selected match period for one complete 11-player team.
                                        </p>
                                        {isAB && (
                                          <p className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg mt-2 inline-block border border-amber-200">
                                            📞 Price on request: Call Rajesh Bajaj (+91 95402 28222)
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="text-sm font-black text-[#ea580c] block">
                                        {teamPriceInfo.label}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setBookingType('SINGLE_TEAM_OF_11');
                                        }}
                                        className={`mt-1 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                                          isSelected ? 'bg-[#0a2e6e] text-white' : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {isSelected ? 'SELECTED' : 'SELECT'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Option B: WHOLE GROUND */}
                            {(() => {
                              const isSelected = bookingType === 'WHOLE_GROUND';
                              const wholePriceInfo = calculatePrice(selectedPeriod || 'MORNING', 'WHOLE_GROUND');

                              return (
                                <div
                                  onClick={() => setBookingType('WHOLE_GROUND')}
                                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                                    isSelected
                                      ? 'bg-blue-50/70 border-[#0a2e6e] shadow-md ring-2 ring-[#0a2e6e]/20'
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                                        isSelected ? 'border-[#0a2e6e] bg-[#0a2e6e]' : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-black text-xs text-primary">WHOLE GROUND</h4>
                                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#0a2e6e]">
                                            Entire Venue
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-700 font-medium mt-1">
                                          Reserve the entire venue for the selected period.
                                        </p>
                                        {isAB && (
                                          <p className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg mt-2 inline-block border border-emerald-200">
                                            ✓ Full facility access: Umpires, scorers, pitch, pavilion & nets included
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="text-sm font-black text-[#ea580c] block">
                                        {wholePriceInfo.label}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setBookingType('WHOLE_GROUND');
                                        }}
                                        className={`mt-1 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                                          isSelected ? 'bg-[#0a2e6e] text-white' : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {isSelected ? 'SELECTED' : 'SELECT'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setBookingStep('DETAILS')}
                          className="w-1/3 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs uppercase hover:bg-slate-50 cursor-pointer"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleProceedToSummary}
                          className="w-2/3 py-3 rounded-xl bg-[#0a2e6e] hover:bg-[#082252] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer shadow-md"
                        >
                          <span>REVIEW SUMMARY</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                      </div>

                      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                        Step 3 of 4 • Choose single team or whole ground reservation
                      </p>
                    </div>
                  )}

                  {/* STEP 4: FINAL BOOKING SUMMARY */}
                  {bookingStep === 'SUMMARY' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#0a2e6e] text-white text-[10px] font-bold flex items-center justify-center">4</span>
                          <span className="text-xs font-bold text-[#0a2e6e] uppercase tracking-wider">Final Booking Summary</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBookingStep('TYPE')}
                          className="text-xs font-semibold text-slate-500 hover:text-primary flex items-center gap-0.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">arrow_back</span>
                          Back
                        </button>
                      </div>

                      {/* Summary Box */}
                      <div className="bg-[#F8FAFC] p-5 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            BOOKING SUMMARY
                          </span>
                          <span className="text-[10px] font-bold text-[#0a2e6e] bg-blue-50 px-2 py-0.5 rounded-md">
                            Authoritative Server Pricing
                          </span>
                        </div>

                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Venue:</span>
                          <span className="font-bold text-primary">{ground.name}</span>
                        </div>

                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Date:</span>
                          <span className="font-bold text-primary">{formattedSelectedDate}</span>
                        </div>

                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Match:</span>
                          <span className="font-bold text-primary">{currentPeriodObj?.name} ({currentPeriodObj?.timeRange})</span>
                        </div>

                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Booking:</span>
                          <span className="font-bold text-emerald-700">
                            {isRRR
                              ? bookingType === 'INDIVIDUAL'
                                ? 'Individual'
                                : bookingType === 'HALF_TEAM'
                                ? 'Half Team'
                                : 'Entire Venue'
                              : bookingType === 'SINGLE_TEAM_OF_11'
                              ? 'Single Team of 11'
                              : 'Whole Ground'}
                          </span>
                        </div>

                        {isRRR && currentSummaryPrice.originalPrice && currentSummaryPrice.discount ? (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Price:</span>
                              <span className="font-semibold text-slate-700">
                                {currentSummaryPrice.originalPrice === 373.75 ? '₹373.75' : formatCurrency(currentSummaryPrice.originalPrice)}
                              </span>
                            </div>

                            <div className="flex justify-between text-xs text-emerald-700">
                              <span className="flex items-center gap-1 font-semibold">
                                <span className="material-symbols-outlined text-xs">loyalty</span>
                                BE11 WELCOMES (25% OFF):
                              </span>
                              <span className="font-bold">
                                -{currentSummaryPrice.discount === 74.75 ? '₹74.75' : formatCurrency(currentSummaryPrice.discount)}
                              </span>
                            </div>

                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[11px] text-emerald-800 flex items-center gap-1.5 font-medium">
                              <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                              <span>✓ 25% welcome discount applied automatically</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Price:</span>
                            <span className="font-bold text-primary">
                              {currentSummaryPrice.label}
                            </span>
                          </div>
                        )}

                        <div className="h-[1px] bg-slate-200 w-full my-2"></div>

                        {/* Customer Information */}
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Customer:</span>
                          <span className="font-semibold text-primary">{customerName}</span>
                        </div>

                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Mobile:</span>
                          <span className="font-semibold text-primary">{normalizePhone(customerPhone)}</span>
                        </div>

                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Email:</span>
                          <span className="font-semibold text-primary">{customerEmail}</span>
                        </div>

                        <div className="h-[1px] bg-slate-200 w-full my-2"></div>

                        <div className="flex justify-between items-center text-sm pt-0.5">
                          <span className="font-bold text-primary">TOTAL:</span>
                          <div className="text-right">
                            {isRRR && currentSummaryPrice.originalPrice && (
                              <span className="text-xs text-slate-400 line-through mr-2 font-medium">
                                {currentSummaryPrice.originalPrice === 373.75 ? '₹373.75' : formatCurrency(currentSummaryPrice.originalPrice)}
                              </span>
                            )}
                            <span className="font-black text-xl text-[#ea580c]">
                              {currentSummaryPrice.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* PAYMENT METHOD SELECTOR */}
                      {(() => {
                        const payableAmount = currentSummaryPrice.amount || 0;
                        const currentBalance = user?.walletBalance ?? 0;
                        const hasSufficientWallet = currentBalance >= payableAmount;
                        const walletShortfall = Math.max(0, payableAmount - currentBalance);

                        return (
                          <div className="space-y-4 pt-1">
                            <div className="space-y-2 text-left">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                                PAYMENT METHOD
                              </label>
                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaymentMethod('WALLET');
                                    setPaymentError('');
                                  }}
                                  className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    paymentMethod === 'WALLET'
                                      ? 'bg-blue-50/80 border-[#0a2e6e] text-[#0a2e6e] shadow-md ring-2 ring-[#0a2e6e]/20'
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-lg text-[#0a2e6e]">account_balance_wallet</span>
                                    <span className="text-xs font-black uppercase tracking-wider">WALLET CREDITS</span>
                                  </div>
                                  <span className="text-[11px] font-semibold text-slate-600">
                                    Balance: ₹{currentBalance.toFixed(2)}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaymentMethod('RAZORPAY');
                                    setPaymentError('');
                                  }}
                                  className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    paymentMethod === 'RAZORPAY'
                                      ? 'bg-orange-50/80 border-[#ea580c] text-[#ea580c] shadow-md ring-2 ring-[#ea580c]/20'
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-lg text-[#ea580c]">credit_card</span>
                                    <span className="text-xs font-black uppercase tracking-wider">RAZORPAY</span>
                                  </div>
                                  <span className="text-[11px] font-semibold text-slate-600">
                                    UPI, Cards, NetBanking
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* WALLET DETAILS / TOPUP IF SELECTED */}
                            {paymentMethod === 'WALLET' && (
                              <div className="bg-[#F8FAFC] border border-slate-200 rounded-2xl p-4 text-xs space-y-2 text-left animate-fadeIn">
                                <div className="flex justify-between text-slate-600">
                                  <span>Wallet Balance:</span>
                                  <span className="text-primary font-bold">₹{currentBalance.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                  <span>Booking Amount:</span>
                                  <span className="text-emerald-700 font-bold">{currentSummaryPrice.label}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                  <span>Available:</span>
                                  <span className="text-primary font-bold">₹{currentBalance.toFixed(2)}</span>
                                </div>

                                <div className="h-[1px] bg-slate-200 w-full my-1"></div>

                                {hasSufficientWallet ? (
                                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold pt-1">
                                    <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                                    <span>✓ Sufficient wallet balance</span>
                                  </div>
                                ) : (
                                  <div className="space-y-2.5 pt-1">
                                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide">
                                        <span className="material-symbols-outlined text-sm text-amber-600">warning</span>
                                        <span>INSUFFICIENT WALLET BALANCE</span>
                                      </div>
                                      <div className="flex justify-between text-[11px] text-slate-700 pt-1">
                                        <span>Required: {currentSummaryPrice.label}</span>
                                        <span className="text-amber-800 font-bold">Short by: ₹{walletShortfall.toFixed(2)}</span>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleTopupWallet(walletShortfall)}
                                      disabled={topupLoading}
                                      className="w-full py-3 bg-gradient-to-r from-[#f97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                                    >
                                      {topupLoading ? (
                                        <span>Opening Razorpay Top-Up...</span>
                                      ) : (
                                        <>
                                          <span className="material-symbols-outlined text-sm">add_card</span>
                                          <span>TOP UP WALLET WITH RAZORPAY (₹{Math.ceil(walletShortfall)})</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* RAZORPAY DETAILS IF SELECTED */}
                            {paymentMethod === 'RAZORPAY' && (
                              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-[11px] text-slate-700 leading-relaxed flex items-start gap-2 animate-fadeIn">
                                <span className="material-symbols-outlined text-base text-emerald-600 shrink-0 mt-0.5">verified_user</span>
                                <div>
                                  <strong>Secure payment powered by Razorpay:</strong> Supports UPI, Debit/Credit Cards & NetBanking. Charges authoritative final amount <strong>{currentSummaryPrice.label}</strong> with slot reservation.
                                </div>
                              </div>
                            )}

                            {/* Dynamic Payment State Alerts */}
                            {paymentState === 'cancelled' && (
                              <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-xs text-amber-900 space-y-1 animate-fade-in">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span className="material-symbols-outlined text-base text-amber-600">warning</span>
                                  <span>Payment Cancelled / Dismissed</span>
                                </div>
                                <p className="text-[11px] leading-relaxed">
                                  Your reservation request is safely saved with ID{' '}
                                  <strong className="font-mono text-primary">BK-{confirmedBooking?.id?.slice(0, 8)}</strong>{' '}
                                  (Status: PENDING). Your slot is temporarily reserved. Click <strong>RETRY PAYMENT</strong> below to complete checkout.
                                </p>
                              </div>
                            )}

                            {paymentState === 'failed' && (
                              <div className="bg-red-50 border border-red-300 p-4 rounded-xl text-xs text-red-900 space-y-2 animate-fade-in">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span className="material-symbols-outlined text-base text-red-600">error</span>
                                  <span>Booking Request Notice</span>
                                </div>
                                <p className="text-[11px] leading-relaxed">
                                  {paymentError || error || 'The transaction could not be processed. Please check your card or UPI app and retry.'}
                                </p>
                              </div>
                            )}

                            {paymentState === 'processing' && (
                              <div className="bg-blue-50 border border-blue-300 p-3 rounded-xl text-xs text-[#0a2e6e] flex items-center gap-2 animate-pulse">
                                <svg className="animate-spin h-4 w-4 text-[#0a2e6e]" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                </svg>
                                <span className="font-semibold text-[11px]">Verifying payment signature with Razorpay...</span>
                              </div>
                            )}

                            {/* Confirm & Pay Button */}
                            <div className="pt-2 flex gap-3">
                              <button
                                type="button"
                                onClick={() => setBookingStep('TYPE')}
                                disabled={bookingLoading || paymentState === 'processing'}
                                className="w-1/3 py-3.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs uppercase hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                              >
                                Back
                              </button>

                              {paymentMethod === 'WALLET' ? (
                                <button
                                  type="button"
                                  onClick={handleFinalBookingSubmit}
                                  disabled={bookingLoading || paymentState === 'processing' || !hasSufficientWallet}
                                  className="w-2/3 py-3.5 rounded-xl bg-[#0a2e6e] hover:bg-[#082252] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider text-center cursor-pointer transition-all shadow-lg active:scale-98 duration-150 flex items-center justify-center gap-2"
                                >
                                  {bookingLoading ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                      </svg>
                                      <span>Processing Wallet Payment...</span>
                                    </>
                                  ) : (
                                    `PAY ${currentSummaryPrice.label} FROM WALLET`
                                  )}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleFinalBookingSubmit}
                                  disabled={bookingLoading || paymentState === 'processing'}
                                  className="w-2/3 py-3.5 rounded-xl bg-[#f97316] hover:bg-[#ea580c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider text-center cursor-pointer transition-all shadow-lg active:scale-98 duration-150 flex items-center justify-center gap-2"
                                >
                                  {bookingLoading || paymentState === 'processing' ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                      </svg>
                                      <span>{paymentState === 'processing' ? 'Verifying Payment...' : 'Connecting to Razorpay...'}</span>
                                    </>
                                  ) : paymentState === 'cancelled' || paymentState === 'failed' ? (
                                    `RETRY PAYMENT (${currentSummaryPrice.label})`
                                  ) : (
                                    `PAY ${currentSummaryPrice.label} WITH RAZORPAY`
                                  )}
                                </button>
                              )}
                            </div>

                            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                              Atomic database transaction • Server-side HMAC SHA256 verification • Double-booking protected
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* STEP 5: SUCCESS / CONFIRMED SCREEN */}
                  {bookingStep === 'SUCCESS' && confirmedBooking && (
                    <div className="space-y-5 text-center p-2 animate-fadeIn">
                      <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <span className="material-symbols-outlined text-3xl">check_circle</span>
                      </div>

                      <div>
                        <h4 className="font-poppins font-black text-xl text-primary">
                          {confirmedBooking.paymentStatus === 'PAID' ? 'Payment Verified & Request Submitted!' : 'Reservation Request Submitted'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Booking Ref: <strong className="text-primary font-mono">BK-{confirmedBooking.id.slice(0, 8)}</strong>
                        </p>
                      </div>

                      {/* Prominent Admin Approval Notice */}
                      <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-left text-xs text-amber-900 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="material-symbols-outlined text-base text-amber-600">pending_actions</span>
                          <span>Booking Status: PENDING Admin Approval</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          Your payment of <strong>{formatCurrency(confirmedBooking.totalPrice || confirmedBooking.serverPrice)}</strong> has been successfully received and verified. Per club policy, this match slot is now locked and awaits venue manager approval.
                        </p>
                      </div>

                      <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200 text-left space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Booking Status:</span>
                          <span className="font-bold px-2.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800">
                            {confirmedBooking.status} (PENDING APPROVAL)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Payment Status:</span>
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                            confirmedBooking.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {confirmedBooking.paymentStatus}
                          </span>
                        </div>
                        {confirmedBooking.transactionId && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Transaction ID:</span>
                            <span className="font-mono text-[11px] text-slate-700">{confirmedBooking.transactionId}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-500">Venue:</span>
                          <span className="font-bold text-primary">{ground.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Date & Match:</span>
                          <span className="font-bold text-primary">{date} ({confirmedBooking.matchPeriod})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Booking Type:</span>
                          <span className="font-bold text-primary">{confirmedBooking.bookingType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Customer:</span>
                          <span className="font-semibold text-primary">{confirmedBooking.customerName || customerName}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
                          <span>Amount Paid:</span>
                          <span className="text-[#ea580c]">{formatCurrency(confirmedBooking.totalPrice || confirmedBooking.serverPrice)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmedBooking(null);
                            setBookingStep('PERIOD');
                          }}
                          className="w-full py-3 rounded-xl bg-[#0a2e6e] text-white font-bold text-xs uppercase hover:bg-[#082252] cursor-pointer shadow"
                        >
                          Book Another Date
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('/dashboard')}
                          className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs uppercase hover:bg-slate-200 cursor-pointer"
                        >
                          Go to Dashboard
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* RRR Cricket Club: Secondary Owner Contact for Custom Arrangements */}
              {isRRR && (
                <div className="mt-6 pt-5 border-t border-slate-200/60 bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 text-left">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="material-symbols-outlined text-base text-[#f97316]">support_agent</span>
                    <span className="text-[11px] font-bold text-primary uppercase tracking-wide">
                      Need a custom arrangement?
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                    Contact RRR Cricket Club owner Rishi for custom over formats, special ball requirements, or tournament setups.
                  </p>
                  <a
                    href={`tel:${ground.ownerPhone || '+919711669718'}`}
                    className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-[#0a2e6e] border border-slate-200 font-bold text-xs flex justify-center items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm text-[#f97316]">call</span>
                    Contact RRR Cricket Club ({ground.ownerPhone || '+91 97116 69718'})
                  </a>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Venue FAQs */}
        <FAQSection
          className="mt-8"
          title="Frequently Asked Questions"
          items={venueFaqs}
        />
      </div>
    </div>
  );
};
export default VenueDetail;
