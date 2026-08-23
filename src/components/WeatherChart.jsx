import React, { useMemo, useRef, useEffect, useState, useCallback, useLayoutEffect, memo, Component } from 'react';
import { Thermometer, Droplets, Gauge } from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceArea,
    ReferenceLine,
    Area,
    ComposedChart,
} from 'recharts';
import { formatTimeIST12, getSolarPhase } from '../lib/ham-utils';
import {
    formatSensorValue,
    formatCalcTempC,
    formatCalcPressureHPa,
    formatHumidityPct,
    formatPressureHPa,
    formatVpdKPa,
    formatChartTick,
    formatCalculated,
    chartYDomain,
    nightSpansFromTimestamps,
    enrichReading,
} from '../lib/weather-math';

const CHART_HEIGHT = 200;
const COMFORT_CHART_HEIGHT = 140;
const RHYTHM_CHART_HEIGHT = 110;
const OUTLOOK_CHART_HEIGHT = 150;

const TICK_STYLE = {
    fontSize: 10,
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
};

export const SERIES_CONFIG = [
    {
        key: 'temperature',
        label: 'Temperature',
        shortLabel: 'Temp',
        color: '#dc2626',
        fill: 'rgba(220, 38, 38, 0.08)',
        minSpan: 2,
        icon: Thermometer,
        formatTick: (v) => `${formatChartTick(v)}°`,
        formatValue: (v) => `${formatSensorValue(v)}°C`,
        chartHint: 'Hover for feels-like, dew point, margin.',
    },
    {
        key: 'humidity',
        label: 'Humidity',
        shortLabel: 'Humidity',
        color: '#0891b2',
        fill: 'rgba(8, 145, 178, 0.08)',
        minSpan: 8,
        icon: Droplets,
        formatTick: (v) => `${formatChartTick(v)}%`,
        formatValue: (v) => `${formatSensorValue(v)}%`,
        comfortBand: { low: 40, high: 60 },
        chartHint: 'Green band: 40 to 60% RH.',
    },
    {
        key: 'pressure',
        label: 'Pressure',
        shortLabel: 'Pressure',
        color: '#9333ea',
        fill: 'rgba(147, 51, 234, 0.08)',
        minSpan: 3,
        icon: Gauge,
        formatTick: (v) => formatChartTick(v),
        formatValue: (v) => `${formatSensorValue(v)} hPa`,
        chartHint: 'Hover for sea-level pressure and 3h change.',
    },
];

function buildChartRows(chartData, altitudeM) {
    return chartData.map((r) => {
        const enriched = enrichReading(r, altitudeM);
        return {
            time: new Date(r.createdAt).getTime(),
            timeLabel: formatTimeIST12(r.createdAt),
            temperature: Number(enriched.temperature),
            humidity: Number(enriched.humidity),
            pressure: Number(enriched.pressure),
            feelsLike: enriched.feelsLike,
            dewPoint: enriched.dewPoint,
            dewMargin: enriched.dewMargin,
            seaLevelPressure: enriched.seaLevelPressure,
            vpd: enriched.vpd,
            delta3h: r.delta3h ?? null,
        };
    });
}

function tooltipRowsForMetric(metricKey, row) {
    switch (metricKey) {
        case 'temperature':
            return [
                { label: 'Temperature', value: `${formatSensorValue(row.temperature)}°C` },
                { label: 'Feels like', value: formatCalcTempC(row.feelsLike) },
                { label: 'Dew point', value: formatCalcTempC(row.dewPoint) },
                {
                    label: 'Dew margin',
                    value: formatCalcTempC(row.dewMargin),
                    hint: row.dewMargin < 2 ? 'Condensation risk' : null,
                },
            ];
        case 'humidity':
            return [
                { label: 'Humidity', value: formatHumidityPct(row.humidity) },
                { label: 'Dew point', value: formatCalcTempC(row.dewPoint) },
                { label: 'VPD', value: formatVpdKPa(row.vpd) },
                { label: 'Dew margin', value: formatCalcTempC(row.dewMargin) },
            ];
        case 'pressure':
            return [
                { label: 'Pressure', value: formatPressureHPa(row.pressure) },
                {
                    label: 'Sea level',
                    value: formatCalcPressureHPa(row.seaLevelPressure),
                },
                ...(row.delta3h != null
                    ? [{
                        label: '3h change',
                        value: `${row.delta3h >= 0 ? '+' : ''}${formatCalculated(row.delta3h, 2)} hPa`,
                    }]
                    : []),
            ];
        default:
            return [];
    }
}

const TooltipSync = memo(function TooltipSync({ active, payload, onHover }) {
    useLayoutEffect(() => {
        if (!active || !payload?.[0]?.payload) return;
        onHover(payload[0].payload);
    }, [active, payload, onHover]);
    return null;
});

function HoverPhase({ row, lat, lon }) {
    if (!row?.time || lat == null || lon == null) return null;
    const phase = getSolarPhase(lat, lon, row.time);
    if (!phase) return null;
    return (
        <span className={`wx-tooltip-phase phase-${phase.tone}`}>{phase.label}</span>
    );
}

function ChartHoverDock({ row, placeholder, lat, lon, children, variant = 'default' }) {
    return (
        <div
            className={`wx-chart-hover-dock wx-hover-${variant} ${row ? 'is-active' : 'is-empty'}`}
            aria-live="polite"
        >
            <div className="wx-hover-head">
                <span className="wx-hover-time wx-num">{row?.timeLabel ?? 'Select point'}</span>
                {row && <HoverPhase row={row} lat={lat} lon={lon} />}
            </div>
            <div className="wx-hover-body">
                {row ? children : (
                    <span className="wx-chart-hover-placeholder">{placeholder}</span>
                )}
            </div>
        </div>
    );
}

function HoverMetricGrid({ items }) {
    const hint = items.find((item) => item.hint)?.hint;
    return (
        <>
            <dl className="wx-hover-grid">
                {items.map((item) => (
                    <div key={item.label} className="wx-hover-cell">
                        <dt>{item.label}</dt>
                        <dd className="wx-num">{item.value}</dd>
                    </div>
                ))}
            </dl>
            {hint && <p className="wx-hover-note">{hint}</p>}
        </>
    );
}

function HistoryHoverDock({ row, series, lat, lon, placeholder }) {
    const items = row ? tooltipRowsForMetric(series.key, row) : [];
    return (
        <ChartHoverDock row={row} placeholder={placeholder} lat={lat} lon={lon}>
            <HoverMetricGrid items={items} />
        </ChartHoverDock>
    );
}

function ComfortHoverDock({ row, lat, lon, placeholder }) {
    const margin = row ? row.temperature - row.dewPoint : null;
    const items = row
        ? [
            { label: 'Temperature', value: formatCalcTempC(row.temperature) },
            { label: 'Dew point', value: formatCalcTempC(row.dewPoint) },
            { label: 'Margin', value: formatCalcTempC(margin) },
        ]
        : [];
    const hint = margin != null && margin < 2 ? 'Condensation risk' : null;

    return (
        <ChartHoverDock row={row} placeholder={placeholder} lat={lat} lon={lon} variant="comfort">
            <HoverMetricGrid items={items} />
            {hint && <p className="wx-hover-note">{hint}</p>}
        </ChartHoverDock>
    );
}

function OutlookHoverDock({ row, lat, lon, placeholder }) {
    const items = row
        ? [
            {
                label: '3h ΔP',
                value: `${row.delta3h >= 0 ? '+' : ''}${formatCalculated(row.delta3h, 2)} hPa`,
            },
            { label: 'Trend', value: row.tendencyLabel },
            { label: 'Rain', value: row.rainSummary },
        ]
        : [];

    return (
        <ChartHoverDock row={row} placeholder={placeholder} lat={lat} lon={lon} variant="outlook">
            <HoverMetricGrid items={items} />
        </ChartHoverDock>
    );
}

function RhythmHoverDock({ row, placeholder }) {
    const displayRow = row
        ? { timeLabel: `${row.label} IST avg`, time: row.time ?? Date.now() }
        : null;

    return (
        <ChartHoverDock row={displayRow} placeholder={placeholder} lat={null} lon={null}>
            {row && (
                <dl className="wx-hover-grid">
                    <div className="wx-hover-cell">
                        <dt>Avg temp</dt>
                        <dd className="wx-num">{formatCalcTempC(row.value)}</dd>
                    </div>
                </dl>
            )}
        </ChartHoverDock>
    );
}

const CHART_TOOLTIP_PROPS = {
    allowEscapeViewBox: { x: true, y: true },
    wrapperClassName: 'wx-chart-tooltip-wrapper',
    isAnimationActive: false,
};

export function ChartMetricFilter({ value, onChange }) {
    return (
        <div className="wx-tab-group" role="group" aria-label="Chart metric">
            {SERIES_CONFIG.map((cfg) => {
                const Icon = cfg.icon;
                return (
                    <button
                        key={cfg.key}
                        type="button"
                        className={`wx-tab metric-${cfg.key} ${value === cfg.key ? 'active' : ''}`}
                        onClick={() => onChange(cfg.key)}
                        aria-pressed={value === cfg.key}
                    >
                        <Icon size={13} strokeWidth={2} aria-hidden="true" />
                        <span>{cfg.shortLabel}</span>
                    </button>
                );
            })}
        </div>
    );
}

function useChartWidth() {
    const ref = useRef(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const update = () => {
            const w = el.getBoundingClientRect().width;
            if (w > 0) setWidth(Math.floor(w));
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return { ref, width };
}

function useStableHover() {
    const [hoverRow, setHoverRow] = useState(null);
    const onHover = useCallback((row) => {
        if (!row) return;
        setHoverRow((prev) => {
            const prevKey = prev?.time ?? prev?.label;
            const nextKey = row.time ?? row.label;
            return prevKey === nextKey ? prev : row;
        });
    }, []);
    const clearHover = useCallback(() => setHoverRow(null), []);
    return { hoverRow, onHover, clearHover };
}

const HistoryLinePlot = memo(function HistoryLinePlot({
    width,
    rows,
    series,
    yDomain,
    windowAvg,
    nightSpans,
    gradientId,
    lat,
    lon,
    onHover,
}) {
    return (
        <LineChart
            width={width}
            height={CHART_HEIGHT}
            data={rows}
            margin={{ top: 10, right: 8, left: 4, bottom: 4 }}
        >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={series.color} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={series.color} stopOpacity={0.02} />
                </linearGradient>
            </defs>
            {nightSpans.map((span, i) => (
                <ReferenceArea
                    key={`night-${i}`}
                    x1={span.x1}
                    x2={span.x2}
                    yAxisId="main"
                    fill="rgba(30, 58, 138, 0.05)"
                    strokeOpacity={0}
                    ifOverflow="hidden"
                />
            ))}
            {series.comfortBand && (
                <ReferenceArea
                    yAxisId="main"
                    y1={series.comfortBand.low}
                    y2={series.comfortBand.high}
                    fill="rgba(16, 185, 129, 0.1)"
                    strokeOpacity={0}
                    ifOverflow="extendDomain"
                />
            )}
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t) => formatTimeIST12(new Date(t))}
                minTickGap={36}
                tick={{ ...TICK_STYLE, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                dy={4}
            />
            <YAxis
                yAxisId="main"
                orientation="left"
                domain={yDomain}
                stroke={series.color}
                tick={{ ...TICK_STYLE, fill: series.color }}
                tickLine={false}
                axisLine={false}
                width={46}
                tickFormatter={series.formatTick}
            />
            {windowAvg != null && (
                <ReferenceLine
                    yAxisId="main"
                    y={windowAvg}
                    stroke={series.color}
                    strokeDasharray="4 4"
                    strokeOpacity={0.45}
                    ifOverflow="extendDomain"
                />
            )}
            <Tooltip
                {...CHART_TOOLTIP_PROPS}
                content={<TooltipSync onHover={onHover} />}
                cursor={{
                    stroke: series.color,
                    strokeOpacity: 0.3,
                    strokeDasharray: '4 4',
                }}
            />
            <Area
                yAxisId="main"
                type="monotone"
                dataKey={series.key}
                stroke="none"
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
            />
            <Line
                yAxisId="main"
                type="monotone"
                dataKey={series.key}
                stroke={series.color}
                strokeWidth={2}
                dot={false}
                activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    fill: 'var(--background)',
                    stroke: series.color,
                }}
                isAnimationActive={false}
            />
        </LineChart>
    );
});

const ComfortLinePlot = memo(function ComfortLinePlot({
    width,
    rows,
    yDomain,
    nightSpans,
    onHover,
}) {
    return (
        <LineChart
            width={width}
            height={COMFORT_CHART_HEIGHT}
            data={rows}
            margin={{ top: 8, right: 8, left: 4, bottom: 2 }}
        >
            {nightSpans.map((span, i) => (
                <ReferenceArea
                    key={`night-${i}`}
                    x1={span.x1}
                    x2={span.x2}
                    yAxisId="main"
                    fill="rgba(30, 58, 138, 0.05)"
                    strokeOpacity={0}
                    ifOverflow="hidden"
                />
            ))}
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t) => formatTimeIST12(new Date(t))}
                minTickGap={40}
                tick={{ ...TICK_STYLE, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                dy={4}
            />
            <YAxis
                yAxisId="main"
                orientation="left"
                domain={yDomain}
                stroke="#dc2626"
                tick={{ ...TICK_STYLE, fill: '#dc2626' }}
                tickLine={false}
                axisLine={false}
                width={42}
                tickFormatter={(v) => `${formatChartTick(v)}°`}
            />
            <Tooltip
                {...CHART_TOOLTIP_PROPS}
                content={<TooltipSync onHover={onHover} />}
                cursor={{
                    stroke: 'var(--muted-foreground)',
                    strokeOpacity: 0.25,
                    strokeDasharray: '4 4',
                }}
            />
            <Line
                yAxisId="main"
                type="monotone"
                dataKey="temperature"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 2, fill: 'var(--background)', stroke: '#dc2626' }}
                isAnimationActive={false}
            />
            <Line
                yAxisId="main"
                type="monotone"
                dataKey="dewPoint"
                stroke="#0d9488"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 2, fill: 'var(--background)', stroke: '#0d9488' }}
                isAnimationActive={false}
            />
        </LineChart>
    );
});

const OutlookComposedPlot = memo(function OutlookComposedPlot({
    width,
    rows,
    yDomain,
    nightSpans,
    onHover,
}) {
    return (
        <ComposedChart
            width={width}
            height={OUTLOOK_CHART_HEIGHT}
            data={rows}
            margin={{ top: 8, right: 8, left: 4, bottom: 2 }}
        >
            {nightSpans.map((span, i) => (
                <ReferenceArea
                    key={`night-${i}`}
                    x1={span.x1}
                    x2={span.x2}
                    yAxisId="delta"
                    fill="rgba(30, 58, 138, 0.05)"
                    strokeOpacity={0}
                    ifOverflow="hidden"
                />
            ))}
            <ReferenceArea yAxisId="delta" y1={yDomain[0]} y2={-3} fill="rgba(239, 68, 68, 0.08)" strokeOpacity={0} />
            <ReferenceArea yAxisId="delta" y1={-3} y2={-1.5} fill="rgba(249, 115, 22, 0.07)" strokeOpacity={0} />
            <ReferenceArea yAxisId="delta" y1={1.5} y2={yDomain[1]} fill="rgba(16, 185, 129, 0.08)" strokeOpacity={0} />
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t) => formatTimeIST12(new Date(t))}
                minTickGap={40}
                tick={{ ...TICK_STYLE, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                dy={4}
            />
            <YAxis
                yAxisId="delta"
                orientation="left"
                domain={yDomain}
                stroke="#9333ea"
                tick={{ ...TICK_STYLE, fill: '#9333ea' }}
                tickLine={false}
                axisLine={false}
                width={42}
                tickFormatter={(v) => formatChartTick(v)}
            />
            <YAxis yAxisId="score" orientation="right" domain={[0, 100]} hide />
            <ReferenceLine yAxisId="delta" y={0} stroke="var(--border)" strokeWidth={1.5} />
            <Tooltip
                {...CHART_TOOLTIP_PROPS}
                content={<TooltipSync onHover={onHover} />}
                cursor={{
                    stroke: '#9333ea',
                    strokeOpacity: 0.25,
                    strokeDasharray: '4 4',
                }}
            />
            <Bar
                yAxisId="score"
                dataKey="rainScore"
                fill="#0891b2"
                fillOpacity={0.15}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
            />
            <Line
                yAxisId="delta"
                type="monotone"
                dataKey="delta3h"
                stroke="#9333ea"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 2, fill: 'var(--background)', stroke: '#9333ea' }}
                isAnimationActive={false}
            />
        </ComposedChart>
    );
});

const RhythmBarPlot = memo(function RhythmBarPlot({
    width,
    rhythmData,
    yDomain,
    onHover,
}) {
    return (
        <BarChart
            width={width}
            height={RHYTHM_CHART_HEIGHT}
            data={rhythmData}
            margin={{ top: 6, right: 4, left: 2, bottom: 0 }}
        >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
                dataKey="label"
                tick={{ ...TICK_STYLE, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                interval="preserveStartEnd"
                minTickGap={12}
            />
            <YAxis
                domain={yDomain}
                tick={{ ...TICK_STYLE, fill: '#dc2626' }}
                tickLine={false}
                axisLine={false}
                width={42}
                tickFormatter={(v) => `${formatChartTick(v)}°`}
            />
            <Tooltip
                {...CHART_TOOLTIP_PROPS}
                content={<TooltipSync onHover={onHover} />}
                cursor={{ fill: 'rgba(220, 38, 38, 0.06)' }}
            />
            <Bar
                dataKey="value"
                fill="#dc2626"
                fillOpacity={0.75}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
            />
        </BarChart>
    );
});

function WeatherChartBody({ chartData, activeMetric, lat, lon, altitudeM = 0, outlookByTime }) {
    const { ref, width } = useChartWidth();
    const { hoverRow, onHover, clearHover } = useStableHover();
    const series = SERIES_CONFIG.find((s) => s.key === activeMetric) ?? SERIES_CONFIG[0];

    const rows = useMemo(() => {
        const base = buildChartRows(chartData, altitudeM);
        if (!outlookByTime) return base;
        return base.map((row) => ({
            ...row,
            delta3h: outlookByTime.get(row.time)?.delta3h ?? null,
        }));
    }, [chartData, altitudeM, outlookByTime]);

    const values = useMemo(
        () => rows.map((r) => r[series.key]).filter((v) => Number.isFinite(v)),
        [rows, series.key],
    );

    const yDomain = useMemo(
        () => chartYDomain(values, series.minSpan),
        [values, series.minSpan],
    );

    const windowAvg = useMemo(() => {
        if (!values.length) return null;
        return parseFloat(formatCalculated(values.reduce((a, b) => a + b, 0) / values.length, 2));
    }, [values]);

    const nightSpans = useMemo(
        () => nightSpansFromTimestamps(rows.map((r) => r.time), lat, lon),
        [rows, lat, lon],
    );

    if (rows.length < 2) {
        return <p className="wx-chart-empty">Need more readings for this window.</p>;
    }

    const gradientId = `wx-fill-${series.key}`;

    const plot = useMemo(() => {
        if (width <= 0) return null;
        return (
            <HistoryLinePlot
                width={width}
                rows={rows}
                series={series}
                yDomain={yDomain}
                windowAvg={windowAvg}
                nightSpans={nightSpans}
                gradientId={gradientId}
                lat={lat}
                lon={lon}
                onHover={onHover}
            />
        );
    }, [width, rows, series, yDomain, windowAvg, nightSpans, gradientId, lat, lon, onHover]);

    return (
        <div
            ref={ref}
            className="wx-recharts-wrap"
            onMouseLeave={clearHover}
        >
            <HistoryHoverDock
                row={hoverRow}
                series={series}
                lat={lat}
                lon={lon}
                placeholder="Hover chart for calculated values"
            />
            <div className="wx-chart-plot">{plot}</div>
        </div>
    );
}

function ComfortChartBody({ chartData, lat, lon, altitudeM = 0 }) {
    const { ref, width } = useChartWidth();
    const { hoverRow, onHover, clearHover } = useStableHover();
    const rows = useMemo(
        () => buildChartRows(chartData, altitudeM),
        [chartData, altitudeM],
    );

    const yDomain = useMemo(() => {
        const vals = rows.flatMap((r) => [r.temperature, r.dewPoint]).filter((v) => Number.isFinite(v));
        return chartYDomain(vals, 2);
    }, [rows]);

    const nightSpans = useMemo(
        () => nightSpansFromTimestamps(rows.map((r) => r.time), lat, lon),
        [rows, lat, lon],
    );

    if (rows.length < 2) {
        return <p className="wx-chart-empty">Need more readings for this window.</p>;
    }

    const plot = useMemo(() => {
        if (width <= 0) return null;
        return (
            <ComfortLinePlot
                width={width}
                rows={rows}
                yDomain={yDomain}
                nightSpans={nightSpans}
                onHover={onHover}
            />
        );
    }, [width, rows, yDomain, nightSpans, onHover]);

    return (
        <div
            ref={ref}
            className="wx-recharts-wrap wx-recharts-wrap-sm"
            onMouseLeave={clearHover}
        >
            <ComfortHoverDock
                row={hoverRow}
                lat={lat}
                lon={lon}
                placeholder="Hover for temp vs dew point"
            />
            <div className="wx-chart-plot">{plot}</div>
        </div>
    );
}

function PressureOutlookChartBody({ outlookData, lat, lon }) {
    const { ref, width } = useChartWidth();
    const { hoverRow, onHover, clearHover } = useStableHover();

    const rows = useMemo(
        () =>
            outlookData.map((r) => ({
                ...r,
                timeLabel: formatTimeIST12(r.time),
            })),
        [outlookData],
    );

    const yDomain = useMemo(() => {
        const vals = rows.map((r) => r.delta3h).filter((v) => Number.isFinite(v));
        return chartYDomain(vals, 1);
    }, [rows]);

    const nightSpans = useMemo(
        () => nightSpansFromTimestamps(rows.map((r) => r.time), lat, lon),
        [rows, lat, lon],
    );

    if (rows.length < 2) {
        return <p className="wx-chart-empty">Need at least 3 hours of readings for pressure outlook.</p>;
    }

    const plot = useMemo(() => {
        if (width <= 0) return null;
        return (
            <OutlookComposedPlot
                width={width}
                rows={rows}
                yDomain={yDomain}
                nightSpans={nightSpans}
                onHover={onHover}
            />
        );
    }, [width, rows, yDomain, nightSpans, onHover]);

    return (
        <div
            ref={ref}
            className="wx-recharts-wrap wx-recharts-wrap-sm"
            onMouseLeave={clearHover}
        >
            <OutlookHoverDock
                row={hoverRow}
                lat={lat}
                lon={lon}
                placeholder="Hover for pressure change and rain outlook"
            />
            <div className="wx-chart-plot">{plot}</div>
        </div>
    );
}

function DailyRhythmChartBody({ rhythmData }) {
    const { ref, width } = useChartWidth();
    const { hoverRow, onHover, clearHover } = useStableHover();

    const yDomain = useMemo(
        () => chartYDomain(rhythmData.map((r) => r.value), 2),
        [rhythmData],
    );

    if (rhythmData.length < 2) {
        return <p className="wx-chart-empty">Need a longer window for hourly rhythm.</p>;
    }

    const plot = useMemo(() => {
        if (width <= 0) return null;
        return (
            <RhythmBarPlot
                width={width}
                rhythmData={rhythmData}
                yDomain={yDomain}
                onHover={onHover}
            />
        );
    }, [width, rhythmData, yDomain, onHover]);

    return (
        <div
            ref={ref}
            className="wx-recharts-wrap wx-recharts-wrap-sm"
            onMouseLeave={clearHover}
        >
            <RhythmHoverDock
                row={hoverRow}
                placeholder="Hover a bar for hourly average"
            />
            <div className="wx-chart-plot">{plot}</div>
        </div>
    );
}

class ChartErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    render() {
        if (this.state.error) {
            return (
                <p className="wx-chart-empty">
                    Chart could not render. Try another metric or refresh.
                </p>
            );
        }
        return this.props.children;
    }
}

export default function WeatherChart(props) {
    return (
        <ChartErrorBoundary>
            <WeatherChartBody {...props} />
        </ChartErrorBoundary>
    );
}

export function ComfortChart(props) {
    return (
        <ChartErrorBoundary>
            <ComfortChartBody {...props} />
        </ChartErrorBoundary>
    );
}

export function PressureOutlookChart(props) {
    return (
        <ChartErrorBoundary>
            <PressureOutlookChartBody {...props} />
        </ChartErrorBoundary>
    );
}

export function DailyRhythmChart({ rhythmData }) {
    return (
        <ChartErrorBoundary>
            <DailyRhythmChartBody rhythmData={rhythmData} />
        </ChartErrorBoundary>
    );
}
