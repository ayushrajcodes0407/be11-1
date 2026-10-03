import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { BookingDTO, formatCurrency } from '@be11/shared';
import { normalizeVenue } from '../utils/venueUtils.js';
import { SEO } from '../components/common/SEO.js';

export const MyBookings: React.FC = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'past' | 'cancelled'>('all');
  const [bookings, setBookings] = useState<BookingDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMyBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/bookings/my');
      const rawBookings: BookingDTO[] = res.data.data.bookings || [];
      const normalizedBookings = rawBookings.map((b) => ({
        ...b,
        ground: b.ground ? normalizeVenue(b.ground) : b.ground,
      }));
      setBookings(normalizedBookings);
    } catch (err: any) {
      console.error('Failed to fetch bookings:', err);
      setError(err.response?.data?.message || 'Failed to load your reservations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredBookings = bookings.filter((b) => {
    if (activeFilter === 'cancelled') return b.status === 'CANCELLED';
    if (activeFilter === 'upcoming') return b.date >= todayStr && b.status !== 'CANCELLED';
    if (activeFilter === 'past') return b.date < todayStr && b.status !== 'CANCELLED';
    return true;
  });

  return (
    <div className="pt-24 pb-20 min-h-screen bg-surface-container-low text-left font-poppins">
      <SEO title="My Bookings | BE11" noindex={true} />
      <div className="max-w-5xl mx-auto px-container-padding">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="font-poppins font-black text-3xl text-primary flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#f97316] text-3xl">confirmation_number</span>
              MY VENUE BOOKINGS
            </h1>
            <p className="text-on-surface-variant text-sm mt-1">
              View your scheduled match periods, confirmation status and match receipts.
            </p>
          </div>

          <Link
            to="/venues"
            className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-xs btn-primary-premium flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">stadium</span>
            Explore Venues
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-[#EDF2F7] p-1.5 rounded-2xl w-full sm:w-fit mb-6">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'text-primary hover:bg-[#F8FAFC]'
            }`}
          >
            All Bookings ({bookings.length})
          </button>
          <button
            onClick={() => setActiveFilter('upcoming')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'upcoming' ? 'bg-primary text-white shadow-sm' : 'text-primary hover:bg-[#F8FAFC]'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveFilter('past')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'past' ? 'bg-primary text-white shadow-sm' : 'text-primary hover:bg-[#F8FAFC]'
            }`}
          >
            Past Matches
          </button>
          <button
            onClick={() => setActiveFilter('cancelled')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'cancelled' ? 'bg-primary text-white shadow-sm' : 'text-primary hover:bg-[#F8FAFC]'
            }`}
          >
            Cancelled
          </button>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container p-4 rounded-xl text-xs font-bold mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-primary font-bold text-sm">Loading your bookings...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-24 p-12 text-center shadow-sm border border-outline-variant/30 space-y-3">
            <span className="material-symbols-outlined text-5xl text-secondary-container">sports_cricket</span>
            <h3 className="font-poppins font-bold text-xl text-primary">No Bookings Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {activeFilter === 'all'
                ? "You haven't reserved any venues yet. Explore our verified grounds in Haryana."
                : `No ${activeFilter} reservations found.`}
            </p>
            <div className="pt-2">
              <Link
                to="/venues"
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-xs btn-primary-premium shadow inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">search</span>
                Book A Venue
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-24 p-6 shadow-sm border border-outline-variant/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-primary transition-all text-left"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs font-black text-slate-400">BK-{b.id.slice(0, 8)}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      b.status === 'CONFIRMED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : b.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {b.status}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0a2e6e]">
                      {b.bookingType === 'SINGLE_TEAM_OF_11' || b.bookingType === 'TEAM_OF_11' ? 'Single Team of 11' : 'Whole Ground'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      (b as any).paymentStatus === 'PAID'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      Payment: {(b as any).paymentStatus || 'PENDING'}
                    </span>
                  </div>

                  <h3 className="font-poppins font-black text-lg text-primary">{b.ground?.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-sm text-[#f97316]">location_on</span>
                    {b.ground?.location}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-primary">
                      <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                      {b.date}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-[#0a2e6e]">
                      <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                      {b.matchPeriod || `${b.startTime} - ${b.endTime}`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Amount</span>
                    <span className="font-poppins font-black text-xl text-[#ea580c]">
                      {formatCurrency(b.totalPrice)}
                    </span>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    {(b as any).paymentStatus === 'PAYMENT_PENDING' && b.status !== 'CANCELLED' && (
                      <button
                        onClick={() => navigate(`/venues/${b.ground?.slug || b.groundId}?date=${b.date}`)}
                        className="px-4 py-2 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-xs cursor-pointer transition-all shadow-xs"
                      >
                        Pay Now
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/venues/${b.ground?.slug || b.groundId}?date=${b.date}`)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-primary font-bold text-xs cursor-pointer transition-all"
                    >
                      View Venue
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
export default MyBookings;
