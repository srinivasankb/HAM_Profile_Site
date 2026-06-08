import React, { useState, useEffect } from 'react';
import netsData from '../data/nets.json';
import profileData from '../data/profile.json';

const PHONETICS = {
    A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo',
    F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet',
    K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar',
    P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
    U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray',
    Y: 'Yankee', Z: 'Zulu',
    '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
    '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '0': 'Zero'
};

const getPhonetic = (callsign) => {
    return callsign.toUpperCase().split('').map(c => PHONETICS[c] || c).join(' ');
};

export default function NetCheckin() {
    const [selectedNet, setSelectedNet] = useState('');
    const [prefix, setPrefix] = useState('VU2');
    const [suffix, setSuffix] = useState('');
    const [updates, setUpdates] = useState('');
    const [includeHandle, setIncludeHandle] = useState(false);

    const [allNets, setAllNets] = useState([]);

    useEffect(() => {
        const combined = [];
        Object.entries(netsData).forEach(([location, nets]) => {
            nets.forEach(n => combined.push({ ...n, location }));
        });
        setAllNets(combined);
        if (combined.length > 0) {
            setSelectedNet(combined[0].id);
        }
    }, []);

    const getTimeBasedGreetings = (startTime) => {
        let hour = new Date().getHours();
        if (startTime) {
            const [h] = startTime.split(':');
            hour = parseInt(h, 10);
        }

        let greeting = 'Good evening';
        let signoff = 'Good night and good day tomorrow';

        if (hour >= 5 && hour < 12) {
            greeting = 'Good morning';
            signoff = 'Good day today';
        } else if (hour >= 12 && hour < 17) {
            greeting = 'Good afternoon';
            signoff = 'Good evening ahead';
        }

        return { greeting, signoff };
    };

    const generateScript = () => {
        const netObj = allNets.find(n => n.id === selectedNet);
        const controllerCallsign = suffix ? `${prefix}${suffix.toUpperCase()}` : '[NET CONTROLLER]';
        const myCallsign = profileData.callsign;
        const netName = netObj ? netObj.name : 'the NET';
        const { greeting, signoff } = getTimeBasedGreetings(netObj?.start);

        const hasCustomUpdates = updates.trim().length > 0;

        const trafficSection = hasCustomUpdates ? updates.trim() : `QRU for the NET / No traffic`;
        const handleText = includeHandle ? `\n\nHandle is Srinivas. QTH is Rayasandra` : '';

        return `${controllerCallsign} this is ${myCallsign}${handleText}

${greeting} everyone on the frequency

${trafficSection}

73 ${signoff}

${controllerCallsign} this is ${myCallsign} Clear.`;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generateScript());
        alert('Script copied to clipboard!');
    };

    const handleQuickUpdate = (text) => {
        setUpdates(prev => prev ? prev + '\n' + text : text);
    };

    return (
        <div className="modern-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
            <header className="profile-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h1 className="name-heading" style={{ fontSize: '2.5rem' }}>Net Check-in Assistant</h1>
                <p style={{ color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>
                    Quickly generate your check-in script for local VHF/UHF nets based on real-time conditions.
                </p>
            </header>

            <div className="modern-grid grid-2" style={{ marginBottom: '2rem' }}>
                <div className="modern-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card-label">1. Net Details</div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>SELECT NET</label>
                        <select
                            value={selectedNet}
                            onChange={(e) => setSelectedNet(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.95rem' }}
                        >
                            {allNets.map(n => (
                                <option key={n.id} value={n.id}>{n.name} ({n.location.toUpperCase()})</option>
                            ))}
                        </select>
                    </div>

                    {(() => {
                        const activeNet = allNets.find(n => n.id === selectedNet);
                        if (!activeNet) return null;
                        return (
                            <div style={{ background: 'var(--secondary)', padding: '1rem', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                                <div><span style={{ color: 'var(--muted-foreground)' }}>RX:</span> <strong style={{ color: 'var(--foreground)' }}>{activeNet.rx}</strong> MHz</div>
                                <div><span style={{ color: 'var(--muted-foreground)' }}>TX:</span> <strong style={{ color: 'var(--foreground)' }}>{activeNet.tx}</strong> MHz</div>
                                <div><span style={{ color: 'var(--muted-foreground)' }}>OFFSET:</span> <strong style={{ color: 'var(--foreground)' }}>{activeNet.offset}</strong></div>
                                <div><span style={{ color: 'var(--muted-foreground)' }}>TIME:</span> <strong style={{ color: 'var(--foreground)' }}>{activeNet.start}-{activeNet.end}</strong></div>
                            </div>
                        );
                    })()}

                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>NET CONTROLLER</label>
                        <div style={{ display: 'flex' }}>
                            <select
                                value={prefix}
                                onChange={(e) => setPrefix(e.target.value)}
                                style={{ padding: '0.75rem', borderRadius: '8px 0 0 8px', border: '1px solid var(--border)', borderRight: 'none', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.95rem' }}
                            >
                                <option value="VU2">VU2</option>
                                <option value="VU3">VU3</option>
                            </select>
                            <input
                                type="text"
                                value={suffix}
                                onChange={(e) => setSuffix(e.target.value)}
                                placeholder="SUFFIX (e.g. ABC)"
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '0 8px 8px 0', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', textTransform: 'uppercase', fontSize: '0.95rem' }}
                                maxLength={4}
                            />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: 'var(--foreground)', marginTop: '1rem' }}>
                            <input
                                type="checkbox"
                                checked={includeHandle}
                                onChange={(e) => setIncludeHandle(e.target.checked)}
                                style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)' }}
                            />
                            Include Handle and QTH
                        </label>
                    </div>
                </div>

                <div className="modern-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="card-label">2. Traffic / Updates</div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <textarea
                            value={updates}
                            onChange={(e) => setUpdates(e.target.value)}
                            placeholder="Enter weather, signal reports, or custom messages... (Leave empty for QRU)"
                            style={{ flex: 1, minHeight: '150px', width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', resize: 'vertical', fontSize: '0.95rem' }}
                        />

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => handleQuickUpdate('WX is clear and sunny.')} style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '4px', background: 'var(--secondary)', border: 'none', cursor: 'pointer', color: 'var(--foreground)', fontWeight: 600 }}>+ WX Clear</button>
                            <button type="button" onClick={() => handleQuickUpdate('You are coming in loud and clear, solid 5/9 into my station.')} style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '4px', background: 'var(--secondary)', border: 'none', cursor: 'pointer', color: 'var(--foreground)', fontWeight: 600 }}>+ 5/9 Signal</button>
                            <button type="button" onClick={() => handleQuickUpdate('Operating mobile/portable today.')} style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '4px', background: 'var(--secondary)', border: 'none', cursor: 'pointer', color: 'var(--foreground)', fontWeight: 600 }}>+ Mobile</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="modern-card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Generated Script</span>
                    <button
                        onClick={handleCopy}
                        style={{ background: 'rgba(255,255,255,0.2)', color: 'var(--primary-foreground)', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                        COPY TO CLIPBOARD
                    </button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--muted-foreground)', display: 'grid', gap: '0.5rem', background: 'var(--secondary)', padding: '1rem', borderRadius: '8px' }}>
                        {(() => {
                            const activeNet = allNets.find(n => n.id === selectedNet);
                            return activeNet && (
                                <div style={{ marginBottom: '0.25rem', paddingBottom: '0.5rem', borderBottom: '1px dashed var(--border)' }}>
                                    <span style={{ display: 'inline-block', width: '100px' }}>Active Net:</span> <strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>{activeNet.name}</strong>
                                </div>
                            );
                        })()}
                        <div><span style={{ display: 'inline-block', width: '100px' }}>Your Phonetic:</span> <strong style={{ color: 'var(--foreground)' }}>{getPhonetic(profileData.callsign)}</strong></div>
                        {suffix && (
                            <div><span style={{ display: 'inline-block', width: '100px' }}>Controller:</span> <strong style={{ color: 'var(--foreground)' }}>{getPhonetic(`${prefix}${suffix}`)}</strong></div>
                        )}
                    </div>

                    <pre style={{
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        fontFamily: 'monospace',
                        fontSize: '1.15rem',
                        lineHeight: '1.6',
                        color: 'var(--foreground)',
                        margin: 0
                    }}>
                        {generateScript()}
                    </pre>
                </div>
            </div>
        </div>
    );
}
