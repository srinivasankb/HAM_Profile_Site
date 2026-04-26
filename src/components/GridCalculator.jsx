import React, { useState, useEffect } from 'react';
import {
    MapPin,
    ExternalLink,
    Info,
    Copy,
    Share2,
    Check
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Rectangle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { STATIONS, getMaidenhead, formatGrid, getGridBounds } from '../lib/ham-utils';

// Fix for default marker icon in leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const PRIMARY_STATION = STATIONS.find(s => s.isPrimary) || STATIONS[0];

export default function GridCalculator() {
    const [mode, setMode] = useState('coords');
    const [coords, setCoords] = useState({ lat: PRIMARY_STATION.lat, lon: PRIMARY_STATION.lon });
    const [grid, setGrid] = useState(PRIMARY_STATION.grid);
    const [bounds, setBounds] = useState(getGridBounds(PRIMARY_STATION.grid));
    const [inputCoords, setInputCoords] = useState({ lat: PRIMARY_STATION.lat.toFixed(4), lon: PRIMARY_STATION.lon.toFixed(4) });
    const [inputGrid, setInputGrid] = useState(PRIMARY_STATION.grid);
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
        const handleHashChange = () => {
            const hashValue = window.location.hash.replace('#', '').trim();
            if (hashValue && /^[A-R]{2}[0-9]{2}([A-X]{2})?$/i.test(hashValue)) {
                setMode('grid');
                setInputGrid(formatGrid(hashValue));
                handleUpdateByGrid(hashValue);
            }
        };
        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    useEffect(() => {
        const fetchLocationName = async () => {
            setIsLocating(true);
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lon}&format=json&accept-language=en`,
                    { headers: { 'User-Agent': 'HAM-Profile-Site/1.0' } }
                );
                const data = await response.json();

                if (data) {
                    const address = data.address || {};
                    const locality = address.city || address.town || address.village || address.suburb || address.state_district || address.county || address.state;
                    const country = address.country;

                    if (locality || country) {
                        setLocationInfo({
                            city: locality || "Unnamed Region",
                            country: country || "",
                            countryCode: address.country_code || "",
                            displayName: data.display_name
                        });
                    } else {
                        // Likely open water or unsurveyed region
                        setLocationInfo({
                            city: "Open Water / Unnamed Area",
                            country: "International Waters",
                            countryCode: null,
                            displayName: "Geographic coordinates in a remote or maritime region"
                        });
                    }
                } else {
                    setLocationInfo(null);
                }
            } catch (err) {
                console.error("Nominatim fetch error:", err);
                setLocationInfo({ city: "Location data unavailable", country: "", countryCode: null });
            } finally { setIsLocating(false); }
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
                const paddingFactor = gridLength === 4 ? 0.5 : 0.3;
                const paddedBounds = L.latLngBounds(bounds).pad(paddingFactor);
                map.fitBounds(paddedBounds, { animate: true });
            }
        }, [bounds, gridLength]);
        return null;
    }

    return (
        <div className="modern-container calc-container">
            <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <h2 className="name-heading" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Maidenhead Grid Explorer</h2>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>Visualize boundaries and locate grid squares on the map.</p>
            </header>
            <div className="tabs-header" role="tablist">
                <button role="tab" aria-selected={mode === 'coords'} className={`tab-btn ${mode === 'coords' ? 'active' : ''}`} onClick={() => setMode('coords')}>Location</button>
                <button role="tab" aria-selected={mode === 'grid'} className={`tab-btn ${mode === 'grid' ? 'active' : ''}`} onClick={() => setMode('grid')}>Grid square</button>
            </div>
            <div className="modern-card" style={{ marginBottom: '1.5rem' }}>
                {mode === 'coords' ? (
                    <div className="input-row">
                        <div className="input-group">
                            <label className="card-label" htmlFor="lat-input">Latitude</label>
                            <input id="lat-input" className="input-field" aria-label="Enter Latitude" placeholder="9.45" value={inputCoords.lat} onChange={e => setInputCoords(p => ({ ...p, lat: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleUpdateByCoords(inputCoords.lat, inputCoords.lon)} />
                        </div>
                        <div className="input-group">
                            <label className="card-label" htmlFor="lon-input">Longitude</label>
                            <input id="lon-input" className="input-field" aria-label="Enter Longitude" placeholder="77.55" value={inputCoords.lon} onChange={e => setInputCoords(p => ({ ...p, lon: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleUpdateByCoords(inputCoords.lat, inputCoords.lon)} />
                        </div>
                        <button className="calc-button" aria-label="Locate coordinates on grid" onClick={() => handleUpdateByCoords(inputCoords.lat, inputCoords.lon)}>Locate</button>
                    </div>
                ) : (
                    <div className="input-row">
                        <div className="input-group">
                            <label className="card-label" htmlFor="grid-input">Grid Square ID</label>
                            <input id="grid-input" className="input-field" aria-label="Enter 4 or 6 character grid square" placeholder="MJ89sk" value={inputGrid} onChange={e => setInputGrid(formatGrid(e.target.value))} maxLength={6} onKeyDown={e => e.key === 'Enter' && handleUpdateByGrid(inputGrid)} />
                        </div>
                        <button className="calc-button" aria-label="Search for grid square" onClick={() => handleUpdateByGrid(inputGrid)}>Search</button>
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
                {isLocating ? <div style={{ marginTop: '1rem', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>Fetching location details...</div> : locationInfo && (
                    <div className="location-info-box">
                        <div className="card-label"><MapPin size={14} /> Location</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {locationInfo.countryCode && <img src={`https://flagcdn.com/w40/${locationInfo.countryCode.toLowerCase()}.png`} alt={locationInfo.country} style={{ width: '24px', height: 'auto', borderRadius: '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />}
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{locationInfo.city}, {locationInfo.country}</div>
                        </div>
                    </div>
                )}
                <div className="share-action-container">
                    <button className="share-btn" onClick={copyLink}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied!" : "Copy Link"}</button>
                    <button className="share-btn" onClick={shareLink}><Share2 size={14} /> Share</button>
                </div>
            </div>
            <div className="map-wrapper" style={{ height: '350px', zIndex: '1' }}>
                <MapContainer center={[coords.lat, coords.lon]} zoom={11} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {bounds && <Rectangle bounds={bounds} pathOptions={{ color: '#ef4444', weight: 3, fillColor: '#ef4444', fillOpacity: 0.15 }} />}
                    <Marker position={[coords.lat, coords.lon]} />
                    <MapEvents />
                    <SetView bounds={bounds} gridLength={grid.length} />
                </MapContainer>
            </div>
            <div className="modern-card" style={{ marginTop: '1.5rem', background: '#fafafa', borderStyle: 'dashed' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <Info size={16} className="text-secondary" style={{ marginTop: '0.25rem', flexShrink: 0 }} />
                    <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>How it works</h4>
                        <ul style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', lineHeight: '1.6', paddingLeft: '1rem' }}>
                            <li>The <strong style={{ color: '#ef4444' }}>red rectangle</strong> represents the exact boundary of the selected 6-digit grid.</li>
                            <li>A 6-digit Maidenhead square is approximately <strong>7km x 4.6km</strong> at the equator.</li>
                            <li><strong>Pro Tip:</strong> Click directly on the map to see the grid square for any location worldwide.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
