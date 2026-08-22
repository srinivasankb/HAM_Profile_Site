import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getWeatherCacheSnapshot,
    subscribeWeather,
    fetchWeatherBeacon,
    isLatestReadingStale,
} from '../lib/weather-cache';

const REFRESH_COOLDOWN_MS = 60000;
const AUTO_CHECK_MS = 60_000;

export function useWeatherData() {
    const initial = typeof window !== 'undefined' ? getWeatherCacheSnapshot() : null;
    const [readings, setReadings] = useState(initial?.data ?? []);
    const [loading, setLoading] = useState(!initial?.data?.length);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(false);
    const [cooldownSecs, setCooldownSecs] = useState(0);
    const lastManualRefreshRef = useRef(0);

    const applyPayload = useCallback((payload) => {
        if (payload.data.length > 0) {
            setReadings(payload.data);
            setError(false);
        } else if (!payload.fromCache) {
            setError(payload.error);
        }
        setLoading(false);
        setIsRefreshing(false);
    }, []);

    const updateCooldown = useCallback(() => {
        const remaining = Math.max(0, REFRESH_COOLDOWN_MS - (Date.now() - lastManualRefreshRef.current));
        setCooldownSecs(Math.ceil(remaining / 1000));
    }, []);

    const load = useCallback(async (force = false) => {
        if (force) {
            const elapsed = Date.now() - lastManualRefreshRef.current;
            if (lastManualRefreshRef.current > 0 && elapsed < REFRESH_COOLDOWN_MS) {
                updateCooldown();
                return;
            }
            setIsRefreshing(true);
        } else {
            const snap = getWeatherCacheSnapshot();
            if (snap.data.length) {
                setReadings(snap.data);
                setLoading(false);
                if (snap.isFresh) return;
            } else {
                setLoading(true);
            }
        }

        const payload = await fetchWeatherBeacon(force);
        if (force && !payload.error) {
            lastManualRefreshRef.current = Date.now();
            updateCooldown();
        }
        applyPayload(payload);
    }, [applyPayload, updateCooldown]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const unsub = subscribeWeather((payload) => applyPayload(payload));
        load(false);

        return unsub;
    }, [load, applyPayload]);

    useEffect(() => {
        if (!lastManualRefreshRef.current) return;
        updateCooldown();
        const timer = setInterval(updateCooldown, 1000);
        return () => clearInterval(timer);
    }, [readings, updateCooldown]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const maybeAutoRefresh = () => {
            const snap = getWeatherCacheSnapshot();
            if (isLatestReadingStale(snap.data)) {
                fetchWeatherBeacon(false);
            }
        };

        maybeAutoRefresh();
        const timer = setInterval(maybeAutoRefresh, AUTO_CHECK_MS);
        return () => clearInterval(timer);
    }, []);

    const refresh = useCallback(() => {
        if (cooldownSecs > 0 || isRefreshing) return;
        load(true);
    }, [cooldownSecs, isRefreshing, load]);

    const canRefresh = cooldownSecs === 0 && !isRefreshing;
    const refreshTitle = canRefresh ? 'Update readings' : 'Please wait a moment';

    return {
        readings,
        loading,
        isRefreshing,
        error,
        refresh,
        canRefresh,
        refreshTitle,
    };
}
