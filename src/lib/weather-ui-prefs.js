const PREFIX = 'vu35kb_wx_';

export function readWxPref(key, fallback) {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = localStorage.getItem(`${PREFIX}${key}`);
        if (raw == null) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function writeWxPref(key, value) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
    } catch {
        /* ignore quota */
    }
}
