import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { formatCurrency } from '@be11/shared';
import { normalizeVenuesList } from '../../utils/venueUtils.js';

interface LiveMatchItem {
  id: string;
  sport: string;
  date: string;
  startTime: string;
  entryFee: number;
  playersJoined: number;
  totalPlayers: number;
  spotsLeft: number;
  skillLevel: string;
  hostId: string;
  hostName: string;
  verifiedHost: boolean;
  status: string;
  groundId: string;
  groundName: string;
  groundSlug?: string;
  groundCity?: string;
  groundLocation?: string;
  teamACount: number;
  teamBCount: number;
  createdAt: string;
}

export const AdminMatchesView: React.FC = () => {
  const [matches, setMatches] = useState<LiveMatchItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedSport, setSelectedSport] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Available Grounds for Dynamic Dropdown
  const [grounds, setGrounds] = useState<any[]>([]);

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    groundId: '',
    sport: 'Cricket',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00 AM – 02:00 PM',
    entryFee: 299,
    totalPlayers: 22,
    skillLevel: 'Intermediate',
    teamA: [] as any[],
    teamB: [] as any[],
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Modals for Inspection / Cancellation
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelMatchId, setCancelMatchId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchMatches = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = { page, limit: 15 };
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (selectedSport !== 'ALL') params.sport = selectedSport;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/admin/matches', { params });
      const rawMatches: LiveMatchItem[] = res.data.data.matches || [];
      const normalizedMatches = rawMatches.map((m) => {
        const isPlaynow =
          m.groundSlug?.includes('playnow') ||
          m.groundName?.toLowerCase().includes('playnow') ||
          m.groundId === '8597cac9-2d50-4d71-9f16-60c1c8132ed7';
        if (isPlaynow) {
          return {
            ...m,
            groundName: 'Playnow Cricket Ground',
            groundSlug: 'playnow-cricket-ground',
            groundCity: 'Gurugram',
            groundLocation: 'Gurugram, Haryana',
          };
        }
        return m;
      });
      setMatches(normalizedMatches);
      setTotalPages(res.data.data.pagination.totalPages);
      setStats(res.data.data.stats);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch live matches.');
    } finally {
      setLoading(false);
    }
  };

  const fetchGrounds = async () => {
    try {
      const res = await api.get('/grounds');
      const groundList = res.data.data.grounds || [];
      const normalizedGrounds = normalizeVenuesList(groundList);
      setGrounds(normalizedGrounds);
      if (normalizedGrounds.length > 0 && !createForm.groundId) {
        setCreateForm((prev) => ({ ...prev, groundId: normalizedGrounds[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load grounds:', err);
    }
  };

  useEffect(() => {
    fetchMatches();
    fetchGrounds();
  }, [page, selectedStatus, selectedSport]);

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    try {
      await api.post('/admin/matches', createForm);
      setSuccessToast('Live match successfully created and published!');
      setCreateModalOpen(false);
      fetchMatches();
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      console.error(err);
      setCreateError(err.response?.data?.message || 'Failed to create live match.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCancelMatch = async () => {
    if (!cancelMatchId) return;
    setCancelLoading(true);
    try {
      await api.patch(`/admin/matches/${cancelMatchId}/cancel`, {
        reason: cancelReason || 'Cancelled by administrator',
      });
      setSuccessToast('Live match cancelled and participant dues refunded!');
      setCancelModalOpen(false);
      setCancelMatchId('');
      setCancelReason('');
      fetchMatches();
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to cancel match.');
    } finally {
      setCancelLoading(false);
    }
  };

  const inspectRoster = async (matchId: string) => {
    try {
      const res = await api.get(`/admin/matches/${matchId}`);
      setSelectedMatch(res.data.data.match);
      setRosterModalOpen(true);
    } catch (err: any) {
      console.error(err);
      alert('Failed to load match roster.');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header & Action Bar ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-poppins font-black text-2xl text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FF8C1A] text-2xl">sports_cricket</span>
            Live Matches Operations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Schedule competitive match lobbies on verified BE11 grounds and monitor player rosters.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateError('');
            setCreateModalOpen(true);
          }}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF8C1A] to-[#FF9933] text-white text-xs font-bold hover:opacity-95 active:scale-95 transition-all shadow-md flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-sm">add_circle</span>
          Create New Match
        </button>
      </div>

      {/* ─── Notification Toast ───────────────────────────────────── */}
      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
          {successToast}
        </div>
      )}

      {/* ─── Match KPI Metrics Row ────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Total Matches</span>
            <div className="text-xl font-poppins font-black text-slate-900">{stats.totalMatches || 0}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-emerald-700 uppercase">Open Lobbies</span>
            <div className="text-xl font-poppins font-black text-emerald-600">{stats.openMatches || 0}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-blue-700 uppercase">Completed Matches</span>
            <div className="text-xl font-poppins font-black text-blue-600">{stats.completedMatches || 0}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-rose-700 uppercase">Cancelled Matches</span>
            <div className="text-xl font-poppins font-black text-rose-600">{stats.cancelledMatches || 0}</div>
          </div>
        </div>
      )}

      {/* ─── Search & Filters ─────────────────────────────────────── */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchMatches()}
            placeholder="Search ground, host, sport..."
            className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF8C1A] focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:border-[#FF8C1A]"
          >
            <option value="ALL">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Live">Live</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={selectedSport}
            onChange={(e) => {
              setSelectedSport(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:border-[#FF8C1A]"
          >
            <option value="ALL">All Sports</option>
            <option value="Cricket">Cricket</option>
            <option value="Football">Football</option>
          </select>
        </div>
      </div>

      {/* ─── Matches Table ────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-3.5 pl-6 pr-4">Match ID</th>
                <th className="py-3.5 px-4">Venue & City</th>
                <th className="py-3.5 px-4">Sport</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Entry Fee</th>
                <th className="py-3.5 px-4">Spots Joined</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Host</th>
                <th className="py-3.5 pr-6 pl-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    <span className="material-symbols-outlined animate-spin text-xl text-[#FF8C1A]">sync</span>
                    <p className="mt-2">Loading live matches...</p>
                  </td>
                </tr>
              ) : matches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    No live matches found matching your filters.
                  </td>
                </tr>
              ) : (
                matches.map((item) => {
                  const percent = Math.min(100, Math.round((item.playersJoined / item.totalPlayers) * 100));
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 pl-6 pr-4 font-mono font-bold text-slate-700">
                        #{item.id.length > 14 ? item.id.substring(0, 12) : item.id}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900">{item.groundName}</div>
                        <div className="text-[10px] text-slate-400">{item.groundCity}</div>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-700">
                        {item.sport}
                      </td>
                      <td className="py-4 px-4 text-slate-600">
                        <div>{item.date}</div>
                        <div className="text-[10px] text-slate-400">{item.startTime}</div>
                      </td>
                      <td className="py-4 px-4 font-poppins font-bold text-slate-900">
                        {item.entryFee === 0 ? 'Free' : formatCurrency(item.entryFee)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1 w-28">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
                            <span>{item.playersJoined} / {item.totalPlayers}</span>
                            <span className="text-slate-400">{item.spotsLeft} left</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.status === 'Open'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'Live'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : item.status === 'Completed'
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-700 text-xs">
                        {item.hostName}
                      </td>
                      <td className="py-4 pr-6 pl-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => inspectRoster(item.id)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                          >
                            Roster
                          </button>
                          {item.status !== 'Cancelled' && item.status !== 'Completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelMatchId(item.id);
                                setCancelReason('');
                                setCancelModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all cursor-pointer"
                              title="Cancel Match"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Create Live Match Modal ───────────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#FF8C1A]">add_circle</span>
                <h3 className="font-poppins font-bold text-base text-slate-900">
                  Create New Live Match Lobby
                </h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {createError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateMatch} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Select Ground / Venue</label>
                <select
                  required
                  value={createForm.groundId}
                  onChange={(e) => setCreateForm({ ...createForm, groundId: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#FF8C1A]"
                >
                  {grounds.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.city || (g.slug?.includes('playnow') ? 'Gurugram' : 'Faridabad')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Sport</label>
                  <select
                    value={createForm.sport}
                    onChange={(e) => setCreateForm({ ...createForm, sport: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#FF8C1A]"
                  >
                    <option value="Cricket">Cricket</option>
                    <option value="Football">Football</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Skill Level</label>
                  <select
                    value={createForm.skillLevel}
                    onChange={(e) => setCreateForm({ ...createForm, skillLevel: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#FF8C1A]"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced / Pro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Match Date</label>
                  <input
                    type="date"
                    required
                    value={createForm.date}
                    onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#FF8C1A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Time Period / Slot</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10:00 AM – 02:00 PM"
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#FF8C1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Entry Fee (₹ per player)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={createForm.entryFee}
                    onChange={(e) => setCreateForm({ ...createForm, entryFee: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#FF8C1A]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Total Capacity (Players)</label>
                  <input
                    type="number"
                    min="2"
                    max="50"
                    required
                    value={createForm.totalPlayers}
                    onChange={(e) => setCreateForm({ ...createForm, totalPlayers: parseInt(e.target.value, 10) || 22 })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-[#FF8C1A]"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF8C1A] to-[#FF9933] text-white font-bold shadow-md hover:opacity-95 disabled:opacity-50 cursor-pointer"
                >
                  {createLoading ? 'Publishing Match...' : 'Publish Live Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Match Roster Inspection Modal ─────────────────────────── */}
      {rosterModalOpen && selectedMatch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-poppins font-bold text-base text-slate-900">
                  Player Roster & Match Details
                </h3>
                <p className="text-xs text-slate-500">{selectedMatch.ground?.name} • {selectedMatch.date}</p>
              </div>
              <button
                onClick={() => setRosterModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              {/* Team A */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 uppercase">Team A</span>
                  <span className="text-[11px] font-bold text-blue-700">
                    {selectedMatch.teamA?.length || 0} Players
                  </span>
                </div>
                {(!selectedMatch.teamA || selectedMatch.teamA.length === 0) ? (
                  <p className="text-slate-400 text-center py-4">No players joined Team A yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedMatch.teamA.map((p: any, idx: number) => (
                      <div key={idx} className="p-2 rounded-lg bg-white border border-blue-100 flex items-center justify-between">
                        <span className="font-medium text-slate-800">{p.name || `Player ${idx + 1}`}</span>
                        <span className="text-[10px] text-slate-400">{p.joinedAt ? new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Confirmed'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Team B */}
              <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-orange-900 uppercase">Team B</span>
                  <span className="text-[11px] font-bold text-[#FF8C1A]">
                    {selectedMatch.teamB?.length || 0} Players
                  </span>
                </div>
                {(!selectedMatch.teamB || selectedMatch.teamB.length === 0) ? (
                  <p className="text-slate-400 text-center py-4">No players joined Team B yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedMatch.teamB.map((p: any, idx: number) => (
                      <div key={idx} className="p-2 rounded-lg bg-white border border-orange-100 flex items-center justify-between">
                        <span className="font-medium text-slate-800">{p.name || `Player ${idx + 1}`}</span>
                        <span className="text-[10px] text-slate-400">{p.joinedAt ? new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Confirmed'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setRosterModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancel Match Modal ────────────────────────────────────── */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-poppins font-bold text-base text-rose-600 flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span>
              Cancel Live Match
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cancelling this match will change its status to <strong>Cancelled</strong> and automatically refund entry fees to all joined players' digital wallets.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for cancellation</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Inclement weather / Ground maintenance"
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Keep Match
              </button>
              <button
                type="button"
                disabled={cancelLoading}
                onClick={handleCancelMatch}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
