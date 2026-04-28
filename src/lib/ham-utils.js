import stationsData from '../data/stations.json';

export const STATIONS = stationsData;




export function getMaidenhead(lat, lon) {
    let grid = "";
    let adjLon = lon + 180;
    let adjLat = lat + 90;
    grid += String.fromCharCode(65 + Math.floor(adjLon / 20));
    grid += String.fromCharCode(65 + Math.floor(adjLat / 10));
    grid += Math.floor((adjLon % 20) / 2);
    grid += Math.floor((adjLat % 10) / 1);
    let subLon = (adjLon % 2) / (2 / 24);
    let subLat = (adjLat % 1) / (1 / 24);
    grid += String.fromCharCode(97 + Math.floor(subLon));
    grid += String.fromCharCode(97 + Math.floor(subLat));
    return grid;
}

export function formatGrid(grid) {
    if (!grid || typeof grid !== 'string') return '';
    const clean = grid.trim();
    if (clean.length === 6) {
        return clean.slice(0, 4).toUpperCase() + clean.slice(4).toLowerCase();
    }
    return clean.toUpperCase();
}

export function getGridBounds(grid) {
    if (!grid) return null;
    grid = grid.toUpperCase();
    if (!/^[A-R]{2}[0-9]{2}([A-X]{2})?$/.test(grid)) return null;
    let minLon = (grid.charCodeAt(0) - 65) * 20 - 180;
    let minLat = (grid.charCodeAt(1) - 65) * 10 - 90;
    minLon += parseInt(grid[2]) * 2;
    minLat += parseInt(grid[3]) * 1;
    let maxLon, maxLat;
    if (grid.length === 6) {
        minLon += (grid.charCodeAt(4) - 65) * (2 / 24);
        minLat += (grid.charCodeAt(5) - 65) * (1 / 24);
        maxLon = minLon + (2 / 24);
        maxLat = minLat + (1 / 24);
    } else {
        maxLon = minLon + 2;
        maxLat = minLat + 1;
    }
    return [[minLat, minLon], [maxLat, maxLon]];
}

export function getSunTimes(lat, lon, date = new Date()) {
    const rad = Math.PI / 180;
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);

    // Fractional year in radians
    const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (date.getUTCHours() - 12) / 24);

    // Equation of time in minutes
    const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));

    // Solar declination angle in radians
    const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

    // Hour angle for sunrise/sunset (90.833 degrees zenith accounts for refraction)
    const ha_arg = (Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl));

    if (ha_arg < -1 || ha_arg > 1) return null; // Sun doesn't rise or set

    const ha = Math.acos(ha_arg) / rad;

    // Solar noon in UTC minutes
    const solarNoon = 720 - (4 * lon) - eqtime;
    const sunriseMin = solarNoon - (4 * ha);
    const sunsetMin = solarNoon + (4 * ha);

    const minutesToDate = (min) => {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCMinutes(Math.round(min));
        return d;
    };

    return {
        sunrise: minutesToDate(sunriseMin),
        sunset: minutesToDate(sunsetMin)
    };
}

let echolinkCache = {
    data: null,
    timestamp: 0
};

export async function getEcholinkStatus(callsign = "VU35KB", force = false) {
    const now = Date.now();
    const CACHE_KEY = `echolink_status_${callsign}`;
    const CACHE_DURATION = 120000; // 2 minutes

    // 1. Avoid fetching on server to prevent build-time/SSR API abuse
    if (typeof window === 'undefined') {
        if (echolinkCache.data) return { data: echolinkCache.data, timestamp: echolinkCache.timestamp };
        return { data: { status: 'OFF', node: '--', location: 'Offline' }, timestamp: 0 };
    }

    // 2. Check in-memory module cache (survives component remounts in same page session)
    if (!force && echolinkCache.data && (now - echolinkCache.timestamp < CACHE_DURATION)) {
        return { data: echolinkCache.data, timestamp: echolinkCache.timestamp };
    }

    // 3. Check localStorage (survives page refreshes/switching pages in Astro)
    if (!force && window.localStorage) {
        try {
            const stored = localStorage.getItem(CACHE_KEY);
            if (stored) {
                const { data, timestamp } = JSON.parse(stored);
                if (now - timestamp < CACHE_DURATION) {
                    echolinkCache = { data, timestamp }; // Sync to memory cache
                    return { data, timestamp };
                }
            }
        } catch (e) {
            console.warn("Storage access error:", e);
        }
    }

    // 4. Fetch fresh data from API
    try {
        const response = await fetch(`https://n8n.srinikb.in/webhook/echolink-status?callsign=${callsign}`);
        const data = await response.json();

        const newCache = { data, timestamp: now };
        echolinkCache = newCache;

        if (window.localStorage) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
        }

        return { data, timestamp: now };
    } catch (error) {
        console.error("Echolink status fetch error:", error);
        if (echolinkCache.data) return { data: echolinkCache.data, timestamp: echolinkCache.timestamp };
        return { data: { error: "Service unavailable" }, timestamp: 0 };
    }
}
