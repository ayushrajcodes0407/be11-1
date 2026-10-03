import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLocationStore } from '../store/locationStore.js';
import { normalizeVenuesList } from '../utils/venueUtils.js';
import { GroundDTO } from '@be11/shared';
import { calculateHaversineDistance, Coordinates } from '../utils/geo.js';

export const Venues: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedCity, setCity } = useLocationStore();

  const initialSport = searchParams.get('sport') || 'All';
  const initialSearch = searchParams.get('search') || '';

  const [sport, setSport] = useState(initialSport);
  const [search, setSearch] = useState(initialSearch);
  const [sortByNearest, setSortByNearest] = useState(false);
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null);
  const [geoStatusMsg, setGeoStatusMsg] = useState('');

  const [date] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [grounds, setGrounds] = useState<GroundDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const mapInstanceRef = useRef<any>(null);

  // Sync URL query params with location store
  const urlCity = searchParams.get('city') || searchParams.get('location');
  useEffect(() => {
    if (urlCity && urlCity !== selectedCity) {
      setCity(urlCity);
    }
  }, [urlCity, selectedCity, setCity]);

  const fetchGrounds = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (sport !== 'All') params.sport = sport;
      if (selectedCity && selectedCity !== 'All') params.city = selectedCity;
      if (search) params.search = search;

      const res = await api.get('/grounds', { params });
      const rawGrounds: GroundDTO[] = res.data.data.grounds || [];
      const normalizedGrounds = normalizeVenuesList<GroundDTO>(rawGrounds);
      setGrounds(normalizedGrounds);
    } catch (err: any) {
      console.error(err);
      setError('Failed to retrieve venues. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrounds();
  }, [sport, selectedCity, searchParams]);

  // Request browser geolocation
  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatusMsg('Geolocation is not supported by your browser.');
      return;
    }
    setGeoStatusMsg('Detecting user location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setUserCoords(coords);
        setSortByNearest(true);
        setGeoStatusMsg('Location detected! Venues sorted by geographic proximity.');
      },
      (err) => {
        console.error(err);
        setGeoStatusMsg('Location access is disabled. Please select your location manually.');
      }
    );
  };

  // City center coordinates for Haryana / NCR fallback
  const CITY_COORDINATES: Record<string, Coordinates> = {
    Faridabad: { latitude: 28.4089, longitude: 77.3178 },
    Gurugram: { latitude: 28.4595, longitude: 77.0266 },
    Haryana: { latitude: 28.4089, longitude: 77.3178 },
  };

  // Compute calculated distance for grounds using GPS or city fallback
  const effectiveCoords = userCoords || CITY_COORDINATES[selectedCity] || CITY_COORDINATES['Faridabad'];

  const groundsWithDistance = grounds.map((g) => {
    let distanceKm: number | null = null;
    if (effectiveCoords && g.latitude && g.longitude) {
      distanceKm = calculateHaversineDistance(
        effectiveCoords.latitude,
        effectiveCoords.longitude,
        g.latitude,
        g.longitude
      );
    }
    return { ...g, distanceKm };
  });

  const displayedGrounds = [...groundsWithDistance].sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) {
      return a.distanceKm - b.distanceKm;
    }
    return 0;
  });

  // Leaflet Map initialization with Auto-fit Bounds
  useEffect(() => {
    if (viewMode !== 'map' || grounds.length === 0) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    const L = (window as any).L;
    if (!L) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const centerLat = grounds[0]?.latitude || 28.441139;
    const centerLng = grounds[0]?.longitude || 77.377944;

    const map = L.map('map-container').setView([centerLat, centerLng], 12);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const markerBounds: [number, number][] = [];

    displayedGrounds.forEach((g) => {
      if (!g.latitude || !g.longitude) return;

      markerBounds.push([g.latitude, g.longitude]);
      const venuePath = `/venues/${g.slug || g.id}?date=${date}`;
      const priceText = g.pricingLabel || (g.pricePerHour > 0 ? `₹${g.pricePerHour}/hr` : 'Price on request');
      const directionsUrl = g.mapsUrl || `https://maps.google.com/?q=${g.latitude},${g.longitude}`;
      const distanceBadge = g.distanceKm !== null ? `📍 ${g.distanceKm} km away` : `📍 ${g.location}`;

      const popupHtml = `
        <div style="font-family: 'Poppins', sans-serif; min-width: 220px; padding: 6px; text-align: left;">
          <h4 style="font-weight: bold; font-size: 14px; margin: 0 0 4px 0; color: #0A2E6E;">${g.name}</h4>
          <p style="font-size: 11px; color: #64748B; margin: 0 0 8px 0;">
            ${distanceBadge}
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 10px; font-weight: bold;">
            <span style="color: #e07f24;">${priceText}</span>
            <span style="color: #64748B; font-size: 10px;">${g.rating > 0 ? `⭐ ${g.rating}` : 'Verified Venue'}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <a href="${venuePath}" style="flex: 1; text-align: center; text-decoration: none; background: #0A2E6E; color: white; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: bold;">
              Book Now
            </a>
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="text-align: center; text-decoration: none; background: #EDF2F7; color: #0A2E6E; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: bold;">
              Directions
            </a>
          </div>
        </div>
      `;

      L.marker([g.latitude, g.longitude]).addTo(map).bindPopup(popupHtml);
    });

    if (markerBounds.length > 1) {
      map.fitBounds(markerBounds, { padding: [40, 40] });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [viewMode, grounds, date, sortByNearest, userCoords]);

  const handleApplySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ sport, city: selectedCity, search });
  };

  return (
    <div className="pt-24 min-h-screen bg-surface-container-low pb-16">
      <div className="max-w-7xl mx-auto px-container-padding">
        {/* Search header filter panel */}
        <div className="bg-white rounded-24 p-6 shadow-sm border border-outline-variant/30 mb-8 text-left">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
            <h2 className="font-poppins font-bold text-xl text-primary">Search Approved Sports Venues</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRequestLocation}
                className="px-4 py-2 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">my_location</span>
                Use My Location
              </button>
              {userCoords && (
                <button
                  type="button"
                  onClick={() => setSortByNearest(!sortByNearest)}
                  className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    sortByNearest ? 'bg-secondary-container text-white border-secondary-container' : 'bg-white text-primary border-outline-variant'
                  }`}
                >
                  Sort by Nearest
                </button>
              )}
            </div>
          </div>

          {geoStatusMsg && (
            <p className="text-xs text-primary/80 mb-4 bg-primary/5 p-2.5 rounded-lg font-semibold">
              {geoStatusMsg}
            </p>
          )}

          <form onSubmit={handleApplySearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider block mb-1">
                Where (City / Region)
              </label>
              <select
                value={selectedCity}
                onChange={(e) => {
                  setCity(e.target.value);
                  setSearchParams({ sport, city: e.target.value, search });
                }}
                className="w-full bg-[#EDF2F7] rounded-xl px-4 py-2.5 border border-transparent focus:border-primary focus:ring-0 transition-all font-body-md appearance-none"
              >
                <option value="All">All Locations</option>
                <option value="Faridabad">Faridabad</option>
                <option value="Haryana">Haryana (All State)</option>
                <option value="Gurugram">Gurugram</option>
                <option value="Delhi">Delhi</option>
                <option value="Noida">Noida</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Bengaluru">Bengaluru</option>
                <option value="Hyderabad">Hyderabad</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider block mb-1">
                Sport Type
              </label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="w-full bg-[#EDF2F7] rounded-xl px-4 py-2.5 border border-transparent focus:border-primary focus:ring-0 transition-all font-body-md appearance-none"
              >
                <option value="All">All Sports</option>
                <option value="Cricket">Cricket</option>
                <option value="Football">Football</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-outline uppercase tracking-wider block mb-1">
                Venue Name / Keywords
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#EDF2F7] rounded-xl px-4 py-2.5 border border-transparent focus:border-primary focus:ring-0 transition-all font-body-md"
                placeholder="RRR, Playnow, AB..."
              />
            </div>
            <button
              type="submit"
              className="w-full bg-secondary-container hover:bg-[#e07f24] text-white py-3 rounded-xl font-label-bold btn-primary-premium shadow-md flex justify-center items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-white">search</span>
              Filter Venues
            </button>
          </form>
        </div>

        {/* Results grid header & View Toggle */}
        <div className="flex justify-between items-center mb-6 text-left">
          <div>
            <h3 className="font-poppins font-bold text-lg text-primary">
              {loading ? 'Searching...' : `${displayedGrounds.length} Verified Venues Available`}
            </h3>
            <p className="text-xs text-on-surface-variant">Real sports facilities ready for instant match booking</p>
          </div>

          <div className="flex bg-[#EDF2F7] p-1 rounded-xl border border-outline-variant/30">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-sm">format_list_bulleted</span>
              List View
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'map' ? 'bg-primary text-white shadow-sm' : 'text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-sm">map</span>
              Map View
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm font-semibold mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-24 h-[420px] animate-pulse">
                <div className="h-60 bg-gray-200 rounded-t-24"></div>
                <div className="p-6 space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-10 bg-gray-200 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : displayedGrounds.length === 0 ? (
          /* Production Clean Empty State (No Dummy Fallbacks) */
          <div className="bg-white rounded-24 p-12 text-center shadow-sm border border-outline-variant/30 max-w-2xl mx-auto my-8 space-y-4">
            <span className="material-symbols-outlined text-5xl text-secondary-container">location_off</span>
            <h3 className="font-poppins font-black text-2xl text-primary uppercase tracking-tight">
              NO VERIFIED VENUES AVAILABLE
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              BE11 is currently live with 3 verified grounds in <strong>Faridabad, Haryana</strong>. We do not display fake listings.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <button
                onClick={() => {
                  setCity('Faridabad');
                  setSearchParams({ sport: 'All', city: 'Faridabad', search: '' });
                }}
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-xs btn-primary-premium shadow cursor-pointer"
              >
                Explore Faridabad Venues
              </button>
              <button
                onClick={() => {
                  setCity('Haryana');
                  setSearchParams({ sport: 'All', city: 'Haryana', search: '' });
                }}
                className="px-6 py-3 rounded-xl bg-[#EDF2F7] text-primary font-bold text-xs hover:bg-[#E2E8F0] cursor-pointer"
              >
                View All Haryana Venues
              </button>
            </div>
          </div>
        ) : viewMode === 'map' ? (
          <div className="space-y-6">
            <div
              id="map-container"
              className="w-full h-[550px] bg-white rounded-24 shadow-sm border border-outline-variant/30 overflow-hidden relative"
              style={{ zIndex: 1 }}
            ></div>

            {/* Dynamic Nearby Venues Panel under Map */}
            <div className="bg-white rounded-24 p-6 shadow-sm border border-outline-variant/30 text-left">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="font-poppins font-bold text-base text-primary">Venues Near You</h4>
                  <p className="text-xs text-on-surface-variant">Real sports facilities sorted by geographical distance</p>
                </div>
                {userCoords && (
                  <span className="text-xs font-bold text-secondary-container bg-surface-container px-3 py-1 rounded-full">
                    GPS Active
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {displayedGrounds.map((g) => {
                  const venuePath = `/venues/${g.slug || g.id}?date=${date}`;
                  const imagesList = Array.isArray(g.images) ? g.images : typeof g.images === 'string' ? JSON.parse(g.images) : [];
                  const heroImg = imagesList[0] || 'https://images.unsplash.com/photo-1540747737956-37872f84a62f?auto=format&fit=crop&w=600&q=80';

                  return (
                    <div
                      key={g.id}
                      onClick={() => navigate(venuePath)}
                      className="bg-[#F8FAFC] rounded-xl p-4 border border-outline-variant/20 hover:border-primary transition-all cursor-pointer flex gap-4 items-center"
                    >
                      <img src={heroImg} alt={g.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h5 className="font-bold text-primary text-xs truncate">{g.name}</h5>
                        <p className="text-[11px] text-outline truncate">{g.location}</p>
                        {g.distanceKm !== null ? (
                          <span className="text-[10px] font-bold text-secondary-container block mt-1">
                            📍 {g.distanceKm} km away
                          </span>
                        ) : (
                          <span className="text-[10px] text-on-surface-variant block mt-1">
                            {g.pricingLabel || (g.pricePerHour > 0 ? `₹${g.pricePerHour}/hr` : 'Price on request')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {displayedGrounds.map((g) => {
              const venuePath = `/venues/${g.slug || g.id}?date=${date}`;
              const displayPrice = g.pricingLabel || (g.pricePerHour > 0 ? `₹${g.pricePerHour}/hr` : 'Price on request');
              const imagesList = Array.isArray(g.images) ? g.images : typeof g.images === 'string' ? JSON.parse(g.images) : [];
              const heroImg = imagesList[0] || 'https://images.unsplash.com/photo-1540747737956-37872f84a62f?auto=format&fit=crop&w=600&q=80';
              const amenitiesList = Array.isArray(g.amenities) ? g.amenities : typeof g.amenities === 'string' ? JSON.parse(g.amenities) : [];
              const directionsUrl = g.mapsUrl || `https://maps.google.com/?q=${g.latitude},${g.longitude}`;

              return (
                <div
                  key={g.id}
                  className="bg-white rounded-24 overflow-hidden shadow-sm premium-card group cursor-pointer flex flex-col justify-between text-left"
                  onClick={() => navigate(venuePath)}
                >
                  <div>
                    <div className="relative h-60 overflow-hidden">
                      <img
                        className="w-full h-full object-cover"
                        alt={g.name}
                        src={heroImg}
                      />
                      {g.distanceKm !== null ? (
                        <div className="absolute top-4 left-4 bg-primary text-white text-[11px] font-bold px-3 py-1 rounded-full shadow">
                          📍 {g.distanceKm} km away
                        </div>
                      ) : null}
                      {g.rating > 0 ? (
                        <div className="absolute top-4 right-4 glass-panel px-3 py-1.5 rounded-full flex items-center gap-1">
                          <span
                            className="material-symbols-outlined text-secondary-container"
                            style={{ fontVariationSettings: '"FILL" 1' }}
                          >
                            star
                          </span>
                          <span className="text-label-bold text-primary">{g.rating}</span>
                        </div>
                      ) : (
                        <div className="absolute top-4 right-4 bg-primary/90 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                          Verified Venue
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <h3 className="font-headline-md text-primary text-xl font-bold line-clamp-1">{g.name}</h3>
                        <span className="text-on-tertiary-container font-label-bold font-bold text-sm shrink-0">
                          {displayPrice}
                        </span>
                      </div>
                      <p className="text-on-surface-variant text-label-sm flex items-center gap-1 mb-4 text-xs">
                        <span className="material-symbols-outlined text-sm">location_on</span>{' '}
                        {g.location}
                      </p>
                      <div className="flex gap-2 flex-wrap mb-6">
                        {amenitiesList.slice(0, 4).map((am: string) => (
                          <span
                            key={am}
                            className="bg-surface-container px-3 py-1 rounded-full text-label-sm text-outline text-xs"
                          >
                            {am}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-6 pt-0 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(venuePath);
                      }}
                      className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-label-bold btn-primary-premium cursor-pointer text-xs"
                    >
                      Book Now
                    </button>
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-4 py-3 rounded-xl bg-[#EDF2F7] hover:bg-[#E2E8F0] text-primary font-label-bold flex items-center justify-center text-xs transition-colors"
                      title="Get Directions"
                    >
                      <span className="material-symbols-outlined text-base">near_me</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};


