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
  Check
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

// --- Home Profile Page ---
function ProfilePage() {
  const [weather, setWeather] = useState(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!WEATHER_API_KEY) {
        setWeather({
          main: { temp: 31, humidity: 62 },
          weather: [{ description: 'partly cloudy', main: 'Clouds' }],
          wind: { speed: 4.1 },
          mock: true
        });
        return;
      }
      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${STATION.lat}&lon=${STATION.lon}&appid=${WEATHER_API_KEY}&units=metric`
        );
        const data = await response.json();
        setWeather(data);
      } catch (err) { console.error(err); }
    };
    fetchWeather();
  }, []);

  const getUtcTime = () => time.toISOString().slice(11, 16);
  const getIstTime = () => time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

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
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.925rem' }}>
          Amateur Radio Operator • Rajapalayam, IN
        </p>
      </header>

      <div className="modern-grid">
        <div className="modern-card">
          <div className="card-label"><Award size={14} /> License</div>
          <div className="card-value">ASOC Restricted Grade</div>
        </div>
        <div className="modern-card">
          <div className="card-label"><Compass size={14} /> Grid Square</div>
          <div className="card-value">
            <NavLink to={`/grid#${STATION.grid}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {STATION.grid} <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} />
            </NavLink>
          </div>
        </div>

        <div className="modern-card full-width-card weather-section">
          <div className="card-label"><Cloud size={14} /> Live Weather @ {STATION.name}</div>
          {weather && (
            <div className="weather-content">
              <div>
                <div className="temp-big">{Math.round(weather.main.temp)}°C</div>
                <div style={{ textTransform: 'capitalize', color: 'var(--muted-foreground)', fontWeight: 500 }}>{weather.weather[0].description}</div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '1rem' }}>
                <div>
                  <div className="card-label" style={{ marginBottom: '0.25rem' }}><Droplets size={12} /> Humidity</div>
                  <div className="card-value" style={{ fontSize: '0.875rem' }}>{weather.main.humidity}%</div>
                </div>
                <div>
                  <div className="card-label" style={{ marginBottom: '0.25rem' }}><Wind size={12} /> Wind</div>
                  <div className="card-value" style={{ fontSize: '0.875rem' }}>{weather.wind.speed} m/s</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modern-card">
          <div className="card-label"><Clock size={14} /> UTC Time</div>
          <div className="card-value">{getUtcTime()} Z</div>
        </div>
        <div className="modern-card">
          <div className="card-label"><MapPin size={14} /> Local Time</div>
          <div className="card-value">{getIstTime()} IST</div>
        </div>

        <div className="modern-card full-width-card">
          <div className="card-label"><Radio size={14} /> Station & Rig</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)' }}>Rig: Baofeng UV-17R Plus</p>
              <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6' }}>Operating primarily on <strong>2m/70cm</strong> bands with a focus on <strong>QRP</strong>.</p>
            </div>
            <div style={{ flex: '1 1 200px', background: 'var(--secondary)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div className="card-label" style={{ marginBottom: '0.5rem' }}><Award size={12} /> QSL Policy</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Exclusive QRZ.com only.</p>
              <a href="https://www.qrz.com/db/VU35KB" target="_blank" rel="noopener noreferrer" className="qrz-button"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem', textDecoration: 'none' }}>
                QRZ Profile <ExternalLink size={14} />
              </a>
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
    setInputGrid(newGrid.toUpperCase());
    // Update hash without reloading
    window.history.replaceState(null, null, `/grid#${newGrid}`);
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
    setGrid(gridStr.toLowerCase());
    setCoords({ lat: centerLat, lon: centerLon });
    setBounds(newBounds);
    setInputCoords({ lat: centerLat.toFixed(4), lon: centerLon.toFixed(4) });
    window.history.replaceState(null, null, `/grid#${gridStr.toUpperCase()}`);
  };

  const copyLink = () => {
    const url = `${window.location.origin}/grid#${grid.toUpperCase()}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    const url = `${window.location.origin}/grid#${grid.toUpperCase()}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Maidenhead Grid Explorer',
          text: `Check out grid square ${grid.toUpperCase()} on my Ham Radio Explorer!`,
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
      setInputGrid(hashValue.toUpperCase());
      handleUpdateByGrid(hashValue);
    }
  }, [location.hash]);

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

  function SetView({ center }) {
    const map = useMap();
    useEffect(() => {
      map.setView(center, map.getZoom());
    }, [center]);
    return null;
  }

  return (
    <div className="modern-container calc-container" style={{ margin: 0, maxWidth: 'none' }}>
      <SEO
        title={`Grid ${grid.toUpperCase()} | Maidenhead Explorer`}
        description={`Locate and visualize Maidenhead Grid Square ${grid.toUpperCase()} on the interactive map. Tool by VU35KB.`}
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
              <input className="input-field" placeholder="9.45" value={inputCoords.lat} onChange={e => setInputCoords(p => ({ ...p, lat: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="card-label">Longitude</label>
              <input className="input-field" placeholder="77.55" value={inputCoords.lon} onChange={e => setInputCoords(p => ({ ...p, lon: e.target.value }))} />
            </div>
            <button className="calc-button" onClick={() => handleUpdateByCoords(inputCoords.lat, inputCoords.lon)}>Locate</button>
          </div>
        ) : (
          <div className="input-row">
            <div className="input-group">
              <label className="card-label">Grid Square ID</label>
              <input className="input-field" placeholder="MJ89sk" value={inputGrid} onChange={e => setInputGrid(e.target.value.toUpperCase())} maxLength={6} />
            </div>
            <button className="calc-button" onClick={() => handleUpdateByGrid(inputGrid)}>Search</button>
          </div>
        )}
        {error && <div className="error-text">{error}</div>}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, padding: '1rem', background: 'var(--secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <div className="card-label" style={{ justifyContent: 'center' }}>4-DIGIT SQUARE</div>
            <div className="card-value" style={{ fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: 700 }}>{grid.toUpperCase().slice(0, 4)}</div>
          </div>
          <div style={{ flex: 1, padding: '1rem', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '8px', textAlign: 'center' }}>
            <div className="card-label" style={{ justifyContent: 'center', color: '#2563eb' }}>6-DIGIT SUBSQUARE</div>
            <div className="card-value" style={{ fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{grid.toUpperCase()}</div>
          </div>
        </div>

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
          <SetView center={[coords.lat, coords.lon]} />
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
    </Router>
  );
}

export default App;
