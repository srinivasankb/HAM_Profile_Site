import React from 'react';
import { Calendar, MapPin, ExternalLink, ArrowRight, Clock } from 'lucide-react';
import eventsData from '../data/events.json';

export default function EventsSection() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getStatus = (startStr, endStr) => {
        const start = new Date(startStr);
        const end = new Date(endStr);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (today > end) return { label: 'Completed', color: 'var(--muted-foreground)', bg: 'var(--secondary)' };
        if (today >= start && today <= end) return { label: 'Happening Now', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', pulse: true };

        const diffTime = start - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { label: `In ${diffDays} Days`, color: 'var(--primary)', bg: 'rgba(0, 0, 0, 0.05)' };
    };

    const formatDate = (start, end) => {
        const s = new Date(start);
        const e = new Date(end);
        const options = { day: 'numeric', month: 'short' };

        if (start === end) {
            return s.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        }

        if (s.getMonth() === e.getMonth()) {
            return `${s.getDate()} - ${e.getDate()} ${s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        }

        return `${s.toLocaleDateString('en-US', options)} - ${e.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
    };

    // Sort events: Upcoming first, then current, then past
    const sortedEvents = [...eventsData].sort((a, b) => {
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);
        return dateA - dateB;
    });

    return (
        <section style={{ marginTop: '4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Where to Meet Me</h2>
                    <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>Events I'm attending or planning to visit. Come say hello!</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {sortedEvents.map(event => {
                    const status = getStatus(event.startDate, event.endDate);
                    const isUpcoming = !status.label.includes('Completed') && !status.label.includes('Happening');

                    return (
                        <div key={event.id} className="modern-card event-card" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem',
                            opacity: status.label === 'Completed' ? 0.7 : 1,
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    color: status.color,
                                    background: status.bg,
                                    border: `1px solid ${status.color === 'var(--primary)' ? 'rgba(0,0,0,0.1)' : 'transparent'}`
                                }}>
                                    {status.pulse && <span className="status-pulse-small" />}
                                    {status.label}
                                </span>
                                <img
                                    src={`https://flagcdn.com/w40/${event.countryId}.png`}
                                    alt={event.countryId}
                                    style={{ width: '24px', borderRadius: '4px', border: '1px solid var(--border)' }}
                                />
                            </div>

                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>{event.name}</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Calendar size={14} /> {formatDate(event.startDate, event.endDate)}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <MapPin size={14} /> {event.venue}, {event.location}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <a
                                    href={event.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Visit official website for ${event.name}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        color: 'var(--primary)',
                                        textDecoration: 'none'
                                    }}
                                >
                                    Event Website <ExternalLink size={14} />
                                </a>
                                {status.label !== 'Completed' && (
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        Let's meet <ArrowRight size={12} />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .status-pulse-small {
                    width: 6px;
                    height: 6px;
                    background: #10b981;
                    border-radius: 50%;
                    animation: pulse-small 1.5s infinite;
                }
                @keyframes pulse-small {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                .event-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .event-card:hover {
                    transform: translateY(-5px);
                    border-color: var(--primary) !important;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                }
            `}} />
        </section>
    );
}
