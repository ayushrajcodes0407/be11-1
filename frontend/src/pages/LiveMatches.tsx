import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api.js';
import { useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useLocationStore } from '../store/locationStore.js';
import { io } from 'socket.io-client';
import { API_URL } from '../config/env.js';
import { loadRazorpaySdk } from '../lib/razorpay.js';
import { SEO } from '../components/common/SEO.js';
import { FAQSection } from '../components/common/FAQSection.js';
import { AEO_KNOWLEDGE } from '../config/aeoKnowledge.js';
import { normalizeVenue, normalizeVenuesList } from '../utils/venueUtils.js';

interface Ground {
  id: string;
  name: string;
  slug?: string;
  location: string;
  address?: string;
  city: string;
  state?: string;
  country?: string;
  pricePerHour: number;
  sport: string;
  rating: number;
  amenities: string[];
  images: string[];
}

interface Match {
  id: string;
  groundId: string;
  ground: Ground;
  sport: string;
  date: string;
  startTime: string;
  entryFee: number;
  playersJoined: number;
  totalPlayers: number;
  skillLevel: string;
  hostId: string;
  hostName: string;
  verifiedHost: boolean;
  status: string;
  teamA: any; // array or string
  teamB: any; // array or string
}

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const LiveMatches: React.FC = () => {
  const { isAuthenticated, user, updateWalletBalance } = useAuthStore();
  const { selectedCity } = useLocationStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.permissionDenied) {
      alert("You don't have permission to access this page.");
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Player Join Flow Premium Modal State
  const [playerBookingMatch, setPlayerBookingMatch] = useState<Match | null>(null);
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3 | 4 | 5>(1); // 1: Overview, 3: Invoice & Payment, 5: Success screen
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'RAZORPAY'>('WALLET');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [invoiceResult, setInvoiceResult] = useState<any | null>(null);

  // Helper to determine if match has fixed ₹299 welcome promo
  const isRRRMatch = (m?: Match | null) => {
    if (!m) return false;
    return (
      m.ground?.slug === 'rrr-cricket-club-kidawali-faridabad' ||
      m.groundId === '04b615ea-c1a6-4a60-9b06-926d3b3b020c' ||
      (m.ground?.name && m.ground.name.includes('RRR')) ||
      m.ground?.slug === 'playnow-cricket-ground' ||
      m.ground?.slug === 'playnow-cricket-ground-sector-86-gurugram' ||
      m.groundId === '8597cac9-2d50-4d71-9f16-60c1c8132ed7' ||
      (m.ground?.name && m.ground.name.includes('Playnow')) ||
      m.entryFee === 299 ||
      m.date === '2026-10-03'
    );
  };

  // Authoritative price calculation for live match booking
  const getMatchPriceInfo = (m?: Match | null) => {
    if (!m) return { markedPrice: 0, discount: 0, finalPrice: 0, isRRR: false };
    const isRRR = isRRRMatch(m);
    if (isRRR) {
      return {
        markedPrice: 373.75,
        discount: 74.75,
        finalPrice: 299.0,
        isRRR: true,
      };
    }
    const base = m.entryFee;
    const gst = base * 0.18;
    const platformFee = 20.0;
    return {
      markedPrice: base,
      discount: 0,
      finalPrice: Math.max(0, base + gst + platformFee),
      isRRR: false,
    };
  };

  // Top Up Wallet with Razorpay
  const handleTopupWallet = async (shortfallAmount: number) => {
    if (!isAuthenticated) {
      alert('Please log in first.');
      navigate('/login');
      return;
    }
    const topupAmount = Math.max(1, Math.ceil(shortfallAmount));

    setTopupLoading(true);
    setPaymentError('');
    try {
      const isLoaded = await loadRazorpaySdk();
      if (!isLoaded || !window.Razorpay) {
        alert('Failed to load Razorpay payment gateway. Please check your internet connection.');
        return;
      }

      // 1. Create wallet top-up order
      const orderRes = await api.post('/wallet/topup/create-order', {
        amount: topupAmount,
      });

      const { orderId, amount, keyId } = orderRes.data.data;

      // 2. Open Razorpay modal
      const options = {
        key: keyId,
        amount: amount,
        currency: 'INR',
        name: 'BE11 Sports',
        description: `Wallet Top-Up (₹${topupAmount})`,
        order_id: orderId,
        handler: async (response: any) => {
          try {
            const verifyRes = await api.post('/wallet/topup/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            const newBal = verifyRes.data.data.walletBalance;
            updateWalletBalance(newBal);
            setPaymentError('');
            alert(`Wallet topped up successfully by ₹${topupAmount}! Current balance: ₹${newBal}. You can now pay from wallet.`);
          } catch (err: any) {
            console.error('Wallet topup verification failed:', err);
            setPaymentError(err.response?.data?.message || 'Top-up verification failed.');
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentError('Wallet top-up was cancelled.');
          },
        },
        prefill: {
          name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: { color: '#FF9933' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error(err);
      setPaymentError(err.response?.data?.message || 'Failed to initiate wallet top-up.');
    } finally {
      setTopupLoading(false);
    }
  };

  // Pay from Wallet
  const handleWalletPaymentSubmit = async () => {
    if (!playerBookingMatch) return;
    const priceInfo = getMatchPriceInfo(playerBookingMatch);
    const payable = priceInfo.finalPrice;

    if ((user?.walletBalance ?? 0) < payable) {
      setPaymentError(`Insufficient wallet balance. Required: ₹${payable}, Available: ₹${(user?.walletBalance ?? 0).toFixed(2)}`);
      return;
    }

    setCheckoutLoading(true);
    setPaymentError('');

    try {
      const res = await api.post(`/matches/${playerBookingMatch.id}/booking`, {
        bookingType: 'INDIVIDUAL',
        playerCount: 1,
      });

      if (user) {
        updateWalletBalance(user.walletBalance - payable);
      }

      const booking = res.data.data.booking;
      setInvoiceResult({
        transactionId: booking.transactionId || `tx_w_${Math.floor(10000000 + Math.random() * 90000000)}`,
        invoiceId: booking.invoice || `inv_m_${Math.floor(100000 + Math.random() * 900000)}`,
        amountPaid: payable,
        date: new Date().toLocaleDateString(),
        bookingId: booking.id,
        status: 'PENDING ADMIN CONFIRMATION',
      });

      setBookingStep(5);
      fetchMatches();
    } catch (err: any) {
      console.error(err);
      setPaymentError(err.response?.data?.message || 'Failed to complete wallet payment.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Pay with Razorpay Checkout
  const handleRazorpayPaymentSubmit = async () => {
    if (!playerBookingMatch) return;
    setCheckoutLoading(true);
    setPaymentError('');

    try {
      const isLoaded = await loadRazorpaySdk();
      if (!isLoaded || !window.Razorpay) {
        alert('Failed to load Razorpay checkout.');
        setCheckoutLoading(false);
        return;
      }

      const orderRes = await api.post(`/matches/${playerBookingMatch.id}/create-order`, {
        bookingType: 'INDIVIDUAL',
        playerCount: 1,
      });

      const { orderId, amount, keyId, finalPrice } = orderRes.data.data;

      const options = {
        key: keyId,
        amount: amount,
        currency: 'INR',
        name: 'BE11 Sports',
        description: `Match Booking: ${playerBookingMatch.ground?.name || 'Cricket Match'}`,
        order_id: orderId,
        handler: async (response: any) => {
          try {
            const verifyRes = await api.post(`/matches/${playerBookingMatch.id}/verify-payment`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              bookingType: 'INDIVIDUAL',
              playerCount: 1,
            });

            const booking = verifyRes.data.data.booking;
            setInvoiceResult({
              transactionId: response.razorpay_payment_id || booking?.transactionId,
              invoiceId: booking?.invoice || `inv_m_${Math.floor(100000 + Math.random() * 900000)}`,
              amountPaid: finalPrice,
              date: new Date().toLocaleDateString(),
              bookingId: booking?.id,
              status: 'PENDING ADMIN CONFIRMATION',
            });

            setBookingStep(5);
            fetchMatches();
          } catch (verifyErr: any) {
            console.error('Payment verification error:', verifyErr);
            setPaymentError(verifyErr.response?.data?.message || 'Payment signature verification failed.');
          } finally {
            setCheckoutLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setCheckoutLoading(false);
            setPaymentError('Payment cancelled. Your booking has not been paid.');
          },
        },
        prefill: {
          name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: { color: '#FF9933' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        setCheckoutLoading(false);
        setPaymentError(resp.error?.description || 'Payment failed. Your booking has not been paid.');
      });
      rzp.open();
    } catch (err: any) {
      console.error(err);
      setPaymentError(err.response?.data?.message || 'Failed to start Razorpay payment.');
      setCheckoutLoading(false);
    }
  };

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters & Search & Sort states
  const [searchParams, setSearchParams] = useSearchParams();
  const sportParam = searchParams.get('sport');
  const initialSport = () => {
    if (sportParam) {
      const formatted = sportParam.charAt(0).toUpperCase() + sportParam.slice(1).toLowerCase();
      if (['Cricket', 'Football', 'Badminton', 'Basketball', 'Volleyball', 'Tennis'].includes(formatted)) {
        return formatted;
      }
    }
    return 'All';
  };

  const [selectedSport, setSelectedSport] = useState(initialSport);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriceFilter, setSelectedPriceFilter] = useState('All'); // 'All', 'Free', '100', '300'
  const [selectedSkillFilter, setSelectedSkillFilter] = useState('All'); // 'All', 'Beginner', 'Intermediate', 'Professional'
  const [sortBy, setSortBy] = useState('Newest'); // 'Newest', 'Lowest Price', 'Highest Rating'

  // Selected Match details view
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // Synchronize URL changes (e.g. back button, direct navigation)
  useEffect(() => {
    if (sportParam) {
      const formatted = sportParam.charAt(0).toUpperCase() + sportParam.slice(1).toLowerCase();
      if (['Cricket', 'Football', 'Badminton', 'Basketball', 'Volleyball', 'Tennis'].includes(formatted)) {
        if (selectedSport !== formatted) {
          setSelectedSport(formatted);
        }
      }
    } else {
      if (selectedSport !== 'All') {
        setSelectedSport('All');
      }
    }
  }, [sportParam]);

  // Synchronize state changes to URL
  useEffect(() => {
    if (selectedSport === 'All') {
      if (searchParams.has('sport')) {
        const copy = new URLSearchParams(searchParams.toString());
        copy.delete('sport');
        setSearchParams(copy);
      }
    } else {
      if (searchParams.get('sport') !== selectedSport.toLowerCase()) {
        const copy = new URLSearchParams(searchParams.toString());
        copy.set('sport', selectedSport.toLowerCase());
        setSearchParams(copy);
      }
    }
  }, [selectedSport]);


  // Match Chat Room State
  const [chatRoomMatchId, setChatRoomMatchId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [typingMessage, setTypingMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Host Match Wizard State
  const [isHostOpen, setIsHostOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [hostGrounds, setHostGrounds] = useState<Ground[]>([]);
  
  // Host Form states
  const [hostGroundId, setHostGroundId] = useState('');
  const [hostSport, setHostSport] = useState('Cricket');
  const [hostDate, setHostDate] = useState('2026-08-16');
  const [hostTime, setHostTime] = useState('07:00 AM');
  const [hostDuration, setHostDuration] = useState('2 Hours');
  const [hostSkill, setHostSkill] = useState('Intermediate');
  const [hostPlayers, setHostPlayers] = useState('22');
  const [hostFee, setHostFee] = useState('299');
  const [hostDesc, setHostDesc] = useState('Friendly open game. Slots include refreshments and dynamic umpire tracking.');
  const [hostLoading, setHostLoading] = useState(false);

  const fetchMatches = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/matches', {
        params: {
          sport: selectedSport === 'All' ? undefined : selectedSport,
          city: selectedCity,
          search: searchQuery || undefined,
        },
      });
      let fetched: Match[] = res.data?.data?.matches || res.data?.matches || [];

      // Normalize ground data to canonical location source
      fetched = fetched.map((m) => ({
        ...m,
        ground: normalizeVenue(m.ground),
      }));

      // If city query returned 0 matches, fallback to fetch all matches and filter with normalized ground data
      if (fetched.length === 0 && selectedCity && selectedCity !== 'All') {
        try {
          const allRes = await api.get('/matches', {
            params: {
              sport: selectedSport === 'All' ? undefined : selectedSport,
              search: searchQuery || undefined,
            },
          });
          const allMatches: Match[] = allRes.data?.data?.matches || allRes.data?.matches || [];
          const normalizedAll = allMatches.map((m) => ({
            ...m,
            ground: normalizeVenue(m.ground),
          }));

          const targetCity = selectedCity.toLowerCase().trim();
          fetched = normalizedAll.filter((m) => {
            const gCity = (m.ground?.city || '').toLowerCase();
            const gLoc = (m.ground?.location || '').toLowerCase();
            const gAddr = (m.ground?.address || '').toLowerCase();
            const gState = (m.ground?.state || '').toLowerCase();

            if (targetCity === 'haryana') {
              return gState.includes('haryana') || gCity.includes('haryana') || gCity.includes('faridabad') || gCity.includes('gurugram') || gLoc.includes('haryana');
            }
            if (targetCity === 'gurugram' || targetCity === 'gurgaon') {
              return gCity === 'gurugram' || gCity === 'gurgaon' || gLoc.includes('gurugram') || gAddr.includes('gurugram') || (m.ground?.slug && m.ground.slug.includes('playnow')) || (m.ground?.name && m.ground.name.includes('Playnow'));
            }
            if (targetCity === 'faridabad') {
              return (gCity === 'faridabad' || gLoc.includes('faridabad')) && !gLoc.includes('gurugram');
            }
            return gCity === targetCity || gLoc.includes(targetCity);
          });
        } catch (_) {}
      }

      // Canonical fallback match if no match is returned for Gurugram or Haryana
      if (fetched.length === 0 && (selectedCity === 'Gurugram' || selectedCity === 'Gurgaon' || selectedCity === 'Haryana' || selectedCity === 'All' || !selectedCity)) {
        fetched = [
          {
            id: 'playnow-seed-match-20261003',
            groundId: '8597cac9-2d50-4d71-9f16-60c1c8132ed7',
            ground: normalizeVenue({
              id: '8597cac9-2d50-4d71-9f16-60c1c8132ed7',
              name: 'Playnow Cricket Ground',
              slug: 'playnow-cricket-ground',
              location: 'Gurugram, Haryana',
              address: 'Bandhwari Road, Balola, Gurugram, Bandhwari, Haryana 122102',
              city: 'Gurugram',
              pricePerHour: 1500,
              sport: 'Cricket',
              rating: 4.8,
              amenities: ['Turf Pitch', 'Floodlights', 'Pavilion', 'Dugout', 'Parking'],
              images: ['/venues/playnow/unnamed.webp', '/venues/playnow/unnamed (1).webp'],
            }),
            sport: 'Cricket',
            date: '2026-10-03',
            startTime: '10:00 AM – 2:00 PM',
            entryFee: 299,
            playersJoined: 0,
            totalPlayers: 22,
            skillLevel: 'Intermediate',
            hostId: '2080c161-0d9a-46e1-9d2b-6aed4d8b1b67',
            hostName: 'Ayush Rajput',
            verifiedHost: true,
            status: 'Open',
            teamA: [],
            teamB: [],
          },
        ];
      }

      // Exclude cancelled, closed, completed, and dummy matches
      fetched = fetched.filter((m) => {
        const status = (m.status || '').toLowerCase().trim();
        const invalidStatuses = ['cancelled', 'canceled', 'closed', 'completed', 'inactive'];
        if (invalidStatuses.includes(status)) return false;
        const hostName = (m.hostName || '').toLowerCase();
        const groundName = (m.ground?.name || '').toLowerCase();
        if (hostName.includes('dummy') || hostName.includes('test_dummy') || groundName.includes('dummy')) return false;
        return true;
      });
      if (selectedPriceFilter !== 'All') {
        if (selectedPriceFilter === 'Free') fetched = fetched.filter((m) => m.entryFee === 0);
        if (selectedPriceFilter === '100') fetched = fetched.filter((m) => m.entryFee <= 100);
        if (selectedPriceFilter === '300') fetched = fetched.filter((m) => m.entryFee <= 300);
      }
      if (selectedSkillFilter !== 'All') {
        fetched = fetched.filter((m) => (m.skillLevel || '').toLowerCase() === selectedSkillFilter.toLowerCase());
      }

      // Client-side sorting
      if (sortBy === 'Lowest Price') {
        fetched.sort((a, b) => a.entryFee - b.entryFee);
      } else if (sortBy === 'Highest Rating') {
        fetched.sort((a, b) => (b.ground?.rating || 0) - (a.ground?.rating || 0));
      } else {
        fetched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      setMatches(fetched);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to fetch open playrooms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [selectedSport, selectedCity, searchQuery, selectedPriceFilter, selectedSkillFilter, sortBy]);

  // Maintain fresh refs for socket event handlers without recreating the socket instance
  const selectedCityRef = useRef(selectedCity);
  selectedCityRef.current = selectedCity;
  const selectedMatchRef = useRef(selectedMatch);
  selectedMatchRef.current = selectedMatch;

  // Optimized Socket setup for matches with tab-visibility awareness & reconnect bounds
  useEffect(() => {
    let socket: any = null;

    const connectSocket = () => {
      if (socket && socket.connected) return;
      socket = io(API_URL, {
        reconnectionAttempts: 3,
        reconnectionDelay: 5000,
        reconnectionDelayMax: 15000,
        timeout: 5000,
        transports: ['websocket'],
      });

      socket.on('match-update', ({ matchId, action, data }: any) => {
        const normalizedData = data ? { ...data, ground: normalizeVenue(data.ground) } : data;
        setMatches((prev) => {
          if (action === 'CREATED') {
            if (normalizedData?.ground?.city === selectedCityRef.current) {
              return [normalizedData, ...prev];
            }
            return prev;
          }
          return prev.map((m) => (m.id === matchId ? normalizedData : m));
        });

        if (selectedMatchRef.current && selectedMatchRef.current.id === matchId) {
          setSelectedMatch(normalizedData);
        }
      });
    };

    const disconnectSocket = () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };

    // Connect initially if page is visible
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      connectSocket();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        connectSocket();
        fetchMatches();
      } else {
        disconnectSocket();
      }
    };

    // Safety refresh every 45 seconds while tab is active
    const safetyRefreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchMatches();
      }
    }, 45000);

    return () => {
      clearInterval(safetyRefreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnectSocket();
    };
  }, []);

  const loadHostGrounds = async () => {
    try {
      const res = await api.get('/grounds', { params: { city: selectedCity } });
      const rawGrounds: Ground[] = res.data?.data?.grounds || [];
      const normalized = normalizeVenuesList<Ground>(rawGrounds);
      setHostGrounds(normalized);
      if (normalized.length > 0) {
        setHostGroundId(normalized[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isHostOpen) {
      loadHostGrounds();
    }
  }, [isHostOpen, selectedCity]);


  // Host playroom publish
  const handleHostPublish = async () => {
    setHostLoading(true);
    try {
      await api.post('/matches', {
        groundId: hostGroundId,
        sport: hostSport,
        date: hostDate,
        startTime: hostTime,
        entryFee: parseFloat(hostFee || '0'),
        totalPlayers: parseInt(hostPlayers || '10'),
        skillLevel: hostSkill,
      });

      setSuccessMsg('Match Playroom successfully hosted and published live!');
      setIsHostOpen(false);
      setWizardStep(1);
      fetchMatches();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Host registration failed.');
    } finally {
      setHostLoading(false);
    }
  };

  // Leave match
  const handleLeaveMatch = async (matchId: string) => {
    if (!window.confirm('Are you sure you want to cancel your slot booking in this playroom?')) return;
    try {
      const res = await api.post(`/matches/${matchId}/leave`);
      alert('Successfully left the playroom. Entry fee refunded.');
      if (selectedMatch && selectedMatch.entryFee > 0 && user) {
        updateWalletBalance(user.walletBalance + selectedMatch.entryFee);
      }
      if (res.data?.data?.match) {
        setSelectedMatch({
          ...res.data.data.match,
          ground: normalizeVenue(res.data.data.match.ground),
        });
      }
      fetchMatches();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Leave failed.');
    }
  };

  const getTeamRoster = (teamJson: any) => {
    if (typeof teamJson === 'string') {
      try {
        return JSON.parse(teamJson);
      } catch {
        return [];
      }
    }
    return teamJson || [];
  };

  // Chat room updates simulator
  useEffect(() => {
    if (chatRoomMatchId) {
      setChatMessages([
        { sender: 'Ayush Raj', msg: 'Welcome everyone! Pitch is booked. Wear white kits.', time: '09:12' },
        { sender: 'Rahul Sharma', msg: 'Awesome! Bringing additional batting pads.', time: '09:15' },
      ]);
    }
  }, [chatRoomMatchId]);

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typingMessage.trim() || !user) return;
    
    setChatMessages((prev) => [
      ...prev,
      { sender: `${user.firstName} ${user.lastName}`, msg: typingMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    setTypingMessage('');

    // Typing effect simulator
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="pt-20 pb-16 min-h-screen bg-[#040408] text-white text-left font-poppins relative overflow-hidden">
      {/* Visual background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-orange-500/5 blur-[120px] pointer-events-none"></div>

      <SEO
        title="Live Cricket Matches in Gurugram & Faridabad | Join a Match | BE11"
        description="Find and participate in live cricket matches in Gurugram, Faridabad, and Delhi NCR. Join active match lobbies, view match periods, and play competitive cricket on BE11."
        canonical="/live-matches"
        faqJsonLd={AEO_KNOWLEDGE.services['live-matches'].faqs}
        jsonLd={{
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
              name: 'Live Matches',
              item: 'https://be11.in/live-matches',
            },
          ],
        }}
      />
      <div className="max-w-7xl mx-auto px-6 z-10 relative space-y-6">
        
        {/* Breadcrumb Navigation */}
        <div className="flex gap-2 text-[10px] text-gray-400 font-semibold mb-2 text-left uppercase tracking-wider">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          <span className="text-gray-600">&gt;</span>
          <Link to="/live-matches" className="hover:text-white transition-colors">Live Matches</Link>
          {selectedSport !== 'All' && (
            <>
              <span className="text-gray-600">&gt;</span>
              <span className="text-indigo-400 font-bold">{selectedSport}</span>
            </>
          )}
        </div>

        {/* Page title and host trigger */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#FF9933]/10 border border-[#FF9933]/20 px-3 py-1 rounded-full mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF9933] animate-pulse"></span>
              <span className="text-[10px] text-[#FF9933] font-black uppercase tracking-widest">Live Open Matches</span>
            </div>
            <h1 className="font-poppins font-black text-3xl sm:text-4xl uppercase tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
              {selectedSport === 'All' ? 'Open Playrooms' : `${selectedSport} Playrooms`}
            </h1>
            <p className="text-gray-400 text-xs mt-1">Join {selectedSport === 'All' ? 'sports' : selectedSport} activities, split bookings expense, and team up in {selectedCity}.</p>
          </div>

          {isAuthenticated && ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'COACH'].includes(user?.role || '') && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsHostOpen(true);
                  setWizardStep(1);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-2xl cursor-pointer transition-all shadow-md active:scale-95"
              >
                Host Match Lobbies
              </button>
            </div>
          )}
        </div>


        {errorMsg && (
          <div className="bg-red-950/40 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-indigo-950/40 border border-indigo-500/20 text-indigo-300 p-4 rounded-2xl text-xs font-semibold">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          
          {/* Sports Categories */}
          <div className="lg:col-span-5 flex flex-wrap gap-1 bg-black/45 border border-white/10 p-1.5 rounded-2xl w-full">
            {['All', 'Cricket', 'Football', 'Badminton', 'Basketball', 'Volleyball', 'Tennis'].map((sport) => (
              <button
                key={sport}
                type="button"
                onClick={() => setSelectedSport(sport)}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                  selectedSport === sport ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                }`}
              >
                {sport}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="lg:col-span-3 relative w-full">
            <input
              type="text"
              placeholder={selectedSport === 'All' ? 'Search venue, sport, host...' : `Search ${selectedSport} venues...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#09090F]/70 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="lg:col-span-4 grid grid-cols-3 gap-2 w-full text-xs">
            <select
              value={selectedPriceFilter}
              onChange={(e) => setSelectedPriceFilter(e.target.value)}
              className="bg-[#09090F]/70 border border-white/10 rounded-xl px-3 py-2 text-gray-300 focus:outline-none"
            >
              <option value="All">All Prices</option>
              <option value="Free">Free entry</option>
              <option value="100">Below ₹100</option>
              <option value="300">Below ₹300</option>
            </select>

            <select
              value={selectedSkillFilter}
              onChange={(e) => setSelectedSkillFilter(e.target.value)}
              className="bg-[#09090F]/70 border border-white/10 rounded-xl px-3 py-2 text-gray-300 focus:outline-none"
            >
              <option value="All">All Skills</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Professional">Professional</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#09090F]/70 border border-white/10 rounded-xl px-3 py-2 text-gray-300 focus:outline-none"
            >
              <option value="Newest">Newest first</option>
              <option value="Lowest Price">Lowest price</option>
              <option value="Highest Rating">Highest rating</option>
            </select>
          </div>

        </div>

        {/* Lobbies grid layout */}
        {loading ? (
          <div className="py-24 text-center text-indigo-400 font-bold uppercase tracking-wider">Retrieving Active Matches...</div>
        ) : matches.length === 0 ? (
          <div className="py-20 text-center bg-[#09090F]/45 border border-dashed border-white/10 rounded-[28px] p-8 space-y-4 max-w-xl mx-auto">
            <span className="text-5xl inline-block">🏟️</span>
            <h3 className="font-bold text-xl uppercase tracking-wider text-white">
              NO LIVE MATCHES RIGHT NOW
            </h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
              There are currently no open matches available in your area. Check back later or create/book your own match.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                to="/venues"
                className="bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl shadow-lg transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">stadium</span>
                EXPLORE VENUES
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((m) => {
              const joined = m.playersJoined || 0;
              const max = m.totalPlayers || 22;
              const ratio = joined / max;
              const isFull = joined >= max;

              const teamA = getTeamRoster(m.teamA);
              const teamB = getTeamRoster(m.teamB);
              const userInA = teamA.some((p: any) => p.id === user?.id);
              const userInB = teamB.some((p: any) => p.id === user?.id);
              const hasJoined = userInA || userInB;

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMatch(m)}
                  className="bg-[#09090F]/70 border border-white/10 rounded-[22px] p-5 shadow-2xl hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)] hover:border-indigo-500/30 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between cursor-pointer relative group text-left"
                >
                  <div>
                    {/* Badge and sports */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                          m.sport === 'Cricket' ? 'bg-[#FF9933]/15 text-[#FF9933] border border-[#FF9933]/20' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {m.sport}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-indigo-600/15 text-indigo-300 border border-indigo-500/20">
                          {m.startTime.includes('10:00') ? 'AFTERNOON' : 'OPEN'}
                        </span>
                      </div>
                      <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">{m.skillLevel || 'OPEN'}</span>
                    </div>

                    <h3 className="font-poppins font-black text-base text-white truncate uppercase tracking-wide group-hover:text-indigo-400 transition-colors">
                      {m.ground?.name || 'Local Turf Hub'}
                    </h3>
                    <p className="text-gray-400 text-xs mt-1 truncate font-light flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      {m.ground?.location}
                    </p>

                    {/* Date/Time slots */}
                    <div className="flex items-center gap-3 mt-4 bg-white/5 border border-white/5 px-3 py-2 rounded-xl text-xs font-semibold">
                      <span className="flex items-center gap-1 text-gray-300">
                        <span className="material-symbols-outlined text-[14px] text-indigo-400">calendar_today</span>
                        {formatDateDisplay(m.date)}
                      </span>
                      <span className="flex items-center gap-1 text-gray-300">
                        <span className="material-symbols-outlined text-[14px] text-indigo-400">schedule</span>
                        {m.startTime}
                      </span>
                    </div>

                    {/* Spots progress ledger */}
                    <div className="mt-5 space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                        <span className="text-gray-300">{joined} / {max} Joined</span>
                        <span className="text-indigo-300">
                          {isFull ? 'Roster Full' : `${max - joined} Spots Available`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFull ? 'bg-red-500' : ratio > 0.85 ? 'bg-[#FF9933]' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${ratio * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Foot action pricing */}
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest block font-bold">Individual Fee</span>
                      <span className="text-sm font-black text-white uppercase">{m.entryFee === 0 ? 'Free' : `₹${m.entryFee}`}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasJoined) {
                          setSelectedMatch(m);
                        } else if (isFull) {
                          alert('Lobby is currently full. Capacity reached.');
                        } else if (!isAuthenticated) {
                          alert('Please login to book this live match.');
                          navigate('/login');
                        } else {
                          setPlayerBookingMatch(m);
                          setBookingStep(1);
                          setInvoiceResult(null);
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        hasJoined
                          ? 'bg-indigo-600 text-white'
                          : isFull
                          ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                          : 'bg-[#FF9933] hover:bg-[#e07f24] text-white shadow-md'
                      }`}
                    >
                      {hasJoined ? 'Manage Room' : isFull ? 'Lobby Full' : 'BOOK INDIVIDUAL PLAYER'}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Selected Match Details View Drawer/Modal */}
        {selectedMatch && (
          <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#09090F] border border-white/10 rounded-[28px] max-w-4xl w-full p-6 relative shadow-2xl animate-scale-in text-left max-h-[90vh] overflow-y-auto">
              
              <button
                onClick={() => {
                  setSelectedMatch(null);
                  setChatRoomMatchId(null);
                }}
                className="absolute top-6 right-6 text-gray-400 hover:text-white transition-all scale-110 cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4">
                <div className="md:col-span-7 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-indigo-600/20 text-indigo-300 border border-indigo-500/25">
                        {selectedMatch.sport} Activity
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/25">
                        Match Status: {selectedMatch.status || 'Open'}
                      </span>
                    </div>
                    <h2 className="font-poppins font-black text-2xl uppercase tracking-wide mt-2 text-white">
                      {selectedMatch.ground?.name || 'Local Turf'}
                    </h2>
                    <p className="text-gray-400 text-xs mt-1 flex items-center gap-1 font-light">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      {selectedMatch.ground?.location}
                    </p>
                  </div>

                  <div className="p-4 bg-white/5 border border-white/5 rounded-2xl grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[8px] uppercase tracking-widest text-gray-400 block font-bold">Schedule</span>
                      <span className="font-bold text-white block mt-0.5">{formatDateDisplay(selectedMatch.date)}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase tracking-widest text-gray-400 block font-bold">Timings</span>
                      <span className="font-bold text-white block mt-0.5">{selectedMatch.startTime}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase tracking-widest text-gray-400 block font-bold">Entry Fee</span>
                      <span className="font-bold text-emerald-400 block mt-0.5">
                        {selectedMatch.entryFee === 0 ? 'FREE' : `₹${selectedMatch.entryFee} / player`}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-950/20 border border-indigo-500/15 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest text-indigo-300 block font-bold">Player Availability</span>
                      <span className="font-bold text-white text-sm">
                        {selectedMatch.totalPlayers - selectedMatch.playersJoined} spots available ({selectedMatch.playersJoined} / {selectedMatch.totalPlayers} joined)
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Individual Joining Only</span>
                  </div>

                  {/* Team rosters */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/30 border border-white/5 p-4 rounded-2xl">
                      <h4 className="font-poppins font-black text-[11px] uppercase tracking-wider text-[#FF9933] pb-2 border-b border-white/5">
                        🛡️ Team A
                      </h4>
                      <ul className="space-y-2 mt-3 text-xs text-gray-300">
                        {getTeamRoster(selectedMatch.teamA).length === 0 ? (
                          <li className="text-gray-500 text-[11px] italic">No players joined yet</li>
                        ) : (
                          getTeamRoster(selectedMatch.teamA).map((p: any, i: number) => (
                            <li key={p.id || i} className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[14px]">account_circle</span>
                              {p.firstName} {p.lastName}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>

                    <div className="bg-black/30 border border-white/5 p-4 rounded-2xl">
                      <h4 className="font-poppins font-black text-[11px] uppercase tracking-wider text-emerald-400 pb-2 border-b border-white/5">
                        🛡️ Team B
                      </h4>
                      <ul className="space-y-2 mt-3 text-xs text-gray-300">
                        {getTeamRoster(selectedMatch.teamB).length === 0 ? (
                          <li className="text-gray-500 text-[11px] italic">No players joined yet</li>
                        ) : (
                          getTeamRoster(selectedMatch.teamB).map((p: any, i: number) => (
                            <li key={p.id || i} className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[14px]">account_circle</span>
                              {p.firstName} {p.lastName}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Leave or Join trigger button inside details */}
                  {(() => {
                    const teamA = getTeamRoster(selectedMatch.teamA);
                    const teamB = getTeamRoster(selectedMatch.teamB);
                    const isJoined = teamA.some((p: any) => p.id === user?.id) || teamB.some((p: any) => p.id === user?.id);
                    const isFull = selectedMatch.playersJoined >= selectedMatch.totalPlayers;

                    if (isJoined) {
                      return (
                        <button
                          onClick={() => handleLeaveMatch(selectedMatch.id)}
                          className="w-full py-3 bg-red-950/40 hover:bg-red-900 border border-red-500/20 text-red-400 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer text-center block transition-all"
                        >
                          Cancel Slot Booking
                        </button>
                      );
                    }

                    if (isFull) {
                      return (
                        <button
                          disabled
                          className="w-full py-3 bg-white/5 text-gray-500 border border-white/10 rounded-xl font-bold text-xs uppercase tracking-wider text-center block cursor-not-allowed"
                        >
                          Lobby Full (22/22)
                        </button>
                      );
                    }

                    return (
                      <button
                        onClick={() => {
                          if (!isAuthenticated) {
                            alert('Please login to book this live match.');
                            navigate('/login');
                            return;
                          }
                          const m = selectedMatch;
                          setSelectedMatch(null);
                          setPlayerBookingMatch(m);
                          setBookingStep(1);
                          setInvoiceResult(null);
                        }}
                        className="w-full py-3.5 bg-[#FF9933] hover:bg-[#e07f24] text-white rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer text-center block transition-all shadow-lg"
                      >
                        BOOK INDIVIDUAL PLAYER
                      </button>
                    );
                  })()}
                </div>

                {/* Right panel chat rooms (Only for joined users!) */}
                <div className="md:col-span-5 bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col justify-between min-h-[380px]">
                  {(() => {
                    const teamA = getTeamRoster(selectedMatch.teamA);
                    const teamB = getTeamRoster(selectedMatch.teamB);
                    const isJoined = teamA.some((p: any) => p.id === user?.id) || teamB.some((p: any) => p.id === user?.id);

                    if (!isJoined) {
                      return (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500 space-y-2">
                          <span className="material-symbols-outlined text-3xl">lock</span>
                          <h5 className="font-bold text-xs uppercase tracking-wider text-gray-400">Chat Room Locked</h5>
                          <p className="text-[10px] leading-relaxed">Join this playroom as an individual player to coordinate kits, positions and weather updates.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col h-full justify-between">
                        <div>
                          <div className="flex justify-between items-center pb-2 border-b border-white/5 mb-3">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Playroom Chat</h5>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                          </div>
                          
                          {/* Messages logs */}
                          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 text-xs">
                            {chatMessages.map((msg, i) => (
                              <div key={i} className="p-2.5 bg-white/5 border border-white/5 rounded-xl space-y-1">
                                <div className="flex justify-between text-[8px] font-black text-indigo-400">
                                  <span>{msg.sender}</span>
                                  <span className="text-gray-500">{msg.time}</span>
                                </div>
                                <p className="text-[11px] text-gray-200 leading-normal">{msg.msg}</p>
                              </div>
                            ))}
                            {isTyping && (
                              <p className="text-[9px] text-gray-500 italic animate-pulse">Someone is typing...</p>
                            )}
                          </div>
                        </div>

                        {/* Input form */}
                        <form onSubmit={sendChatMessage} className="flex gap-2 border-t border-white/5 pt-3 mt-4">
                          <input
                            required
                            type="text"
                            placeholder="Type a message..."
                            value={typingMessage}
                            onChange={(e) => setTypingMessage(e.target.value)}
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-3.5 flex items-center justify-center cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">send</span>
                          </button>
                        </form>
                      </div>
                    );
                  })()}
                </div>

              </div>

            </div>
          </div>
        )}

        {/* Premium Join Match Flow Modal - INDIVIDUAL PLAYER ONLY */}
        {playerBookingMatch && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#09090F]/95 border border-white/10 rounded-[28px] max-w-2xl w-full p-6 md:p-8 relative shadow-2xl text-left backdrop-blur-xl my-8">
              
              <button
                onClick={() => setPlayerBookingMatch(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white transition-all scale-110 cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>

              {/* STEP 1: Individual Player Booking Overview */}
              {(() => {
                const priceInfo = getMatchPriceInfo(playerBookingMatch);
                const isRRR = priceInfo.isRRR;
                const payableAmount = priceInfo.finalPrice;
                const currentBalance = user?.walletBalance ?? 0;
                const hasSufficientWallet = currentBalance >= payableAmount;
                const walletShortfall = Math.max(0, payableAmount - currentBalance);

                return (
                  <>
                    {bookingStep === 1 && (
                      <div>
                        <div className="mb-6">
                          <div className="inline-flex items-center gap-2 bg-[#FF9933]/15 border border-[#FF9933]/25 px-3 py-1 rounded-full mb-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9933]"></span>
                            <span className="text-[9px] text-[#FF9933] font-bold uppercase tracking-widest">LIVE MATCH PARTICIPATION</span>
                          </div>
                          <h3 className="font-poppins font-black text-2xl uppercase tracking-wider text-white">
                            🏏 BOOK AS INDIVIDUAL PLAYER
                          </h3>
                          <p className="text-gray-400 text-xs mt-1">
                            Join individually and get automatically assigned to a playing team for this official match.
                          </p>
                        </div>

                        <div className="bg-gradient-to-b from-[#0e0e1a]/80 to-[#07070f]/90 border border-white/10 rounded-2xl p-6 space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-xs pb-4 border-b border-white/5">
                            <div>
                              <span className="text-[9px] uppercase tracking-widest text-gray-400 block font-bold">Venue</span>
                              <span className="font-bold text-white block mt-1">{playerBookingMatch.ground?.name}</span>
                              <span className="text-gray-400 text-[10px] block mt-0.5">{playerBookingMatch.ground?.location}</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase tracking-widest text-gray-400 block font-bold">Date & Slot</span>
                              <span className="font-bold text-white block mt-1">{formatDateDisplay(playerBookingMatch.date)}</span>
                              <span className="text-indigo-400 text-[10px] block mt-0.5">{playerBookingMatch.startTime}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center text-xs bg-black/40 p-3 rounded-xl border border-white/5">
                            <div>
                              <span className="text-[8px] uppercase tracking-widest text-gray-400 block font-bold">Payable Price</span>
                              <div className="mt-0.5">
                                {isRRR && (
                                  <span className="text-[10px] text-gray-400 line-through mr-1">₹373.75</span>
                                )}
                                <span className="text-emerald-400 font-bold text-sm">₹{payableAmount}</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-[8px] uppercase tracking-widest text-gray-400 block font-bold">Available Spots</span>
                              <span className="text-white font-bold text-sm block mt-0.5">
                                {playerBookingMatch.totalPlayers - playerBookingMatch.playersJoined} / {playerBookingMatch.totalPlayers}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] uppercase tracking-widest text-gray-400 block font-bold">Assignment</span>
                              <span className="text-indigo-400 font-bold text-sm block mt-0.5">Automatic</span>
                            </div>
                          </div>

                          {isRRR && (
                            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 text-[11px] text-emerald-300 space-y-1 text-left">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm">loyalty</span>
                                  PROMO APPLIED
                                </span>
                                <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold text-emerald-200">
                                  🏷 BE11 WELCOMES (25% OFF)
                                </span>
                              </div>
                              <p className="text-[10px] text-emerald-200 leading-relaxed font-medium">
                                ✓ Welcome discount applied automatically (₹373.75 - ₹74.75 = ₹299).
                              </p>
                            </div>
                          )}

                          <div className="p-3 bg-white/5 rounded-xl text-[11px] text-gray-300 space-y-1 text-left">
                            <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                              <span className="material-symbols-outlined text-[14px]">info</span>
                              <span>Individual Player Only</span>
                            </div>
                            <p className="text-gray-400 text-[10px] leading-relaxed">
                              This match is exclusively configured for individual player participation. No team or full-ground booking is accepted for this live room.
                            </p>
                          </div>

                          <button
                            onClick={() => {
                              setBookingStep(3);
                              setPaymentError('');
                            }}
                            className="w-full py-3.5 bg-[#FF9933] hover:bg-[#e07f24] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg mt-2"
                          >
                            PROCEED TO PAYMENT (₹{payableAmount})
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3: Booking Invoice & Payment Screen */}
                    {bookingStep === 3 && (
                      <div className="max-w-md mx-auto space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <h4 className="font-black text-sm uppercase tracking-wide text-white">
                            BOOKING SUMMARY
                          </h4>
                          <button
                            onClick={() => {
                              setBookingStep(1);
                              setPaymentError('');
                            }}
                            className="text-xs text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                            Back
                          </button>
                        </div>

                        {/* Invoice Breakdown Card */}
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-3 text-xs text-gray-300 text-left">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Venue:</span>
                            <span className="text-white font-bold">{playerBookingMatch.ground?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Date:</span>
                            <span className="text-white font-bold">{formatDateDisplay(playerBookingMatch.date)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Match:</span>
                            <span className="text-white font-bold">{playerBookingMatch.startTime}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Booking:</span>
                            <span className="text-indigo-400 font-bold uppercase tracking-wider">Individual Player</span>
                          </div>

                          <div className="h-[1px] bg-white/5 w-full my-2"></div>

                          {isRRR ? (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Marked Price:</span>
                                <span className="text-gray-400 font-semibold">₹373.75</span>
                              </div>
                              <div className="flex justify-between text-emerald-400 font-bold">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm">loyalty</span>
                                  BE11 WELCOMES (25% OFF):
                                </span>
                                <span>-₹74.75</span>
                              </div>
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-[10px] text-emerald-300 flex items-center gap-1.5 font-medium">
                                <span className="material-symbols-outlined text-xs text-emerald-400">check_circle</span>
                                <span>✓ 25% welcome discount applied automatically</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Base Entry Fee:</span>
                                <span className="text-white font-semibold">₹{playerBookingMatch.entryFee}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">GST (18%):</span>
                                <span className="text-white font-semibold">₹{(playerBookingMatch.entryFee * 0.18).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Platform Booking Fee:</span>
                                <span className="text-white font-semibold">₹20.00</span>
                              </div>
                            </>
                          )}

                          <div className="h-[1px] bg-white/5 w-full my-2"></div>

                          <div className="flex justify-between items-center text-sm font-black text-white pt-1">
                            <span className="uppercase tracking-wide">YOU PAY</span>
                            <div className="text-right">
                              {isRRR && (
                                <span className="text-xs text-gray-400 line-through mr-2 font-normal">₹373.75</span>
                              )}
                              <span className="text-emerald-400 text-lg">₹{payableAmount}</span>
                            </div>
                          </div>
                        </div>

                        {/* PAYMENT METHOD SELECTOR */}
                        <div className="space-y-2 text-left">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                            PAYMENT METHOD
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentMethod('WALLET');
                                setPaymentError('');
                              }}
                              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                                paymentMethod === 'WALLET'
                                  ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg'
                                  : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-base text-indigo-400">account_balance_wallet</span>
                                <span className="text-xs font-black uppercase tracking-wider">WALLET CREDITS</span>
                              </div>
                              <span className="text-[10px] text-gray-300 font-semibold">
                                Balance: ₹{currentBalance.toFixed(2)}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPaymentMethod('RAZORPAY');
                                setPaymentError('');
                              }}
                              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                                paymentMethod === 'RAZORPAY'
                                  ? 'bg-[#FF9933]/20 border-[#FF9933] text-white shadow-lg'
                                  : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-base text-[#FF9933]">credit_card</span>
                                <span className="text-xs font-black uppercase tracking-wider">RAZORPAY</span>
                              </div>
                              <span className="text-[10px] text-gray-300 font-semibold">
                                UPI, Cards, NetBanking
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* WALLET DETAILS / TOPUP IF SELECTED */}
                        {paymentMethod === 'WALLET' && (
                          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-xs space-y-2 text-left animate-fadeIn">
                            <div className="flex justify-between text-gray-400">
                              <span>Wallet Balance:</span>
                              <span className="text-white font-bold">₹{currentBalance.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-400">
                              <span>Booking Amount:</span>
                              <span className="text-emerald-400 font-bold">₹{payableAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-400">
                              <span>Available:</span>
                              <span className="text-white font-bold">₹{currentBalance.toFixed(2)}</span>
                            </div>

                            <div className="h-[1px] bg-white/5 w-full my-1"></div>

                            {hasSufficientWallet ? (
                              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold pt-1">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                <span>✓ Sufficient wallet balance</span>
                              </div>
                            ) : (
                              <div className="space-y-2.5 pt-1">
                                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 text-[11px] text-amber-300 space-y-1">
                                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide">
                                    <span className="material-symbols-outlined text-sm text-amber-400">warning</span>
                                    <span>INSUFFICIENT WALLET BALANCE</span>
                                  </div>
                                  <div className="flex justify-between text-[10px] text-gray-300 pt-1">
                                    <span>Required: ₹{payableAmount.toFixed(2)}</span>
                                    <span className="text-amber-300 font-bold">Short by: ₹{walletShortfall.toFixed(2)}</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleTopupWallet(walletShortfall)}
                                  disabled={topupLoading}
                                  className="w-full py-3 bg-gradient-to-r from-[#f97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
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
                          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-left text-gray-300 flex items-center gap-2.5 animate-fadeIn">
                            <span className="material-symbols-outlined text-lg text-emerald-400 shrink-0">verified_user</span>
                            <span className="text-[11px] leading-relaxed">
                              Secure payment powered by Razorpay. Supports UPI apps, Credit/Debit Cards, NetBanking and Wallets.
                            </span>
                          </div>
                        )}

                        {/* Error Alert */}
                        {paymentError && (
                          <div className="bg-red-500/15 border border-red-500/30 text-red-300 p-3 rounded-xl text-xs text-left flex items-start gap-2">
                            <span className="material-symbols-outlined text-base text-red-400 shrink-0 mt-0.5">error</span>
                            <span className="leading-relaxed">{paymentError}</span>
                          </div>
                        )}

                        {/* ACTION BUTTONS */}
                        <div className="flex gap-3 pt-4">
                          <button
                            type="button"
                            onClick={() => {
                              setBookingStep(1);
                              setPaymentError('');
                            }}
                            className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase text-gray-400 hover:text-white cursor-pointer transition-all"
                          >
                            Back
                          </button>

                          {paymentMethod === 'WALLET' ? (
                            <button
                              type="button"
                              onClick={handleWalletPaymentSubmit}
                              disabled={checkoutLoading || !hasSufficientWallet}
                              className="flex-1 py-3.5 bg-[#FF9933] hover:bg-[#e07f24] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase text-white shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2"
                            >
                              {checkoutLoading ? 'Processing Payment...' : `PAY ₹${payableAmount} FROM WALLET`}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleRazorpayPaymentSubmit}
                              disabled={checkoutLoading}
                              className="flex-1 py-3.5 bg-[#FF9933] hover:bg-[#e07f24] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase text-white shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2"
                            >
                              {checkoutLoading ? 'Connecting to Razorpay...' : `PAY ₹${payableAmount} WITH RAZORPAY`}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* STEP 5: Success Screen */}
                    {bookingStep === 5 && invoiceResult && (
                      <div className="text-center space-y-6 py-4 max-w-md mx-auto animate-fadeIn">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 text-3xl">
                          ✓
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-poppins font-black text-xl uppercase tracking-wider text-emerald-400">
                            ✓ PAYMENT SUCCESSFUL
                          </h3>
                          <p className="text-gray-300 text-xs">
                            Your payment has been received and verified. Your spot reservation is submitted.
                          </p>
                        </div>

                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-xs space-y-2.5 text-left text-gray-300">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Amount Paid:</span>
                            <span className="text-emerald-400 font-bold text-sm">₹{invoiceResult.amountPaid.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Booking Status:</span>
                            <span className="text-amber-400 font-bold uppercase tracking-wider bg-amber-500/15 px-2 py-0.5 rounded text-[10px]">
                              PENDING ADMIN CONFIRMATION
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Receipt Invoice:</span>
                            <span className="text-white font-mono font-bold">{invoiceResult.invoiceId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Transaction ID:</span>
                            <span className="text-white font-mono font-bold">{invoiceResult.transactionId}</span>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setPlayerBookingMatch(null);
                              setBookingStep(1);
                              setInvoiceResult(null);
                              fetchMatches();
                            }}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer shadow-lg"
                          >
                            Done / Return to Live Matches
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

            </div>
          </div>
        )}



        {/* Host Match Wizard Multi-Step Form */}
        {isHostOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#09090F] border border-white/10 rounded-[28px] max-w-md w-full p-8 relative shadow-2xl text-left">
              
              <button
                onClick={() => setIsHostOpen(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white transition-all scale-110 cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>

              {/* Progress step markers */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Step {wizardStep} of 4</span>
                  <h4 className="font-poppins font-black text-lg uppercase tracking-wide text-white">
                    {wizardStep === 1 && 'Sport & Ground'}
                    {wizardStep === 2 && 'Schedule Timings'}
                    {wizardStep === 3 && 'Rules & Fees'}
                    {wizardStep === 4 && 'Lobby Summary'}
                  </h4>
                </div>
                <div className="flex gap-1.5 bg-black/40 border border-white/5 px-3 py-1.5 rounded-full text-xs font-bold">
                  {[1, 2, 3, 4].map((s) => (
                    <span
                      key={s}
                      className={`w-2.5 h-2.5 rounded-full block border ${
                        wizardStep === s ? 'bg-indigo-500 border-indigo-400 shadow-lg' : 'bg-white/5 border-white/10'
                      }`}
                    ></span>
                  ))}
                </div>
              </div>

              {wizardStep === 1 && (
                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Select Sport Type</label>
                    <select
                      value={hostSport}
                      onChange={(e) => setHostSport(e.target.value)}
                      className="w-full bg-[#050508] border border-white/10 rounded-xl p-3 text-xs text-white"
                    >
                      <option value="Cricket">Cricket</option>
                      <option value="Football">Football</option>
                      <option value="Badminton">Badminton</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Select Ground Venue</label>
                    <select
                      value={hostGroundId}
                      onChange={(e) => setHostGroundId(e.target.value)}
                      className="w-full bg-[#050508] border border-white/10 rounded-xl p-3 text-xs text-white"
                    >
                      {hostGrounds.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} (₹{g.pricePerHour}/hr)
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setWizardStep(2)}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider text-center cursor-pointer transition-all mt-4"
                  >
                    Next Step
                  </button>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Date Selection</label>
                    <input
                      type="date"
                      value={hostDate}
                      onChange={(e) => setHostDate(e.target.value)}
                      className="w-full bg-[#050508] border border-white/10 rounded-xl p-3 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Start Time</label>
                      <input
                        type="text"
                        placeholder="e.g. 07:00 AM"
                        value={hostTime}
                        onChange={(e) => setHostTime(e.target.value)}
                        className="w-full bg-[#050508] border border-white/10 rounded-xl p-3 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Duration</label>
                      <select
                        value={hostDuration}
                        onChange={(e) => setHostDuration(e.target.value)}
                        className="w-full bg-[#050508] border border-white/10 rounded-xl p-3 text-xs text-white"
                      >
                        <option value="1 Hour">1 Hour</option>
                        <option value="2 Hours">2 Hours</option>
                        <option value="3 Hours">3 Hours</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setWizardStep(3)}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold uppercase"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Max Players</label>
                      <input
                        type="number"
                        value={hostPlayers}
                        onChange={(e) => setHostPlayers(e.target.value)}
                        className="w-full bg-[#050508] border border-white/10 rounded-xl p-3 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Entry Fee (₹)</label>
                      <input
                        type="number"
                        value={hostFee}
                        onChange={(e) => setHostFee(e.target.value)}
                        className="w-full bg-[#050508] border border-white/10 rounded-xl p-3 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Skill Level</label>
                    <select
                      value={hostSkill}
                      onChange={(e) => setHostSkill(e.target.value)}
                      className="w-full bg-[#050508] border border-white/10 rounded-xl p-3 text-xs text-white"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Professional">Professional</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Description</label>
                    <textarea
                      rows={3}
                      value={hostDesc}
                      onChange={(e) => setHostDesc(e.target.value)}
                      className="w-full bg-[#050508] border border-white/10 rounded-xl p-3 text-xs text-white resize-none"
                    />
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setWizardStep(4)}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold uppercase"
                    >
                      Summary
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4 text-xs">
                  <div className="bg-black/35 border border-white/5 rounded-2xl p-4 space-y-2 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>Sport:</span>
                      <span className="text-white font-bold">{hostSport}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ground:</span>
                      <span className="text-white font-bold">{hostGrounds.find((g) => g.id === hostGroundId)?.name || 'Turf'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Schedule:</span>
                      <span className="text-white font-bold">{hostDate} @ {hostTime} ({hostDuration})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Skill Level:</span>
                      <span className="text-white font-bold">{hostSkill}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Player limit:</span>
                      <span className="text-white font-bold">{hostPlayers} spots</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Entry charge:</span>
                      <span className="text-emerald-400 font-bold">₹{hostFee}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setWizardStep(3)}
                      className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleHostPublish}
                      disabled={hostLoading}
                      className="flex-1 py-3 bg-[#FF9933] hover:bg-[#e07f24] rounded-xl text-xs font-bold uppercase text-white shadow-md active:scale-95"
                    >
                      {hostLoading ? 'Publishing...' : 'Publish Match'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Live Matches Direct Answer FAQ Section */}
        <FAQSection
          className="mt-8"
          theme="dark"
          title="Frequently Asked Questions"
          items={AEO_KNOWLEDGE.services['live-matches'].faqs}
        />

      </div>
    </div>
  );
};

export default LiveMatches;
