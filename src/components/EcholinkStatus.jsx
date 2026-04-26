import React, { useState, useEffect } from 'react';
import { Users, Wifi, WifiOff, MapPin, Clock, Info, Radio } from 'lucide-react';
import { getEcholinkStatus } from '../lib/ham-utils';

export default function EcholinkStatus({ variant = 'minimal', showLabel = true }) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStatus = async () => {
            const data = await getEcholinkStatus("VU35KB");
            setStatus(data);
            setLoading(false);
        };
        fetchStatus();

        // Refresh every minute to respect the cache/update cycle
        const interval = setInterval(fetchStatus, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6 }}>
                <Users size={14} />
                <span style={{ fontSize: '0.85rem' }}>Echolink status...</span>
            </div>
        );
    }

    const isOnline = status && status.status === 'ON';

    if (variant === 'card') {
        return (
            <div className="modern-card">
                <div className="card-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isOnline ? '#10b981' : 'var(--muted-foreground)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={14} /> Echolink {isOnline ? 'Online' : ''}
                    </div>
                    <div title="Real-time data synced with Echolink online status" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', cursor: 'help' }}>
                        <Info size={12} style={{ opacity: 0.4 }} />
                    </div>
                </div>
                {isOnline ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div className="signal-waves">
                                        <Radio size={16} className="text-primary" />
                                        <div className="wave"></div>
                                        <div className="wave delay-1"></div>
                                    </div>
                                    <span style={{ fontWeight: 800, fontSize: '1.25rem', fontFamily: 'monospace' }}>{status.node}</span>
                                </div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, opacity: 0.5, marginLeft: '24px' }}>NODE ID</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {status.location}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Last updated: {status.time} IST</div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>Offline</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>VU35KB is currently disconnected.</p>
                    </div>
                )}
            </div>
        );
    }

    // Default 'minimal' variant for Home Page highlight grid
    return (
        <div style={{ display: 'contents' }}>
            {showLabel && (
                <div className="card-label card-label-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={14} /> Echolink
                    </div>
                    <div title="Real-time data synced with Echolink online status" style={{ display: 'flex', alignItems: 'center', cursor: 'help' }}>
                        <Info size={12} style={{ opacity: 0.4 }} />
                    </div>
                </div>
            )}
            <div className="card-value" style={{ color: isOnline ? '#10b981' : 'inherit', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isOnline ? <Wifi size={18} /> : <WifiOff size={18} style={{ opacity: 0.7 }} />}
                <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                {isOnline ? (
                    <><b>#{status.node}</b> • {status.location.split(',')[0]}</>
                ) : 'Search: VU35KB'}
            </p>
            <style dangerouslySetInnerHTML={{
                __html: `
                .signal-waves {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .wave {
                    position: absolute;
                    width: 16px;
                    height: 16px;
                    border: 1px solid #10b981;
                    border-radius: 50%;
                    animation: ripple 2s infinite;
                    opacity: 0;
                }
                .delay-1 { animation-delay: 1s; }
                @keyframes ripple {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(3); opacity: 0; }
                }
            `}} />
        </div>
    );
}
