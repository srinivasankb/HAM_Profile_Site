export const STATION = {
    name: "Rajapalayam",
    lat: 9.4503,
    lon: 77.5516,
    grid: "MJ89sk"
};

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
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;
    const JD = Math.floor(date.getTime() / 86400000) + 2440587.5;
    const n = JD - 2451545.0;
    const L = (280.46 + 0.9856474 * n) % 360;
    const g = toRad((357.528 + 0.9856003 * n) % 360);
    const lambda = toRad(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
    const epsilon = toRad(23.439 - 0.0000004 * n);
    const sinDec = Math.sin(epsilon) * Math.sin(lambda);
    const dec = Math.asin(sinDec);
    const cosHA = (Math.cos(toRad(90.833)) - Math.sin(toRad(lat)) * sinDec) / (Math.cos(toRad(lat)) * Math.cos(dec));
    if (cosHA < -1 || cosHA > 1) return null;
    const HA = toDeg(Math.acos(cosHA));
    const EqT = 4 * (L - 0.0057183 - toDeg(Math.atan2(Math.sin(lambda) * Math.cos(epsilon), Math.cos(lambda))) + 360 * Math.cos(epsilon) * Math.sin(lambda) / (2 * Math.PI));
    const solarNoonMin = 720 - 4 * lon - EqT;
    const sunriseMin = solarNoonMin - HA * 4;
    const sunsetMin = solarNoonMin + HA * 4;
    const toUtcDate = (minutesFromMidnightUtc) => {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        d.setTime(d.getTime() + minutesFromMidnightUtc * 60000);
        return d;
    };
    return { sunrise: toUtcDate(sunriseMin), sunset: toUtcDate(sunsetMin) };
}
