import React, { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    RadioTower,
    Info,
    Printer,
    Share2,
    Check,
    Mic,
    Music,
    Terminal,
    Lightbulb,
    Shield,
    ChevronDown,
    ChevronUp,
    Zap,
} from 'lucide-react';
import bandData from '../data/india-bands.json';
import '../styles/india-band-plan.css';

const {
    bands: bandsData,
    emissionsLegend,
    meta,
    allocationLegend,
    licensingReminders,
    modeFilters,
    commonModeMap,
} = bandData;

const SHARE_TITLE = 'India HAM Radio Band Plan';
const SHARE_TEXT = 'Interactive India amateur radio band plan: NFAP-2025 / WPC frequency allocations, emission designators, and power limits for Restricted & General grade licenses.';
const PAGE_URL = 'https://ham.srinikb.in/india-band-plan';

const SPECTRUM_SEGMENTS = [
    { filter: 'MF', label: 'MF', range: '.3-3 MHz' },
    { filter: 'HF', label: 'HF', range: '3-30 MHz' },
    { filter: 'VHF', label: 'VHF', range: '30-300 MHz' },
    { filter: 'UHF', label: 'UHF', range: '.3-3 GHz' },
    { filter: 'SHF', label: 'SHF', range: '3-30 GHz' },
];

const TYPE_COLORS = {
    MF: '#8b5cf6',
    HF: '#3b82f6',
    VHF: '#10b981',
    UHF: '#f59e0b',
    SHF: '#ef4444',
};

const TYPE_DESCRIPTIONS = {
    MF: 'Medium Frequency (300 kHz to 3 MHz)',
    HF: 'High Frequency (3 MHz to 30 MHz)',
    VHF: 'Very High Frequency (30 MHz to 300 MHz)',
    UHF: 'Ultra High Frequency (300 MHz to 3 GHz)',
    SHF: 'Super High Frequency (3 GHz to 30 GHz)',
};

const ALLOCATION_LABELS = {
    primary: 'Primary',
    'primary-shared': 'Primary · Shared',
    secondary: 'Secondary',
    nib: 'NIB',
    terrestrial: 'Terrestrial',
};

function parseHash() {
    const raw = window.location.hash.replace('#', '').toLowerCase();
    if (!raw) return { grade: null, mode: 'all' };
    const parts = raw.split('-');
    let grade = null;
    let mode = 'all';
    if (parts[0] === 'general' || parts[0] === 'restricted') grade = parts[0];
    if (parts[1] && modeFilters.some(m => m.id === parts[1])) mode = parts[1];
    else if (!grade && modeFilters.some(m => m.id === parts[0])) mode = parts[0];
    return { grade, mode };
}

function buildShareUrl(isGeneral, modeFilter) {
    const grade = isGeneral ? 'general' : 'restricted';
    if (modeFilter === 'all') return `${PAGE_URL}#${grade}`;
    return `${PAGE_URL}#${grade}-${modeFilter}`;
}

function bandSupportsMode(emissions, modeId) {
    if (!emissions || modeId === 'all') return true;
    const filter = modeFilters.find(m => m.id === modeId);
    if (!filter?.emissions) return true;
    return emissions.some(e => filter.emissions.includes(e));
}

function getModeBadges(emissions) {
    const hasCW = emissions.some(e => ['A1A', 'A2A', 'F1A'].includes(e));
    const hasVoice = emissions.some(e => ['A3E', 'J3E', 'F3E', 'H3E', 'R3E'].includes(e));
    const hasData = emissions.some(e => ['F1B', 'F2B', 'F3C', 'A3C', 'A3F', 'A3X'].includes(e));

    const badges = [];
    if (hasVoice) badges.push({ key: 'voice', label: 'Voice', icon: Mic });
    if (hasCW) badges.push({ key: 'cw', label: 'CW', icon: Music });
    if (hasData) badges.push({ key: 'data', label: 'Digital', icon: Terminal });
    return badges;
}

function getGradeDiff(band) {
    const r = band.restricted;
    const g = band.general;
    if (!g && !r) return null;
    if (!r && g) return { type: 'general-only', text: 'General Grade only' };
    if (r && !g) return { type: 'restricted-only', text: 'Not available on Restricted' };
    const addedEmissions = g.emission.filter(e => !r.emission.includes(e));
    const powerDiff = r.power !== g.power ? `${r.power} → ${g.power}` : null;
    const parts = [];
    if (powerDiff) parts.push(`Power: ${powerDiff}`);
    if (addedEmissions.length) {
        const modes = [...new Set(addedEmissions.map(e => commonModeMap[e] || e))].slice(0, 4);
        parts.push(`General adds: ${modes.join(', ')}`);
    }
    return parts.length ? { type: 'diff', parts } : null;
}

function computeGradeSummary(isGeneral) {
    const generalOnly = bandsData.filter(b => b.general && !b.restricted);
    const restrictedOnly = bandsData.filter(b => b.restricted && !b.general);
    const hfBands = bandsData.filter(b => b.type === 'HF' && b.restricted && b.general);
    const vhfUhf = bandsData.filter(b => ['VHF', 'UHF'].includes(b.type) && b.restricted && b.general);

    return {
        generalOnly: generalOnly.map(b => b.band),
        restrictedOnly: restrictedOnly.map(b => b.band),
        hfPowerRestricted: hfBands[0]?.restricted?.power,
        hfPowerGeneral: hfBands[0]?.general?.power,
        vhfPowerRestricted: vhfUhf[0]?.restricted?.power,
        vhfPowerGeneral: vhfUhf[0]?.general?.power,
        viewing: isGeneral ? 'general' : 'restricted',
    };
}

function AllocationBadge({ allocation }) {
    if (!allocation) return null;
    return (
        <span className={`band-plan-allocation-badge alloc-${allocation}`} title={allocationLegend[allocation]}>
            {ALLOCATION_LABELS[allocation] || allocation}
        </span>
    );
}

function BandCard({ band, data, altData, isGeneral, isOpen, onToggle }) {
    const gradeDiff = getGradeDiff(band);

    if (!data) {
        return (
            <div className={`band-plan-card type-${band.type} band-plan-card--blocked`}>
                <div className="band-plan-unauthorized">
                    <div className="band-plan-card-summary">
                        <div className="band-plan-card-top">
                            <div className="band-plan-card-header-left">
                                <span className={`band-plan-type-badge type-${band.type}`}>{band.type}</span>
                                <h3 className="band-plan-card-title" style={{ color: 'var(--muted-foreground)' }}>{band.band}</h3>
                            </div>
                            <span className="band-plan-unauthorized-label">Not Authorized</span>
                        </div>
                        <div className="band-plan-freq-row">
                            <span className="band-plan-freq">{band.freq}</span>
                        </div>
                    </div>
                </div>
                {!isGeneral && band.general && (
                    <div className="band-plan-grade-hint">Available on General Grade</div>
                )}
            </div>
        );
    }

    const modeBadges = getModeBadges(data.emission);

    return (
        <div
            className={`band-plan-card type-${band.type}${isOpen ? ' is-open' : ''}`}
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            onClick={onToggle}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle();
                }
            }}
        >
            <div className="band-plan-card-body">
                <div className="band-plan-card-summary">
                    <div className="band-plan-card-top">
                        <div className="band-plan-card-header-left">
                            <span className={`band-plan-type-badge type-${band.type}`}>{band.type}</span>
                            <h3 className="band-plan-card-title">{band.band}</h3>
                        </div>
                        <div className="band-plan-power">
                            <Zap size={12} aria-hidden="true" />
                            {data.power}
                        </div>
                    </div>

                    <div className="band-plan-freq-row">
                        <span className="band-plan-freq">{band.freq}</span>
                    </div>

                    <div className="band-plan-card-meta">
                        <div className="band-plan-card-alloc-tags">
                            <AllocationBadge allocation={band.allocation} />
                        </div>
                        {modeBadges.length > 0 && (
                            <div className="band-plan-card-mode-tags">
                                {modeBadges.map(({ key, label, icon: Icon }) => (
                                    <span key={key} className={`band-plan-mode-badge ${key}`}>
                                        <Icon size={11} aria-hidden="true" /> {label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {!isGeneral && gradeDiff?.type === 'diff' && (
                        <div className="band-plan-grade-diff">
                            <strong>On General:</strong> {gradeDiff.parts.join(' · ')}
                        </div>
                    )}
                </div>

                <div className="band-plan-details">
                    {band.subBands && band.subBands.length > 0 && (
                        <div className="band-plan-subbands">
                            <div className="band-plan-usage-label">Sub-bands (IARU R3 convention)</div>
                            <ul>
                                {band.subBands.map(sb => (
                                    <li key={sb.range}>
                                        <span className="band-plan-subband-range">{sb.range}</span>
                                        <span>{sb.usage}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {band.usage && (
                        <div className="band-plan-usage">
                            <div className="band-plan-usage-label">Propagation / Usage</div>
                            <div className="band-plan-usage-text">{band.usage}</div>
                        </div>
                    )}

                    <div className="band-plan-emissions-label">
                        Allowed Emissions ({data.emission.length})
                    </div>
                    <div>
                        {data.emission.map(e => (
                            <span
                                key={e}
                                className="band-plan-emission-badge"
                                title={`${emissionsLegend[e] || e}${commonModeMap[e] ? ` (${commonModeMap[e]})` : ''}${altData && !altData.emission.includes(e) ? ', not on other grade' : ''}`}
                            >
                                {e}
                            </span>
                        ))}
                    </div>

                    {band.notes && (
                        <div className="band-plan-note">
                            <Info size={14} style={{ flexShrink: 0, marginTop: '0.125rem' }} />
                            <span><strong style={{ color: 'var(--foreground)' }}>Note:</strong> {band.notes}</span>
                        </div>
                    )}
                </div>

                {!isOpen && (
                    <p className="band-plan-tap-hint">Tap for details</p>
                )}
            </div>
        </div>
    );
}

function GradeComparison({ isGeneral }) {
    const [expanded, setExpanded] = useState(false);
    const summary = useMemo(() => computeGradeSummary(isGeneral), [isGeneral]);

    return (
        <div className="modern-card band-plan-grade-compare no-print">
            <button
                type="button"
                className="band-plan-grade-compare-toggle"
                onClick={() => setExpanded(v => !v)}
                aria-expanded={expanded}
            >
                <Shield size={16} />
                <span>
                    Viewing <strong>{isGeneral ? 'General' : 'Restricted'}</strong> Grade
                    {!expanded && ', tap to compare'}
                </span>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expanded && (
                <div className="band-plan-grade-compare-body">
                    <div className="band-plan-grade-compare-grid">
                        <div>
                            <h4>General Grade only</h4>
                            <p>{summary.generalOnly.length ? summary.generalOnly.join(', ') : 'N/A'}</p>
                        </div>
                        <div>
                            <h4>HF power limits</h4>
                            <p>Restricted {summary.hfPowerRestricted} · General {summary.hfPowerGeneral}</p>
                        </div>
                        <div>
                            <h4>VHF / UHF power</h4>
                            <p>Restricted {summary.vhfPowerRestricted} · General {summary.vhfPowerGeneral}</p>
                        </div>
                        <div>
                            <h4>Restricted HF modes</h4>
                            <p>Phone emissions (SSB/AM) only; no CW or digital on HF</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function LegendSection({ printIncludeLegend }) {
    return (
        <div className={`modern-card band-plan-legend-card no-print${printIncludeLegend ? '' : ' band-plan-legend-screen-only'}`}>
            <div className="band-plan-legend-title">
                <Info size={18} style={{ color: 'var(--muted-foreground)' }} />
                Legend & Regulatory Notes
            </div>

            <div className="band-plan-meta-banner">
                <span className="band-plan-year-badge">NFAP-{meta.bandPlanYear}</span>
                <span className="band-plan-meta-text">{meta.planName}</span>
                <span className="band-plan-meta-text">{meta.regulatoryFramework}</span>
            </div>

            <div className="band-plan-legend-grid">
                <div className="band-plan-legend-section band-plan-legend-section--types">
                    <h3>Frequency Types</h3>
                    <ul className="band-plan-freq-legend">
                        {Object.entries(TYPE_COLORS).map(([type, color]) => (
                            <li key={type}>
                                <span className="band-plan-type-dot" style={{ backgroundColor: color }} />
                                <strong className="band-plan-type-label">{type}</strong>
                                <span className="band-plan-legend-detail">{TYPE_DESCRIPTIONS[type]}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="band-plan-legend-section band-plan-legend-section--alloc">
                    <h3>Allocation Status</h3>
                    <ul className="band-plan-alloc-legend">
                        {Object.entries(allocationLegend).map(([key, desc]) => (
                            <li key={key}>
                                <AllocationBadge allocation={key} />
                                <span className="band-plan-legend-detail">{desc}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="band-plan-legend-section band-plan-legend-section--emissions">
                    <h3>Emission Designators</h3>
                    <div className="band-plan-emissions-table-wrap">
                        <table className="band-plan-emissions-table">
                            <thead>
                                <tr>
                                    <th scope="col">Code</th>
                                    <th scope="col">Description</th>
                                    <th scope="col">Mode</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(emissionsLegend).map(([code, desc]) => (
                                    <tr key={code}>
                                        <td>
                                            <span className="band-plan-emission-code">{code}</span>
                                        </td>
                                        <td className="band-plan-legend-detail" data-label="Description">{desc}</td>
                                        <td className="band-plan-emission-mode-cell" data-label="Mode">
                                            {commonModeMap[code] || ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="band-plan-legend-section band-plan-legend-section--footer">
                <h3>Licensing & Operating Reminders</h3>
                <ul className="band-plan-notes">
                    {licensingReminders.map(item => (
                        <li key={item} className="band-plan-legend-detail">{item}</li>
                    ))}
                </ul>
                <p className="band-plan-source band-plan-legend-detail">
                    Sources:{' '}
                    {meta.sources.map((s, i) => (
                        <React.Fragment key={s.url}>
                            {i > 0 && ', '}
                            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
                        </React.Fragment>
                    ))}
                    {' '}· Last reviewed {meta.lastReviewed}
                </p>
            </div>
        </div>
    );
}

function HelpGuide() {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);
    const popupRef = useRef(null);

    const updatePosition = useCallback(() => {
        const trigger = triggerRef.current;
        const popup = popupRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const popupWidth = popup?.offsetWidth ?? 320;
        const popupHeight = popup?.offsetHeight ?? 320;
        const gap = 8;
        const margin = 12;

        let left = rect.right - popupWidth;
        left = Math.max(margin, Math.min(left, window.innerWidth - popupWidth - margin));

        let top = rect.bottom + gap;
        if (top + popupHeight > window.innerHeight - margin) {
            top = rect.top - popupHeight - gap;
        }
        top = Math.max(margin, top);

        setPosition({ top, left });
    }, []);

    useLayoutEffect(() => {
        if (open) updatePosition();
    }, [open, updatePosition]);

    useEffect(() => {
        if (!open) return;

        const handleReposition = () => updatePosition();
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        const handleClickOutside = (e) => {
            if (triggerRef.current?.contains(e.target)) return;
            if (popupRef.current?.contains(e.target)) return;
            setOpen(false);
        };

        window.addEventListener('scroll', handleReposition, true);
        window.addEventListener('resize', handleReposition);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('scroll', handleReposition, true);
            window.removeEventListener('resize', handleReposition);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open, updatePosition]);

    const popup = open ? createPortal(
        <div
            ref={popupRef}
            className="band-plan-help-popup band-plan-help-popup--portal"
            style={{ top: position.top, left: position.left }}
            role="dialog"
            aria-label="Quick start guide"
        >
            <h4><Lightbulb size={14} /> Quick Start Guide</h4>
            <ol className="band-plan-help-list">
                <li>Select your license grade (<strong>Restricted</strong> or <strong>General</strong>) at the top right.</li>
                <li>Filter by mode (<strong>Voice</strong>, <strong>CW</strong>, <strong>Digital</strong>) or tap the spectrum map.</li>
                <li>Tap any band card to expand sub-bands, emissions, and regulatory notes.</li>
                <li>Compare grades using the <strong>Grade comparison</strong> panel below the header.</li>
                <li>Use <strong>Print</strong> options for compact/detailed shack charts with QR link.</li>
            </ol>
        </div>,
        document.body
    ) : null;

    return (
        <div className="band-plan-help-tooltip">
            <button
                ref={triggerRef}
                type="button"
                className={`band-plan-help-trigger${open ? ' is-open' : ''}`}
                aria-label="How to use this band plan"
                aria-expanded={open}
                onClick={() => setOpen(prev => !prev)}
            >
                <Lightbulb size={14} />
                New to HAM Radio?
            </button>
            {popup}
        </div>
    );
}

export default function IndiaBandPlan() {
    const [isGeneral, setIsGeneral] = useState(true);
    const [currentFilter, setCurrentFilter] = useState('all');
    const [modeFilter, setModeFilter] = useState('all');
    const [openCards, setOpenCards] = useState(new Set());
    const [copied, setCopied] = useState(false);
    const [printOptionsOpen, setPrintOptionsOpen] = useState(false);
    const [printLayout, setPrintLayout] = useState('detailed');
    const [printIncludeLegend, setPrintIncludeLegend] = useState(true);
    const stickyRef = useRef(null);
    const listAnchorRef = useRef(null);
    const skipListScrollRef = useRef(true);

    const scrollToBandList = useCallback(() => {
        requestAnimationFrame(() => {
            const anchor = listAnchorRef.current;
            const sticky = stickyRef.current;
            if (!anchor || !sticky) return;

            const gap = 8;
            const delta = anchor.getBoundingClientRect().top - sticky.getBoundingClientRect().bottom - gap;
            if (Math.abs(delta) > 4) {
                window.scrollBy({ top: delta, behavior: 'smooth' });
            }
        });
    }, []);

    useEffect(() => {
        const { grade, mode } = parseHash();
        if (grade === 'restricted') setIsGeneral(false);
        else if (grade === 'general') setIsGeneral(true);
        if (mode) setModeFilter(mode);
    }, []);

    useEffect(() => {
        const hash = modeFilter === 'all'
            ? (isGeneral ? 'general' : 'restricted')
            : `${isGeneral ? 'general' : 'restricted'}-${modeFilter}`;
        window.history.replaceState(null, '', `${window.location.pathname}#${hash}`);
    }, [isGeneral, modeFilter]);

    useEffect(() => {
        if (skipListScrollRef.current) {
            skipListScrollRef.current = false;
            return;
        }
        scrollToBandList();
    }, [currentFilter, modeFilter, isGeneral, scrollToBandList]);

    const filteredBands = useMemo(() => {
        return bandsData.filter(band => {
            if (currentFilter !== 'all' && band.type !== currentFilter) return false;
            const data = isGeneral ? band.general : band.restricted;
            if (!data) return modeFilter === 'all';
            return bandSupportsMode(data.emission, modeFilter);
        });
    }, [currentFilter, isGeneral, modeFilter]);

    const filterLabel = currentFilter === 'all' ? 'All bands' : `${currentFilter} bands`;
    const modeLabel = modeFilters.find(m => m.id === modeFilter)?.label || 'All modes';
    const gradeLabel = isGeneral ? 'General' : 'Restricted';
    const shareUrl = buildShareUrl(isGeneral, modeFilter);
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(shareUrl)}`;

    const updateFilter = useCallback((filterValue) => {
        setCurrentFilter(filterValue);
        setOpenCards(new Set());
    }, []);

    const toggleFilter = useCallback((filter) => {
        updateFilter(currentFilter === filter ? 'all' : filter);
    }, [currentFilter, updateFilter]);

    const toggleCard = useCallback((index) => {
        setOpenCards(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    }, []);

    const setGrade = useCallback((general) => {
        setIsGeneral(general);
        setOpenCards(new Set());
    }, []);

    const copyLink = useCallback(() => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [shareUrl]);

    const sharePage = useCallback(async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: shareUrl });
            } catch (err) {
                if (err?.name !== 'AbortError') console.error('Share failed:', err);
            }
        } else {
            copyLink();
        }
    }, [copyLink, shareUrl]);

    const handlePrint = useCallback(() => {
        document.documentElement.setAttribute('data-print-layout', printLayout);
        document.documentElement.setAttribute('data-print-legend', printIncludeLegend ? 'yes' : 'no');
        window.print();
    }, [printLayout, printIncludeLegend]);

    return (
        <div className="modern-container band-plan-container compact-view">
            <header className="band-plan-header no-print">
                <div className="modern-card band-plan-header-card">
                    <div className="band-plan-title-wrap">
                        <div className="band-plan-title-row">
                            <div className="band-plan-icon">
                                <RadioTower size={24} />
                            </div>
                            <span className="band-plan-year-badge">NFAP-{meta.bandPlanYear}</span>
                        </div>
                        <h2 className="name-heading" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                            India HAM Radio Band Plan
                        </h2>
                        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', maxWidth: '36rem' }}>
                            Interactive spectrum chart for amateur operations in India. Based on {meta.planName} and {meta.regulatoryFramework}.
                        </p>
                    </div>
                    <div className="band-plan-actions">
                        <HelpGuide />
                        <div className="band-plan-toolbar">
                            <div className="band-plan-print-group">
                                <button
                                    type="button"
                                    className="band-plan-print-btn"
                                    onClick={handlePrint}
                                >
                                    <Printer size={16} /> Print Shack Chart
                                </button>
                                <button
                                    type="button"
                                    className="band-plan-print-btn band-plan-print-options-toggle"
                                    onClick={() => setPrintOptionsOpen(v => !v)}
                                    aria-expanded={printOptionsOpen}
                                    aria-label="Print options"
                                >
                                    {printOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                            </div>
                            <button
                                type="button"
                                className="band-plan-print-btn"
                                onClick={sharePage}
                            >
                                {copied ? <Check size={16} /> : <Share2 size={16} />}
                                {copied ? 'Link Copied!' : 'Share'}
                            </button>
                        </div>
                        {printOptionsOpen && (
                            <div className="band-plan-print-options">
                                <div className="band-plan-print-option-row">
                                    <span className="card-label">Layout</span>
                                    <div className="tabs-header band-plan-mini-tabs" role="group">
                                        <button
                                            type="button"
                                            className={`tab-btn${printLayout === 'compact' ? ' active' : ''}`}
                                            onClick={() => setPrintLayout('compact')}
                                        >
                                            Compact
                                        </button>
                                        <button
                                            type="button"
                                            className={`tab-btn${printLayout === 'detailed' ? ' active' : ''}`}
                                            onClick={() => setPrintLayout('detailed')}
                                        >
                                            Detailed
                                        </button>
                                    </div>
                                </div>
                                <label className="band-plan-print-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={printIncludeLegend}
                                        onChange={e => setPrintIncludeLegend(e.target.checked)}
                                    />
                                    Include legend & allocation key in print
                                </label>
                            </div>
                        )}
                        <div className="tabs-header band-plan-grade-tabs" role="group" aria-label="License grade">
                            <button
                                type="button"
                                className={`tab-btn${!isGeneral ? ' active' : ''}`}
                                aria-pressed={!isGeneral}
                                onClick={() => setGrade(false)}
                            >
                                Restricted Grade
                            </button>
                            <button
                                type="button"
                                className={`tab-btn${isGeneral ? ' active' : ''}`}
                                aria-pressed={isGeneral}
                                onClick={() => setGrade(true)}
                            >
                                General Grade
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <GradeComparison isGeneral={isGeneral} />

            <div className="band-plan-main">
                <div className="band-plan-spectrum-sticky no-print" ref={stickyRef}>
                    <div className="modern-card">
                        <div className="band-plan-spectrum-header">
                            <div className="band-plan-spectrum-title">
                                <span className="card-label">Spectrum Map</span>
                            </div>
                            <div className="band-plan-spectrum-meta">
                                <span className="band-plan-spectrum-meta-full" aria-live="polite">
                                    {filteredBands.length} bands · {filterLabel} · {modeLabel} · {gradeLabel}
                                </span>
                                <span className="band-plan-spectrum-meta-short" aria-live="polite">
                                    {filteredBands.length} bands
                                </span>
                                {(currentFilter !== 'all' || modeFilter !== 'all') && (
                                    <button
                                        type="button"
                                        className="band-plan-reset-btn"
                                        onClick={() => { updateFilter('all'); setModeFilter('all'); }}
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="band-plan-spectrum-bar" role="group" aria-label="Filter by frequency type">
                            {SPECTRUM_SEGMENTS.map(segment => (
                                <button
                                    key={segment.filter}
                                    type="button"
                                    className={`band-plan-spectrum-segment${
                                        currentFilter === 'all' ? '' :
                                        currentFilter === segment.filter ? ' active' : ' inactive'
                                    }`}
                                    style={{ backgroundColor: TYPE_COLORS[segment.filter] }}
                                    aria-label={`Filter ${segment.filter} bands`}
                                    aria-pressed={currentFilter === segment.filter}
                                    onClick={() => toggleFilter(segment.filter)}
                                >
                                    <div className="band-plan-spectrum-segment-inner">
                                        <span>{segment.label}</span>
                                        <span>{segment.range}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="band-plan-mode-filters" role="group" aria-label="Filter by mode">
                            <span className="card-label">Mode</span>
                            <div className="band-plan-mode-filter-chips">
                                {modeFilters.map(m => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        className={`band-plan-mode-chip${modeFilter === m.id ? ' active' : ''}`}
                                        aria-pressed={modeFilter === m.id}
                                        onClick={() => { setModeFilter(m.id); setOpenCards(new Set()); }}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div ref={listAnchorRef} className="band-plan-list-anchor" aria-hidden="true" />

                {filteredBands.length === 0 ? (
                    <div className="band-plan-empty no-print">
                        <p style={{ fontWeight: 600 }}>No bands match this filter for {gradeLabel} Grade.</p>
                    </div>
                ) : (
                    <div className="band-plan-cards no-print">
                        {filteredBands.map((band, index) => {
                            const data = isGeneral ? band.general : band.restricted;
                            const altData = isGeneral ? band.restricted : band.general;
                            return (
                                <BandCard
                                    key={`${band.band}-${band.freq}`}
                                    band={band}
                                    data={data}
                                    altData={altData}
                                    isGeneral={isGeneral}
                                    isOpen={openCards.has(index)}
                                    onToggle={() => toggleCard(index)}
                                />
                            );
                        })}
                    </div>
                )}

                <LegendSection printIncludeLegend={printIncludeLegend} />

                <div className={`no-screen band-plan-print-wrapper band-plan-print-${printLayout}`}>
                    <header className="band-plan-print-header">
                        <h1>India HAM Radio Band Plan</h1>
                        <p className="band-plan-print-meta">
                            <strong>{gradeLabel} Grade</strong>
                            <span className="band-plan-print-meta-sep">·</span>
                            {meta.planName}
                            <span className="band-plan-print-meta-sep">·</span>
                            NFAP-{meta.bandPlanYear}
                        </p>
                    </header>

                    <table className="band-plan-print-table">
                        <thead>
                            <tr>
                                <th>Band</th>
                                <th>Frequency</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Max Pwr</th>
                                <th>Emissions / Modes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bandsData.map(band => {
                                const data = isGeneral ? band.general : band.restricted;
                                return (
                                    <tr key={`print-${band.band}-${band.freq}`}>
                                        <td style={{ fontWeight: 700 }}>{band.band}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{band.freq}</td>
                                        <td>{ALLOCATION_LABELS[band.allocation] || 'N/A'}</td>
                                        {!data ? (
                                            <td colSpan={2} style={{ textAlign: 'center', fontStyle: 'italic', color: '#94a3b8' }}>
                                                Not Authorized for {gradeLabel} Grade
                                            </td>
                                        ) : (
                                            <>
                                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{data.power}</td>
                                                <td className="band-plan-print-emissions-cell">
                                                    {data.emission.map(e => (
                                                        <span key={e} className="print-emission" title={commonModeMap[e]}>{e}</span>
                                                    ))}
                                                    {printLayout === 'detailed' && band.commonModes && (
                                                        <div className="band-plan-print-modes">{band.commonModes.join(' · ')}</div>
                                                    )}
                                                    {printLayout === 'detailed' && band.subBands && (
                                                        <div className="band-plan-print-subbands">
                                                            {band.subBands.map(sb => `${sb.range}: ${sb.usage}`).join('; ')}
                                                        </div>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {printIncludeLegend && (
                        <section className="band-plan-print-legend">
                            <h2>Allocation Key</h2>
                            <ul>
                                {Object.entries(allocationLegend).map(([key, desc]) => (
                                    <li key={key}><strong>{ALLOCATION_LABELS[key]}:</strong> {desc}</li>
                                ))}
                            </ul>
                            <h2>Emission Quick Reference</h2>
                            <p className="band-plan-print-emissions-ref">
                                {Object.entries(commonModeMap).map(([code, mode]) => `${code}=${mode}`).join(' · ')}
                            </p>
                        </section>
                    )}

                    <footer className="band-plan-print-footer">
                        <div className="band-plan-print-footer-inner">
                            <div>
                                <p>
                                    Interactive tool by <strong>VU35KB</strong>
                                </p>
                                <p>
                                    <a href={shareUrl}>{shareUrl.replace('https://', '')}</a>
                                </p>
                                <p>73 de VU35KB · Amateur Radio Operator, India</p>
                            </div>
                            <div className="band-plan-print-qr">
                                <img src={qrImageUrl} width="64" height="64" alt={`QR code for ${shareUrl}`} />
                                <span>Scan for live chart</span>
                            </div>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}
