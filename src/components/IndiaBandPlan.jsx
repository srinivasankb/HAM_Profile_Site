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
    Search,
    X,
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

const MODE_CHIP_SHORT = {
    all: 'All',
    voice: 'Voice',
    cw: 'CW',
    digital: 'Data',
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

function getBandKey(band) {
    return `${band.band}-${band.freq}`;
}

function parseFrequencyRange(rangeStr) {
    if (!rangeStr) return null;
    const match = rangeStr.trim().match(/([\d.]+)\s+to\s+([\d.]+)\s*(ghz|mhz|khz)?/i);
    if (!match) return null;

    let min = parseFloat(match[1]);
    let max = parseFloat(match[2]);
    if (Number.isNaN(min) || Number.isNaN(max)) return null;

    const unit = (match[3] || 'mhz').toLowerCase();
    if (unit === 'ghz') {
        min *= 1000;
        max *= 1000;
    } else if (unit === 'khz') {
        min /= 1000;
        max /= 1000;
    }

    return { minMHz: Math.min(min, max), maxMHz: Math.max(min, max) };
}

const FREQ_UNIT_ALIASES = {
    ghz: ['ghz', 'g'],
    mhz: ['mhz', 'm', 'mc', 'meg', 'megs', 'megahz'],
    khz: ['khz', 'k', 'kc', 'kcs', 'kilohz'],
    hz: ['hz'],
};

const SPECTRUM_TYPE_ALIASES = {
    mf: 'MF',
    hf: 'HF',
    vhf: 'VHF',
    uhf: 'UHF',
    shf: 'SHF',
};

const SPECTRUM_TYPE_NAME_ALIASES = {
    'medium frequency': 'MF',
    'high frequency': 'HF',
    'very high frequency': 'VHF',
    'ultra high frequency': 'UHF',
    'super high frequency': 'SHF',
};

function parseSpectrumTypeSearch(cleaned) {
    const shortMatch = cleaned.match(/^(mf|hf|vhf|uhf|shf)(?:\s+bands?)?$/);
    if (shortMatch) {
        return SPECTRUM_TYPE_ALIASES[shortMatch[1]];
    }

    const longType = SPECTRUM_TYPE_NAME_ALIASES[cleaned.replace(/\s+bands?$/, '')];
    if (longType) return longType;

    return null;
}

function formatSpectrumTypeHint(spectrumType, bandCount) {
    const countLabel = `${bandCount} band${bandCount === 1 ? '' : 's'}`;
    const description = TYPE_DESCRIPTIONS[spectrumType];
    return description
        ? `${spectrumType} · ${countLabel} · ${description}`
        : `${spectrumType} · ${countLabel}`;
}

function normalizeFreqUnit(token) {
    if (!token) return null;
    const lower = token.toLowerCase();
    for (const [unit, aliases] of Object.entries(FREQ_UNIT_ALIASES)) {
        if (aliases.includes(lower)) return unit;
    }
    return null;
}

function preprocessFrequencyInput(input) {
    let value = input.trim().replace(/,/g, '');
    value = value.replace(/^[a-z]{1,6}\s*:\s*/i, '');

    const rigMatch = value.match(/^(\d{1,3})\.(\d{3})\.(\d{2,3})$/);
    if (rigMatch) {
        return `${parseInt(rigMatch[1], 10)}.${rigMatch[2]}`;
    }

    return value;
}

function parseFrequencyCandidates(input) {
    const preprocessed = preprocessFrequencyInput(input);
    const trimmed = preprocessed.trim().toLowerCase();
    if (!trimmed) return [];

    if (/^[\d.]+e[+-]?\d+$/i.test(trimmed)) {
        const sci = parseFloat(trimmed);
        if (!Number.isNaN(sci)) {
            return expandFrequencyCandidates(sci);
        }
    }

    const unitPattern = Object.values(FREQ_UNIT_ALIASES).flat().join('|');
    const match = trimmed.match(new RegExp(`^([\\d.]+)\\s*(${unitPattern})?$`, 'i'));
    if (!match) return [];

    const value = parseFloat(match[1]);
    if (Number.isNaN(value)) return [];

    const unit = normalizeFreqUnit(match[2]);
    if (unit === 'ghz') return [value * 1000];
    if (unit === 'mhz') return [value];
    if (unit === 'khz') return [value / 1000];
    if (unit === 'hz') return [value / 1e6];

    return expandFrequencyCandidates(value);
}

function expandFrequencyCandidates(value) {
    const candidates = new Set([value, value / 1000]);
    if (value >= 1e6) candidates.add(value / 1e6);
    if (value < 100) candidates.add(value * 1000);
    return [...candidates].filter(mhz => mhz >= 0.1 && mhz <= 100000);
}

function parseBandNameSearch(lowerInput) {
    const cleaned = lowerInput
        .replace(/\bband\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return null;

    const spectrumType = parseSpectrumTypeSearch(cleaned);
    if (spectrumType) {
        return { kind: 'type', spectrumType };
    }

    const unitPattern = '(m|cm|mm|metre|meter|meters|metres)';
    const upperSuffix = '(?:\\s*\\(upper\\)|\\s+upper|-upper|upper)';

    const upperMatch = cleaned.match(new RegExp(`^(\\d+)\\s*${unitPattern}${upperSuffix}$`, 'i'));
    if (upperMatch) {
        return {
            kind: 'band-name',
            value: upperMatch[1],
            unit: normalizeBandUnit(upperMatch[2]),
            upperOnly: true,
        };
    }

    const basicMatch = cleaned.match(new RegExp(`^(\\d+)\\s*${unitPattern}$`, 'i'));
    if (basicMatch) {
        return {
            kind: 'band-name',
            value: basicMatch[1],
            unit: normalizeBandUnit(basicMatch[2]),
            upperOnly: false,
        };
    }

    return null;
}

function normalizeBandUnit(unit) {
    const lower = unit.toLowerCase();
    if (['metre', 'meter', 'meters', 'metres'].includes(lower)) return 'm';
    return lower;
}

function bandNameParts(band) {
    const label = band.band.toLowerCase();
    const match = label.match(/^(\d+)\s*(m|cm|mm)/);
    if (!match) return null;
    return {
        value: match[1],
        unit: match[2],
        upper: label.includes('upper'),
    };
}

function bandMatchesBandNameSearch(band, search) {
    const parts = bandNameParts(band);
    if (!parts) return false;
    if (parts.value !== search.value || parts.unit !== search.unit) return false;
    if (search.upperOnly) return parts.upper;
    return true;
}

function parseBandPlanSearch(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const lower = trimmed.toLowerCase();
    const bandName = parseBandNameSearch(lower);
    if (bandName) return bandName;

    const candidatesMHz = parseFrequencyCandidates(trimmed);
    if (candidatesMHz.length > 0) {
        return { kind: 'frequency', candidatesMHz };
    }

    return null;
}

function bandMatchesCandidates(band, candidatesMHz) {
    return candidatesMHz.some(mhz => frequencyInBand(band, mhz));
}

function matchingMHzForBand(band, candidatesMHz) {
    return candidatesMHz.find(mhz => frequencyInBand(band, mhz)) ?? null;
}

function formatMHz(mhz) {
    return `${parseFloat(mhz.toFixed(6))} MHz`;
}

function pickBestCandidateMHz(candidatesMHz) {
    if (candidatesMHz.length === 1) return candidatesMHz[0];

    let best = candidatesMHz[0];
    let bestDist = Infinity;
    for (const mhz of candidatesMHz) {
        const nearest = findNearestBand(mhz);
        const dist = nearest?.dist ?? Infinity;
        if (dist < bestDist) {
            bestDist = dist;
            best = mhz;
        }
    }
    return best;
}

function findNearestBand(mhz) {
    let nearest = null;
    let minDist = Infinity;

    for (const band of bandsData) {
        const range = getBandRange(band);
        if (!range) continue;

        let dist;
        if (mhz < range.minMHz) dist = range.minMHz - mhz;
        else if (mhz > range.maxMHz) dist = mhz - range.maxMHz;
        else dist = 0;

        if (dist < minDist) {
            minDist = dist;
            nearest = { band, dist, range };
        }
    }

    return nearest;
}

function formatNearestBandHint(nearest, mhz) {
    const { band, dist, range } = nearest;
    if (dist === 0) return null;

    const edge = mhz < range.minMHz
        ? `starts at ${formatMHz(range.minMHz)}`
        : `ends at ${formatMHz(range.maxMHz)}`;
    return `Not in an allocation · nearest ${band.band} (${edge})`;
}

function resolveBandPlanSearch(rawInput) {
    const query = rawInput.trim();
    if (!query) {
        return {
            active: false,
            invalid: false,
            kind: null,
            bands: null,
            hint: null,
            candidatesMHz: [],
        };
    }

    const parsed = parseBandPlanSearch(query);
    if (!parsed) {
        return {
            active: false,
            invalid: true,
            kind: null,
            bands: [],
            hint: null,
            candidatesMHz: [],
            query,
        };
    }

    if (parsed.kind === 'type') {
        const bands = bandsData.filter(band => band.type === parsed.spectrumType);
        return {
            active: true,
            invalid: false,
            kind: 'type',
            spectrumType: parsed.spectrumType,
            bands,
            hint: bands.length ? formatSpectrumTypeHint(parsed.spectrumType, bands.length) : null,
            candidatesMHz: [],
            query,
        };
    }

    if (parsed.kind === 'band-name') {
        const bands = bandsData.filter(band => bandMatchesBandNameSearch(band, parsed));
        return {
            active: true,
            invalid: false,
            kind: 'band-name',
            bands,
            hint: bands.length
                ? `Band name · ${bands.map(band => band.band).join(', ')}`
                : null,
            candidatesMHz: [],
            query,
        };
    }

    const bands = bandsData.filter(band => bandMatchesCandidates(band, parsed.candidatesMHz));
    let hint = null;

    if (bands.length > 0) {
        const matchMHz = matchingMHzForBand(bands[0], parsed.candidatesMHz);
        if (matchMHz !== null) hint = `Matched as ${formatMHz(matchMHz)}`;
    } else {
        const primaryMHz = pickBestCandidateMHz(parsed.candidatesMHz);
        const nearest = findNearestBand(primaryMHz);
        if (nearest) hint = formatNearestBandHint(nearest, primaryMHz);
    }

    return {
        active: true,
        invalid: false,
        kind: 'frequency',
        bands,
        hint,
        candidatesMHz: parsed.candidatesMHz,
        query,
    };
}

function getInitialFreqFromUrl() {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('f') || '';
}

const bandRangeCache = new Map();

function getBandRange(band) {
    const key = getBandKey(band);
    if (!bandRangeCache.has(key)) {
        bandRangeCache.set(key, parseFrequencyRange(band.freq));
    }
    return bandRangeCache.get(key);
}

function frequencyInBand(band, mhz) {
    const range = getBandRange(band);
    if (!range || mhz === null) return false;
    return mhz >= range.minMHz && mhz <= range.maxMHz;
}

function findSubBand(band, mhz) {
    if (!band.subBands?.length) return null;
    return band.subBands.find(sb => {
        const range = parseFrequencyRange(sb.range);
        return range && mhz >= range.minMHz && mhz <= range.maxMHz;
    }) || null;
}

function getInitialStateFromHash() {
    if (typeof window === 'undefined') {
        return { isGeneral: false, modeFilter: 'all' };
    }
    const { grade, mode } = parseHash();
    return {
        isGeneral: grade === 'general',
        modeFilter: mode || 'all',
    };
}

function buildShareUrl(isGeneral, modeFilter, freqQuery = '') {
    const grade = isGeneral ? 'general' : 'restricted';
    const hash = modeFilter === 'all' ? grade : `${grade}-${modeFilter}`;
    const trimmed = freqQuery.trim();
    if (trimmed) {
        return `${PAGE_URL}?f=${encodeURIComponent(trimmed)}#${hash}`;
    }
    return `${PAGE_URL}#${hash}`;
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
            <div
                className={`band-plan-card type-${band.type} band-plan-card--blocked`}
            >
                <div className="band-plan-unauthorized">
                    <div className="band-card-header">
                        <div className="band-card-title-group">
                            <span className={`band-type-pill type-${band.type}`}>{band.type}</span>
                            <h3 className="band-card-title" style={{ color: 'var(--muted-foreground)' }}>{band.band}</h3>
                        </div>
                        <span className="band-plan-unauthorized-label">Not Authorized</span>
                    </div>
                    <div className="band-card-freq">
                        {band.freq}
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
            <div className="band-card-inner">
                <div className="band-card-header">
                    <div className="band-card-title-group">
                        <span className={`band-type-pill type-${band.type}`}>{band.type}</span>
                        <h3 className="band-card-title">{band.band}</h3>
                    </div>
                    <div className="band-power-pill">
                        <Zap size={12} aria-hidden="true" />
                        {data.power}
                    </div>
                </div>

                <div className="band-card-freq">
                    {band.freq}
                </div>

                <div className="band-card-tags">
                    <AllocationBadge allocation={band.allocation} />
                    {modeBadges.map(({ key, label, icon: Icon }) => (
                        <span key={key} className={`mode-badge ${key}`}>
                            <Icon size={12} aria-hidden="true" /> {label}
                        </span>
                    ))}
                </div>

                {!isGeneral && gradeDiff?.type === 'diff' && (
                    <div className="band-diff-notice">
                        <strong>On General:</strong> {gradeDiff.parts.join(' · ')}
                    </div>
                )}

                <div className="band-card-details">
                    {band.subBands && band.subBands.length > 0 && (
                        <div className="detail-section">
                            <div className="detail-label">Sub-bands (IARU R3)</div>
                            <ul className="subband-list">
                                {band.subBands.map(sb => (
                                    <li key={sb.range}>
                                        <span className="subband-range">{sb.range}</span>
                                        <span className="subband-usage">{sb.usage}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {band.usage && (
                        <div className="detail-section">
                            <div className="detail-label">Propagation / Usage</div>
                            <div className="usage-text">{band.usage}</div>
                        </div>
                    )}

                    <div className="detail-section">
                        <div className="detail-label">Allowed Emissions</div>
                        <div className="emissions-list">
                            {data.emission.map(e => (
                                <span
                                    key={e}
                                    className="emission-badge"
                                    title={`${emissionsLegend[e] || e}${commonModeMap[e] ? ` (${commonModeMap[e]})` : ''}${altData && !altData.emission.includes(e) ? ', not on other grade' : ''}`}
                                >
                                    {e}
                                </span>
                            ))}
                        </div>
                    </div>

                    {band.notes && (
                        <div className="band-note">
                            <Info size={14} className="note-icon" />
                            <span><strong>Note:</strong> {band.notes}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function GradeComparison({ isGeneral }) {
    const [expanded, setExpanded] = useState(false);
    const summary = useMemo(() => computeGradeSummary(isGeneral), [isGeneral]);

    return (
        <div className="band-plan-callout no-print">
            <button
                type="button"
                className="callout-toggle"
                onClick={() => setExpanded(v => !v)}
                aria-expanded={expanded}
            >
                <div className="callout-toggle-left">
                    <Shield size={16} />
                    <span>
                        Viewing <strong>{isGeneral ? 'General' : 'Restricted'}</strong> Grade Limits
                    </span>
                    <span className="callout-hint">— Tap to compare</span>
                </div>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expanded && (
                <div className="callout-body">
                    <div className="callout-grid">
                        <div className="callout-item">
                            <h4>General Grade only</h4>
                            <p>{summary.generalOnly.length ? summary.generalOnly.join(', ') : 'N/A'}</p>
                        </div>
                        <div className="callout-item">
                            <h4>HF power limits</h4>
                            <p>Restricted {summary.hfPowerRestricted} · General {summary.hfPowerGeneral}</p>
                        </div>
                        <div className="callout-item">
                            <h4>VHF / UHF power</h4>
                            <p>Restricted {summary.vhfPowerRestricted} · General {summary.vhfPowerGeneral}</p>
                        </div>
                        <div className="callout-item">
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
        <div className={`band-plan-legend-card no-print${printIncludeLegend ? '' : ' band-plan-legend-screen-only'}`}>
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
                <li>Enter a frequency with or without units; matching band cards are shown (e.g. 7.100, 7100, 5750, 5.725 GHz).</li>
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
    const [hashInit] = useState(() => getInitialStateFromHash());
    const [isGeneral, setIsGeneral] = useState(hashInit.isGeneral);
    const [currentFilter, setCurrentFilter] = useState('all');
    const [modeFilter, setModeFilter] = useState(hashInit.modeFilter);
    const [openCards, setOpenCards] = useState(new Set());
    const [copied, setCopied] = useState(false);
    const [printOptionsOpen, setPrintOptionsOpen] = useState(false);
    const [printLayout, setPrintLayout] = useState('detailed');
    const [printIncludeLegend, setPrintIncludeLegend] = useState(true);
    const [freqQuery, setFreqQuery] = useState(() => getInitialFreqFromUrl());
    const stickyRef = useRef(null);
    const listAnchorRef = useRef(null);
    const skipListScrollRef = useRef(true);

    const scrollBelowSticky = useCallback((element, behavior = 'smooth') => {
        if (!element || !stickyRef.current) return false;

        const gap = 8;
        const delta = element.getBoundingClientRect().top - stickyRef.current.getBoundingClientRect().bottom - gap;
        if (Math.abs(delta) > 2) {
            window.scrollBy({ top: delta, behavior });
            return true;
        }
        return false;
    }, []);

    const scrollToBandList = useCallback(() => {
        scrollBelowSticky(listAnchorRef.current);
    }, [scrollBelowSticky]);

    useEffect(() => {
        const syncFromHash = () => {
            const { grade, mode } = parseHash();
            setIsGeneral(grade === 'general');
            setModeFilter(mode || 'all');
            setOpenCards(new Set());
        };

        window.addEventListener('hashchange', syncFromHash);
        return () => window.removeEventListener('hashchange', syncFromHash);
    }, []);

    useEffect(() => {
        const hash = modeFilter === 'all'
            ? (isGeneral ? 'general' : 'restricted')
            : `${isGeneral ? 'general' : 'restricted'}-${modeFilter}`;
        const url = new URL(window.location.href);
        const trimmed = freqQuery.trim();
        if (trimmed) url.searchParams.set('f', trimmed);
        else url.searchParams.delete('f');
        window.history.replaceState(null, '', `${url.pathname}${url.search}#${hash}`);
    }, [isGeneral, modeFilter, freqQuery]);

    useEffect(() => {
        if (skipListScrollRef.current) {
            skipListScrollRef.current = false;
            return;
        }
        if (freqQuery.trim()) return;
        scrollToBandList();
    }, [currentFilter, modeFilter, isGeneral, scrollToBandList, freqQuery]);

    const filteredBands = useMemo(() => {
        return bandsData.filter(band => {
            if (currentFilter !== 'all' && band.type !== currentFilter) return false;
            const data = isGeneral ? band.general : band.restricted;
            if (!data) return modeFilter === 'all';
            return bandSupportsMode(data.emission, modeFilter);
        });
    }, [currentFilter, isGeneral, modeFilter]);

    const searchResult = useMemo(() => resolveBandPlanSearch(freqQuery), [freqQuery]);
    const isFreqSearchActive = searchResult.active;
    const isFreqSearchInvalid = searchResult.invalid;
    const freqCandidatesMHz = searchResult.candidatesMHz;

    const displayBands = useMemo(() => {
        if (!isFreqSearchActive) return filteredBands;
        return searchResult.bands;
    }, [isFreqSearchActive, searchResult.bands, filteredBands]);

    const freqLookup = useMemo(() => {
        if (!isFreqSearchActive) return null;
        if (displayBands.length === 0) {
            return { status: 'none', query: searchResult.query };
        }

        const band = displayBands[0];
        const matchMHz = searchResult.kind === 'frequency'
            ? matchingMHzForBand(band, freqCandidatesMHz)
            : null;
        const subBand = matchMHz !== null ? findSubBand(band, matchMHz) : null;
        const gradeData = isGeneral ? band.general : band.restricted;

        return {
            status: 'match',
            band,
            subBand,
            gradeData,
            matchMHz,
            matchCount: displayBands.length,
        };
    }, [isFreqSearchActive, displayBands, freqCandidatesMHz, isGeneral, searchResult]);

    const clearFreqSearch = useCallback(() => {
        setFreqQuery('');
    }, []);

    const handleFreqKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            clearFreqSearch();
        }
    }, [clearFreqSearch]);

    useEffect(() => {
        if (!isFreqSearchActive || displayBands.length === 0) return;
        requestAnimationFrame(() => scrollToBandList());
    }, [isFreqSearchActive, displayBands.length, scrollToBandList]);

    useEffect(() => {
        setOpenCards(new Set());
    }, [freqCandidatesMHz.join(',')]);

    const filterLabel = currentFilter === 'all' ? 'All bands' : `${currentFilter} bands`;
    const modeLabel = modeFilters.find(m => m.id === modeFilter)?.label || 'All modes';
    const gradeLabel = isGeneral ? 'General' : 'Restricted';
    const freqSearchLabel = searchResult.spectrumType || freqQuery.trim();
    const listMetaShort = useMemo(() => {
        if (isFreqSearchActive) {
            return `${displayBands.length} bands · ${freqSearchLabel}`;
        }
        const bits = [`${filteredBands.length} bands`];
        if (currentFilter !== 'all') bits.push(currentFilter);
        bits.push(isGeneral ? 'Gen' : 'Rst');
        if (modeFilter !== 'all') {
            const short = { voice: 'Voice', cw: 'CW', digital: 'Digital' }[modeFilter];
            if (short) bits.push(short);
        }
        return bits.join(' · ');
    }, [
        isFreqSearchActive,
        displayBands.length,
        freqSearchLabel,
        filteredBands.length,
        currentFilter,
        isGeneral,
        modeFilter,
    ]);

    const showSearchStatus = freqQuery && (
        isFreqSearchInvalid
        || searchResult.hint
        || freqLookup?.status === 'none'
        || (freqLookup?.status === 'match' && !freqLookup.gradeData)
    );

    const listMetaLabel = isFreqSearchActive
        ? `${displayBands.length} band${displayBands.length === 1 ? '' : 's'} · ${freqSearchLabel}`
        : `${filteredBands.length} bands · ${filterLabel} · ${modeLabel} · ${gradeLabel}`;
    const shareUrl = buildShareUrl(isGeneral, modeFilter, freqQuery);
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
        <div className="band-plan-container">
            <header className="band-plan-header no-print">
                <div className="band-plan-header-inner">
                    <div className="band-plan-title-wrap">
                        <div className="band-plan-title-row">
                            <div className="band-plan-icon">
                                <RadioTower size={24} />
                            </div>
                            <span className="band-plan-year-badge">NFAP-{meta.bandPlanYear}</span>
                        </div>
                        <h2 className="band-plan-page-title">
                            India HAM Radio Band Plan
                        </h2>
                        <p className="band-plan-page-desc">
                            Interactive spectrum chart for amateur operations in India. Based on {meta.planName} and {meta.regulatoryFramework}.
                        </p>
                    </div>
                    <div className="band-plan-actions">
                        <div className="band-plan-action-row">
                            <HelpGuide />
                            <div className="band-plan-toolbar">
                                <div className="band-plan-print-group">
                                    <button
                                        type="button"
                                        className="band-plan-btn"
                                        onClick={handlePrint}
                                    >
                                        <Printer size={16} aria-hidden="true" />
                                        <span className="band-plan-btn-text">Print</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="band-plan-btn band-plan-btn-icon"
                                        onClick={() => setPrintOptionsOpen(v => !v)}
                                        aria-expanded={printOptionsOpen}
                                        aria-label="Print options"
                                    >
                                        {printOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className="band-plan-btn"
                                    onClick={sharePage}
                                >
                                    {copied ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
                                    <span className="band-plan-btn-text">{copied ? 'Copied' : 'Share'}</span>
                                </button>
                            </div>
                        </div>
                        {printOptionsOpen && (
                            <div className="band-plan-print-options">
                                <div className="band-plan-print-option-row">
                                    <span className="card-label">Layout</span>
                                    <div className="band-plan-segmented" role="group">
                                        <button
                                            type="button"
                                            className={`segment-btn${printLayout === 'compact' ? ' active' : ''}`}
                                            onClick={() => setPrintLayout('compact')}
                                        >
                                            Compact
                                        </button>
                                        <button
                                            type="button"
                                            className={`segment-btn${printLayout === 'detailed' ? ' active' : ''}`}
                                            onClick={() => setPrintLayout('detailed')}
                                        >
                                            Detailed
                                        </button>
                                    </div>
                                </div>
                                <label className="band-plan-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={printIncludeLegend}
                                        onChange={e => setPrintIncludeLegend(e.target.checked)}
                                    />
                                    Include legend in print
                                </label>
                            </div>
                        )}
                        <div className="band-plan-grade-selector" role="group" aria-label="License grade">
                            <button
                                type="button"
                                className={`grade-btn${!isGeneral ? ' active' : ''}`}
                                aria-pressed={!isGeneral}
                                onClick={() => setGrade(false)}
                            >
                                Restricted
                            </button>
                            <button
                                type="button"
                                className={`grade-btn${isGeneral ? ' active' : ''}`}
                                aria-pressed={isGeneral}
                                onClick={() => setGrade(true)}
                            >
                                General
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <GradeComparison isGeneral={isGeneral} />

            <div className="band-plan-main">
                <div className="band-plan-toolbar-glass no-print" ref={stickyRef}>
                    <div className="toolbar-glass-inner">
                        <div className="toolbar-top-controls">
                            <div className="toolbar-search">
                                <Search size={14} className="search-icon" aria-hidden="true" />
                                <input
                                    id="band-plan-freq-input"
                                    type="text"
                                    inputMode="text"
                                    className="search-input"
                                    placeholder="Search freq or band (e.g. 7.100, 40m)"
                                    value={freqQuery}
                                    onChange={e => setFreqQuery(e.target.value)}
                                    onKeyDown={handleFreqKeyDown}
                                    aria-describedby={showSearchStatus ? 'band-plan-freq-search-status' : undefined}
                                />
                                {freqQuery && (
                                    <button
                                        type="button"
                                        className="search-clear"
                                        onClick={clearFreqSearch}
                                        aria-label="Clear frequency search"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            <div className="toolbar-mode-segments" role="group" aria-label="Filter by mode">
                                {modeFilters.map(m => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        className={`mode-segment${modeFilter === m.id ? ' active' : ''}`}
                                        aria-pressed={modeFilter === m.id}
                                        aria-label={m.label}
                                        onClick={() => { setModeFilter(m.id); setOpenCards(new Set()); }}
                                    >
                                        <span className="mode-segment-long">{m.label}</span>
                                        <span className="mode-segment-short">{MODE_CHIP_SHORT[m.id]}</span>
                                    </button>
                                ))}
                            </div>
                            
                            {(currentFilter !== 'all' || modeFilter !== 'all' || freqQuery) && (
                                <button
                                    type="button"
                                    className="toolbar-reset-btn"
                                    onClick={() => { updateFilter('all'); setModeFilter('all'); clearFreqSearch(); }}
                                >
                                    Reset
                                </button>
                            )}
                        </div>

                        <div className="toolbar-spectrum-scale" role="group" aria-label="Filter by frequency type">
                            {SPECTRUM_SEGMENTS.map(segment => (
                                <button
                                    key={segment.filter}
                                    type="button"
                                    className={`spectrum-scale-segment${
                                        currentFilter === 'all' ? '' :
                                        currentFilter === segment.filter ? ' active' : ' inactive'
                                    }`}
                                    style={{ '--segment-color': TYPE_COLORS[segment.filter] }}
                                    aria-label={`Filter ${segment.filter} bands`}
                                    aria-pressed={currentFilter === segment.filter}
                                    onClick={() => toggleFilter(segment.filter)}
                                >
                                    <span className="scale-label">{segment.label}</span>
                                    <span className="scale-range">{segment.range}</span>
                                </button>
                            ))}
                        </div>

                        <div className="band-plan-spectrum-meta">
                            <span className="band-plan-spectrum-meta-full" aria-live="polite">
                                {listMetaLabel}
                            </span>
                            <span className="band-plan-spectrum-meta-short" aria-live="polite">
                                {listMetaShort}
                            </span>
                        </div>
                    </div>
                </div>

                {showSearchStatus && (
                    <p
                        id="band-plan-freq-search-status"
                        className="band-plan-search-status no-print"
                        aria-live="polite"
                        title={searchResult.hint || undefined}
                    >
                        {isFreqSearchInvalid && <>Invalid frequency or band name</>}
                        {isFreqSearchActive && searchResult.hint && !isFreqSearchInvalid && (
                            <>{searchResult.hint}</>
                        )}
                        {isFreqSearchActive && freqLookup?.status === 'none' && !searchResult.hint && (
                            <>No amateur band matches {freqSearchLabel}</>
                        )}
                        {freqLookup?.status === 'match' && !freqLookup.gradeData && (
                            <>Not authorized on {gradeLabel} Grade</>
                        )}
                    </p>
                )}

                <div ref={listAnchorRef} className="band-plan-list-anchor" aria-hidden="true" />

                {displayBands.length === 0 ? (
                    !(isFreqSearchActive && showSearchStatus) ? (
                        <div className="band-plan-empty no-print">
                            <p style={{ fontWeight: 600 }}>
                                {isFreqSearchActive
                                    ? `No amateur band matches ${freqSearchLabel}.`
                                    : `No bands match this filter for ${gradeLabel} Grade.`}
                            </p>
                        </div>
                    ) : null
                ) : (
                    <div className="band-plan-cards no-print">
                        {displayBands.map((band, index) => {
                            const data = isGeneral ? band.general : band.restricted;
                            const altData = isGeneral ? band.restricted : band.general;
                            const bandKey = getBandKey(band);
                            return (
                                <BandCard
                                    key={bandKey}
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
