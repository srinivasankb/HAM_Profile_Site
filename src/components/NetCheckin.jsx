import React, { useState, useEffect, useRef } from 'react';
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

/* Shared input style constants */
const INPUT_BASE = {
    padding: '0.85rem',
    border: '1px solid var(--border)',
    background: 'var(--background)',
    color: 'var(--foreground)',
    fontSize: '1.1rem',
    lineHeight: '1.5',
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    boxSizing: 'border-box',
    WebkitAppearance: 'none',
};

const LABEL_STYLE = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--muted-foreground)',
    marginBottom: '0.5rem',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
};

const CLEAR_BTN = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--muted-foreground)',
    fontSize: '1.25rem',
    lineHeight: 1,
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: '28px',
    minHeight: '28px',
    borderRadius: '4px',
    transition: 'background 0.15s, color 0.15s',
};

const QUICK_BTN = {
    fontSize: '0.85rem',
    padding: '0.6rem 1rem',
    borderRadius: '6px',
    background: 'var(--secondary)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    color: 'var(--foreground)',
    fontWeight: 600,
    transition: 'background 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
};

export default function NetCheckin() {
    const [selectedNet, setSelectedNet] = useState('');
    const [prefix, setPrefix] = useState('VU2');
    const [suffix, setSuffix] = useState('');
    const [updates, setUpdates] = useState('');
    const [includeHandle, setIncludeHandle] = useState(false);
    const [copied, setCopied] = useState(false);

    const [allNets, setAllNets] = useState([]);
    const suffixRef = useRef(null);
    const updatesRef = useRef(null);

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
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleQuickUpdate = (text) => {
        setUpdates(prev => prev ? prev + '\n' + text : text);
        updatesRef.current?.focus();
    };

    const handleLogQSO = () => {
        const callsign = `${prefix}${suffix.toUpperCase()}`;
        const netObj = allNets.find(n => n.id === selectedNet);
        const netName = netObj ? netObj.name : '';
        if (netName) {
            navigator.clipboard.writeText(netName);
        }
        window.open(`https://logbook.qrz.com/logbook/?op=add;addcall=${callsign}`, '_blank');
    };

    const activeNet = allNets.find(n => n.id === selectedNet);

    return (
        <>
            <style>{`
                .nc-input:focus, .nc-select:focus, .nc-textarea:focus {
                    border-color: var(--primary) !important;
                    box-shadow: 0 0 0 3px rgba(24, 24, 27, 0.08) !important;
                }
                .nc-clear-btn:hover {
                    background: var(--secondary) !important;
                    color: var(--foreground) !important;
                }
                .nc-quick-btn:hover {
                    border-color: var(--primary) !important;
                    background: var(--background) !important;
                }
                .nc-log-btn:hover {
                    opacity: 0.85;
                }
                .nc-copy-btn:hover {
                    background: rgba(255,255,255,0.3) !important;
                }
                @media (max-width: 768px) {
                    .nc-form-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .nc-header h1 {
                        font-size: 1.75rem !important;
                    }
                    .nc-callsign-row {
                        flex-wrap: wrap !important;
                    }
                    .nc-callsign-input-wrap {
                        min-width: 120px !important;
                    }
                    .nc-log-btn {
                        border-radius: 8px !important;
                        border-left: 1px solid var(--primary) !important;
                        flex: 1 1 100% !important;
                        justify-content: center !important;
                    }
                    .nc-script-header {
                        flex-direction: column !important;
                        gap: 0.75rem !important;
                        align-items: stretch !important;
                    }
                    .nc-script-pre {
                        font-size: 0.95rem !important;
                    }
                    .nc-freq-grid {
                        grid-template-columns: 1fr 1fr !important;
                    }
                }
            `}</style>

            <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem' }}>
                {/* Header */}
                <header className="nc-header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <h1 className="name-heading" style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>Net Check-in Assistant</h1>
                    <p style={{ color: 'var(--muted-foreground)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto' }}>
                        Quickly generate your check-in script for local VHF/UHF nets based on real-time conditions.
                    </p>
                </header>

                {/* Form Grid */}
                <div className="nc-form-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1.25rem',
                    marginBottom: '1.5rem',
                    alignItems: 'stretch',
                }}>
                    {/* Card 1: Net Details */}
                    <div className="modern-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="card-label">1. Net Details</div>

                        {/* Net Select */}
                        <div>
                            <label style={LABEL_STYLE}>Select Net</label>
                            <select
                                className="nc-select"
                                value={selectedNet}
                                onChange={(e) => setSelectedNet(e.target.value)}
                                style={{
                                    ...INPUT_BASE,
                                    width: '100%',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                }}
                            >
                                {allNets.map(n => (
                                    <option key={n.id} value={n.id}>{n.name} ({n.location.toUpperCase()})</option>
                                ))}
                            </select>
                        </div>

                        {/* Frequency Info */}
                        {activeNet && (
                            <div className="nc-freq-grid" style={{
                                background: 'var(--secondary)',
                                padding: '0.85rem 1rem',
                                borderRadius: '8px',
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '0.6rem 1.5rem',
                                fontSize: '0.85rem',
                            }}>
                                <div><span style={{ color: 'var(--muted-foreground)' }}>RX:</span> <strong style={{ color: 'var(--foreground)' }}>{activeNet.rx}</strong> MHz</div>
                                <div><span style={{ color: 'var(--muted-foreground)' }}>TX:</span> <strong style={{ color: 'var(--foreground)' }}>{activeNet.tx}</strong> MHz</div>
                                <div><span style={{ color: 'var(--muted-foreground)' }}>OFFSET:</span> <strong style={{ color: 'var(--foreground)' }}>{activeNet.offset}</strong></div>
                                <div><span style={{ color: 'var(--muted-foreground)' }}>TIME:</span> <strong style={{ color: 'var(--foreground)' }}>{activeNet.start}-{activeNet.end}</strong></div>
                            </div>
                        )}

                        {/* Net Controller */}
                        <div>
                            <label style={LABEL_STYLE}>Net Controller Callsign</label>
                            <div className="nc-callsign-row" style={{ display: 'flex', gap: '0' }}>
                                <select
                                    className="nc-select"
                                    value={prefix}
                                    onChange={(e) => setPrefix(e.target.value)}
                                    style={{
                                        ...INPUT_BASE,
                                        borderRadius: '8px 0 0 8px',
                                        borderRight: 'none',
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        minWidth: '72px',
                                    }}
                                >
                                    <option value="VU2">VU2</option>
                                    <option value="VU3">VU3</option>
                                </select>

                                <div className="nc-callsign-input-wrap" style={{ position: 'relative', flex: '1 1 auto', display: 'flex', minWidth: '100px' }}>
                                    <input
                                        ref={suffixRef}
                                        className="nc-input"
                                        type="text"
                                        value={suffix}
                                        onChange={(e) => setSuffix(e.target.value)}
                                        placeholder="Suffix"
                                        autoCapitalize="characters"
                                        autoComplete="off"
                                        autoCorrect="off"
                                        spellCheck="false"
                                        style={{
                                            ...INPUT_BASE,
                                            width: '100%',
                                            borderRadius: suffix ? '0' : '0 8px 8px 0',
                                            textTransform: 'uppercase',
                                            fontWeight: 600,
                                            letterSpacing: '0.05em',
                                            paddingRight: suffix ? '2.25rem' : '0.75rem',
                                        }}
                                        maxLength={4}
                                    />
                                    {suffix && (
                                        <button
                                            type="button"
                                            className="nc-clear-btn"
                                            title="Clear callsign"
                                            onClick={() => { setSuffix(''); suffixRef.current?.focus(); }}
                                            style={{
                                                ...CLEAR_BTN,
                                                position: 'absolute',
                                                right: '0.35rem',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                            }}
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>

                                {suffix && (
                                    <button
                                        type="button"
                                        className="nc-log-btn"
                                        title="Log QSO on QRZ.com (copies net name to clipboard)"
                                        onClick={handleLogQSO}
                                        style={{
                                            ...INPUT_BASE,
                                            borderRadius: '0 8px 8px 0',
                                            border: '1px solid var(--primary)',
                                            borderLeft: 'none',
                                            background: 'var(--primary)',
                                            color: 'var(--primary-foreground)',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.35rem',
                                            transition: 'opacity 0.2s ease',
                                            flexShrink: 0,
                                            padding: '0.75rem 1rem',
                                        }}
                                    >
                                        Log QSO
                                    </button>
                                )}
                            </div>

                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                color: 'var(--foreground)',
                                marginTop: '1rem',
                                padding: '0.25rem 0',
                            }}>
                                <input
                                    type="checkbox"
                                    checked={includeHandle}
                                    onChange={(e) => setIncludeHandle(e.target.checked)}
                                    style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                                />
                                Include Handle and QTH
                            </label>
                        </div>
                    </div>

                    {/* Card 2: Traffic / Updates */}
                    <div className="modern-card" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="card-label">2. Traffic / Updates</div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <textarea
                                    ref={updatesRef}
                                    className="nc-textarea"
                                    value={updates}
                                    onChange={(e) => setUpdates(e.target.value)}
                                    placeholder="Enter weather, signal reports, or custom messages... (Leave empty for QRU)"
                                    style={{
                                        ...INPUT_BASE,
                                        flex: 1,
                                        minHeight: '140px',
                                        width: '100%',
                                        borderRadius: '8px',
                                        resize: 'vertical',
                                        paddingRight: updates ? '2.25rem' : '0.75rem',
                                    }}
                                />
                                {updates && (
                                    <button
                                        type="button"
                                        className="nc-clear-btn"
                                        title="Clear message"
                                        onClick={() => { setUpdates(''); updatesRef.current?.focus(); }}
                                        style={{
                                            ...CLEAR_BTN,
                                            position: 'absolute',
                                            right: '0.5rem',
                                            top: '0.5rem',
                                            background: 'var(--secondary)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '4px',
                                        }}
                                    >
                                        &times;
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button type="button" className="nc-quick-btn" onClick={() => handleQuickUpdate('WX is clear and sunny.')} style={QUICK_BTN}>+ WX Clear</button>
                                <button type="button" className="nc-quick-btn" onClick={() => handleQuickUpdate('You are coming in loud and clear, solid 5/9 into my station.')} style={QUICK_BTN}>+ 5/9 Signal</button>
                                <button type="button" className="nc-quick-btn" onClick={() => handleQuickUpdate('Operating mobile/portable today.')} style={QUICK_BTN}>+ Mobile</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Generated Script Card */}
                <div className="modern-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div className="nc-script-header" style={{
                        background: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                    }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Generated Script</span>
                        <button
                            className="nc-copy-btn"
                            onClick={handleCopy}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                color: 'var(--primary-foreground)',
                                border: 'none',
                                padding: '0.5rem 1.25rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {copied ? 'COPIED' : 'COPY TO CLIPBOARD'}
                        </button>
                    </div>

                    <div style={{ padding: '1.25rem' }}>
                        {/* Metadata summary */}
                        <div style={{
                            marginBottom: '1.25rem',
                            fontSize: '0.85rem',
                            color: 'var(--muted-foreground)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            background: 'var(--secondary)',
                            padding: '1rem',
                            borderRadius: '8px',
                        }}>
                            {activeNet && (
                                <div style={{ marginBottom: '0.25rem', paddingBottom: '0.5rem', borderBottom: '1px dashed var(--border)' }}>
                                    <span style={{ display: 'inline-block', width: '100px' }}>Active Net:</span> <strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>{activeNet.name}</strong>
                                </div>
                            )}
                            <div><span style={{ display: 'inline-block', width: '100px' }}>Your Phonetic:</span> <strong style={{ color: 'var(--foreground)' }}>{getPhonetic(profileData.callsign)}</strong></div>
                            {suffix && (
                                <div><span style={{ display: 'inline-block', width: '100px' }}>Controller:</span> <strong style={{ color: 'var(--foreground)' }}>{getPhonetic(`${prefix}${suffix}`)}</strong></div>
                            )}
                        </div>

                        <pre className="nc-script-pre" style={{
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                            fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
                            fontSize: '1.2rem',
                            fontWeight: 600,
                            lineHeight: '1.4',
                            color: 'var(--foreground)',
                            margin: 0,
                            background: 'var(--background)',
                            padding: '1rem',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                        }}>
                            {generateScript()}
                        </pre>
                    </div>
                </div>
            </div>
        </>
    );
}
