import React, { useEffect } from 'react';
import { Cloud, ArrowRight, Thermometer, Droplets, Gauge } from 'lucide-react';
import { useWeatherData } from '../hooks/useWeatherData';
import { formatTempC, formatHumidityPct, formatPressureHPa } from '../lib/weather-math';

export default function WeatherPill() {
    const { readings, loading, error } = useWeatherData();

    useEffect(() => {
        import('../styles/weather.css');
    }, []);

    const latest = readings[0];

    return (
        <a href="/weather" className="weather-pill" aria-label="View weather station readings">
            <div className="weather-pill-icon">
                <Cloud size={20} strokeWidth={2} />
            </div>
            <div className="weather-pill-body">
                <span className="weather-pill-label">Inside shack weather</span>
                {loading && !latest ? (
                    <span className="weather-pill-data-text">Loading readings…</span>
                ) : error && !latest ? (
                    <span className="weather-pill-data-text">No readings yet. View station.</span>
                ) : latest ? (
                    <div className="weather-pill-metrics">
                        <span className="weather-pill-chip">
                            <Thermometer size={14} />
                            {formatTempC(latest.temperature)}
                        </span>
                        <span className="weather-pill-chip">
                            <Droplets size={14} />
                            {formatHumidityPct(latest.humidity)}
                        </span>
                        <span className="weather-pill-chip">
                            <Gauge size={14} />
                            {formatPressureHPa(latest.pressure)}
                        </span>
                    </div>
                ) : null}
            </div>
            <ArrowRight size={18} className="weather-pill-arrow" aria-hidden="true" />
        </a>
    );
}
