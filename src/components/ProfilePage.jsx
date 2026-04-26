import React, { useState, useEffect } from 'react';
import {
    Radio,
    Award,
    Compass,
    Clock,
    ExternalLink,
    Sun,
    Sunrise,
    Sunset,
    MapPin,
    Calendar,
    Zap,
    History,
    Users
} from 'lucide-react';
import { STATIONS, getSunTimes, getEcholinkStatus } from '../lib/ham-utils';
import EcholinkStatus from './EcholinkStatus';
import netsData from '../data/nets.json';
import profileData from '../data/profile.json';
import clubsData from '../data/clubs.json';
import hardwareData from '../data/hardware.json';




export default function ProfilePage() {
    const [time, setTime] = useState(new Date());
    const [tzMode, setTzMode] = useState('utc');

    useEffect(() => {
        setTzMode(localStorage.getItem('pref_tz') || 'utc');
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);



    const toggleTz = () => setTzMode(t => {
        const next = t === 'utc' ? 'ist' : 'utc';
        localStorage.setItem('pref_tz', next);
        return next;
    });







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

    const getISTMinutes = () => {
        const istStr = time.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
        const timeStr = istStr.split(', ')[1];
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const parseTimeToMinutes = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    const renderNetSchedule = (stationId) => {
        const nets = netsData[stationId] || [];
        if (nets.length === 0) return <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No scheduled nets for this location.</p>;

        const currentMins = getISTMinutes();
        const ongoing = nets.filter(n => {
            const start = parseTimeToMinutes(n.start);
            const end = parseTimeToMinutes(n.end);
            return currentMins >= start && currentMins < end;
        });

        const upcoming = nets.filter(n => {
            const start = parseTimeToMinutes(n.start);
            return start > currentMins;
        }).sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="net-status-section">
                    <div className="card-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem', color: ongoing.length > 0 ? '#ef4444' : 'var(--muted-foreground)' }}>
                        <Zap size={14} fill={ongoing.length > 0 ? '#ef4444' : 'transparent'} className={ongoing.length > 0 ? 'pulse' : ''} />
                        {ongoing.length > 0 ? 'ONGOING NOW (LIVE)' : 'NO ONGOING NETS'}
                    </div>
                    {ongoing.length > 0 ? (
                        ongoing.map(n => (
                            <div key={n.id} className="net-item ongoing" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.05)' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#b91c1c' }}>{n.name}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.8, color: '#b91c1c' }}>Ends at {n.end} IST</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 800, color: '#ef4444', fontSize: '1.1rem' }}>{n.rx}</div>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.7, color: '#b91c1c' }}>Offset: {n.offset}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: '0.75rem', borderRadius: '8px', border: '1px dashed var(--border)', fontSize: '0.8rem', color: 'var(--muted-foreground)', textAlign: 'center' }}>
                            Station is currently clear. Next net starts soon.
                        </div>
                    )}
                </div>

                {upcoming.length > 0 && (
                    <div className="net-status-section">
                        <div className="card-label" style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                            <Clock size={14} /> UPCOMING TODAY
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {upcoming.slice(0, 2).map(n => (
                                <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed var(--border)' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{n.name}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>{n.start} IST</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="net-status-section">
                    <div className="card-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                        <History size={14} /> FULL SCHEDULE
                    </div>
                    <div className="table-container" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>TIME (IST)</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>NET NAME</th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>FREQ (MHz)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {nets.map(n => (
                                    <tr key={n.id} style={{ borderBottom: '1px solid var(--border)', opacity: parseTimeToMinutes(n.end) < currentMins ? 0.4 : 1 }}>
                                        <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{n.start} - {n.end}</td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <div style={{ fontWeight: 600 }}>{n.name}</div>
                                            <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>Offset: {n.offset} | TX: {n.tx}</div>
                                        </td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>{n.rx}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="modern-container" style={{ maxWidth: '1000px' }}>
            <header className="profile-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <div className="callsign-pill" style={{ marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ opacity: 0.6, fontWeight: 400, fontSize: '0.7rem' }}>CALL SIGN:</span>
                    <span>{profileData.callsign}</span>
                </div>
                <h1 className="name-heading" style={{ fontSize: '2.5rem' }}>Operating Stations</h1>
                <p style={{ color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>
                    Real-time telemetry and schedule for {profileData.name}'s active stations.
                </p>
            </header>

            <div className="modern-grid grid-2" style={{ marginBottom: '2rem' }}>
                {STATIONS.map(station => {
                    const sun = getSunTimes(station.lat, station.lon);

                    return (
                        <div key={station.id} className="modern-card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div className={`status-pulse ${time > sun.sunrise && time < sun.sunset ? 'day' : 'night'}`}></div>
                                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{station.name} {station.isPrimary && <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>PRIMARY</span>}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(station.grid);
                                        const btn = document.getElementById(`grid-copy-${station.id}`);
                                        if (btn) {
                                            const oldText = btn.innerText;
                                            btn.innerText = 'COPIED!';
                                            btn.style.color = '#10b981';
                                            setTimeout(() => {
                                                btn.innerText = oldText;
                                                btn.style.color = '';
                                            }, 2000);
                                        }
                                    }}
                                    style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.9rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title="Click to copy Grid Square"
                                >
                                    GRID: <span id={`grid-copy-${station.id}`}>{station.grid}</span>
                                </button>
                            </div>

                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                    <div className="stat-item">
                                        <div className="stat-label"><Compass size={14} /> Latitude</div>
                                        <div className="stat-value" style={{ fontSize: '0.9rem' }}>{station.lat.toFixed(4)}°</div>
                                    </div>
                                    <div className="stat-item">
                                        <div className="stat-label"><Compass size={14} /> Longitude</div>
                                        <div className="stat-value" style={{ fontSize: '0.9rem' }}>{station.lon.toFixed(4)}°</div>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                                    <div className="card-label-row" style={{ marginBottom: '1.5rem' }}>
                                        <span className="card-label"><Sun size={14} /> Solar State & Telemetry</span>
                                        <button className="unit-toggle" onClick={toggleTz} aria-label={`Switch to ${tzMode === 'utc' ? 'IST' : 'UTC'} timezone`}>
                                            <span className={tzMode === 'utc' ? 'active' : ''}>UTC</span>
                                            <span className="toggle-sep">|</span>
                                            <span className={tzMode === 'ist' ? 'active' : ''}>IST</span>
                                        </button>
                                    </div>

                                    {/* Real-time Solar Status */}
                                    <div style={{
                                        padding: '1rem',
                                        borderRadius: '12px',
                                        background: time > sun.sunrise && time < sun.sunset
                                            ? 'rgba(251, 191, 36, 0.08)'
                                            : 'rgba(30, 41, 59, 0.05)',
                                        border: '1px solid ' + (time > sun.sunrise && time < sun.sunset ? 'rgba(251, 191, 36, 0.2)' : 'rgba(30, 41, 59, 0.1)'),
                                        marginBottom: '1.5rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.05em' }}>CURRENT STATE</div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', marginTop: '2px' }}>
                                                    {time > sun.sunrise && time < sun.sunset ? 'Daylight' : 'Nightfall'}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.05em' }}>NEXT EVENT</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted-foreground)', marginTop: '2px' }}>
                                                    {(() => {
                                                        let target, label;
                                                        if (time < sun.sunrise) {
                                                            target = sun.sunrise;
                                                            label = 'Sunrise';
                                                        } else if (time < sun.sunset) {
                                                            target = sun.sunset;
                                                            label = 'Sunset';
                                                        } else {
                                                            target = new Date(sun.sunrise.getTime() + 86400000);
                                                            label = 'Sunrise';
                                                        }
                                                        const diff = Math.max(0, Math.floor((target.getTime() - time.getTime()) / 1000));
                                                        const h = Math.floor(diff / 3600);
                                                        const m = Math.floor((diff % 3600) / 60);
                                                        return `${label} in ${h}h ${m}m`;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', opacity: time < sun.sunrise ? 1 : 0.6 }}>
                                            <Sunrise size={24} style={{ color: '#fbbf24' }} />
                                            <div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>SUNRISE</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace' }}>{sun ? formatSunTime(sun.sunrise) : '--'}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', opacity: time >= sun.sunrise && time < sun.sunset ? 1 : 0.6 }}>
                                            <Sunset size={24} style={{ color: '#f97316' }} />
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

            <div className="modern-grid grid-2" style={{ marginBottom: '3rem' }}>
                <div className="modern-card">
                    <div className="card-label"><Award size={14} /> Global License</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div className="card-value">{profileData.license.grade}</div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Valid till: {profileData.license.validThru} • {profileData.license.authority}</p>
                    </div>
                </div>

                <EcholinkStatus variant="card" />

                <div className="modern-card">
                    <div className="card-label-row">
                        <span className="card-label"><Clock size={14} /> {getDisplayTime().label}</span>
                        <button className="unit-toggle" onClick={toggleTz} title="Toggle timezone">
                            <span className={tzMode === 'utc' ? 'active' : ''}>UTC</span>
                            <span className="toggle-sep">|</span>
                            <span className={tzMode === 'ist' ? 'active' : ''}>IST</span>
                        </button>
                    </div>
                    <div className="card-value" style={{ fontSize: '0.95rem' }}>{getDisplayTime().value}</div>
                </div>

                <div className="modern-card">
                    <div className="card-label"><Radio size={14} /> Rig Details</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <p style={{ fontSize: '0.95rem', fontWeight: 700 }}>{hardwareData.primary.name}</p>
                                <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>{hardwareData.primary.status}</span>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{hardwareData.primary.category}</p>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {hardwareData.primary.specs.map(spec => (
                                <span key={spec} style={{ fontSize: '0.7rem', background: 'var(--secondary)', padding: '2px 8px', borderRadius: '4px' }}>{spec}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="modern-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-label"><Award size={14} /> QSL Policy</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <p style={{ fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: '0.5rem', fontWeight: 600 }}>{profileData.qsl.policy}</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: '1.5' }}>
                                {profileData.qsl.description}
                            </p>
                        </div>
                        <a href={profileData.qsl.qrzUrl} target="_blank" rel="noopener noreferrer" className="qrz-button"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, textDecoration: 'none', transition: 'transform 0.2s' }}>
                            View QRZ Profile <ExternalLink size={16} />
                        </a>
                    </div>
                </div>
            </div>

            { /* Net Schedule Section */}
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', maxWidth: '600px', margin: '0 auto' }}>
                    I regularly monitor these local nets to stay connected with the amateur radio community and occasionally participate to practice my operating skills.
                </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                {STATIONS.map(station => (
                    <div key={`nets-${station.id}`} className="modern-card">
                        <div className="card-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                            <Calendar size={16} /> NET SCHEDULE • {station.name.toUpperCase()}
                        </div>
                        {renderNetSchedule(station.id)}
                    </div>
                ))}
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .status-pulse {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    position: relative;
                }
                .status-pulse.day {
                    background: #fbbf24;
                    box-shadow: 0 0 8px #fbbf24;
                    animation: pulse-day 2s infinite;
                }
                .status-pulse.night {
                    background: #3b82f6;
                    box-shadow: 0 0 8px #3b82f6;
                    animation: pulse-night 2s infinite;
                }
                @keyframes pulse-day {
                    0% { opacity: 0.6; transform: scale(0.9); }
                    50% { opacity: 1; transform: scale(1.1); }
                    100% { opacity: 0.6; transform: scale(0.9); }
                }
                @keyframes pulse-night {
                    0% { opacity: 0.4; transform: scale(0.9); }
                    50% { opacity: 0.8; transform: scale(1.1); }
                    100% { opacity: 0.4; transform: scale(0.9); }
                }
            `}} />
        </div>
    );
}


