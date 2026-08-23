/** Calculated metrics: round to maxDecimals, trim trailing zeros */
import { formatHour12IST, isNightAt } from './ham-utils';
export function formatCalculated(value, maxDecimals = 2) {
    if (value == null || Number.isNaN(value)) return 'n/a';
    return parseFloat(Number(value).toFixed(maxDecimals)).toString();
}

/** Display API sensor values rounded to 2 decimal places */
export function formatSensorValue(value) {
    return formatCalculated(value, 2);
}

/** Display temperature with °C */
export function formatTempC(value) {
    if (value == null || Number.isNaN(value)) return 'n/a';
    return `${formatSensorValue(value)}°C`;
}

/** Display humidity with % */
export function formatHumidityPct(value) {
    if (value == null || Number.isNaN(value)) return 'n/a';
    return `${formatSensorValue(value)}%`;
}

/** Display pressure with hPa */
export function formatPressureHPa(value) {
    if (value == null || Number.isNaN(value)) return 'n/a';
    return `${formatSensorValue(value)} hPa`;
}

/** Display calculated temperature with °C */
export function formatCalcTempC(value, maxDecimals = 2) {
    if (value == null || Number.isNaN(value)) return 'n/a';
    return `${formatCalculated(value, maxDecimals)}°C`;
}

/** Display calculated pressure with hPa */
export function formatCalcPressureHPa(value, maxDecimals = 2) {
    if (value == null || Number.isNaN(value)) return 'n/a';
    return `${formatCalculated(value, maxDecimals)} hPa`;
}

/** Display VPD with kPa */
export function formatVpdKPa(value, maxDecimals = 2) {
    if (value == null || Number.isNaN(value)) return 'n/a';
    return `${formatCalculated(value, maxDecimals)} kPa`;
}

/** Chart axis tick — always 2 decimal places max */
export function formatChartTick(value, suffix = '') {
    if (value == null || Number.isNaN(value)) return '';
    return `${formatSensorValue(value)}${suffix}`;
}

/** Dew point (°C) — Magnus formula */
export function dewPointC(tempC, humidityPct) {
    const a = 17.27;
    const b = 237.7;
    const rh = humidityPct / 100;
    const alpha = (a * tempC) / (b + tempC) + Math.log(rh);
    return (b * alpha) / (a - alpha);
}

/** Heat index / apparent temperature (°C) — Rothfusz regression (hot conditions) */
export function heatIndexC(tempC, humidityPct) {
    const tF = tempC * 9 / 5 + 32;
    const rh = humidityPct;

    if (tF < 80) return tempC;

    let hi =
        -42.379 +
        2.04901523 * tF +
        10.14333127 * rh -
        0.22475541 * tF * rh -
        0.00683783 * tF * tF -
        0.05481717 * rh * rh +
        0.00122874 * tF * tF * rh +
        0.00085282 * tF * rh * rh -
        0.00000199 * tF * tF * rh * rh;

    if (rh < 13 && tF >= 80 && tF <= 112) {
        hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(tF - 95)) / 17);
    } else if (rh > 85 && tF >= 80 && tF <= 87) {
        hi += ((rh - 85) / 10) * ((87 - tF) / 5);
    }

    return (hi - 32) * 5 / 9;
}

/**
 * Steadman apparent temperature (°C). Accounts for humidity at any temperature;
 * wind defaults to 0 at the shack sensor.
 */
export function apparentTemperatureC(tempC, humidityPct, windMs = 0) {
    const vaporHpa = saturationVaporPressureKPa(tempC) * (humidityPct / 100) * 10;
    return tempC + 0.33 * vaporHpa - 0.7 * windMs - 4;
}

/** Feels-like: Rothfusz heat index when hot, Steadman apparent temp otherwise */
export function feelsLikeC(tempC, humidityPct) {
    const tF = tempC * 9 / 5 + 32;
    if (tF >= 80) return heatIndexC(tempC, humidityPct);
    return apparentTemperatureC(tempC, humidityPct);
}

/** Saturation vapor pressure (kPa) */
export function saturationVaporPressureKPa(tempC) {
    return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

/** Vapor pressure deficit (kPa) */
export function vaporPressureDeficitKPa(tempC, humidityPct) {
    const svp = saturationVaporPressureKPa(tempC);
    return svp - svp * (humidityPct / 100);
}

/** Estimate sea-level pressure from station reading (hPa) */
export function seaLevelPressureHPa(stationHPa, altitudeM, tempC) {
    if (!altitudeM) return stationHPa;
    const tK = tempC + 273.15;
    return stationHPa * Math.pow(1 - (0.0065 * altitudeM) / (tK + 0.0065 * altitudeM), -5.257);
}

/** Dew point depression / margin (°C) — low values mean condensation risk */
export function dewMarginC(tempC, humidityPct) {
    return tempC - dewPointC(tempC, humidityPct);
}

/** Add derived metrics to a raw reading */
export function enrichReading(reading, altitudeM = 0) {
    const temp = Number(reading.temperature);
    const hum = Number(reading.humidity);
    const pres = Number(reading.pressure);
    const dew = dewPointC(temp, hum);
    return {
        ...reading,
        feelsLike: feelsLikeC(temp, hum),
        dewPoint: dew,
        dewMargin: temp - dew,
        seaLevelPressure: seaLevelPressureHPa(pres, altitudeM, temp),
        vpd: vaporPressureDeficitKPa(temp, hum),
    };
}

export function enrichReadings(readings, altitudeM = 0) {
    return readings.map((r) => enrichReading(r, altitudeM));
}

/** Average metric per IST hour (0–23) for rhythm charts */
export function hourlyBucketsIST(readingsOldestFirst, key, altitudeM = 0) {
    const buckets = new Map();

    for (const r of readingsOldestFirst) {
        const enriched = enrichReading(r, altitudeM);
        const val = Number(enriched[key]);
        if (!Number.isFinite(val)) continue;
        const hour = istHour(r.createdAt);
        if (!buckets.has(hour)) buckets.set(hour, { sum: 0, count: 0 });
        const b = buckets.get(hour);
        b.sum += val;
        b.count += 1;
    }

    const rows = [];
    for (let h = 0; h < 24; h += 1) {
        const b = buckets.get(h);
        if (!b) continue;
        rows.push({
            hour: h,
            label: formatHour12IST(h),
            value: parseFloat(formatCalculated(b.sum / b.count, 2)),
        });
    }
    return rows;
}

export function getComfortLevel(tempC, humidityPct) {
    const feels = feelsLikeC(tempC, humidityPct);
    if (tempC < 16) return { label: 'Cool', hint: 'Light layers recommended', tone: 'cool' };
    if (feels >= 35) return { label: 'Very Hot', hint: 'High heat stress. Stay hydrated.', tone: 'hot' };
    if (feels >= 32) return { label: 'Hot & Humid', hint: 'Feels warmer than actual temperature', tone: 'warm' };
    if (humidityPct >= 85) return { label: 'Very Humid', hint: 'High moisture in the air', tone: 'humid' };
    if (tempC >= 28) return { label: 'Warm', hint: 'Pleasant for most activities', tone: 'warm' };
    if (humidityPct >= 70) return { label: 'Humid', hint: 'Moderate moisture levels', tone: 'humid' };
    return { label: 'Comfortable', hint: 'Balanced temperature and humidity', tone: 'comfort' };
}

export function summarizeMetric(readings, key) {
    if (!readings.length) return null;
    const values = readings.map((r) => r[key]);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: sum / values.length,
    };
}

export function pressureTrend(readings) {
    if (readings.length < 4) return { label: 'Stable', delta: 0, tone: 'neutral' };
    const recent = readings.slice(-3).map((r) => r.pressure);
    const older = readings.slice(-6, -3).map((r) => r.pressure);
    if (older.length < 3) return { label: 'Stable', delta: 0, tone: 'neutral' };

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const delta = recentAvg - olderAvg;

    if (delta > 0.4) return { label: 'Rising', delta, tone: 'up' };
    if (delta < -0.4) return { label: 'Falling', delta, tone: 'down' };
    return { label: 'Stable', delta, tone: 'neutral' };
}

/** Per-hour rate of change from oldest→newest window (units per hour) */
export function hourlyRate(readings, key) {
    if (readings.length < 2) return 0;
    const first = readings[0][key];
    const last = readings[readings.length - 1][key];
    const hours =
        (new Date(readings[readings.length - 1].createdAt) - new Date(readings[0].createdAt)) /
        (1000 * 60 * 60);
    if (hours <= 0) return 0;
    return (last - first) / hours;
}

/** Hours between first and last reading (oldest→newest array) */
export function readingSpanHours(readingsOldestFirst) {
    if (readingsOldestFirst.length < 2) return 0;
    const start = new Date(readingsOldestFirst[0].createdAt).getTime();
    const end = new Date(readingsOldestFirst[readingsOldestFirst.length - 1].createdAt).getTime();
    return Math.max(0, (end - start) / (3600 * 1000));
}

/** Slice readings to a time window ending at the latest point */
export function sliceReadingsByHours(readingsOldestFirst, hours) {
    if (!readingsOldestFirst.length) return [];
    const endMs = new Date(readingsOldestFirst[readingsOldestFirst.length - 1].createdAt).getTime();
    const startMs = endMs - hours * 60 * 60 * 1000;
    return readingsOldestFirst.filter((r) => new Date(r.createdAt).getTime() >= startMs);
}

export function predictNextValue(readings, key) {
    if (readings.length < 3) return null;
    const rate = hourlyRate(readings, key);
    const latest = readings[readings.length - 1][key];
    return latest + rate * 0.25; // ~15 min ahead
}

/** Hour (0–23) in Asia/Kolkata for a timestamp */
export function istHour(dateInput) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return parseInt(
        new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            hour12: false,
        }).format(d),
        10,
    );
}

/** Day/night phase for ambient theming (IST, shack-local) */
export function getTimeOfDay(dateInput) {
    const h = istHour(dateInput);
    if (h >= 5 && h < 7) return { label: 'Dawn', tone: 'dawn', isNight: false };
    if (h >= 7 && h < 17) return { label: 'Day', tone: 'day', isNight: false };
    if (h >= 17 && h < 19) return { label: 'Dusk', tone: 'dusk', isNight: false };
    return { label: 'Night', tone: 'night', isNight: true };
}

/** Y-axis domain with minimum span so small changes stay visible */
export function chartYDomain(values, minSpan, paddingRatio = 0.1) {
    if (!values.length) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, minSpan);
    const mid = (min + max) / 2;
    const pad = span * paddingRatio;
    const low = mid - span / 2 - pad;
    const high = mid + span / 2 + pad;
    return [parseFloat(low.toFixed(4)), parseFloat(high.toFixed(4))];
}

/** Contiguous night spans for chart shading (uses station sunrise/sunset when lat/lon given) */
export function nightSpansFromTimestamps(timestampsMs, lat, lon) {
    if (!timestampsMs.length) return [];
    const spans = [];
    let start = null;

    for (let i = 0; i < timestampsMs.length; i++) {
        const isNight =
            lat != null && lon != null
                ? isNightAt(lat, lon, timestampsMs[i])
                : getTimeOfDay(timestampsMs[i]).isNight;
        if (isNight && start == null) start = timestampsMs[i];
        if (!isNight && start != null) {
            spans.push({ x1: start, x2: timestampsMs[i] });
            start = null;
        }
    }
    if (start != null) {
        spans.push({ x1: start, x2: timestampsMs[timestampsMs.length - 1] });
    }
    return spans;
}

const PRESSURE_OUTLOOK_TOLERANCE_MS = 45 * 60 * 1000;

/** Pressure change over the last N hours at a given index (oldest→newest array) */
export function pressureDeltaHoursAt(readingsOldestFirst, index, hours = 3) {
    if (index < 0 || !readingsOldestFirst[index]) return null;
    const current = readingsOldestFirst[index];
    const currentMs = new Date(current.createdAt).getTime();
    const targetMs = currentMs - hours * 3600 * 1000;

    let best = null;
    let bestDiff = Infinity;
    for (let j = 0; j <= index; j += 1) {
        const t = new Date(readingsOldestFirst[j].createdAt).getTime();
        if (t > currentMs) continue;
        const diff = Math.abs(t - targetMs);
        if (diff < bestDiff) {
            bestDiff = diff;
            best = readingsOldestFirst[j];
        }
    }

    if (!best || bestDiff > PRESSURE_OUTLOOK_TOLERANCE_MS) return null;
    return Number(current.pressure) - Number(best.pressure);
}

/** METAR-style 3-hour barometric tendency */
export function classifyPressureTendency3h(delta3h) {
    if (delta3h == null || Number.isNaN(delta3h)) return { code: 'unknown', label: 'Unknown' };
    if (delta3h <= -3) return { code: 'rapid_fall', label: 'Falling rapidly' };
    if (delta3h <= -1.5) return { code: 'fall', label: 'Falling' };
    if (delta3h <= -0.5) return { code: 'slow_fall', label: 'Falling slowly' };
    if (delta3h < 0.5) return { code: 'steady', label: 'Steady' };
    if (delta3h < 1.5) return { code: 'slow_rise', label: 'Rising slowly' };
    if (delta3h < 3) return { code: 'rise', label: 'Rising' };
    return { code: 'rapid_rise', label: 'Rising rapidly' };
}

/**
 * Rain outlook from 3-hour pressure tendency + humidity.
 * Rule set follows standard barometric forecasting (WMO tendency / Lancaster method).
 */
export function rainOutlook(pressureHPa, delta3h, humidityPct) {
    const tendency = classifyPressureTendency3h(delta3h);
    let risk = 'low';
    let score = 20;
    let summary = 'Fair conditions likely';
    let detail = 'Pressure is steady or rising. Outdoor weather usually holds or improves.';

    switch (tendency.code) {
        case 'rapid_fall':
            risk = 'high';
            score = 85;
            summary = 'Rain or storms likely';
            detail = 'A sharp 3-hour pressure drop often precedes heavy rain or storms within 12 to 24 hours. Check local forecasts before outdoor plans.';
            break;
        case 'fall':
            risk = 'moderate';
            score = 65;
            summary = 'Rain possible';
            detail = 'Falling pressure with moisture in the air increases rain chances. Useful for planning antenna work or field ops.';
            break;
        case 'slow_fall':
            risk = 'low';
            score = 45;
            summary = 'Watch the trend';
            detail = 'Pressure is edging down. If humidity rises too, rain may follow in the next day.';
            break;
        case 'steady':
            risk = 'low';
            score = 25;
            summary = 'Fair conditions likely';
            detail = 'Little barometric change. Expect similar outdoor weather to continue.';
            break;
        case 'slow_rise':
            risk = 'low';
            score = 15;
            summary = 'Slowly improving';
            detail = 'Pressure is climbing. Skies often clear over the next day.';
            break;
        case 'rise':
        case 'rapid_rise':
            risk = 'low';
            score = 10;
            summary = 'Clearing trend';
            detail = 'Rising pressure usually means drier, more stable outdoor weather ahead.';
            break;
        default:
            break;
    }

    if (delta3h < -0.5 && humidityPct >= 80) {
        score = Math.min(95, score + 15);
        if (risk === 'low') {
            risk = 'moderate';
            summary = 'Rain possible';
            detail = 'Falling pressure plus high indoor humidity suggests outdoor rain may be approaching.';
        }
    }

    if (pressureHPa < 1000 && delta3h < -1) {
        score = Math.min(95, score + 5);
    }

    return {
        risk,
        score,
        summary,
        detail,
        tendency,
        delta3h,
    };
}

export function currentRainOutlook(readingsOldestFirst) {
    if (!readingsOldestFirst.length) return null;
    const latest = readingsOldestFirst[readingsOldestFirst.length - 1];
    const index = readingsOldestFirst.length - 1;
    const delta3h = pressureDeltaHoursAt(readingsOldestFirst, index, 3);
    if (delta3h == null) return null;
    return rainOutlook(Number(latest.pressure), delta3h, Number(latest.humidity));
}

/** Time series for pressure-change / rain-outlook chart */
export function buildPressureOutlookSeries(readingsOldestFirst) {
    return readingsOldestFirst
        .map((r, i) => {
            const delta3h = pressureDeltaHoursAt(readingsOldestFirst, i, 3);
            if (delta3h == null) return null;
            const outlook = rainOutlook(Number(r.pressure), delta3h, Number(r.humidity));
            return {
                time: new Date(r.createdAt).getTime(),
                delta3h: parseFloat(formatCalculated(delta3h, 2)),
                rainScore: outlook.score,
                rainSummary: outlook.summary,
                rainDetail: outlook.detail,
                tendencyLabel: outlook.tendency.label,
                risk: outlook.risk,
            };
        })
        .filter(Boolean);
}
