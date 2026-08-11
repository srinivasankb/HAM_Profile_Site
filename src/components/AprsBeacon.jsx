import React, { useState, useEffect, useRef } from 'react';
import {
    Radio,
    MapPin,
    Send,
    Terminal as TerminalIcon,
    Shield,
    ShieldAlert,
    RefreshCw,
    Copy,
    Check,
    Navigation,
    Trash2,
    Info,
    ExternalLink,
    Crosshair,
    Bookmark,
    Plus,
    Sparkles
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { STATIONS } from '../lib/ham-utils';
import profileData from '../data/profile.json';

// Fix for default marker icon in leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const STORAGE_KEY = 'aprs_beacon_config_v1';
const PRESETS_STORAGE_KEY = 'aprs_beacon_custom_presets_v1';
const PRIMARY_STATION = STATIONS.find(s => s.isPrimary) || STATIONS[0];

const DEFAULT_PRESETS = [
    { id: 'mobile', name: 'Primary Mobile', ssid: '-9', iconSymbol: '/>', comment: 'Primary Mobile / Car Tracker', badge: '🚗 Mobile' },
    { id: 'ht', name: 'Handheld HT', ssid: '-7', iconSymbol: '/[', comment: 'Pedestrian HT Walkie Tracker', badge: '🏃 HT Walkie' },
    { id: 'base', name: 'Home Base QTH', ssid: '', iconSymbol: '/-', comment: 'QTH Base Station', badge: '🏠 Base Station' },
    { id: 'wx', name: 'Weather Station', ssid: '-13', iconSymbol: '/r', comment: 'QTH Weather Station Telemetry', badge: '🗼 Weather' },
    { id: 'aircraft', name: 'Aircraft / Balloon', ssid: '-11', iconSymbol: '/O', comment: 'High Altitude Balloon Tracker', badge: '🎈 Balloon' },
];

// Official APRS Passcode Hashing Algorithm
export function computePasscode(callsign) {
    if (!callsign) return -1;
    const cleanCall = callsign.split('-')[0].toUpperCase().trim();
    if (!cleanCall) return -1;

    let hash = 0x73E2;
    let i = 0;
    while (i < cleanCall.length) {
        hash ^= cleanCall.charCodeAt(i) << 8;
        if (i + 1 < cleanCall.length) hash ^= cleanCall.charCodeAt(i + 1);
        i += 2;
    }
    return hash & 0x7FFF;
}

// Decimal Degrees to APRS Standard Format (DDMM.mmN / DDDMM.mmW)
export function convertToAPRSCoords(lat, lon) {
    if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
        return { aprsLat: '0000.00N', aprsLon: '00000.00E' };
    }
    const latDeg = Math.floor(Math.abs(lat));
    const latMin = ((Math.abs(lat) - latDeg) * 60).toFixed(2).padStart(5, '0');
    const latHemi = lat >= 0 ? 'N' : 'S';
    const aprsLat = `${String(latDeg).padStart(2, '0')}${latMin}${latHemi}`;

    const lonDeg = Math.floor(Math.abs(lon));
    const lonMin = ((Math.abs(lon) - lonDeg) * 60).toFixed(2).padStart(5, '0');
    const lonHemi = lon >= 0 ? 'E' : 'W';
    const aprsLon = `${String(lonDeg).padStart(3, '0')}${lonMin}${lonHemi}`;

    return { aprsLat, aprsLon };
}

// Map Click Listener Component
function MapPicker({ position, setPosition, addLog }) {
    useMapEvents({
        click(e) {
            const newLat = parseFloat(e.latlng.lat.toFixed(5));
            const newLon = parseFloat(e.latlng.lng.toFixed(5));
            setPosition({ lat: newLat, lon: newLon });
            addLog(`Map pin set to coordinates: ${newLat}, ${newLon}`, 'info');
        },
    });

    return position.lat !== null && position.lon !== null ? (
        <Marker position={[position.lat, position.lon]} />
    ) : null;
}

// Map View Updater Component
function MapRecenter({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center.lat !== null && center.lon !== null) {
            map.setView([center.lat, center.lon], map.getZoom());
        }
    }, [center, map]);
    return null;
}

export default function AprsBeacon() {
    const [callsign, setCallsign] = useState(profileData.callsign || 'VU35KB');
    const [ssid, setSsid] = useState('-9');
    const [iconSymbol, setIconSymbol] = useState('/>');
    const [comment, setComment] = useState('Web APRS Beacon Pro');
    const [isLive, setIsLive] = useState(false);

    const [coords, setCoords] = useState({ lat: PRIMARY_STATION.lat, lon: PRIMARY_STATION.lon });
    const [inputLat, setInputLat] = useState(PRIMARY_STATION.lat.toString());
    const [inputLon, setInputLon] = useState(PRIMARY_STATION.lon.toString());
    const [gpsAccuracy, setGpsAccuracy] = useState(null);
    const [isLocating, setIsLocating] = useState(false);

    const [customPresets, setCustomPresets] = useState([]);
    const [newPresetName, setNewPresetName] = useState('');
    const [showSavePresetInput, setShowSavePresetInput] = useState(false);
    const [activePresetId, setActivePresetId] = useState('mobile');

    const [logs, setLogs] = useState([]);
    const [copiedPayload, setCopiedPayload] = useState(false);
    const [copiedLogs, setCopiedLogs] = useState(false);
    const [isTransmitting, setIsTransmitting] = useState(false);

    const terminalRef = useRef(null);

    const addLog = (msg, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { id: Date.now() + Math.random(), timestamp, text: msg, type }]);
    };

    // Auto scroll terminal to bottom on new log
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    // Initial console log on mount & load saved presets
    useEffect(() => {
        addLog('APRS-IS Console initialized. Select parameters and acquire location lock.', 'info');
        loadSavedSettings();
        loadCustomPresets();
    }, []);

    // Local Storage Persistence
    const saveSettings = () => {
        const config = {
            callsign,
            ssid,
            iconSymbol,
            comment,
            isLive
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    };

    const loadSavedSettings = () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        try {
            const config = JSON.parse(saved);
            if (config.callsign !== undefined) setCallsign(config.callsign);
            if (config.ssid !== undefined) setSsid(config.ssid);
            if (config.iconSymbol !== undefined) setIconSymbol(config.iconSymbol);
            if (config.comment !== undefined) setComment(config.comment);
            if (config.isLive !== undefined) setIsLive(config.isLive);
            addLog('Loaded saved configuration from browser cache.', 'success');
        } catch (e) {
            console.error('Failed to parse saved settings:', e);
        }
    };

    const loadCustomPresets = () => {
        const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                setCustomPresets(parsed);
            }
        } catch (e) {
            console.error('Failed to parse custom presets:', e);
        }
    };

    const saveCustomPreset = () => {
        const name = newPresetName.trim();
        if (!name) {
            alert('Please enter a name for your preset.');
            return;
        }
        const newPreset = {
            id: `custom_${Date.now()}`,
            name,
            ssid,
            iconSymbol,
            comment,
            badge: `⭐ ${name}`
        };
        const updated = [...customPresets, newPreset];
        setCustomPresets(updated);
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
        setActivePresetId(newPreset.id);
        setNewPresetName('');
        setShowSavePresetInput(false);
        addLog(`Saved new custom station preset: "${name}"`, 'success');
    };

    const deleteCustomPreset = (id, name) => {
        if (window.confirm(`Delete custom preset "${name}"?`)) {
            const updated = customPresets.filter(p => p.id !== id);
            setCustomPresets(updated);
            localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
            addLog(`Deleted custom preset: "${name}"`, 'warning');
        }
    };

    const applyPreset = (preset) => {
        setSsid(preset.ssid);
        setIconSymbol(preset.iconSymbol);
        setComment(preset.comment);
        setActivePresetId(preset.id);
        saveSettings();
        addLog(`Applied station profile preset: "${preset.name}" (${preset.ssid ? 'SSID' + preset.ssid : 'No SSID'})`, 'info');
    };

    const clearSettings = () => {
        if (window.confirm('Clear all saved APRS preferences from browser cache?')) {
            localStorage.removeItem(STORAGE_KEY);
            setCallsign(profileData.callsign || 'VU35KB');
            setSsid('-9');
            setIconSymbol('/>');
            setComment('Web APRS Beacon Pro');
            setIsLive(false);
            setActivePresetId('mobile');
            addLog('Cleared cached settings and restored defaults.', 'warning');
        }
    };

    // Sync input inputs with coords state
    useEffect(() => {
        if (coords.lat !== null && coords.lon !== null) {
            setInputLat(coords.lat.toString());
            setInputLon(coords.lon.toString());
        }
    }, [coords]);

    const handleManualCoordChange = (latVal, lonVal) => {
        setInputLat(latVal);
        setInputLon(lonVal);
        const parsedLat = parseFloat(latVal);
        const parsedLon = parseFloat(lonVal);
        if (!isNaN(parsedLat) && !isNaN(parsedLon) && parsedLat >= -90 && parsedLat <= 90 && parsedLon >= -180 && parsedLon <= 180) {
            setCoords({ lat: parsedLat, lon: parsedLon });
            setGpsAccuracy(null);
        }
    };

    const fetchGPSLocation = () => {
        if (!navigator.geolocation) {
            addLog('Geolocation API is unsupported on this browser.', 'error');
            return;
        }
        setIsLocating(true);
        addLog('Requesting high-accuracy GPS fix from device...', 'info');

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const newLat = parseFloat(pos.coords.latitude.toFixed(5));
                const newLon = parseFloat(pos.coords.longitude.toFixed(5));
                const accuracy = parseFloat(pos.coords.accuracy.toFixed(1));

                setCoords({ lat: newLat, lon: newLon });
                setGpsAccuracy(accuracy);
                setIsLocating(false);

                const { aprsLat, aprsLon } = convertToAPRSCoords(newLat, newLon);
                addLog(`GPS Lock Acquired! ${aprsLat} / ${aprsLon} (±${accuracy}m)`, 'success');
            },
            (err) => {
                addLog(`GPS Error (${err.code}): ${err.message}`, 'error');
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    };

    const handleModeToggle = (e) => {
        const checked = e.target.checked;
        setIsLive(checked);
        if (checked) {
            addLog('Switched to LIVE MODE. Packets will transmit directly to global APRS-IS network.', 'warning');
        } else {
            addLog('Switched to READ-ONLY MODE. Transmissions are safely simulated.', 'info');
        }
    };

    // Calculate derived packet details
    const cleanCall = callsign.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const passcode = computePasscode(cleanCall);
    const fullCall = `${cleanCall}${ssid}`;

    const { aprsLat, aprsLon } = convertToAPRSCoords(coords.lat, coords.lon);
    const tableSymbol = iconSymbol.charAt(0) || '/';
    const codeSymbol = iconSymbol.charAt(1) || '>';

    const aprsPacket = `${fullCall}>APRS,TCPIP*:${tableSymbol}${aprsLat}${codeSymbol}${aprsLon}${comment}`;
    const fullPayload = `user ${fullCall} pass ${isLive ? passcode : -1} vers WebBeacon 2.0\r\n${aprsPacket}\r\n`;
    const aprsFiUrl = `https://aprs.fi/info/a/${encodeURIComponent(fullCall)}`;

    const copyPayload = () => {
        navigator.clipboard.writeText(fullPayload.trim());
        setCopiedPayload(true);
        setTimeout(() => setCopiedPayload(false), 2000);
    };

    const copyLogs = () => {
        const text = logs.map(l => `[${l.timestamp}] ${l.text}`).join('\n');
        navigator.clipboard.writeText(text);
        setCopiedLogs(true);
        setTimeout(() => setCopiedLogs(false), 2000);
    };

    const clearLogs = () => {
        setLogs([]);
        addLog('Terminal console cleared.', 'info');
    };

    const sendBeacon = async (e) => {
        e.preventDefault();

        if (!cleanCall) {
            alert('Please provide a valid callsign.');
            return;
        }

        if (coords.lat === null || coords.lon === null) {
            alert('Please acquire or specify valid location coordinates.');
            return;
        }

        saveSettings();

        if (!isLive) {
            addLog(`[READ-ONLY SIMULATION] Transmit payload constructed:\n${fullPayload.trim()}`, 'warning');
            return;
        }

        setIsTransmitting(true);
        addLog(`Connecting to rotate.aprs2.net:8080 as ${fullCall}...`, 'info');

        try {
            const res = await fetch('/api/aprs-proxy', {
                method: 'POST',
                // No need for CORS headers when calling same-origin proxy
                body: fullPayload
            });

            if (res.ok) {
                const text = await res.text();
                addLog(`SUCCESS: Transmitted frame to APRS-IS network!\nServer Output: ${text.trim() || 'OK'}`, 'success');
            } else {
                addLog(`HTTP Error ${res.status}: ${res.statusText}`, 'error');
            }
        } catch (err) {
            addLog(`Connection Failed: ${err.message}. (Ensure CORS / HTTPS network policies allow rotate.aprs2.net).`, 'error');
        } finally {
            setIsTransmitting(false);
        }
    };

    return (
        <div className="modern-container" style={{ maxWidth: '900px' }}>
            {/* Header Title */}
            <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                <div className="callsign-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Radio size={14} /> APRS-IS TOOL
                </div>
                <h1 className="name-heading" style={{ fontSize: '2.25rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    APRS-IS Web Beacon Pro
                </h1>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '1rem', lineHeight: '1.6', maxWidth: '650px' }}>
                    Acquire live location telemetry and transmit APRS position frames over IP directly to the global APRS-IS network or simulate safe packet broadcasts.
                </p>
            </div>

            {/* Operational Mode Banner */}
            <div className={`aprs-mode-banner ${isLive ? 'live' : 'readonly'}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isLive ? <ShieldAlert size={22} style={{ color: '#22c55e' }} /> : <Shield size={22} style={{ color: '#f59e0b' }} />}
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: isLive ? '#15803d' : '#b45309' }}>
                            {isLive ? 'Mode: LIVE (Transmitting to APRS-IS)' : 'Mode: READ-ONLY (Safe Test Simulation)'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                            {isLive ? 'Transmissions post live to rotate.aprs2.net:8080' : 'Packets are safely validated and displayed in the terminal console without network transmission.'}
                        </div>
                    </div>
                </div>

                <label className="aprs-toggle-container" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.05em', color: isLive ? '#22c55e' : 'var(--muted-foreground)' }}>
                        LIVE
                    </span>
                    <input
                        type="checkbox"
                        checked={isLive}
                        onChange={(e) => {
                            handleModeToggle(e);
                            saveSettings();
                        }}
                        style={{ display: 'none' }}
                    />
                    <div
                        style={{
                            width: '44px',
                            height: '24px',
                            borderRadius: '20px',
                            background: isLive ? '#22c55e' : '#a1a1aa',
                            position: 'relative',
                            transition: 'background-color 0.2s ease',
                        }}
                    >
                        <div
                            style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: '#ffffff',
                                position: 'absolute',
                                top: '3px',
                                left: isLive ? '23px' : '3px',
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }}
                        />
                    </div>
                </label>
            </div>

            {/* Station Presets Manager Card */}
            <div className="modern-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                <div className="card-label-row" style={{ marginBottom: '0.75rem' }}>
                    <span className="card-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Bookmark size={16} style={{ color: '#2563eb' }} /> Station Profile Presets
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowSavePresetInput(!showSavePresetInput)}
                        style={{
                            background: 'var(--secondary)',
                            color: 'var(--foreground)',
                            border: '1px solid var(--border)',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                        }}
                    >
                        <Plus size={14} /> Save Current as Preset
                    </button>
                </div>

                {/* Save Custom Preset Inline Form */}
                {showSavePresetInput && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--secondary)', borderRadius: '8px' }}>
                        <input
                            type="text"
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            placeholder="Preset Name (e.g. Offroad Jeep Tracker)"
                            style={{
                                flex: 1,
                                padding: '0.5rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                background: 'var(--background)',
                                color: 'var(--foreground)',
                                fontSize: '0.85rem'
                            }}
                        />
                        <button
                            type="button"
                            onClick={saveCustomPreset}
                            style={{
                                background: 'var(--primary)',
                                color: 'var(--primary-foreground)',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}
                        >
                            Save
                        </button>
                    </div>
                )}

                {/* Presets Chips Palette */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                    {DEFAULT_PRESETS.map((p) => {
                        const isActive = activePresetId === p.id || (ssid === p.ssid && iconSymbol === p.iconSymbol);
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => applyPreset(p)}
                                style={{
                                    padding: '0.5rem 0.85rem',
                                    borderRadius: '9999px',
                                    border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    background: isActive ? 'var(--primary)' : 'var(--background)',
                                    color: isActive ? 'var(--primary-foreground)' : 'var(--foreground)',
                                    fontSize: '0.825rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                <span>{p.badge}</span>
                            </button>
                        );
                    })}

                    {customPresets.map((p) => {
                        const isActive = activePresetId === p.id;
                        return (
                            <div
                                key={p.id}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.35rem 0.4rem 0.35rem 0.85rem',
                                    borderRadius: '9999px',
                                    border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    background: isActive ? 'var(--primary)' : 'var(--background)',
                                    color: isActive ? 'var(--primary-foreground)' : 'var(--foreground)',
                                    fontSize: '0.825rem',
                                    fontWeight: '600'
                                }}
                            >
                                <span onClick={() => applyPreset(p)} style={{ cursor: 'pointer' }}>{p.badge}</span>
                                <button
                                    type="button"
                                    onClick={() => deleteCustomPreset(p.id, p.name)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: isActive ? 'var(--primary-foreground)' : 'var(--destructive)',
                                        opacity: 0.8,
                                        cursor: 'pointer',
                                        padding: '2px'
                                    }}
                                    title="Delete Preset"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Form Section */}
            <form onSubmit={sendBeacon} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="modern-grid grid-2">
                    {/* Callsign Input & Passcode */}
                    <div className="modern-card">
                        <div className="card-label-row">
                            <span className="card-label">
                                Callsign & Passcode
                            </span>
                            <button
                                type="button"
                                onClick={clearSettings}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--destructive)',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                }}
                            >
                                Reset Saved
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <input
                                type="text"
                                value={callsign}
                                onChange={(e) => {
                                    setCallsign(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
                                    saveSettings();
                                }}
                                placeholder="e.g. VU35KB"
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--background)',
                                    color: 'var(--foreground)',
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    fontFamily: 'monospace'
                                }}
                            />
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Clean Call: <strong style={{ color: 'var(--foreground)' }}>{cleanCall || '—'}</strong></span>
                                <span>APRS Passcode: <strong style={{ color: '#2563eb' }}>{cleanCall.length >= 3 ? passcode : '—'}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* SSID Extension */}
                    <div className="modern-card">
                        <div className="card-label">SSID Extension</div>
                        <select
                            value={ssid}
                            onChange={(e) => {
                                setSsid(e.target.value);
                                saveSettings();
                            }}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                background: 'var(--background)',
                                color: 'var(--foreground)',
                                fontSize: '0.95rem',
                                fontWeight: '600'
                            }}
                        >
                            <option value="">No SSID (Primary Station)</option>
                            <option value="-1">SSID-1 (NWS / Digipeater)</option>
                            <option value="-2">SSID-2 (220 MHz Packet)</option>
                            <option value="-5">SSID-5 (D-STAR / Mobile App)</option>
                            <option value="-7">SSID-7 (Handheld HT Walkie)</option>
                            <option value="-8">SSID-8 (Maritime / Boats)</option>
                            <option value="-9">SSID-9 (Primary Mobile / Car)</option>
                            <option value="-10">SSID-10 (IGate / Internet Server)</option>
                            <option value="-11">SSID-11 (Balloons / Aircraft)</option>
                            <option value="-12">SSID-12 (Portable Tracker)</option>
                            <option value="-13">SSID-13 (Weather Station)</option>
                            <option value="-14">SSID-14 (Truck / Heavy Hauler)</option>
                        </select>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                            <span>Formatted Address: <strong style={{ color: 'var(--foreground)' }}>{fullCall}</strong></span>
                            <a
                                href={aprsFiUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    color: '#2563eb',
                                    textDecoration: 'none',
                                    fontWeight: '600',
                                    fontSize: '0.775rem'
                                }}
                                title={`Inspect ${fullCall} live location on aprs.fi`}
                            >
                                <Radio size={12} /> View {fullCall} on aprs.fi <ExternalLink size={11} />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="modern-grid grid-2">
                    {/* APRS Icon Symbol */}
                    <div className="modern-card">
                        <div className="card-label">APRS Icon Symbol</div>
                        <select
                            value={iconSymbol}
                            onChange={(e) => {
                                setIconSymbol(e.target.value);
                                saveSettings();
                            }}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                background: 'var(--background)',
                                color: 'var(--foreground)',
                                fontSize: '0.95rem',
                                fontWeight: '600'
                            }}
                        >
                            <option value="/>">🚗 Car / Primary Mobile (/&gt;)</option>
                            <option value="/[">🏃 Person / Pedestrian (/[)</option>
                            <option value="/k">🚚 Truck / Cargo (/k)</option>
                            <option value="/b">🚲 Bicycle (/b)</option>
                            <option value="/<">🏍️ Motorcycle (/&lt;)</option>
                            <option value="/-">🏠 House / QTH Base (/-)</option>
                            <option value="/y">📡 Yagi / Fixed Station (/y)</option>
                            <option value="/j">🚙 Jeep / Offroad (/j)</option>
                            <option value="/r">🗼 Antenna / Tower (/r)</option>
                            <option value="/Y">⛵ Sailboat (/Y)</option>
                            <option value="/'">🛩️ Small Aircraft (/\')</option>
                            <option value="/O">🎈 Balloon (/O)</option>
                        </select>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                            Symbol Table: <code style={{ color: 'var(--foreground)' }}>{tableSymbol}</code> | Code: <code style={{ color: 'var(--foreground)' }}>{codeSymbol}</code>
                        </div>
                    </div>

                    {/* Status Comment */}
                    <div className="modern-card">
                        <div className="card-label-row">
                            <span className="card-label">Status Comment</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{comment.length}/43</span>
                        </div>
                        <input
                            type="text"
                            value={comment}
                            maxLength={43}
                            onChange={(e) => {
                                setComment(e.target.value);
                                saveSettings();
                            }}
                            placeholder="Status comment (e.g. Web APRS Beacon Pro)"
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                background: 'var(--background)',
                                color: 'var(--foreground)',
                                fontSize: '0.95rem',
                                fontWeight: '500'
                            }}
                        />
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                            Appended to position payload frame.
                        </div>
                    </div>
                </div>

                {/* Location Telemetry Card */}
                <div className="modern-card">
                    <div className="card-label-row">
                        <span className="card-label"><MapPin size={16} /> Location Telemetry & Map Selector</span>
                        <button
                            type="button"
                            onClick={fetchGPSLocation}
                            disabled={isLocating}
                            style={{
                                background: 'var(--primary)',
                                color: 'var(--primary-foreground)',
                                border: 'none',
                                padding: '0.4rem 0.85rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                cursor: isLocating ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            {isLocating ? <RefreshCw size={14} className="spin" /> : <Crosshair size={14} />}
                            {isLocating ? 'Locking GPS...' : 'Acquire Device GPS'}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>
                                LATITUDE (DECIMAL)
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={inputLat}
                                onChange={(e) => handleManualCoordChange(e.target.value, inputLon)}
                                placeholder="12.9716"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.8rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--background)',
                                    color: 'var(--foreground)',
                                    fontSize: '0.9rem',
                                    fontFamily: 'monospace'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>
                                LONGITUDE (DECIMAL)
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={inputLon}
                                onChange={(e) => handleManualCoordChange(inputLat, e.target.value)}
                                placeholder="77.5946"
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 0.8rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--background)',
                                    color: 'var(--foreground)',
                                    fontSize: '0.9rem',
                                    fontFamily: 'monospace'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: 'var(--secondary)', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div>
                            <strong>APRS Format:</strong> <code style={{ color: '#2563eb', fontWeight: '700' }}>{aprsLat} / {aprsLon}</code>
                        </div>
                        <div>
                            <strong>Decimal:</strong> <code>{coords.lat !== null ? coords.lat.toFixed(5) : '—'}, {coords.lon !== null ? coords.lon.toFixed(5) : '—'}</code> {gpsAccuracy && `(±${gpsAccuracy}m GPS)`}
                        </div>
                    </div>

                    {/* Interactive Leaflet Map Box */}
                    <div style={{ height: '260px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', marginTop: '0.5rem' }}>
                        {coords.lat !== null && coords.lon !== null && (
                            <MapContainer
                                center={[coords.lat, coords.lon]}
                                zoom={12}
                                scrollWheelZoom={false}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <MapPicker position={coords} setPosition={setCoords} addLog={addLog} />
                                <MapRecenter center={coords} />
                            </MapContainer>
                        )}
                    </div>
                </div>

                {/* APRS Live Packet String Preview */}
                <div className="modern-card" style={{ background: '#09090b', color: '#fafafa', border: '1px solid #27272a' }}>
                    <div className="card-label-row">
                        <span className="card-label" style={{ color: '#a1a1aa' }}>
                            <Radio size={14} /> APRS Frame Payload Preview
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <a
                                href={aprsFiUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    background: '#18181b',
                                    color: '#60a5fa',
                                    border: '1px solid #3f3f46',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    textDecoration: 'none',
                                    fontWeight: '600'
                                }}
                                title={`Inspect ${fullCall} live station map on aprs.fi`}
                            >
                                <Radio size={12} /> View on aprs.fi <ExternalLink size={11} />
                            </a>
                            <button
                                type="button"
                                onClick={copyPayload}
                                style={{
                                    background: '#18181b',
                                    color: '#fafafa',
                                    border: '1px solid #3f3f46',
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                }}
                            >
                                {copiedPayload ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
                                {copiedPayload ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>

                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem', color: '#38bdf8', wordBreak: 'break-all', background: '#000000', padding: '0.85rem 1rem', borderRadius: '6px' }}>
                        {aprsPacket}
                    </div>
                </div>

                {/* Submit Transmit Button */}
                <button
                    type="submit"
                    disabled={isTransmitting}
                    className="aprs-submit-btn"
                    style={{
                        background: isLive ? '#22c55e' : 'var(--primary)',
                        color: isLive ? '#ffffff' : 'var(--primary-foreground)',
                        boxShadow: isLive ? '0 4px 14px rgba(34, 197, 94, 0.3)' : '0 4px 14px rgba(0, 0, 0, 0.1)',
                    }}
                >
                    {isTransmitting ? <RefreshCw size={20} className="spin" /> : <Send size={20} />}
                    {isLive ? 'TRANSMIT LIVE PACKET TO APRS-IS' : 'SIMULATE APRS TRANSMISSION'}
                </button>
            </form>

            {/* Terminal Monitor Console */}
            <div className="modern-card" style={{ marginTop: '2rem', background: '#020617', border: '1px solid #1e293b', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <TerminalIcon size={16} style={{ color: '#38bdf8' }} /> Terminal Console Monitor
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={copyLogs}
                            style={{
                                background: '#0f172a',
                                color: '#94a3b8',
                                border: '1px solid #1e293b',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                            }}
                        >
                            {copiedLogs ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
                            {copiedLogs ? 'Copied' : 'Copy Logs'}
                        </button>
                        <button
                            type="button"
                            onClick={clearLogs}
                            style={{
                                background: '#0f172a',
                                color: '#f87171',
                                border: '1px solid #1e293b',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                            }}
                        >
                            <Trash2 size={12} /> Clear
                        </button>
                    </div>
                </div>

                <div
                    ref={terminalRef}
                    style={{
                        height: '160px',
                        overflowY: 'auto',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: '0.8rem',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        color: '#38bdf8'
                    }}
                >
                    {logs.map((log) => {
                        let color = '#38bdf8';
                        if (log.type === 'error') color = '#f87171';
                        if (log.type === 'success') color = '#4ade80';
                        if (log.type === 'warning') color = '#fde047';

                        return (
                            <div key={log.id} style={{ color, marginBottom: '0.25rem' }}>
                                <span style={{ opacity: 0.6, marginRight: '0.5rem' }}>[{log.timestamp}]</span>
                                {log.text}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
