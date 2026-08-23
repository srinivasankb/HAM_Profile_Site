import React, { useState, useRef, useEffect } from 'react';
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
    Clock,
} from 'lucide-react';
import profile from '../data/profile.json';
import { STATIONS, formatWeatherBeaconIST } from '../lib/ham-utils';
import { useWeatherData } from '../hooks/useWeatherData';
import {
    dewPointC,
    feelsLikeC,
    seaLevelPressureHPa,
    vaporPressureDeficitKPa,
    getComfortLevel,
    summarizeMetric,
    pressureTrend,
    hourlyRate,
    predictNextValue,
    formatSensorValue,
    formatCalculated,
    formatTempC,
    formatHumidityPct,
    formatPressureHPa,
    formatCalcTempC,
    formatCalcPressureHPa,
    formatVpdKPa,
} from '../lib/weather-math';

const READINGS_INTERVAL_MIN = 15;
const CHART_HOURS = 24;
const CHART_POINTS = CHART_HOURS * (60 / READINGS_INTERVAL_MIN); // 96 readings @ 15 min
const CHART_WIDTH = 800;
const CHART_HEIGHT = 180;
const CHART_PAD = 12;

const SERIES_CONFIG = [
    { key: 'temperature', label: 'Temperature', color: '#dc2626', unit: '°C' },
    { key: 'humidity', label: 'Humidity', color: '#0891b2', unit: '%' },
    { key: 'pressure', label: 'Pressure', color: '#9333ea', unit: 'hPa' },
];

const station = STATIONS.find((s) => s.weatherBeacon) || STATIONS[0];

function Window24HPill({ title = '24-hour window, readings every 15 minutes' }) {
    return (
        <span className="wx-window-pill" title={title}>
            <Clock size={12} strokeWidth={2.25} aria-hidden="true" />
            <span>24H</span>
        </span>
    );
}

function SectionHead({ label, showWindowPill = true }) {
    return (
        <div className="wx-section-head">
            <span className="wx-kicker">{label}</span>
            {showWindowPill && <Window24HPill />}
        </div>
    );
}

function buildSmoothPath(points) {
    if (!points.length) return '';
    if (points.length === 1) {
        const p = points[0];
        return `M ${p.x},${p.y}`;
    }
    if (points.length === 2) {
        return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
    }

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
}

function computeSparkPoints(values, width = CHART_WIDTH, height = CHART_HEIGHT, padding = CHART_PAD) {
    if (!values.length) return { points: [], min: 0, max: 0, path: '' };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = values.length === 1 ? 0 : (width - padding * 2) / (values.length - 1);
    const points = values.map((v, i) => {
        const x = padding + i * stepX;
        const y = padding + (1 - (v - min) / range) * (height - padding * 2);
        return { x, y, value: v, index: i };
    });
    let path;
    if (points.length === 1) {
        const y = height / 2;
        path = `M ${padding},${y} L ${width - padding},${y}`;
    } else {
        path = buildSmoothPath(points);
    }
    return { points, min, max, path };
}

function TrendDelta({ current, previous, unit, size = 'md' }) {
    if (previous == null) return null;
    const diff = current - previous;
    if (Math.abs(diff) < 0.001) {
        return (
            <span className={`wx-delta neutral ${size}`}>
                <Minus size={11} strokeWidth={2.5} />0{unit}
            </span>
        );
    }
    const up = diff > 0;
    const label = `${up ? '+' : ''}${formatCalculated(diff, 2)}${unit}`;
    return (
        <span className={`wx-delta ${up ? 'up' : 'down'} ${size}`}>
            {up ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}
            {label}
        </span>
    );
}

function CombinedChart({ chartData, labelInterval }) {
    const [activeIndex, setActiveIndex] = useState(null);
    const chartRef = useRef(null);
    const lastIndexRef = useRef(null);

    const series = SERIES_CONFIG.map((cfg) => {
        const values = chartData.map((r) => r[cfg.key]);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const normalized = values.map((v) => (v - min) / range);
        const { path, points } = computeSparkPoints(normalized);
        return { ...cfg, path, points };
    });

    const count = chartData.length;
    const activeReading = activeIndex != null ? chartData[activeIndex] : null;
    const guideX =
        activeIndex != null && count > 1
            ? CHART_PAD + (activeIndex / (count - 1)) * (CHART_WIDTH - CHART_PAD * 2)
            : null;

    const resolveIndex = (clientX) => {
        const el = chartRef.current;
        if (!el || count < 2) return count === 1 ? 0 : null;
        const rect = el.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.round(ratio * (count - 1));
    };

    const setIndexIfChanged = (index) => {
        if (index == null) {
            if (lastIndexRef.current !== null) {
                lastIndexRef.current = null;
                setActiveIndex(null);
            }
            return;
        }
        if (index !== lastIndexRef.current) {
            lastIndexRef.current = index;
            setActiveIndex(index);
        }
    };

    const timeLabels = chartData.map((r) => formatWeatherBeaconIST(r.createdAt, true));

    return (
        <div className="wx-combined-chart">
            <div className="wx-chart-legend">
                {SERIES_CONFIG.map((cfg) => (
                    <span key={cfg.key} className="wx-legend-item" style={{ color: cfg.color }}>
                        <span className="wx-legend-dot" style={{ background: cfg.color }} />
                        {cfg.label}
                    </span>
                ))}
            </div>
            <div className="wx-chart-tooltip-slot" aria-live="polite">
                {activeReading && (
                    <div className="wx-chart-tooltip-panel">
                        <span className="wx-tooltip-time">
                            {formatWeatherBeaconIST(activeReading.createdAt, true)}
                        </span>
                        {SERIES_CONFIG.map((cfg) => (
                            <span key={cfg.key} className="wx-tooltip-item">
                                <span className="wx-tooltip-dot" style={{ background: cfg.color }} />
                                <span className="wx-tooltip-value">
                                    {formatSensorValue(activeReading[cfg.key])}
                                    {cfg.unit === 'hPa' ? ' hPa' : cfg.unit}
                                </span>
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <div
                ref={chartRef}
                className="wx-chart-interactive"
                onPointerMove={(e) => setIndexIfChanged(resolveIndex(e.clientX))}
                onPointerLeave={() => setIndexIfChanged(null)}
                onPointerDown={(e) => setIndexIfChanged(resolveIndex(e.clientX))}
                role="img"
                aria-label="Weather readings chart"
            >
                <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="wx-combined-svg" preserveAspectRatio="none">
                    {series.map((s) => (
                        <path key={s.key} d={s.path} fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    {guideX != null && (
                        <line x1={guideX} y1={CHART_PAD} x2={guideX} y2={CHART_HEIGHT - CHART_PAD} stroke="var(--muted-foreground)" strokeWidth="1" strokeOpacity="0.35" strokeDasharray="4 4" />
                    )}
                    {activeIndex != null &&
                        series.map((s) => {
                            const pt = s.points[activeIndex];
                            if (!pt) return null;
                            return <circle key={s.key} cx={pt.x} cy={pt.y} r="5" fill="var(--background)" stroke={s.color} strokeWidth="2" />;
                        })}
                </svg>
            </div>
            <div className="wx-time-axis">
                {timeLabels.map((label, i) => (
                    <span
                        key={i}
                        className="wx-time-tick"
                        style={{ visibility: i % labelInterval === 0 || i === timeLabels.length - 1 ? 'visible' : 'hidden' }}
                    >
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function WeatherDashboard() {
    const { readings, loading, isRefreshing, error, refresh, canRefresh, refreshTitle } = useWeatherData();

    useEffect(() => {
        import('../styles/weather.css');
    }, []);

    const chartData = readings.slice(0, CHART_POINTS).reverse();
    const latest = readings[0];
    const previous = readings[1];
    const labelInterval = chartData.length > 0 ? Math.max(1, Math.floor(chartData.length / 8)) : 1;

    if (loading && !latest) {
        return (
            <div className="wx-page">
                <p className="wx-loading">Loading weather telemetry…</p>
            </div>
        );
    }

    if (error && !latest) {
        return (
            <div className="wx-page">
                <div className="wx-error">Unable to load weather data. Try refreshing shortly.</div>
            </div>
        );
    }

    if (!latest) return null;

    const comfort = getComfortLevel(latest.temperature, latest.humidity);
    const dew = dewPointC(latest.temperature, latest.humidity);
    const hi = feelsLikeC(latest.temperature, latest.humidity);
    const slp = seaLevelPressureHPa(latest.pressure, station.altitudeM || 0, latest.temperature);
    const vpd = vaporPressureDeficitKPa(latest.temperature, latest.humidity);
    const trend = pressureTrend(chartData);
    const tempStats = summarizeMetric(chartData, 'temperature');
    const humStats = summarizeMetric(chartData, 'humidity');
    const presStats = summarizeMetric(chartData, 'pressure');
    const tempRate = hourlyRate(chartData, 'temperature');
    const humRate = hourlyRate(chartData, 'humidity');
    const presRate = hourlyRate(chartData, 'pressure');
    const predTemp = predictNextValue(chartData, 'temperature');
    const predHum = predictNextValue(chartData, 'humidity');

    const statRows = tempStats ? [
        { key: 'temperature', label: 'Temperature', stats: tempStats, suffix: '°C' },
        { key: 'humidity', label: 'Humidity', stats: humStats, suffix: '%' },
        { key: 'pressure', label: 'Pressure', stats: presStats, suffix: ' hPa' },
    ] : [];

    return (
        <div className="wx-page">
            <section className={`wx-hero modern-card tone-${comfort.tone}`}>
                <div className="wx-hero-grid">
                    <div className="wx-hero-station">
                        <div className="wx-hero-station-top">
                            <span className="callsign-pill wx-callsign">{profile.callsign}</span>
                            <button
                                onClick={refresh}
                                className={`wx-refresh-btn ${isRefreshing ? 'spinning' : ''} ${!canRefresh ? 'cooldown' : ''}`}
                                title={refreshTitle}
                                disabled={!canRefresh}
                                aria-label={refreshTitle}
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                        <h1 className="wx-hero-title">
                            Station weather
                            <Window24HPill />
                        </h1>
                        <dl className="wx-station-dl">
                            <div className="wx-station-dl-row">
                                <dt>Location</dt>
                                <dd>{station.name}{profile.qth ? `, ${profile.qth}` : ''}</dd>
                            </div>
                            <div className="wx-station-dl-row">
                                <dt>Grid</dt>
                                <dd className="wx-mono wx-num">{station.grid}</dd>
                            </div>
                            <div className="wx-station-dl-row">
                                <dt>Placement</dt>
                                <dd>Inside the radio shack (indoor)</dd>
                            </div>
                            <div className="wx-station-dl-row">
                                <dt>Sensor</dt>
                                <dd>ESP32-S3 Geek + M5Stack ENV III</dd>
                            </div>
                            <div className="wx-station-dl-row wx-station-dl-reading">
                                <dt>Reading</dt>
                                <dd>
                                    <time className="wx-reading-time wx-num" dateTime={latest.createdAt}>
                                        {formatWeatherBeaconIST(latest.createdAt)}
                                    </time>
                                </dd>
                            </div>
                        </dl>
                        <p className="wx-hero-note">
                            Indoor readings inside the shack, not outdoor weather. Not forecast or internet data.
                        </p>
                    </div>

                    <div className="wx-hero-readings">
                        <div className="wx-hero-temp-row">
                            <span className="wx-hero-temp wx-num">{formatTempC(latest.temperature)}</span>
                            <TrendDelta current={latest.temperature} previous={previous?.temperature} unit="°C" size="lg" />
                        </div>
                        <p className="wx-hero-comfort">
                            <strong>{comfort.label}</strong>
                            <span className="wx-hero-comfort-hint">{comfort.hint}</span>
                        </p>

                        <div className="wx-hero-metrics">
                            <div className="wx-hero-metric">
                                <span className="wx-hero-metric-label">
                                    <Droplets size={14} className="wx-icon-humidity" aria-hidden="true" />
                                    Humidity
                                </span>
                                <span className="wx-hero-metric-value wx-num">
                                    {formatHumidityPct(latest.humidity)}
                                    <TrendDelta current={latest.humidity} previous={previous?.humidity} unit="%" />
                                </span>
                            </div>
                            <div className="wx-hero-metric">
                                <span className="wx-hero-metric-label">
                                    <Gauge size={14} className="wx-icon-pressure" aria-hidden="true" />
                                    Pressure
                                </span>
                                <span className="wx-hero-metric-value wx-num">
                                    {formatPressureHPa(latest.pressure)}
                                    <TrendDelta current={latest.pressure} previous={previous?.pressure} unit=" hPa" />
                                </span>
                            </div>
                        </div>

                        <dl className="wx-hero-derived">
                            <div><dt>Feels like</dt><dd className="wx-num">{formatCalcTempC(hi)}</dd></div>
                            <div><dt>Dew point</dt><dd className="wx-num">{formatCalcTempC(dew)}</dd></div>
                            <div><dt>Sea-level</dt><dd className="wx-num">{formatCalcPressureHPa(slp)}</dd></div>
                            <div><dt>VPD</dt><dd className="wx-num">{formatVpdKPa(vpd)}</dd></div>
                        </dl>
                    </div>
                </div>
            </section>

            {chartData.length > 1 && (
                <section className="modern-card wx-chart-section">
                    <SectionHead label="Last 24 hours" />
                    <CombinedChart chartData={chartData} labelInterval={labelInterval} />
                </section>
            )}

            <section className="wx-trends modern-card">
                <div className="wx-trends-row">
                    <div className="wx-trend-block">
                        <span className="wx-kicker">Pressure trend</span>
                        <div className="wx-trend-main">
                            <span className={`wx-pressure-badge tone-${trend.tone}`}>
                                {trend.tone === 'up' ? <TrendingUp size={15} /> : trend.tone === 'down' ? <TrendingDown size={15} /> : <Minus size={15} />}
                                {trend.label}
                            </span>
                            <span className="wx-trend-detail wx-num">
                                {trend.delta >= 0 ? '+' : ''}{formatCalculated(trend.delta, 2)} hPa over 24 hours
                            </span>
                        </div>
                    </div>
                    <div className="wx-trend-block">
                        <span className="wx-kicker">Rate of change (24h)</span>
                        <div className="wx-rate-line wx-num">
                            <span><Thermometer size={13} /> {tempRate >= 0 ? '+' : ''}{formatCalculated(tempRate, 2)}°C/hr</span>
                            <span><Droplets size={13} /> {humRate >= 0 ? '+' : ''}{formatCalculated(humRate, 2)}%/hr</span>
                            <span><Gauge size={13} /> {presRate >= 0 ? '+' : ''}{formatCalculated(presRate, 2)} hPa/hr</span>
                        </div>
                    </div>
                </div>
                {predTemp != null && (
                    <p className="wx-muted">
                        Short-term outlook: {formatCalcTempC(predTemp)}, {formatHumidityPct(predHum)} humidity
                    </p>
                )}
            </section>

            {statRows.length > 0 && (
                <section className="wx-stats modern-card">
                    <SectionHead label="24-hour range" />
                    <table className="wx-table">
                        <thead>
                            <tr>
                                <th>Metric</th>
                                <th>Min</th>
                                <th>Avg</th>
                                <th>Max</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statRows.map((row) => (
                                <tr key={row.key}>
                                    <td>{row.label}</td>
                                    <td>{formatSensorValue(row.stats.min)}{row.suffix}</td>
                                    <td>{formatCalculated(row.stats.avg, 2)}{row.suffix}</td>
                                    <td>{formatSensorValue(row.stats.max)}{row.suffix}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            <p className="wx-footer-note">
                ENV III sensor inside the {profile.callsign} shack, {station.name}. 96 readings every 15 minutes (24H window). Not outdoor readings. 73
            </p>
        </div>
    );
}
