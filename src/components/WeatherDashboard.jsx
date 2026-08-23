import React, { useState, useEffect, useMemo } from 'react';
import WeatherChart, {
    ChartMetricFilter,
    SERIES_CONFIG,
    ComfortChart,
    PressureOutlookChart,
    DailyRhythmChart,
} from './WeatherChart';
import {
    Thermometer,
    Droplets,
    Gauge,
    RefreshCw,
    ArrowUp,
    ArrowDown,
    Minus,
    TrendingUp,
    TrendingDown,
    Sunrise,
    Sunset,
    Sun,
    Moon,
    CloudRain,
    Calculator,
} from 'lucide-react';
import profile from '../data/profile.json';
import {
    STATIONS,
    formatWeatherBeaconIST,
    formatTimeIST12,
    getSolarState,
    getSolarPhase,
} from '../lib/ham-utils';
import { useWeatherData } from '../hooks/useWeatherData';
import { getWeatherCacheSnapshot } from '../lib/weather-cache';
import {
    dewPointC,
    feelsLikeC,
    seaLevelPressureHPa,
    vaporPressureDeficitKPa,
    getComfortLevel,
    summarizeMetric,
    pressureTrend,
    hourlyRate,
    sliceReadingsByHours,
    readingSpanHours,
    enrichReading,
    hourlyBucketsIST,
    buildPressureOutlookSeries,
    currentRainOutlook,
    formatSensorValue,
    formatCalculated,
    formatTempC,
    formatHumidityPct,
    formatPressureHPa,
    formatCalcTempC,
    formatCalcPressureHPa,
    formatVpdKPa,
} from '../lib/weather-math';

import { readWxPref, writeWxPref } from '../lib/weather-ui-prefs';

const WINDOW_OPTIONS = [24, 12, 6, 3];
const METRIC_KEYS = ['temperature', 'humidity', 'pressure'];
const station = STATIONS.find((s) => s.weatherBeacon) || STATIONS[0];

function readStoredMetric() {
    const m = readWxPref('metric', 'temperature');
    return METRIC_KEYS.includes(m) ? m : 'temperature';
}

function readStoredWindow() {
    const w = readWxPref('window', 24);
    return WINDOW_OPTIONS.includes(w) ? w : 24;
}

function ChartWindowFilter({ value, onChange, pointCount }) {
    return (
        <div className="wx-tab-group" role="group" aria-label="Chart time window">
            {WINDOW_OPTIONS.map((hours) => {
                const disabled = pointCount < 2;
                return (
                    <button
                        key={hours}
                        type="button"
                        className={`wx-tab ${value === hours ? 'active' : ''}`}
                        onClick={() => onChange(hours)}
                        disabled={disabled}
                        title={`${hours}-hour window`}
                    >
                        {hours}h
                    </button>
                );
            })}
        </div>
    );
}

function TrendDelta({ current, previous, unit }) {
    if (previous == null) return null;
    const diff = current - previous;
    if (Math.abs(diff) < 0.001) {
        return (
            <span className="wx-delta neutral">
                <Minus size={10} strokeWidth={2.5} />0{unit}
            </span>
        );
    }
    const up = diff > 0;
    return (
        <span className={`wx-delta ${up ? 'up' : 'down'}`}>
            {up ? <ArrowUp size={10} strokeWidth={2.5} /> : <ArrowDown size={10} strokeWidth={2.5} />}
            {up ? '+' : ''}{formatCalculated(diff, 2)}{unit}
        </span>
    );
}

function LiveStat({ label, value, hint, delta }) {
    return (
        <div className="wx-stat" title={hint}>
            <span className="wx-stat-label">{label}</span>
            <span className="wx-stat-value wx-num">
                {value}
                {delta}
            </span>
        </div>
    );
}

function RateCell({ icon: Icon, label, rate, unit }) {
    const up = rate > 0.001;
    const down = rate < -0.001;
    return (
        <div className="wx-trend-cell">
            <span className="wx-trend-cell-label">{label}</span>
            <span className={`wx-trend-cell-value wx-num ${up ? 'up' : down ? 'down' : 'neutral'}`}>
                <Icon size={13} strokeWidth={2} aria-hidden="true" />
                {rate >= 0 ? '+' : ''}{formatCalculated(rate, 2)}{unit}/hr
            </span>
        </div>
    );
}

function IntroBanner({ collapsed, onToggle }) {
    return (
        <section
            className={`modern-card wx-intro ${collapsed ? 'is-collapsed' : ''}`}
            aria-label="About this dashboard"
        >
            <div className="wx-intro-bar">
                <Calculator size={18} className="wx-intro-icon" aria-hidden="true" />
                <div className="wx-intro-bar-text">
                    <h2 className="wx-intro-title">Three sensors, calculated insight</h2>
                    {!collapsed && (
                        <p className="wx-intro-text">
                            Started as an ESP32 <strong>APRS-IS</strong> node, now a shack WX beacon.
                            Only <strong>temp</strong>, <strong>humidity</strong>, and <strong>pressure</strong> are measured.
                            All other values are formula-based in your browser. <strong>No AI.</strong>
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    className="wx-intro-toggle"
                    onClick={onToggle}
                    aria-expanded={!collapsed}
                >
                    {collapsed ? 'About' : 'Hide'}
                </button>
            </div>
            {!collapsed && (
                <p className="wx-intro-note">
                    Hover charts for derived values. 12-hour IST. Indoor readings.
                    <a
                        className="wx-intro-doc-link"
                        href="/resources/shack-weather-beacon"
                    >
                        Full documentation
                    </a>
                    {' · '}
                    <a
                        className="wx-intro-doc-link"
                        href="https://aprs.fi/#!call=a/VU35KB-13"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        VU35KB-13 on APRS.fi
                    </a>
                </p>
            )}
        </section>
    );
}

function TrendsPanel({ chartWindowHours, trend, tempRate, humRate, presRate }) {
    const pressureIcon =
        trend.tone === 'up' ? <TrendingUp size={14} aria-hidden="true" /> :
        trend.tone === 'down' ? <TrendingDown size={14} aria-hidden="true" /> :
        <Minus size={14} aria-hidden="true" />;

    return (
        <div className="wx-insight-card wx-trends-panel">
            <span className="wx-kicker">Rates · last {chartWindowHours}h</span>
            <div className="wx-trends-grid">
                <div className="wx-trend-cell">
                    <span className="wx-trend-cell-label">Pressure shift</span>
                    <span className={`wx-trend-cell-value wx-trend-pressure tone-${trend.tone}`}>
                        {pressureIcon}
                        <span>{trend.label}</span>
                        <span className="wx-num">
                            {trend.delta >= 0 ? '+' : ''}{formatCalculated(trend.delta, 2)} hPa
                        </span>
                    </span>
                </div>
                <RateCell icon={Thermometer} label="Temperature" rate={tempRate} unit="°C" />
                <RateCell icon={Droplets} label="Humidity" rate={humRate} unit="%" />
                <RateCell icon={Gauge} label="Pressure" rate={presRate} unit=" hPa" />
            </div>
        </div>
    );
}

function RainOutlookCard({ outlook }) {
    if (!outlook) {
        return (
            <div className="wx-outlook-card wx-outlook-pending">
                <CloudRain size={18} aria-hidden="true" />
                <div>
                    <strong>Rain outlook</strong>
                    <p>Collecting 3 hours of pressure history. Check back after a few more readings.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`wx-outlook-card risk-${outlook.risk}`}>
            <CloudRain size={18} aria-hidden="true" />
            <div>
                <strong>{outlook.summary}</strong>
                <p className="wx-outlook-meta wx-num">
                    {outlook.tendency.label} · {outlook.delta3h >= 0 ? '+' : ''}{formatCalculated(outlook.delta3h, 2)} hPa / 3h
                </p>
            </div>
        </div>
    );
}

function SetupDetails() {
    return (
        <section className="modern-card wx-setup" aria-label="Sensor setup">
            <h2 className="wx-section-title wx-setup-heading">Hardware & sampling</h2>
            <div className="wx-setup-grid">
                <div className="wx-setup-item">
                    <span className="wx-kicker">Sensor</span>
                    <p className="wx-setup-value">M5Stack ENV III</p>
                    <p className="wx-setup-detail">SHT30 temp & humidity · QMP6988 barometric pressure</p>
                </div>
                <div className="wx-setup-item">
                    <span className="wx-kicker">Controller</span>
                    <p className="wx-setup-value">ESP32-S3 Geek</p>
                    <p className="wx-setup-detail">Waveshare board · local Wi-Fi uplink</p>
                </div>
                <div className="wx-setup-item">
                    <span className="wx-kicker">Placement</span>
                    <p className="wx-setup-value">Inside the shack</p>
                    <p className="wx-setup-detail">Indoor air. Correlates with outdoor weather but is not a forecast station.</p>
                </div>
                <div className="wx-setup-item">
                    <span className="wx-kicker">Sampling</span>
                    <p className="wx-setup-value wx-num">Every 15 minutes</p>
                    <p className="wx-setup-detail">n8n webhook to this dashboard</p>
                </div>
            </div>
        </section>
    );
}

function SolarStrip({ solar, now }) {
    if (!solar?.sun) return null;
    const { sun, isDaylight, nextLabel, nextInLabel } = solar;

    return (
        <div className={`wx-solar-strip ${isDaylight ? 'is-day' : 'is-night'}`}>
            <div className="wx-solar-status">
                {isDaylight ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
                <span>{isDaylight ? 'Daylight' : 'Night'}</span>
                <span className="wx-solar-next">· {nextLabel} in {nextInLabel}</span>
            </div>
            <div className="wx-solar-times">
                <span className={now < sun.sunrise ? 'active' : ''}>
                    <Sunrise size={14} aria-hidden="true" />
                    {formatTimeIST12(sun.sunrise)}
                </span>
                <span className={isDaylight ? 'active' : ''}>
                    <Sunset size={14} aria-hidden="true" />
                    {formatTimeIST12(sun.sunset)}
                </span>
            </div>
        </div>
    );
}

export default function WeatherDashboard() {
    const { readings, loading, isRefreshing, error, refresh, canRefresh, refreshTitle } = useWeatherData();
    const [chartWindowHours, setChartWindowHours] = useState(() => readStoredWindow());
    const [chartMetric, setChartMetric] = useState(() => readStoredMetric());
    const [introCollapsed, setIntroCollapsed] = useState(() => readWxPref('introCollapsed', false));
    const [now, setNow] = useState(() => new Date());
    const [lastGoodReadings, setLastGoodReadings] = useState(() => {
        if (typeof window === 'undefined') return [];
        return getWeatherCacheSnapshot().data ?? [];
    });

    useEffect(() => {
        import('../styles/weather.css');
    }, []);

    useEffect(() => {
        writeWxPref('metric', chartMetric);
    }, [chartMetric]);

    useEffect(() => {
        writeWxPref('window', chartWindowHours);
    }, [chartWindowHours]);

    useEffect(() => {
        writeWxPref('introCollapsed', introCollapsed);
    }, [introCollapsed]);

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (readings.length > 0) setLastGoodReadings(readings);
    }, [readings]);

    const activeReadings = readings.length > 0 ? readings : lastGoodReadings;

    const historyOldest = useMemo(() => {
        return [...activeReadings]
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }, [activeReadings]);

    const spanHours = useMemo(() => readingSpanHours(historyOldest), [historyOldest]);

    const chartData = useMemo(
        () => sliceReadingsByHours(historyOldest, chartWindowHours),
        [historyOldest, chartWindowHours],
    );

    const altitudeM = station.altitudeM || 0;

    const outlookSeries = useMemo(
        () => buildPressureOutlookSeries(chartData),
        [chartData],
    );

    const outlookByTime = useMemo(() => {
        const map = new Map();
        outlookSeries.forEach((row) => map.set(row.time, row));
        return map;
    }, [outlookSeries]);

    const rainOutlook = useMemo(
        () => currentRainOutlook(historyOldest),
        [historyOldest],
    );

    const rhythmData = useMemo(
        () => hourlyBucketsIST(chartData, 'temperature', altitudeM),
        [chartData, altitudeM],
    );

    const activeSeries = SERIES_CONFIG.find((s) => s.key === chartMetric) ?? SERIES_CONFIG[0];

    const chartSummary = useMemo(() => {
        const current = activeReadings[0] ? enrichReading(activeReadings[0], altitudeM) : null;
        if (!chartData.length || !current) return null;
        const stats = summarizeMetric(chartData, chartMetric);
        if (!stats) return null;
        const nowVal = Number(current[chartMetric]);
        if (!Number.isFinite(nowVal)) return null;
        const avg = parseFloat(formatCalculated(stats.avg, 2));
        const diff = nowVal - avg;
        const relation = diff > 0.02 ? 'above' : diff < -0.02 ? 'below' : 'at';
        return `Now ${activeSeries.formatValue(nowVal)} · ${relation} window avg ${activeSeries.formatValue(avg)}`;
    }, [chartData, chartMetric, activeReadings, altitudeM, activeSeries]);

    const latest = activeReadings[0];
    const previous = activeReadings[1];

    if (loading && !latest) {
        return (
            <div className="wx-page">
                <p className="wx-loading">Loading weather telemetry…</p>
            </div>
        );
    }

    if (!latest) {
        return (
            <div className="wx-page">
                <div className="wx-error">
                    {error ? 'Unable to load weather data. Try refreshing shortly.' : 'No readings yet.'}
                </div>
            </div>
        );
    }

    const solar = getSolarState(station.lat, station.lon, now);
    const phase = getSolarPhase(station.lat, station.lon, now) ?? { label: 'Day', tone: 'day' };
    const comfort = getComfortLevel(
        Number(latest.temperature),
        Number(latest.humidity),
    );
    const temp = Number(latest.temperature);
    const hum = Number(latest.humidity);
    const pres = Number(latest.pressure);
    const dew = dewPointC(temp, hum);
    const hi = feelsLikeC(temp, hum);
    const slp = seaLevelPressureHPa(pres, station.altitudeM || 0, temp);
    const vpd = vaporPressureDeficitKPa(temp, hum);
    const trend = pressureTrend(chartData);
    const tempStats = summarizeMetric(chartData, 'temperature');
    const humStats = summarizeMetric(chartData, 'humidity');
    const presStats = summarizeMetric(chartData, 'pressure');
    const tempRate = hourlyRate(chartData, 'temperature');
    const humRate = hourlyRate(chartData, 'humidity');
    const presRate = hourlyRate(chartData, 'pressure');

    const statRows = tempStats ? [
        { key: 'temperature', label: 'Temp', stats: tempStats, suffix: '°C' },
        { key: 'humidity', label: 'Humidity', stats: humStats, suffix: '%' },
        { key: 'pressure', label: 'Pressure', stats: presStats, suffix: ' hPa' },
    ] : [];

    return (
        <div className="wx-page">
            <header className="wx-top">
                <div className="wx-top-brand">
                    <div className="wx-top-primary">
                        <span className="callsign-pill wx-callsign">{profile.callsign}</span>
                        <span className="wx-top-sep" aria-hidden="true">·</span>
                        <h1 className="wx-title">Shack weather</h1>
                        <span className={`wx-phase-dot phase-${phase.tone}`} title={phase.label} />
                    </div>
                    <p className="wx-sub">
                        <span>{station.name}</span>
                        {profile.qth && <span>{profile.qth}</span>}
                        <span className="wx-mono">{station.grid}</span>
                    </p>
                </div>
                <button
                    onClick={refresh}
                    className={`wx-refresh-btn ${isRefreshing ? 'spinning' : ''} ${!canRefresh ? 'cooldown' : ''}`}
                    title={refreshTitle}
                    disabled={!canRefresh}
                    aria-label={refreshTitle}
                >
                    <RefreshCw size={16} />
                </button>
            </header>

            <IntroBanner
                collapsed={introCollapsed}
                onToggle={() => setIntroCollapsed((c) => !c)}
            />

            <section className={`wx-live modern-card tone-${comfort.tone} phase-${phase.tone}`}>
                <div className="wx-live-row">
                    <div className="wx-temp-block">
                        <span className="wx-temp wx-num">{formatTempC(latest.temperature)}</span>
                        <div className="wx-temp-meta">
                            <strong className="wx-comfort-label">{comfort.label}</strong>
                            <TrendDelta current={latest.temperature} previous={previous?.temperature} unit="°C" />
                        </div>
                    </div>
                    <div className="wx-live-stats">
                        <LiveStat
                            label="Humidity"
                            value={formatHumidityPct(latest.humidity)}
                            hint="Relative moisture. Drives dew point and comfort."
                            delta={<TrendDelta current={latest.humidity} previous={previous?.humidity} unit="%" />}
                        />
                        <LiveStat
                            label="Pressure"
                            value={formatPressureHPa(latest.pressure)}
                            hint="Barometer trend helps predict outdoor rain."
                            delta={<TrendDelta current={latest.pressure} previous={previous?.pressure} unit=" hPa" />}
                        />
                        <LiveStat
                            label="Feels like"
                            value={formatCalcTempC(hi)}
                            hint="Temp adjusted for humidity"
                        />
                        <LiveStat
                            label="Dew point"
                            value={formatCalcTempC(dew)}
                            hint="When air saturates. Watch gear."
                        />
                        <LiveStat
                            label="Sea level"
                            value={formatCalcPressureHPa(slp)}
                            hint="Normalized to compare with forecasts"
                        />
                        <LiveStat
                            label="VPD"
                            value={formatVpdKPa(vpd)}
                            hint="Air dryness. Higher means faster evaporation."
                        />
                    </div>
                </div>
                <div className="wx-live-foot">
                    <time className="wx-reading wx-num" dateTime={latest.createdAt}>
                        {formatWeatherBeaconIST(latest.createdAt)}
                    </time>
                    <SolarStrip solar={solar} now={now} />
                </div>
            </section>

            <RainOutlookCard outlook={rainOutlook} />

            {historyOldest.length >= 2 && (
                <section className="modern-card wx-chart-card">
                    <div className="wx-chart-head">
                        <div className="wx-chart-head-text">
                            <h2 className="wx-section-title">History</h2>
                            <p className="wx-chart-meta wx-num">
                                {chartData.length} pts · {chartWindowHours}h
                                {spanHours > 0 && spanHours < chartWindowHours
                                    ? ` (${formatCalculated(spanHours, 2)}h data)`
                                    : ''}
                            </p>
                        </div>
                        <div className="wx-chart-filters">
                            <ChartMetricFilter value={chartMetric} onChange={setChartMetric} />
                            <ChartWindowFilter
                                value={chartWindowHours}
                                onChange={setChartWindowHours}
                                pointCount={historyOldest.length}
                            />
                        </div>
                    </div>
                    {chartSummary && (
                        <p className="wx-chart-summary wx-num">{chartSummary}</p>
                    )}
                    <WeatherChart
                        chartData={chartData}
                        activeMetric={chartMetric}
                        lat={station.lat}
                        lon={station.lon}
                        altitudeM={altitudeM}
                        outlookByTime={outlookByTime}
                    />
                </section>
            )}

            {outlookSeries.length >= 2 && (
                <section className="modern-card wx-chart-card wx-outlook-chart">
                    <div className="wx-chart-head wx-chart-head-compact">
                        <div className="wx-chart-head-text">
                            <h2 className="wx-section-title">Pressure & rain</h2>
                        </div>
                    </div>
                    <PressureOutlookChart
                        outlookData={outlookSeries}
                        lat={station.lat}
                        lon={station.lon}
                    />
                </section>
            )}

            {chartWindowHours >= 6 && chartData.length >= 2 && (
                <section className="modern-card wx-chart-card wx-comfort-card">
                    <div className="wx-chart-head wx-chart-head-compact">
                        <div className="wx-chart-head-text">
                            <h2 className="wx-section-title">Condensation</h2>
                        </div>
                        <div className="wx-comfort-legend wx-num" aria-hidden="true">
                            <span className="wx-legend-temp">Temp</span>
                            <span className="wx-legend-dew">Dew</span>
                        </div>
                    </div>
                    <ComfortChart
                        chartData={chartData}
                        lat={station.lat}
                        lon={station.lon}
                        altitudeM={altitudeM}
                    />
                </section>
            )}

            {chartWindowHours >= 6 && rhythmData.length >= 2 && (
                <section className="modern-card wx-chart-card wx-rhythm-card">
                    <div className="wx-chart-head wx-chart-head-compact">
                        <div className="wx-chart-head-text">
                            <h2 className="wx-section-title">Daily rhythm</h2>
                        </div>
                    </div>
                    <DailyRhythmChart rhythmData={rhythmData} />
                </section>
            )}

            <section className="modern-card wx-insights">
                <div className="wx-insights-stack">
                    <TrendsPanel
                        chartWindowHours={chartWindowHours}
                        trend={trend}
                        tempRate={tempRate}
                        humRate={humRate}
                        presRate={presRate}
                    />
                    {statRows.length > 0 && (
                        <div className="wx-insight-card wx-range-panel">
                            <span className="wx-kicker">Range · {chartWindowHours}h</span>
                            <div className="wx-range-grid">
                                {statRows.map((row) => (
                                    <div key={row.key} className="wx-range-row">
                                        <span className="wx-range-label">{row.label}</span>
                                        <span className="wx-range-values wx-num">
                                            <span>{formatSensorValue(row.stats.min)}{row.suffix}</span>
                                            <span className="wx-range-mid">{formatCalculated(row.stats.avg, 2)}{row.suffix}</span>
                                            <span>{formatSensorValue(row.stats.max)}{row.suffix}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <span className="wx-range-hint">min · avg · max</span>
                        </div>
                    )}
                </div>
            </section>

            <SetupDetails />

            <p className="wx-footer-note">
                ENV III at {profile.callsign}. Formula-based insight. Indoor only. 73
            </p>
        </div>
    );
}
