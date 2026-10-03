import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useLocationStore } from '../store/locationStore.js';
import { normalizeVenuesList } from '../utils/venueUtils.js';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCity, setCity } = useLocationStore();
  const [sport, setSport] = useState('Cricket');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await api.get('/matches');
        const list = res.data.data.matches || [];
        const counts: Record<string, number> = {};
        list.forEach((m: any) => {
          const sportKey = m.sport.toLowerCase();
          counts[sportKey] = (counts[sportKey] || 0) + 1;
        });
        setMatchCounts(counts);
      } catch (err) {
        console.error('Failed to load dynamic match counts', err);
      }
    };
    fetchCounts();
  }, []);


  // Popular grounds state
  const [popularGrounds, setPopularGrounds] = useState<any[]>([]);
  const [groundsLoading, setGroundsLoading] = useState(false);

  useEffect(() => {
    const fetchPopular = async () => {
      setGroundsLoading(true);
      try {
        const res = await api.get('/grounds', { params: { city: selectedCity } });
        const normalized = normalizeVenuesList(res.data.data.grounds || []);
        setPopularGrounds(normalized.slice(0, 3));
      } catch (err) {
        console.error(err);
      } finally {
        setGroundsLoading(false);
      }
    };
    fetchPopular();
  }, [selectedCity]);

  const handleSearch = () => {
    navigate(`/venues?city=${selectedCity}&sport=${sport}&date=${date}`);
  };



  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden">
        {/* Abstract Background Effects */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-secondary-container/20 rounded-full blur-[100px] ambient-blob"></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-tertiary-fixed-dim/20 rounded-full blur-[100px] ambient-blob" style={{ animationDelay: '-5s' }}></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-container-padding text-center py-12">
          <h1 className="font-display-hero text-headline-lg-mobile md:text-display-hero text-primary mb-6 leading-tight" id="hero-title">
            <span className="text-secondary-container text-glow-saffron reveal-item inline-block revealed">PLAY.</span>{' '}
            <span className="reveal-item inline-block revealed">COMPETE.</span>
            <br />
            <span className="reveal-item inline-block revealed">CELEBRATE. BOOK.</span>{' '}
            <span className="text-secondary-container reveal-item inline-block revealed">PLAY.</span>
            <br />
            <span className="text-on-tertiary-container text-glow-green reveal-item inline-block revealed">REPEAT.</span>
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter max-w-4xl mx-auto mb-16 parallax-container">
            <div
              onClick={() => navigate('/live-matches?sport=cricket')}
              className="relative group h-64 rounded-24 overflow-hidden shadow-xl reveal-item premium-card revealed cursor-pointer"
            >
              <img
                alt="Cricket drive"
                className="w-full h-full object-cover parallax-target"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCCktuQJiB5YK1PcpS264lRBn9MXiWoG-LWr3H5CPfHnGL5Zzkn9uFyarH2-OVe0jSMMzrNPNvAj7CFCpAE9VIo0t98HDbdberfN9vjlFkILL_jg6ToHsf-KDp0Jbv5a9jyUzdV6ZiNecsab3EYl0enzzNjHFWxjw1yJgDQy327bAoT8shwnZzhg0Q8iFDUgwIJ_SQs03abs9oJmSy4d9ni3bTSMdekfGSNQXssuMES8aI1oW0e60lp"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
              <div className="absolute bottom-6 left-6 text-left">
                <span className="bg-secondary-container text-on-secondary px-3 py-1 rounded-full text-label-sm mb-2 inline-block">
                  Cricket
                </span>
                <h3 className="text-white font-headline-md font-bold text-xl">Master the Crease</h3>
              </div>
            </div>

            <div
              onClick={() => navigate('/live-matches?sport=football')}
              className="relative group h-64 rounded-24 overflow-hidden shadow-xl reveal-item premium-card revealed cursor-pointer"
            >
              <img
                alt="Football shoot"
                className="w-full h-full object-cover parallax-target"
                src="https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&w=600&q=80"
                onError={(e) => {
                  e.currentTarget.src = "https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&w=600&q=80";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
              <div className="absolute bottom-6 left-6 text-left">
                <span className="bg-on-tertiary-container text-on-primary px-3 py-1 rounded-full text-label-sm mb-2 inline-block">
                  Football
                </span>
                <h3 className="text-white font-headline-md font-bold text-xl">Control the Pitch</h3>
              </div>
            </div>
          </div>

          {/* Floating Search Card */}
          <div className="glass-panel max-w-5xl mx-auto p-2 rounded-[32px] shadow-2xl border border-white/40 reveal-item focus-scale revealed">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-left">
              <div className="px-6 py-4 flex flex-col items-start border-r border-outline-variant/30 group w-full">
                <span className="text-label-sm text-outline font-bold uppercase tracking-wider mb-1">
                  Where
                </span>
                <div className="flex items-center gap-2 w-full">
                  <span className="material-symbols-outlined text-primary">location_on</span>
                  <select
                    value={selectedCity}
                    onChange={(e) => setCity(e.target.value)}
                    className="bg-transparent border-none p-0 focus:ring-0 w-full font-label-bold focus:outline-none appearance-none cursor-pointer text-sm"
                  >
                    <option value="Mumbai">Mumbai</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Pune">Pune</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Chennai">Chennai</option>
                    <option value="Kolkata">Kolkata</option>
                    <option value="Ahmedabad">Ahmedabad</option>
                    <option value="Ranchi">Ranchi</option>
                    <option value="Deoghar">Deoghar</option>
                    <option value="Dhanbad">Dhanbad</option>
                    <option value="Patna">Patna</option>
                    <option value="Lucknow">Lucknow</option>
                    <option value="Jaipur">Jaipur</option>
                    <option value="Indore">Indore</option>
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 flex flex-col items-start border-r border-outline-variant/30 group">
                <span className="text-label-sm text-outline font-bold uppercase tracking-wider mb-1">
                  Sport
                </span>
                <div className="flex items-center gap-2 w-full">
                  <span className="material-symbols-outlined text-primary">sports_cricket</span>
                  <select
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    className="bg-transparent border-none p-0 focus:ring-0 w-full font-label-bold appearance-none focus:outline-none text-sm cursor-pointer"
                  >
                    <option value="Cricket">Cricket</option>
                    <option value="Football">Football</option>
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 flex flex-col items-start border-r border-outline-variant/30 group">
                <span className="text-label-sm text-outline font-bold uppercase tracking-wider mb-1">
                  When
                </span>
                <div className="flex items-center gap-2 w-full">
                  <span className="material-symbols-outlined text-primary">calendar_today</span>
                  <input
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent border-none p-0 focus:ring-0 w-full font-label-bold focus:outline-none text-sm cursor-pointer"
                    type="date"
                  />
                </div>
              </div>

              <div className="p-2">
                <button
                  onClick={handleSearch}
                  className="bg-secondary-container hover:bg-[#e07f24] w-full h-full rounded-24 flex items-center justify-center gap-2 text-white font-label-bold shadow-lg btn-primary-premium cursor-pointer py-3 md:py-0"
                >
                  <span className="material-symbols-outlined text-white">search</span>
                  Explore Venues
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Choose Your Game */}
      <section className="py-16 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-[#102A56] uppercase tracking-wider mb-2">Choose Your Game</h2>
          <div className="w-16 h-1 bg-[#FF8C1A] mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl mx-auto">
          {[
            { key: 'cricket', label: 'Cricket', title: 'Master the Crease', desc: 'Premium pitches & scoreboard tracking.', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=600&q=80' },
            { key: 'football', label: 'Football', title: 'Control the Pitch', desc: 'FIFA-grade synthetic turfs & leagues.', image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80' },
          ].map((s) => {
            const count = matchCounts[s.key] || 0;
            return (
              <div
                key={s.key}
                role="link"
                tabIndex={0}
                aria-label={`Explore live open ${s.label} matches: ${s.title}`}
                onClick={() => navigate(`/live-matches?sport=${s.key}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/live-matches?sport=${s.key}`);
                  }
                }}
                className="relative group rounded-3xl overflow-hidden h-[340px] bg-slate-950 shadow-lg cursor-pointer transform hover:-translate-y-2 hover:shadow-2xl transition-all duration-500 border border-white/5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {/* Background image with zoom */}
                <img
                  className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-60 group-hover:scale-110 transition-transform duration-700 pointer-events-none"
                  alt={`${s.label} category card`}
                  src={s.image}
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent"></div>
                
                {/* Floating Matches Count Badge */}
                {count > 0 && (
                  <span className="absolute top-4 left-4 bg-[#FF8C1A] text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md animate-pulse">
                    🔥 {count} {count === 1 ? 'Match' : 'Matches'} Today
                  </span>
                )}

                {/* Content */}
                <div className="absolute inset-x-6 bottom-6 flex flex-col justify-end text-left space-y-1.5 z-10">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">
                    {s.label}
                  </span>
                  <h3 className="font-poppins font-black text-base text-white leading-tight transition-transform duration-300 group-hover:-translate-y-1">
                    {s.title}
                  </h3>
                  <p className="text-gray-400 text-[10px] font-light leading-relaxed">
                    {s.desc}
                  </p>
                  
                  {/* Explore CTA fades in on hover */}
                  <div className="pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1.5 text-[#FF8C1A] text-[10px] font-bold uppercase tracking-wider">
                    Explore Live Matches
                    <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">arrow_right_alt</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Popular Near You */}
      <section className="bg-surface-container-low py-section-gap">
        <div className="px-container-padding max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4 text-left reveal-item revealed">
            <div>
              <h2 className="font-headline-lg text-primary text-3xl font-bold">Popular Venues Near You</h2>
              <p className="text-on-surface-variant text-body-lg text-sm">Curated real cricket grounds & sports venues in Faridabad</p>
            </div>
            <button
              onClick={() => navigate('/venues')}
              className="flex items-center gap-2 text-primary font-label-bold group transition-all cursor-pointer"
            >
              View All{' '}
              <span className="material-symbols-outlined transition-transform group-hover:translate-x-2">
                chevron_right
              </span>
            </button>
          </div>

          {groundsLoading ? (
            <p className="text-left text-on-surface-variant text-sm">Loading popular arenas...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {popularGrounds.map((g) => {
                const venuePath = `/venues/${g.slug || g.id}?date=${date}`;
                const displayPrice = g.pricingLabel || (g.pricePerHour > 0 ? `₹${g.pricePerHour}/hr` : 'Price on request');
                const imagesList = Array.isArray(g.images) ? g.images : typeof g.images === 'string' ? JSON.parse(g.images) : [];
                const heroImg = imagesList[0] || 'https://images.unsplash.com/photo-1540747737956-37872f84a62f?auto=format&fit=crop&w=600&q=80';
                const amenitiesList = Array.isArray(g.amenities) ? g.amenities : typeof g.amenities === 'string' ? JSON.parse(g.amenities) : [];

                return (
                  <div
                    key={g.id}
                    onClick={() => navigate(venuePath)}
                    className="bg-white rounded-24 overflow-hidden shadow-sm premium-card group reveal-item revealed cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-60 overflow-hidden">
                        <img className="w-full h-full object-cover" alt={g.name} src={heroImg} />
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
                            New Venue
                          </div>
                        )}
                      </div>
                      <div className="p-card-inner p-6">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <h3 className="font-headline-md text-primary text-xl font-bold line-clamp-1">{g.name}</h3>
                          <span className="text-on-tertiary-container font-label-bold font-bold text-sm shrink-0">
                            {displayPrice}
                          </span>
                        </div>
                        <p className="text-on-surface-variant text-label-sm flex items-center gap-1 mb-4 text-xs">
                          <span className="material-symbols-outlined text-sm">location_on</span> {g.location}
                        </p>
                        <div className="flex gap-2 flex-wrap mb-6">
                          {amenitiesList.slice(0, 3).map((am: string) => (
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
                    <div className="px-6 pb-6">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(venuePath);
                        }}
                        className="w-full py-3 rounded-xl bg-primary text-on-primary font-label-bold btn-primary-premium cursor-pointer"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Gear Up Section */}
      <section className="py-section-gap px-container-padding max-w-7xl mx-auto overflow-hidden">
        <div className="mb-12 text-left reveal-item revealed">
          <h2 className="font-headline-lg text-primary text-3xl font-bold">Gear Up. Play Better.</h2>
          <p className="text-on-surface-variant text-body-lg text-sm">Professional equipment for the serious athlete.</p>
        </div>

        {/* Patriotic Banner */}
        <div className="relative rounded-24 bg-primary p-8 md:p-12 mb-12 flex flex-col md:flex-row items-center justify-between shadow-2xl reveal-item overflow-hidden revealed">
          <div className="absolute inset-0 tricolor-border opacity-30 pointer-events-none"></div>
          <div className="relative z-10 max-w-lg text-left">
            <span className="text-tertiary-fixed font-label-bold uppercase tracking-widest text-xs mb-4 inline-block">
              India's Choice
            </span>
            <h3 className="text-white font-display-hero text-headline-lg-mobile md:text-headline-md text-2xl font-bold mb-6">
              The Nation's Pride Series Cricket Bats
            </h3>
            <p className="text-white/70 text-body-md text-sm mb-8">
              Hand-crafted Grade 1 English Willow bats with unique tri-color graphics. Power and
              heritage in every swing.
            </p>
            <button
              onClick={() => navigate('/store?category=BATS')}
              className="bg-white text-primary px-8 py-3 rounded-full font-label-bold btn-primary-premium cursor-pointer"
            >
              Shop The Collection
            </button>
          </div>
          <img
            className="relative z-10 h-64 md:h-80 w-auto object-contain mt-8 md:mt-0 drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-transform duration-700 hover:rotate-3 hover:scale-110"
            alt="Cricket willow bat"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuClfuShZkbe1THoZMjapBZQ-1c3ZkejvZKrVAlkQlF3jX4K7faUR7frRLzv6aak2wCBJeuqQPb1YhqQg4ykbrmi5f8TGu6xrCHv0K4FaCHGqyP5oXCBdyoDRf0_TFWq5bYmR_jqpLN-XGJGBDhpiKmq-bz56q1aC5xq1D9wO33JVbmwrHb1Rw89U0aeFClNpABHI1fYj8_FB2rTkxhDGgvosuIR05TEYDXRAYcH7lJWy4AdoKQBP2Cv"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div
            onClick={() => navigate('/store?category=BATS')}
            className="bg-white rounded-24 p-6 shadow-sm premium-card text-center group cursor-pointer reveal-item revealed"
          >
            <div className="w-24 h-24 bg-surface rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-4xl">sports_cricket</span>
            </div>
            <h4 className="font-label-bold text-primary font-semibold">Bats</h4>
          </div>
          <div
            onClick={() => navigate('/store?category=BALLS')}
            className="bg-white rounded-24 p-6 shadow-sm premium-card text-center group cursor-pointer reveal-item revealed"
          >
            <div className="w-24 h-24 bg-surface rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-4xl">sports_baseball</span>
            </div>
            <h4 className="font-label-bold text-primary font-semibold">Balls</h4>
          </div>
          <div
            onClick={() => navigate('/store?category=SHOES')}
            className="bg-white rounded-24 p-6 shadow-sm premium-card text-center group cursor-pointer reveal-item revealed"
          >
            <div className="w-24 h-24 bg-surface rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-4xl">ice_skating</span>
            </div>
            <h4 className="font-label-bold text-primary font-semibold">Shoes</h4>
          </div>
          <div
            onClick={() => navigate('/store')}
            className="bg-white rounded-24 p-6 shadow-sm premium-card text-center group cursor-pointer reveal-item revealed"
          >
            <div className="w-24 h-24 bg-surface rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-4xl">backpack</span>
            </div>
            <h4 className="font-label-bold text-primary font-semibold">Bags</h4>
          </div>
        </div>
      </section>

      {/* Custom Jersey Builder */}
      <section className="py-section-gap bg-primary text-white overflow-hidden">
        <div className="px-container-padding max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 text-left reveal-item revealed">
            <h2 className="font-display-hero text-headline-lg-mobile md:text-headline-lg text-3xl font-bold mb-6">
              Design Your Team Jersey
            </h2>
            <p className="text-white/70 text-body-lg text-sm mb-8 font-normal leading-relaxed">
              Professional sublimation printing on high-performance moisture-wicking fabric. Bring
              your team's identity to life with our interactive builder.
            </p>
            <ul className="space-y-4 mb-10 text-sm">
              <li className="flex items-center gap-3 transition-all duration-300 hover:translate-x-2">
                <span className="material-symbols-outlined text-tertiary-fixed">check_circle</span>
                <span>Official Indian Team inspired color palettes</span>
              </li>
              <li className="flex items-center gap-3 transition-all duration-300 hover:translate-x-2">
                <span className="material-symbols-outlined text-tertiary-fixed">check_circle</span>
                <span>Custom Logo &amp; Name Printing</span>
              </li>
              <li className="flex items-center gap-3 transition-all duration-300 hover:translate-x-2">
                <span className="material-symbols-outlined text-tertiary-fixed">check_circle</span>
                <span>Bulk Team Discounts</span>
              </li>
            </ul>
            <button
              onClick={() => navigate('/jersey-builder')}
              className="bg-secondary-container text-white px-10 py-4 rounded-full font-label-bold text-md btn-primary-premium shadow-xl cursor-pointer"
            >
              Start Designing
            </button>
          </div>
          <div className="flex-1 relative group reveal-item revealed">
            <div className="absolute inset-0 bg-secondary-container/20 rounded-full blur-[120px] ambient-blob"></div>
            <img
              className="relative z-10 w-full max-w-md mx-auto transition-all duration-1000 transform group-hover:scale-105 group-hover:rotate-2 drop-shadow-[0_30px_60px_rgba(0,0,0,0.4)]"
              alt="Athletic jersey mock-up"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBur42bD5AWNaRxnKSSh9h8Wf35dy48aMfq8EFaMPmYsz1f1VMz0OGGKBODXSesT1TS4tRUezAoS9phjZQ8MKyrAujVD765PTHqNl1xLOCNPOZ9sstzpELyttBfea7cKpzlTFCTAU7nuQ1pHWwIbJ6jJCQpB2H1i6KK8-_s_K6ouDCWOzZw5SpP70bO8-QlnnH-9TpqtcC4XyD2uKt6Yl-ev69zJwW-p2LcEW8ppGlKgo8ntj23kmGD"
            />
          </div>
        </div>
      </section>

      {/* Cricket Kit Builder */}
      <section className="py-section-gap px-container-padding max-w-7xl mx-auto">
        <div className="text-center mb-16 reveal-item revealed">
          <h2 className="font-headline-lg text-primary text-3xl font-bold mb-4">Complete Cricket Kits</h2>
          <p className="text-on-surface-variant text-body-lg text-sm">
            Curated bundles to save you time and money.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Starter Kit */}
          <div className="bg-white rounded-24 p-10 border border-outline-variant/30 flex flex-col md:flex-row gap-8 items-center text-left premium-card reveal-item revealed">
            <div className="md:w-1/2">
              <span className="bg-surface-container px-3 py-1 rounded-full text-label-sm text-outline text-xs mb-4 inline-block">
                The Starter
              </span>
              <h3 className="font-headline-md text-primary text-xl font-bold mb-2">Beginner Kit</h3>
              <p className="text-on-surface-variant text-sm mb-6">
                Perfect for recreational games and coaching sessions.
              </p>
              <div className="text-headline-md text-on-tertiary-container text-xl font-bold mb-6">
                ₹5,499
              </div>
              <button
                onClick={() => navigate('/kit-builder?type=starter')}
                className="w-full py-3 border-2 border-primary text-primary rounded-xl font-label-bold transition-all hover:bg-primary hover:text-white transform hover:translate-y-[-2px] cursor-pointer text-center"
              >
                Select Bundle
              </button>
            </div>
            <div className="md:w-1/2 overflow-hidden rounded-xl">
              <img
                className="w-full h-auto transition-transform duration-700 group-hover:scale-110"
                alt="Beginner Cricket Kit"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDV2RxaJfWjj1FZKH60XHD2n76KUdrzLkXjgdtnuj0BJVlamFRBexq48rOJ03zZHTN43qns71IdbYerSjgczf2RUECN9cAfei1-70ZhFz8Dv8LUJiBLWRmoTBD7lGFJJEM2s-4YoQy-2ayAkJ2R_Uvtcjjs4ff7nzBRJ1rCOE2Mb2ZQfUDeBve7nRnCSlNpK5THGONr_LPJPJw2QwEMq8XHzBol7Jc02cuDnRTp-lOMiUu-tiTBQEy-"
              />
            </div>
          </div>

          {/* Pro Kit */}
          <div className="bg-primary text-white rounded-24 p-10 flex flex-col md:flex-row gap-8 items-center text-left premium-card relative overflow-hidden reveal-item revealed">
            <div className="absolute top-0 right-0 p-4">
              <span className="bg-secondary-container text-white px-4 py-1 rounded-full text-label-sm font-bold animate-pulse text-xs">
                BEST SELLER
              </span>
            </div>
            <div className="md:w-1/2">
              <span className="bg-white/10 px-3 py-1 rounded-full text-label-sm text-white/80 text-xs mb-4 inline-block">
                The Professional
              </span>
              <h3 className="font-headline-md text-white text-xl font-bold mb-2">Elite Pro Kit</h3>
              <p className="text-white/70 text-sm mb-6">
                Premium English willow bat, pro-grade pads, gloves, and a wheeled kit bag.
              </p>
              <div className="text-headline-md text-secondary-fixed text-xl font-bold mb-6">
                ₹14,999
              </div>
              <button
                onClick={() => navigate('/kit-builder?type=pro')}
                className="w-full py-3 bg-white text-primary rounded-xl font-label-bold transition-all hover:bg-secondary-fixed transform hover:translate-y-[-2px] cursor-pointer text-center text-xs"
              >
                Select Bundle
              </button>
            </div>
            <div className="md:w-1/2 overflow-hidden rounded-xl">
              <img
                className="w-full h-auto transition-transform duration-700 group-hover:scale-110"
                alt="Elite Cricket Kit"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDw7dld1Z2-iX7dO9mXfF01e3Z4mPzD1_p_q7Kx6wJ04d80_4e0_9mXfD01e3Z4mPzD1_p_q7Kx6wJ04d80_4e0_9mXfD"
              />
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
