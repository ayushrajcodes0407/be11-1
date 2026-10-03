import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { formatCurrency } from '@be11/shared';
import { normalizeVenuesList } from '../../utils/venueUtils.js';

interface VenueStats {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  revenue: number;
  activeLiveMatches: number;
}

interface VenueItem {
  id: string;
  name: string;
  slug: string;
  sport: string;
  city: string;
  state: string;
  location: string | null;
  address: string | null;
  pricePerHour: number | null;
  pricingLabel: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  amenities: any;
  rating: number;
  reviewsCount: number;
  isActive?: boolean;
  stats: VenueStats;
  url: string;
}

interface AdminVenuesViewProps {
  onNavigateTab: (tab: any) => void;
}

export const AdminVenuesView: React.FC<AdminVenuesViewProps> = ({ onNavigateTab }) => {
  const [venues, setVenues] = useState<VenueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState('ALL');

  const fetchVenues = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/venues');
      const rawVenues = res.data.data.venues || [];
      setVenues(normalizeVenuesList(rawVenues));
    } catch (err: any) {
      console.error('Failed to fetch admin venues:', err);
      setError(err.response?.data?.message || 'Unable to load official venues from database.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean = true) => {
    setTogglingId(id);
    try {
      await api.patch(`/admin/venues/${id}/toggle-status`);
      setVenues((prev) =>
        prev.map((v) => (v.id === id ? { ...v, isActive: !currentStatus } : v))
      );
      setSuccessToast(`Venue status updated to ${!currentStatus ? 'Active' : 'Inactive'}`);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      console.error('Toggle venue error:', err);
      setError(err.response?.data?.message || 'Failed to update venue status.');
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, []);

  const filteredVenues = venues.filter((v) => {
    const matchesSearch =
      !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.city && v.city.toLowerCase().includes(search.toLowerCase())) ||
      (v.ownerName && v.ownerName.toLowerCase().includes(search.toLowerCase()));

    const matchesSport = selectedSport === 'ALL' || v.sport.toLowerCase() === selectedSport.toLowerCase();

    return matchesSearch && matchesSport;
  });

  const totalPlatformRevenue = venues.reduce((acc, v) => acc + (v.stats?.revenue || 0), 0);
  const totalBookings = venues.reduce((acc, v) => acc + (v.stats?.totalBookings || 0), 0);

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {successToast && (
        <div className="fixed top-24 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* Top Banner & KPI Row */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-poppins text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">stadium</span>
              Official Sports Venues &amp; Grounds
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Live database records of all verified sports facilities across BE11.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('matches')}
              className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Schedule Match
            </button>
            <button
              onClick={() => onNavigateTab('bookings')}
              className="px-4 py-2 bg-gray-100 text-primary hover:bg-gray-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">event</span>
              Inspect Bookings
            </button>
          </div>
        </div>

        {/* Mini stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Total Venues</span>
            <div className="text-2xl font-bold text-primary mt-1 font-poppins">{venues.length} Facilities</div>
          </div>
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Total Bookings</span>
            <div className="text-2xl font-bold text-primary mt-1 font-poppins">{totalBookings} Bookings</div>
          </div>
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Direct Venue Revenue</span>
            <div className="text-2xl font-bold text-[#138808] mt-1 font-poppins">{formatCurrency(totalPlatformRevenue)}</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-sm">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search venue name, city, owner..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 bg-[#f8fafc] text-gray-800 focus:outline-none focus:border-secondary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-[#f8fafc] text-gray-700 font-medium focus:outline-none"
          >
            <option value="ALL">All Sports</option>
            <option value="Cricket">Cricket</option>
            <option value="Football">Football</option>
            <option value="Badminton">Badminton</option>
          </select>

          <button
            onClick={fetchVenues}
            className="p-2 text-gray-500 hover:text-primary rounded-xl border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer"
            title="Reload venues"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchVenues} className="underline hover:text-red-900 cursor-pointer">Retry</button>
        </div>
      )}

      {/* Venue Grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-xs">
          <span className="material-symbols-outlined text-3xl animate-spin mb-2">progress_activity</span>
          <p>Querying verified grounds and booking metrics...</p>
        </div>
      ) : filteredVenues.length === 0 ? (
        <div className="py-16 bg-white rounded-3xl border border-dashed border-gray-300 text-center flex flex-col items-center justify-center p-8">
          <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">stadium</span>
          <h3 className="font-bold text-primary text-base">No Venues Found</h3>
          <p className="text-gray-400 text-xs mt-1 max-w-sm">
            No official sports grounds matched your current search criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredVenues.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-secondary/10 text-secondary">
                        {v.sport}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        v.isActive !== false
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          : 'bg-rose-50 text-rose-700 border-rose-200/60'
                      }`}>
                        {v.isActive !== false ? 'Active Facility' : 'Inactive'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold font-poppins text-primary mt-1.5">{v.name}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-xs text-gray-400">location_on</span>
                      {v.location || v.address || `${v.city}, ${v.state}`}
                    </p>
                  </div>

                  <a
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-gray-400 hover:text-primary rounded-xl border border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center"
                    title="View public venue page"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </a>
                </div>

                {/* Pricing & Contact Bar */}
                <div className="grid grid-cols-2 gap-3 py-3 px-4 my-3 rounded-2xl bg-[#f8fafc] border border-gray-100 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-gray-400 font-bold block">Rate / Package</span>
                    <span className="font-bold text-primary">
                      {v.pricingLabel || (v.pricePerHour ? `${formatCurrency(v.pricePerHour)}/hr` : 'Tiered Pricing')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-gray-400 font-bold block">Venue Contact</span>
                    <span className="font-semibold text-gray-700">
                      {v.ownerName || 'BE11 Ground Ops'} {v.ownerPhone ? `(${v.ownerPhone})` : ''}
                    </span>
                  </div>
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-4 gap-2 py-2 text-center text-xs border-y border-gray-100 my-4">
                  <div>
                    <span className="text-[10px] text-gray-400 font-medium uppercase">Confirmed</span>
                    <div className="font-bold text-emerald-600 text-sm mt-0.5">{v.stats.confirmedBookings}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-medium uppercase">Pending</span>
                    <div className="font-bold text-amber-600 text-sm mt-0.5">{v.stats.pendingBookings}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-medium uppercase">Cancelled</span>
                    <div className="font-bold text-rose-600 text-sm mt-0.5">{v.stats.cancelledBookings}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-medium uppercase">Live Matches</span>
                    <div className="font-bold text-secondary text-sm mt-0.5">{v.stats.activeLiveMatches}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="text-xs">
                  <span className="text-gray-400">Total Revenue:</span>{' '}
                  <strong className="text-primary font-bold">{formatCurrency(v.stats.revenue)}</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(v.id, v.isActive !== false)}
                    disabled={togglingId === v.id}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      v.isActive !== false
                        ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">
                      {v.isActive !== false ? 'pause_circle' : 'play_circle'}
                    </span>
                    {togglingId === v.id ? 'Updating...' : v.isActive !== false ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => onNavigateTab('bookings')}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 text-primary hover:bg-gray-50 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">calendar_month</span>
                    Bookings
                  </button>
                  <button
                    onClick={() => onNavigateTab('matches')}
                    className="px-3 py-1.5 rounded-xl bg-primary text-white hover:bg-primary/90 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">sports_cricket</span>
                    Matches
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
