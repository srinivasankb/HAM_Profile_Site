import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useLocation
} from 'react-router-dom';
import {
  Radio,
  MapPin,
  Award,
  Cloud,
  Clock,
  Compass,
  Wind,
  Droplets,
  ExternalLink,
  Map as MapIcon,
  Info,
  Copy,
  Share2,
  Check,
  Sun,
  CloudRain,
  CloudLightning,
  CloudSun,
  Thermometer,
  Sunrise,
  Sunset
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Rectangle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const WEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const STATION = {
  name: "Rajapalayam",
  lat: 9.4503,
  lon: 77.5516,
  grid: "MJ89sk"
};

/**
 * Converts Decimal Latitude and Longitude to Maidenhead Grid Square
 */
function getMaidenhead(lat, lon) {
  let grid = "";
  let adjLon = lon + 180;
  let adjLat = lat + 90;

  grid += String.fromCharCode(65 + Math.floor(adjLon / 20)); // Field Lon
  grid += String.fromCharCode(65 + Math.floor(adjLat / 10)); // Field Lat

  grid += Math.floor((adjLon % 20) / 2); // Square Lon
  grid += Math.floor((adjLat % 10) / 1); // Square Lat

  let subLon = (adjLon % 2) / (2 / 24);
  let subLat = (adjLat % 1) / (1 / 24);

  grid += String.fromCharCode(97 + Math.floor(subLon)); // Sub Lon
  grid += String.fromCharCode(97 + Math.floor(subLat)); // Sub Lat

  return grid;
}

/**
 * Formats a grid square (e.g., MJ89sk)
 */
function formatGrid(grid) {
  if (!grid || typeof grid !== 'string') return '';
  const clean = grid.trim();
  if (clean.length === 6) {
    return clean.slice(0, 4).toUpperCase() + clean.slice(4).toLowerCase();
  }
  return clean.toUpperCase();
}

/**
 * Calculates the bounding box for a given grid square
 */
function getGridBounds(grid) {
  if (!grid) return null;
  grid = grid.toUpperCase();
  if (!/^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(grid)) return null;

  let minLon = (grid.charCodeAt(0) - 65) * 20 - 180;
  let minLat = (grid.charCodeAt(1) - 65) * 10 - 90;

  minLon += parseInt(grid[2]) * 2;
  minLat += parseInt(grid[3]) * 1;

  let maxLon, maxLat;

  if (grid.length === 6) {
    minLon += (grid.charCodeAt(4) - 65) * (2 / 24);
    minLat += (grid.charCodeAt(5) - 65) * (1 / 24);
    maxLon = minLon + (2 / 24);
    maxLat = minLat + (1 / 24);
  } else {
    maxLon = minLon + 2;
    maxLat = minLat + 1;
  }

  return [
    [minLat, minLon], // SW
    [maxLat, maxLon]  // NE
  ];
}

/**
 * Calculates UTC sunrise and sunset times for given lat/lon and date.
 * Based on the NOAA Solar Calculations algorithm.
 * Returns { sunrise: Date, sunset: Date }
 */
function getSunTimes(lat, lon, date = new Date()) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const JD = Math.floor(date.getTime() / 86400000) + 2440587.5;
  const n = JD - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = toRad((357.528 + 0.9856003 * n) % 360);
  const lambda = toRad(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const epsilon = toRad(23.439 - 0.0000004 * n);
  const sinDec = Math.sin(epsilon) * Math.sin(lambda);
  const dec = Math.asin(sinDec);

  const cosHA = (Math.cos(toRad(90.833)) - Math.sin(toRad(lat)) * sinDec) /
    (Math.cos(toRad(lat)) * Math.cos(dec));

  if (cosHA < -1 || cosHA > 1) return null; // polar day/night

  const HA = toDeg(Math.acos(cosHA));
  const EqT = 4 * (L - 0.0057183 - toDeg(Math.atan2(
    Math.sin(lambda) * Math.cos(epsilon), Math.cos(lambda)
  )) + 360 * Math.cos(epsilon) * Math.sin(lambda) / (2 * Math.PI));

  const solarNoonMin = 720 - 4 * lon - EqT;
  const sunriseMin = solarNoonMin - HA * 4;
  const sunsetMin = solarNoonMin + HA * 4;

  const toUtcDate = (minutesFromMidnightUtc) => {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    d.setTime(d.getTime() + minutesFromMidnightUtc * 60000);
    return d;
  };

  return { sunrise: toUtcDate(sunriseMin), sunset: toUtcDate(sunsetMin) };
}

// --- Home Profile Page ---
function ProfilePage() {
  const [weather, setWeather] = useState(null);
  const [time, setTime] = useState(new Date());
  const [units, setUnits] = useState(() => localStorage.getItem('pref_units') || 'metric');
  const [tzMode, setTzMode] = useState(() => localStorage.getItem('pref_tz') || 'utc');

  const toggleUnits = () => setUnits(u => {
    const next = u === 'metric' ? 'imperial' : 'metric';
    localStorage.setItem('pref_units', next);
    return next;
  });

  const toggleTz = () => setTzMode(t => {
    const next = t === 'utc' ? 'ist' : 'utc';
    localStorage.setItem('pref_tz', next);
    return next;
  });

  // Unit conversion helpers (API always returns metric)
  const toTemp = (c) => units === 'metric' ? `${Math.round(c)}°C` : `${Math.round(c * 9 / 5 + 32)}°F`;
  const toWind = (ms) => units === 'metric' ? `${ms} m/s` : `${(ms * 2.237).toFixed(1)} mph`;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const CACHE_KEY = `weather_${STATION.lat}_${STATION.lon}`;
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    const fetchWeather = async () => {
      // 1. Check LocalStorage Cache
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setWeather(data);
            return;
          }
        } catch (e) {
          localStorage.removeItem(CACHE_KEY);
        }
      }

      if (!WEATHER_API_KEY) {
        const mockData = {
          main: { temp: 31, humidity: 62 },
          weather: [{ description: 'partly cloudy', main: 'Clouds' }],
          wind: { speed: 4.1 },
          mock: true
        };
        setWeather(mockData);
        return;
      }

      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${STATION.lat}&lon=${STATION.lon}&appid=${WEATHER_API_KEY}&units=metric`
        );
        const data = await response.json();

        if (response.ok) {
          setWeather(data);
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        console.error("Weather fetch error:", err);
      }
    };
    fetchWeather();
  }, []);

  const getWeatherIcon = (condition) => {
    const main = condition?.main?.toLowerCase();
    const desc = condition?.description?.toLowerCase();

    if (main === 'clear') return <Sun size={48} className="weather-icon-sun" />;
    if (main === 'clouds') {
      if (desc?.includes('few') || desc?.includes('scattered')) return <CloudSun size={48} className="weather-icon-cloudy" />;
      return <Cloud size={48} className="weather-icon-cloudy" />;
    }
    if (main === 'rain' || main === 'drizzle' || main === 'mist') return <CloudRain size={48} className="weather-icon-rain" />;
    if (main === 'thunderstorm') return <CloudLightning size={48} className="weather-icon-storm" />;
    return <Cloud size={48} className="weather-icon-cloudy" />;
  };

  const getDisplayTime = () => {
    if (tzMode === 'utc') {
      const d = time.getUTCDate().toString().padStart(2, '0');
      const m = time.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const y = time.getUTCFullYear();
      const t = time.toISOString().slice(11, 16);
      return { label: 'UTC Time', value: `${m} ${d}, ${y} • ${t} Z` };
    } else {
      const datePart = time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
      const timePart = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
      return { label: 'Station Local Time', value: `${datePart} • ${timePart} IST` };
    }
  };

  const formatSunTime = (d) => {
    if (tzMode === 'utc') {
      return d.toUTCString().slice(17, 22) + ' UTC';
    } else {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST';
    }
  };

  return (
    <div className="modern-container" style={{ margin: 0, maxWidth: 'none' }}>
      <SEO
        title="VU35KB | Srinivasan KB - Amateur Radio Operator"
        description="Official profile of Srinivasan KB (VU35KB). Amateur Radio Operator from Rajapalayam, IN. Operating Baofeng UV-17R Plus."
      />
      <header className="profile-header">
        <div className="avatar-wrapper">
          <img src="/avatar.png" alt="Srinivasan KB" className="avatar-image" />
        </div>
        <div className="callsign-pill">VU35KB</div>
        <h1 className="name-heading">Srinivasan KB</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.925rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          Amateur Radio Operator • Rajapalayam, IN <img src="https://flagcdn.com/w20/in.png" alt="India" style={{ width: '18px', height: 'auto', borderRadius: '2px', display: 'inline-block' }} />
        </p>
      </header>

      <div className="modern-grid">
        <div className="modern-card">
          <div className="card-label"><Award size={14} /> License</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div className="card-value">ASOC Restricted Grade</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Licensed since: March 2026</p>
          </div>
        </div>
        <div className="modern-card">
          <div className="card-label"><Compass size={14} /> Grid Square</div>
          <div className="card-value">
            <NavLink to={`/grid#${STATION.grid}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {STATION.grid} <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} />
            </NavLink>
          </div>
        </div>

        <div className="modern-card weather-section">
          <div className="card-label-row">
            <span className="card-label"><Cloud size={14} /> Live Weather @ {STATION.name}</span>
            <button className="unit-toggle" onClick={toggleUnits} title="Toggle units">
              <span className={units === 'metric' ? 'active' : ''}>°C</span>
              <span className="toggle-sep">|</span>
              <span className={units === 'imperial' ? 'active' : ''}>°F</span>
            </button>
          </div>
          {weather && (
            <div className="weather-content-enhanced">
              <div className="weather-main-info">
                <div className="weather-icon-big">
                  {getWeatherIcon(weather.weather[0])}
                </div>
                <div>
                  <div className="temp-big">{toTemp(weather.main.temp)}</div>
                  <div className="weather-desc-pill">{weather.weather[0].description}</div>
                </div>
              </div>

              <div className="weather-stats-grid">
                <div className="stat-item">
                  <div className="stat-label"><Thermometer size={14} /> Feels Like</div>
                  <div className="stat-value">{toTemp(weather.main.feels_like || weather.main.temp)}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label"><Droplets size={14} /> Humidity</div>
                  <div className="stat-value">{weather.main.humidity}%</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label"><Wind size={14} /> Wind</div>
                  <div className="stat-value">{toWind(weather.wind.speed)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sunrise/Sunset Card */}
        {(() => {
          const sun = getSunTimes(STATION.lat, STATION.lon);
          return (
            <div className="modern-card sun-section">
              <div className="card-label-row">
                <span className="card-label"><Sun size={14} /> Sun Times @ {STATION.name}</span>
                <button className="unit-toggle" onClick={toggleTz} title="Toggle timezone">
                  <span className={tzMode === 'utc' ? 'active' : ''}>UTC</span>
                  <span className="toggle-sep">|</span>
                  <span className={tzMode === 'ist' ? 'active' : ''}>IST</span>
                </button>
              </div>
              <div className="sun-times-content">
                <div className="sun-time-item">
                  <div className="sun-icon-wrap sunrise-icon"><Sunrise size={36} /></div>
                  <div>
                    <div className="sun-time-label">Sunrise</div>
                    <div className="sun-time-value">{sun ? formatSunTime(sun.sunrise) : '--'}</div>
                  </div>
                </div>
                <div className="sun-divider"></div>
                <div className="sun-time-item">
                  <div className="sun-icon-wrap sunset-icon"><Sunset size={36} /></div>
                  <div>
                    <div className="sun-time-label">Sunset</div>
                    <div className="sun-time-value">{sun ? formatSunTime(sun.sunset) : '--'}</div>
                  </div>
                </div>
              </div>
              <p className="sun-note">{tzMode === 'utc' ? 'UTC' : 'IST (UTC+5:30)'} times for grid MJ89sk</p>
            </div>
          );
        })()}

        {/* Merged Time Card */}
        <div className="modern-card full-width-card">
          <div className="card-label-row">
            <span className="card-label"><Clock size={14} /> {getDisplayTime().label}</span>
            <button className="unit-toggle" onClick={toggleTz} title="Toggle timezone">
              <span className={tzMode === 'utc' ? 'active' : ''}>UTC</span>
              <span className="toggle-sep">|</span>
              <span className={tzMode === 'ist' ? 'active' : ''}>IST</span>
            </button>
          </div>
          <div className="card-value" style={{ fontSize: '0.9rem' }}>{getDisplayTime().value}</div>
        </div>

        <div className="modern-card full-width-card">
          <div className="card-label"><Radio size={14} /> Station & Rig</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)' }}>Rig: Baofeng UV-17R Plus</p>
              <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6' }}>Operating primarily on <strong>2m/70cm</strong> bands with a focus on <strong>QRP</strong>.</p>
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 0, background: 'var(--secondary)', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card-label"><Award size={12} /> QSL Policy</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>Exclusive QRZ.com only.</p>
                <a href="https://www.qrz.com/db/VU35KB" target="_blank" rel="noopener noreferrer" className="qrz-button"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem', textDecoration: 'none' }}>
                  QRZ Profile <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Grid Calculator Tool ---
function GridCalculator() {
  const location = useLocation();
  const [mode, setMode] = useState('coords'); // 'coords' or 'grid'
  const [coords, setCoords] = useState({ lat: STATION.lat, lon: STATION.lon });
  const [grid, setGrid] = useState(STATION.grid);
  const [bounds, setBounds] = useState(getGridBounds(STATION.grid));
  const [inputCoords, setInputCoords] = useState({ lat: STATION.lat.toFixed(4), lon: STATION.lon.toFixed(4) });
  const [inputGrid, setInputGrid] = useState(STATION.grid);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [locationInfo, setLocationInfo] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  const handleUpdateByCoords = (latStr, lonStr) => {
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError("Enter valid latitude (-90 to 90) and longitude (-180 to 180)");
      return;
    }
    setError("");
    const newGrid = getMaidenhead(lat, lon);
    setGrid(newGrid);
    setCoords({ lat, lon });
    setBounds(getGridBounds(newGrid));
    setInputGrid(formatGrid(newGrid));
    // Update hash without reloading
    window.history.replaceState(null, null, `/grid#${formatGrid(newGrid)}`);
  };

  const handleUpdateByGrid = (gridStr) => {
    const newBounds = getGridBounds(gridStr);
    if (!newBounds) {
      setError("Enter a valid 4 or 6 character grid square (e.g., RR73oo)");
      return;
    }
    setError("");
    const centerLat = (newBounds[0][0] + newBounds[1][0]) / 2;
    const centerLon = (newBounds[0][1] + newBounds[1][1]) / 2;
    const formatted = formatGrid(gridStr);
    setGrid(formatted);
    setCoords({ lat: centerLat, lon: centerLon });
    setBounds(newBounds);
    setInputCoords({ lat: centerLat.toFixed(4), lon: centerLon.toFixed(4) });
    window.history.replaceState(null, null, `/grid#${formatted}`);
  };

  const copyLink = () => {
    const formatted = formatGrid(grid);
    const url = `${window.location.origin}/grid#${formatted}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    const formatted = formatGrid(grid);
    const url = `${window.location.origin}/grid#${formatted}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Maidenhead Grid Explorer',
          text: `Check out grid square ${formatted} on my Ham Radio Explorer!`,
          url: url,
        });
      } catch (err) { console.error("Error sharing:", err); }
    } else {
      copyLink();
    }
  };

  useEffect(() => {
    const hashValue = location.hash.replace('#', '').trim();
    if (hashValue && /^[A-R]{2}[0-9]{2}([A-X]{2})?$/i.test(hashValue)) {
      setMode('grid');
      setInputGrid(formatGrid(hashValue));
      handleUpdateByGrid(hashValue);
    }
  }, [location.hash]);

  useEffect(() => {
    const fetchLocationName = async () => {
      setIsLocating(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lon}&format=json&accept-language=en`,
          {
            headers: {
              'User-Agent': 'HAM-Profile-Site/1.0'
            }
          }
        );
        const data = await response.json();
        if (data && data.address) {
          const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.state_district || "Unknown Location";
          const country = data.address.country || "";
          const countryCode = data.address.country_code || "";
          setLocationInfo({ city, country, countryCode, displayName: data.display_name });
        }
      } catch (err) {
        console.error("Nominatim fetch error:", err);
      } finally {
        setIsLocating(false);
      }
    };

    fetchLocationName();
  }, [coords.lat, coords.lon]);

  function MapEvents() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setInputCoords({ lat: lat.toFixed(4), lon: lng.toFixed(4) });
        handleUpdateByCoords(lat.toFixed(4), lng.toFixed(4));
        setMode('coords');
      },
    });
    return null;
  }

  function SetView({ bounds, gridLength }) {
    const map = useMap();
    useEffect(() => {
      if (bounds) {
        // pad(0.4) adds 40% more area on all sides to show neighbors
        // for 4-digit, we use slightly more to ensure context
        const paddingFactor = gridLength === 4 ? 0.5 : 0.3;
        const paddedBounds = L.latLngBounds(bounds).pad(paddingFactor);
        map.fitBounds(paddedBounds, { animate: true });
      }
    }, [bounds, gridLength]);
    return null;
  }

  return (
    <div className="modern-container calc-container" style={{ margin: 0, maxWidth: 'none' }}>
      <SEO
        title={`Grid ${formatGrid(grid)} | Maidenhead Explorer`}
        description={`Locate and visualize Maidenhead Grid Square ${formatGrid(grid)} on the interactive map. Tool by VU35KB.`}
      />
      <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h2 className="name-heading" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Maidenhead Grid Explorer</h2>
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>Visualize boundaries and locate grid squares on the map.</p>
      </header>

      <div className="tabs-header">
        <button className={`tab-btn ${mode === 'coords' ? 'active' : ''}`} onClick={() => setMode('coords')}>Location</button>
        <button className={`tab-btn ${mode === 'grid' ? 'active' : ''}`} onClick={() => setMode('grid')}>Grid square</button>
      </div>

      <div className="modern-card" style={{ marginBottom: '1.5rem' }}>
        {mode === 'coords' ? (
          <div className="input-row">
            <div className="input-group">
              <label className="card-label">Latitude</label>
              <input className="input-field" placeholder="9.45" value={inputCoords.lat} onChange={e => setInputCoords(p => ({ ...p, lat: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleUpdateByCoords(inputCoords.lat, inputCoords.lon)} />
            </div>
            <div className="input-group">
              <label className="card-label">Longitude</label>
              <input className="input-field" placeholder="77.55" value={inputCoords.lon} onChange={e => setInputCoords(p => ({ ...p, lon: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleUpdateByCoords(inputCoords.lat, inputCoords.lon)} />
            </div>
            <button className="calc-button" onClick={() => handleUpdateByCoords(inputCoords.lat, inputCoords.lon)}>Locate</button>
          </div>
        ) : (
          <div className="input-row">
            <div className="input-group">
              <label className="card-label">Grid Square ID</label>
              <input className="input-field" placeholder="MJ89sk" value={inputGrid} onChange={e => setInputGrid(formatGrid(e.target.value))} maxLength={6} onKeyDown={e => e.key === 'Enter' && handleUpdateByGrid(inputGrid)} />
            </div>
            <button className="calc-button" onClick={() => handleUpdateByGrid(inputGrid)}>Search</button>
          </div>
        )}
        {error && <div className="error-text">{error}</div>}

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 120px', minWidth: 0, padding: '1rem', background: 'var(--secondary)', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="card-label" style={{ justifyContent: 'center' }}>4-DIGIT</div>
            <div className="card-value" style={{ fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: 700 }}>{grid.slice(0, 4).toUpperCase()}</div>
          </div>
          <div style={{ flex: '1 1 120px', minWidth: 0, padding: '1rem', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="card-label" style={{ justifyContent: 'center', color: '#2563eb' }}>6-DIGIT</div>
            <div className="card-value" style={{ fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{formatGrid(grid)}</div>
          </div>
        </div>

        {isLocating ? (
          <div style={{ marginTop: '1rem', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
            Fetching location details...
          </div>
        ) : locationInfo && (
          <div className="location-info-box">
            <div className="card-label"><MapPin size={14} /> Location</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {locationInfo.countryCode && (
                <img
                  src={`https://flagcdn.com/w40/${locationInfo.countryCode.toLowerCase()}.png`}
                  alt={locationInfo.country}
                  style={{ width: '24px', height: 'auto', borderRadius: '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                />
              )}
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{locationInfo.city}, {locationInfo.country}</div>
            </div>
          </div>
        )}

        <div className="share-action-container">
          <button className="share-btn" onClick={copyLink}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button className="share-btn" onClick={shareLink}>
            <Share2 size={14} /> Share
          </button>
        </div>
      </div>

      <div className="map-wrapper" style={{ height: '350px', zIndex: '1' }}>
        <MapContainer center={[coords.lat, coords.lon]} zoom={11} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {bounds && (
            <Rectangle
              bounds={bounds}
              pathOptions={{
                color: '#ef4444',
                weight: 3,
                fillColor: '#ef4444',
                fillOpacity: 0.15
              }}
            />
          )}
          <Marker position={[coords.lat, coords.lon]} />
          <MapEvents />
          <SetView bounds={bounds} gridLength={grid.length} />
        </MapContainer>
      </div>

      {copied && <div className="toast">Link copied to clipboard!</div>}

      <div className="modern-card" style={{ marginTop: '1.5rem', background: '#fafafa', borderStyle: 'dashed' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <Info size={16} className="text-secondary" style={{ marginTop: '0.25rem', flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>How it works</h4>
            <ul style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', lineHeight: '1.6', paddingLeft: '1rem' }}>
              <li>The <strong style={{ color: '#ef4444' }}>red rectangle</strong> represents the exact boundary of the selected 6-digit grid.</li>
              <li>A 6-digit Maidenhead square is approximately <strong>7km x 4.6km</strong> at the equator.</li>
              <li>Coordinates are centered within the red boundary for mapping accuracy.</li>
              <li><strong>Pro Tip:</strong> Click directly on the map to see the grid square for any location worldwide.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SEO Helper ---
function SEO({ title, description }) {
  useEffect(() => {
    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);

    // Update OG tags too
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
  }, [title, description]);
  return null;
}

// --- App Shell ---
function App() {
  return (
    <Router>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Radio size={24} /> VU35KB
        </div>

        <div className="sidebar-section">
          <div className="sidebar-heading">Main</div>
          <div className="nav-links-container-new">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <MapPin size={18} /> My Profile
            </NavLink>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-heading">Tools</div>
          <div className="nav-links-container-new">
            <NavLink to="/grid" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Compass size={18} /> Grid Explorer
            </NavLink>
          </div>
        </div>

        <div style={{ marginTop: 'auto', padding: '1.25rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div className="card-label" style={{ fontSize: '0.65rem', marginBottom: '0.25rem' }}>Contact</div>
            <a href="mailto:vu35kb@gmail.com" style={{ fontSize: '0.75rem', color: 'var(--foreground)', textDecoration: 'none', fontWeight: 600 }}>vu35kb@gmail.com</a>
          </div>
          <div style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }}></span>
            STATION QRV
          </div>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.65rem' }}>73 de VU35KB • Rajapalayam</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="app-content">
        <Routes>
          <Route path="/" element={<ProfilePage />} />
          <Route path="/grid" element={<GridCalculator />} />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <NavLink to="/" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <MapPin />
          <span>Profile</span>
        </NavLink>
        <NavLink to="/grid" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
          <Compass />
          <span>Grid</span>
        </NavLink>
      </nav>

      {/* Mobile Footer Info */}
      <div className="mobile-footer-info">
        <a href="mailto:vu35kb@gmail.com" className="mobile-footer-email">vu35kb@gmail.com</a>
        <div className="mobile-footer-status">
          <span className="qrv-dot"></span>
          STATION QRV
        </div>
        <span className="mobile-footer-sign">73 de VU35KB • Rajapalayam</span>
      </div>
    </Router>
  );
}

export default App;
