import React, { useState, useEffect } from 'react';
import {
    Radio,
    Award,
    Cloud,
    Clock,
    Compass,
    Wind,
    Droplets,
    ExternalLink,
    Sun,
    CloudRain,
    CloudLightning,
    CloudSun,
    Thermometer,
    Sunrise,
    Sunset,
    MapPin
} from 'lucide-react';
import { STATIONS, getSunTimes } from '../lib/ham-utils';

const WEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

export default function ProfilePage() {
    const [weatherData, setWeatherData] = useState({});
    const [time, setTime] = useState(new Date());
    const [units, setUnits] = useState('metric');
    const [tzMode, setTzMode] = useState('utc');

    useEffect(() => {
        setUnits(localStorage.getItem('pref_units') || 'metric');
        setTzMode(localStorage.getItem('pref_tz') || 'utc');
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

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

    const toTemp = (c) => {
        if (c === undefined || c === null || isNaN(c)) return '--';
        return units === 'metric' ? `${Math.round(c)}°C` : `${Math.round(c * 9 / 5 + 32)}°F`;
    };
    const toWind = (ms) => units === 'metric' ? `${ms} m/s` : `${(ms * 2.237).toFixed(1)} mph`;

    useEffect(() => {
        const fetchAllWeather = async () => {
            const results = {};
            for (const station of STATIONS) {
                const CACHE_KEY = `weather_${station.lat}_${station.lon}`;
                const CACHE_TTL = 5 * 60 * 1000;

                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    try {
                        const { data, timestamp } = JSON.parse(cached);
                        if (Date.now() - timestamp < CACHE_TTL) {
                            results[station.id] = data;
                            continue;
                        }
                    } catch (e) {
                        localStorage.removeItem(CACHE_KEY);
                    }
                }

                if (!WEATHER_API_KEY) {
                    results[station.id] = {
                        main: {
                            temp: station.id === 'bangalore' ? 28 : 31,
                            humidity: station.id === 'bangalore' ? 55 : 62,
                            feels_like: station.id === 'bangalore' ? 29 : 33
                        },
                        weather: [{ description: 'partly cloudy', main: 'Clouds' }],
                        wind: { speed: station.id === 'bangalore' ? 3.5 : 4.1 },
                        mock: true
                    };
                    continue;
                }


                try {
                    const response = await fetch(
                        `https://api.openweathermap.org/data/2.5/weather?lat=${station.lat}&lon=${station.lon}&appid=${WEATHER_API_KEY}&units=metric`
                    );
                    const data = await response.json();
                    if (response.ok) {
                        results[station.id] = data;
                        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
                    }
                } catch (err) {
                    console.error(`Weather fetch error for ${station.name}:`, err);
                }
            }
            setWeatherData(results);
        };
        fetchAllWeather();
    }, []);

    const getWeatherIcon = (condition) => {
        const main = condition?.main?.toLowerCase();
        const desc = condition?.description?.toLowerCase();
        if (main === 'clear') return <Sun size={32} className="weather-icon-sun" />;
        if (main === 'clouds') {
            if (desc?.includes('few') || desc?.includes('scattered')) return <CloudSun size={32} className="weather-icon-cloudy" />;
            return <Cloud size={32} className="weather-icon-cloudy" />;
        }
        if (main === 'rain' || main === 'drizzle' || main === 'mist') return <CloudRain size={32} className="weather-icon-rain" />;
        if (main === 'thunderstorm') return <CloudLightning size={32} className="weather-icon-storm" />;
        return <Cloud size={32} className="weather-icon-cloudy" />;
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
        <div className="modern-container" style={{ maxWidth: '1000px' }}>
            <header className="profile-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <div className="callsign-pill" style={{ marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ opacity: 0.6, fontWeight: 400, fontSize: '0.7rem' }}>CALL SIGN:</span>
                    <span>VU35KB</span>
                </div>
                <h1 className="name-heading" style={{ fontSize: '2.5rem' }}>Operating Stations</h1>
                <p style={{ color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>Real-time telemetry and schedule for active stations.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                {STATIONS.map(station => {
                    const weather = weatherData[station.id];
                    const sun = getSunTimes(station.lat, station.lon);

                    return (
                        <div key={station.id} className="modern-card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <MapPin size={20} />
                                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{station.name} {station.isPrimary && <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>PRIMARY</span>}</span>
                                </div>
                                <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', opacity: 0.8 }}>GRID: {station.grid}</div>
                            </div>

                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
                                { /* Weather Section */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        {weather && getWeatherIcon(weather.weather[0])}
                                        <div>
                                            <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>{weather ? toTemp(weather.main.temp) : '--'}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', textTransform: 'capitalize' }}>{weather ? weather.weather[0].description : 'Loading...'}</div>
                                        </div>
                                    </div>
                                    <button className="unit-toggle" onClick={toggleUnits}>
                                        <span className={units === 'metric' ? 'active' : ''}>°C</span>
                                        <span className="toggle-sep">|</span>
                                        <span className={units === 'imperial' ? 'active' : ''}>°F</span>
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                    <div className="stat-item">
                                        <div className="stat-label"><Thermometer size={14} /> Feels</div>
                                        <div className="stat-value">{weather ? toTemp(weather.main.feels_like) : '--'}</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-label"><Droplets size={14} /> Humidity</div>
                                        <div className="stat-value">{weather ? `${weather.main.humidity}%` : '--'}</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-label"><Wind size={14} /> Wind</div>
                                        <div className="stat-value">{weather ? toWind(weather.wind.speed) : '--'}</div>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                                    <div className="card-label-row" style={{ marginBottom: '1rem' }}>
                                        <span className="card-label"><Sun size={14} /> Sun Data</span>
                                        <button className="unit-toggle" onClick={toggleTz}>
                                            <span className={tzMode === 'utc' ? 'active' : ''}>UTC</span>
                                            <span className="toggle-sep">|</span>
                                            <span className={tzMode === 'ist' ? 'active' : ''}>IST</span>
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <Sunrise size={24} className="sunrise-icon" />
                                            <div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>SUNRISE</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace' }}>{sun ? formatSunTime(sun.sunrise) : '--'}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <Sunset size={24} className="sunset-icon" />
                                            <div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>SUNSET</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace' }}>{sun ? formatSunTime(sun.sunset) : '--'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                                    <a href={`/grid#${station.grid}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.75rem', borderRadius: '8px', background: 'var(--secondary)', color: 'var(--foreground)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
                                        Explore Grid <Compass size={14} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="modern-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                <div className="modern-card">
                    <div className="card-label"><Award size={14} /> Global License</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div className="card-value">ASOC Restricted Grade</div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Licensed since: April 2026 • Govt. of India</p>
                    </div>
                </div>

                <div className="modern-card">
                    <div className="card-label-row">
                        <span className="card-label"><Clock size={14} /> {getDisplayTime().label}</span>
                        <div className="unit-toggle">
                            <span className={tzMode === 'utc' ? 'active' : ''}>UTC</span>
                            <span className="toggle-sep">|</span>
                            <span className={tzMode === 'ist' ? 'active' : ''}>IST</span>
                        </div>
                    </div>
                    <div className="card-value" style={{ fontSize: '0.95rem' }}>{getDisplayTime().value}</div>
                </div>

                <div className="modern-card" style={{ gridColumn: 'span 1' }}>
                    <div className="card-label"><Radio size={14} /> Rig Details</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>Baofeng M13 Pro</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>2m/70cm • QRP Operation • Mobile Ready</p>
                    </div>
                </div>

                <div className="modern-card" style={{ gridColumn: 'span 1' }}>
                    <div className="card-label"><Award size={14} /> QSL Policy</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>QRZ.com logbook confirmed only.</p>
                        <a href="https://www.qrz.com/db/VU35KB" target="_blank" rel="noopener noreferrer" className="qrz-button"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem', textDecoration: 'none' }}>
                            QRZ Profile <ExternalLink size={14} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}


