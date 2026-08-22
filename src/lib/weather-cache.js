const WEATHER_BEACON_URL =
    import.meta.env.VITE_WEATHER_BEACON_URL ||
    'https://n8n.srinikb.in/webhook/esp32-geek-wx-recent';

const CACHE_KEY = 'vu35kb_weather_beacon';
/** Reuse cached API response without a network call */
const FRESH_MS = 10 * 60 * 1000;
/** Auto-refresh when the latest sensor reading is older than this */
export const READING_STALE_MS = 20 * 60 * 1000;
/** Max age before client cache is considered expired */
const STALE_MS = 20 * 60 * 1000;

let memory = { data: [], fetchedAt: 0 };
let inflight = null;
const listeners = new Set();

function readStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.data)) return null;
        return { data: parsed.data, fetchedAt: parsed.fetchedAt || 0 };
    } catch {
        return null;
    }
}

function writeStorage(payload) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('Weather cache storage error:', e);
    }
}

function notify(payload) {
    listeners.forEach((fn) => fn(payload));
}

export function getWeatherCacheSnapshot() {
    if (typeof window === 'undefined') {
        return { data: [], fetchedAt: 0, ageMs: Infinity, isFresh: false, isStale: true };
    }
    if (!memory.data.length) {
        const stored = readStorage();
        if (stored?.data?.length) memory = stored;
    }
    const ageMs = memory.fetchedAt ? Date.now() - memory.fetchedAt : Infinity;
    return {
        data: memory.data,
        fetchedAt: memory.fetchedAt,
        ageMs,
        isFresh: ageMs < FRESH_MS,
        isStale: ageMs >= FRESH_MS,
        isExpired: ageMs >= STALE_MS,
    };
}

export function isLatestReadingStale(readings) {
    if (!readings?.length) return false;
    const age = Date.now() - new Date(readings[0].createdAt).getTime();
    return age >= READING_STALE_MS;
}

export function subscribeWeather(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export async function fetchWeatherBeacon(force = false) {
    if (typeof window === 'undefined') {
        return { data: [], fetchedAt: 0, fromCache: true, error: false };
    }

    const snapshot = getWeatherCacheSnapshot();
    if (!force && snapshot.isFresh && snapshot.data.length > 0) {
        return { data: snapshot.data, fetchedAt: snapshot.fetchedAt, fromCache: true, error: false };
    }

    if (inflight && !force) {
        return inflight;
    }

    const run = async () => {
        try {
            const response = await fetch(WEATHER_BEACON_URL, {
                cache: 'no-store',
            });
            if (!response.ok) {
                throw new Error(`Weather beacon HTTP ${response.status}`);
            }
            const json = await response.json();
            const data = Array.isArray(json) ? json : [];
            const fetchedAt = Date.now();
            memory = { data, fetchedAt };
            writeStorage(memory);
            const payload = { data, fetchedAt, fromCache: false, error: false };
            notify(payload);
            return payload;
        } catch (error) {
            console.error('Weather beacon fetch error:', error);
            if (snapshot.data.length > 0) {
                const payload = {
                    data: snapshot.data,
                    fetchedAt: snapshot.fetchedAt,
                    fromCache: true,
                    error: true,
                };
                return payload;
            }
            const payload = { data: [], fetchedAt: 0, fromCache: false, error: true };
            notify(payload);
            return payload;
        } finally {
            inflight = null;
        }
    };

    inflight = run();
    return inflight;
}
