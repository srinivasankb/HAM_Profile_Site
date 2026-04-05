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
    Sunset
} from 'lucide-react';
import { STATION, getSunTimes } from '../lib/ham-utils';

const WEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

export default function ProfilePage() {
    const [weather, setWeather] = useState(null);
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

    const toTemp = (c) => units === 'metric' ? `${Math.round(c)}°C` : `${Math.round(c * 9 / 5 + 32)}°F`;
    const toWind = (ms) => units === 'metric' ? `${ms} m/s` : `${(ms * 2.237).toFixed(1)} mph`;

    useEffect(() => {
        const CACHE_KEY = `weather_${STATION.lat}_${STATION.lon}`;
        const CACHE_TTL = 5 * 60 * 1000;

        const fetchWeather = async () => {
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
                if (response.ok) {
                    setWeather(data);
                    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
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
        <div className="modern-container">
            <header className="profile-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <div className="callsign-pill" style={{ marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ opacity: 0.6, fontWeight: 400, fontSize: '0.7rem' }}>CALL SIGN:</span>
                    <span>VU35KB</span>
                </div>
                <h1 className="name-heading" style={{ fontSize: '2rem' }}>Station Details</h1>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.925rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    Rajapalayam, IN <img src="https://flagcdn.com/w20/in.png" alt="India" style={{ width: '18px', height: 'auto', borderRadius: '2px', display: 'inline-block' }} />
                </p>
            </header>

            <div className="modern-grid">
                <div className="modern-card">
                    <div className="card-label"><Award size={14} /> License</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div className="card-value">ASOC Restricted Grade</div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Licensed since: April 2026</p>
                    </div>
                </div>
                <div className="modern-card">
                    <div className="card-label"><Compass size={14} /> Grid Square</div>
                    <div className="card-value">
                        <a href={`/grid#${STATION.grid}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            {STATION.grid} <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} />
                        </a>
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
                            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)' }}>Rig: Baofeng M13 Pro</p>
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
