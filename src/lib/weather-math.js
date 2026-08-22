/** Calculated metrics: round to maxDecimals, trim trailing zeros */
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

export function predictNextValue(readings, key) {
    if (readings.length < 3) return null;
    const rate = hourlyRate(readings, key);
    const latest = readings[readings.length - 1][key];
    return latest + rate * 0.25; // ~15 min ahead
}
