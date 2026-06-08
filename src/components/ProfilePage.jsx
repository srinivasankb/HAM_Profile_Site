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
import { STATIONS, getSunTimes } from '../lib/ham-utils';
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







    const getTemporalDetails = () => {
        const d = new Date(time);
        const start = new Date(d.getFullYear(), 0, 0);
        const diff = d - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const day = Math.floor(diff / oneDay);
        const week = Math.ceil(day / 7);
        return { day, week };
    };

    const getTimes = () => {
        const utc_d = time.getUTCDate().toString().padStart(2, '0');
        const utc_m = time.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        const utc_y = time.getUTCFullYear();
        const utc_t = time.toISOString().slice(11, 16);
        const utcValue = `${utc_m} ${utc_d}, ${utc_y} • ${utc_t} Z`;

        const istDatePart = time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
        const istTimePart = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
        const istValue = `${istDatePart} • ${istTimePart} IST`;

        return { utcValue, istValue };
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
                                <div style={{ minWidth: 0, flex: '1 1 auto', paddingRight: '1rem' }}>
                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#b91c1c', lineHeight: 1.2, marginBottom: '2px' }} title={n.name}>{n.name}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.8, color: '#b91c1c' }}>Ends at {n.end} IST</div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
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
                                <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px dashed var(--border)', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.3 }}>{n.name}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, flexShrink: 0, marginTop: '2px' }}>{n.start} IST</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="net-status-section">
                    <div className="card-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                        <History size={14} /> FULL SCHEDULE
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
                        {nets.map(n => {
                            const isPast = parseTimeToMinutes(n.end) < currentMins;
                            const isOngoing = currentMins >= parseTimeToMinutes(n.start) && currentMins < parseTimeToMinutes(n.end);
                            
                            return (
                                <div key={n.id} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    padding: '0.75rem', 
                                    borderRadius: '8px',
                                    background: isOngoing ? 'rgba(239, 68, 68, 0.05)' : 'var(--secondary)',
                                    border: isOngoing ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent',
                                    opacity: isPast ? 0.5 : 1,
                                    transition: 'all 0.2s'
                                }}>
                                    <div style={{ flex: '0 0 85px' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isOngoing ? '#ef4444' : 'var(--primary)' }}>{n.start}</div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)' }}>to {n.end}</div>
                                    </div>
                                    <div style={{ flex: '1 1 auto', padding: '0 10px', minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isOngoing ? '#ef4444' : 'var(--foreground)', lineHeight: 1.2, marginBottom: '2px' }} title={n.name}>{n.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>TX: {n.tx} • Offset: {n.offset}</div>
                                    </div>
                                    <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                                        <div style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'monospace', color: isOngoing ? '#ef4444' : 'var(--foreground)' }}>{n.rx}</div>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 600, background: 'rgba(128,128,128,0.1)', padding: '2px 4px', borderRadius: '4px', display: 'inline-block', marginTop: '2px', color: 'var(--muted-foreground)' }}>MHz</div>
                                    </div>
                                </div>
                            );
                        })}
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
                        <span className="card-label"><Clock size={14} /> Station Time</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.05em', marginBottom: '2px' }}>STATION LOCAL TIME</div>
                            <div className="card-value" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {getTimes().istValue}
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted-foreground)', background: 'var(--secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                                    (UTC +05:30)
                                </span>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.05em', marginBottom: '2px' }}>UTC TIME</div>
                            <div className="card-value" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {getTimes().utcValue}
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted-foreground)', background: 'var(--secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                                    (UTC +00:00)
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', background: 'rgba(37, 99, 235, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            Day {getTemporalDetails().day}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', background: 'rgba(37, 99, 235, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            Week {getTemporalDetails().week}
                        </span>
                    </div>
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
                        {hardwareData.handheld && (
                            <>
                                <div style={{ borderTop: '1px dashed var(--border)', margin: '0.5rem 0' }}></div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                        <p style={{ fontSize: '0.95rem', fontWeight: 700 }}>{hardwareData.handheld.name}</p>
                                        <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>{hardwareData.handheld.status}</span>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{hardwareData.handheld.category}</p>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {hardwareData.handheld.specs.map(spec => (
                                        <span key={spec} style={{ fontSize: '0.7rem', background: 'var(--secondary)', padding: '2px 8px', borderRadius: '4px' }}>{spec}</span>
                                    ))}
                                </div>
                            </>
                        )}
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
                <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', margin: '0 auto' }}>
                    Schedule of local VHF/UHF nets I regularly monitor and participate in to stay connected with the community.
                </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
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


