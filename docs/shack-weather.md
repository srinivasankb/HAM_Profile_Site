# Shack weather dashboard

Documentation for the `/weather` page: hardware, data flow, metrics, and calculations.

**Live page:** `/weather` on the HAM profile site.

**Scope:** Indoor shack telemetry at Bangalore (grid MK82uu, ~920 m altitude). Not outdoor weather or a certified forecast. All derived values are computed in the browser from three sensor fields. No AI or machine learning.

---

## Hardware

![ESP32-S3 Geek with M5Stack ENV III sensor module. The display shows live shack readings and VU35KB-13 beacon status.](/images/esp32-s3-geek-env-iii-setup.png)

*Waveshare ESP32-S3 Geek with M5Stack ENV III. The onboard screen shows temperature, humidity, pressure, and APRS beacon status.*

| Component | Role |
|-----------|------|
| **M5Stack ENV III** | Environmental sensor module |
| **SHT30** (on ENV III) | Temperature and relative humidity |
| **QMP6988** (on ENV III) | Barometric pressure |
| **ESP32-S3 Geek** (Waveshare) | Reads the sensor, connects over local Wi-Fi |
| **Placement** | Fixed install inside the shack (not outdoor) |

---

## Data pipeline

1. ESP32 samples ENV III on a **15 minute** interval.
2. Readings are sent through an **n8n** workflow to a small JSON API (recent readings array).
3. The dashboard fetches that API in the browser (`VITE_WEATHER_BEACON_URL` if set, otherwise the built-in default in `weather-cache.js`). The URL is not published here.
4. Each reading is stored client-side in memory and `localStorage` under `vu35kb_weather_beacon`.
5. The UI refreshes when cache is older than **10 minutes**, or when the latest reading is older than **20 minutes**. Manual refresh has a **60 second** cooldown.

### API record shape

Each element in the JSON array:

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `temperature` | number | °C | Air temperature |
| `humidity` | number | % | Relative humidity |
| `pressure` | number | hPa | Station barometric pressure |
| `createdAt` | string (ISO 8601) | timestamp | Reading time |

Newest-first order is used in the live card; charts sort oldest to newest.

---

## Raw metrics (sensor)

| Metric | Unit | Notes |
|--------|------|-------|
| Temperature | °C | Direct from SHT30 |
| Humidity | % RH | Direct from SHT30 |
| Pressure | hPa | Direct from QMP6988 at shack altitude |

---

## Derived metrics (calculated)

All formulas live in `src/lib/weather-math.js`. Values are rounded to **2 decimal places** for display.

### Dew point (`dewPointC`)

**Magnus formula** (approximation over liquid water):

- `α = (17.27 × T) / (237.7 + T) + ln(RH/100)`
- `T_dew = (237.7 × α) / (17.27 − α)`

Where `T` is °C and `RH` is percent relative humidity.

**Use:** Moisture content of the air. Compare to temperature for condensation risk.

### Dew margin / dew depression (`dewMarginC`)

`margin = temperature − dewPoint`

**Use:** Gap before air saturates. Below ~2 °C margin, condensation on cold metal is more likely.

### Saturation vapor pressure (`saturationVaporPressureKPa`)

`SVP = 0.6108 × exp((17.27 × T) / (T + 237.3))` kPa

### Vapor pressure deficit (`vaporPressureDeficitKPa`)

`VPD = SVP × (1 − RH/100)` kPa

**Use:** How dry the air is. Higher VPD means stronger evaporative drying.

### Feels like (`feelsLikeC`)

Hybrid apparent temperature:

- If `T` ≥ 26.7 °C (80 °F): **Rothfusz heat index** (US NWS regression, converted back to °C), with low/high humidity adjustments.
- Otherwise: **Steadman apparent temperature** with wind assumed **0 m/s** (no wind sensor):

  `AT = T + 0.33 × e − 4` where `e` is vapor pressure in hPa (`SVP_kPa × RH/100 × 10`).

**Use:** Perceived heat and humidity combined.

### Sea-level pressure (`seaLevelPressureHPa`)

Barometric reduction to mean sea level (standard atmosphere layer), using station altitude from `stations.json` (`altitudeM`, 920 m for Bangalore):

`SLP = P × (1 − (0.0065 × h) / (T_K + 0.0065 × h))^(−5.257)`

Where `P` is station hPa, `h` is altitude m, `T_K` is temperature in K.

**Use:** Compare shack pressure to weather reports and other stations.

### Comfort label (`getComfortLevel`)

Rule-based label from temperature, humidity, and feels-like. **First matching rule wins** (evaluation order matters):

| Order | Condition | Label | Hint | UI tone |
|-------|-----------|-------|------|---------|
| 1 | T under 16 °C | Cool | Light layers recommended | cool |
| 2 | Feels at or above 35 °C | Very Hot | High heat stress. Stay hydrated. | hot |
| 3 | Feels at or above 32 °C | Hot & Humid | Feels warmer than actual temperature | warm |
| 4 | RH at or above 85% | Very Humid | High moisture in the air | humid |
| 5 | T at or above 28 °C | Warm | Pleasant for most activities | warm |
| 6 | RH at or above 70% | Humid | Moderate moisture levels | humid |
| 7 | Else | Comfortable | Balanced temperature and humidity | comfort |

The live card background uses `tone` for ambient coloring. This is indoor comfort inference, not a forecast.

---

## Predictions and inference logic

All inference is **rule-based** in `weather-math.js` and `ham-utils.js`. No machine learning, no numerical weather model, no trained weights.

| Category | What it estimates | Primary inputs |
|----------|-------------------|----------------|
| Rain outlook | Outdoor rain or storm risk | 3h pressure delta, RH, station pressure |
| Condensation risk | Indoor saturation on cold surfaces | Temperature vs dew point |
| Comfort | Shack comfort band | T, RH, feels-like |
| Pressure shift | Recent barometer direction | Last 3 vs previous 3 readings |
| Hourly rates | Slope of each metric in window | Window start vs end |
| Solar phase | Dawn, day, dusk, night at station | Lat/lon, sun times |
| Window comparison | Now vs recent average | Current value vs window mean |

---

### Rain outlook (`rainOutlook`)

**Purpose:** Short-range **outdoor** rain hint from an **indoor** barometer. Based on barometric tendency practice (METAR-style 3h codes, WMO tendency wording, Lancaster-style short-range rules). Falling pressure often precedes approaching weather systems; rising pressure often means clearing.

**Not:** Probability of rain at the shack, minute-by-minute forecast, or replacement for IMD or other official forecasts.

#### Inputs

| Input | Source |
|-------|--------|
| `pressureHPa` | Latest station pressure (hPa) |
| `delta3h` | Current pressure minus pressure ~3 hours earlier (hPa) |
| `humidityPct` | Latest indoor RH (%) |

#### Step 1: 3-hour pressure delta (`pressureDeltaHoursAt`)

For each timestamp in history (oldest to newest):

1. Target time = current time minus **3 hours**.
2. Scan all earlier readings; pick the one whose timestamp is closest to that target.
3. Reject if no reading within **45 minutes** of the target (tolerance = `PRESSURE_OUTLOOK_TOLERANCE_MS`).
4. `delta3h = P_now - P_3h_ago`.

At 15 minute sampling, this is usually the reading 12 intervals back (~3 hours).

#### Step 2: Tendency class (`classifyPressureTendency3h`)

Maps `delta3h` to a METAR-style label:

| delta3h (hPa) | Code | Label |
|---------------|------|-------|
| at or below -3 | `rapid_fall` | Falling rapidly |
| at or below -1.5 | `fall` | Falling |
| at or below -0.5 | `slow_fall` | Falling slowly |
| under 0.5 | `steady` | Steady |
| under 1.5 | `slow_rise` | Rising slowly |
| under 3 | `rise` | Rising |
| 3 or more | `rapid_rise` | Rising rapidly |
| null / NaN | `unknown` | Unknown |

#### Step 3: Base rain score, risk, summary, detail

Default before tendency match: risk `low`, score `20`, summary `Fair conditions likely`, detail about steady or rising pressure.

| Tendency code | Risk | Score | Summary | Detail (logic) |
|---------------|------|-------|---------|----------------|
| `rapid_fall` | high | 85 | Rain or storms likely | Sharp 3h drop often precedes heavy rain or storms within **12 to 24 hours** |
| `fall` | moderate | 65 | Rain possible | Falling pressure plus moisture increases rain chances; useful for antenna or field planning |
| `slow_fall` | low | 45 | Watch the trend | Pressure edging down; if humidity rises, rain may follow in the **next day** |
| `steady` | low | 25 | Fair conditions likely | Little barometric change; similar outdoor weather likely continues |
| `slow_rise` | low | 15 | Slowly improving | Pressure climbing; skies often clear over the **next day** |
| `rise`, `rapid_rise` | low | 10 | Clearing trend | Rising pressure usually means drier, more stable outdoor weather ahead |

**Risk levels:** `low`, `moderate`, `high`. Used for card styling (`risk-low`, `risk-moderate`, `risk-high`).

**Score:** 0 to 100 scale for the pressure & rain chart bars. Higher = more rain concern. Not a calibrated probability percent.

#### Step 4: Humidity modifier

If `delta3h < -0.5` **and** `humidityPct >= 80`:

- Score increases by **15** (capped at **95**).
- If risk was `low`, bump to `moderate`.
- Summary becomes `Rain possible`.
- Detail: falling pressure plus high indoor humidity suggests outdoor rain may be approaching.

Logic: falling barometer plus high moisture (indoor RH often rises before outdoor rain) strengthens the rain hint.

#### Step 5: Low pressure modifier

If `pressureHPa < 1000` **and** `delta3h < -1`:

- Score increases by **5** (capped at **95**).

Logic: sub-1000 hPa with meaningful fall often correlates with active or approaching low-pressure systems.

#### Output object

```text
{ risk, score, summary, detail, tendency, delta3h }
```

#### UI wiring

| Surface | Function | Minimum data |
|---------|----------|--------------|
| Rain outlook card | `currentRainOutlook` on full history | Valid `delta3h` at latest point (~3h of readings) |
| Pressure & rain chart | `buildPressureOutlookSeries` | At least **2** outlook points (chart hidden otherwise) |
| History pressure hover | `outlookByTime` map | 3h delta when available for that timestamp |
| Pending state | No valid 3h delta | "Collecting 3 hours of pressure history…" |

Chart plots **3h delta** (line, hPa) and **rain score** (bars, 0-100) on shared time axis. Hover dock shows tendency label and rain summary.

#### Decision flow (summary)

```text
delta3h = P_now - P_(now - 3h)
tendency = classify(delta3h)
apply base score/risk/summary/detail from tendency table
if delta3h < -0.5 and RH >= 80%: boost score, maybe bump risk
if P < 1000 and delta3h < -1: boost score
return outlook
```

---

### Condensation inference

**Formula:** `dewMargin = temperature - dewPoint` (same as dew depression).

**Physical meaning:** Air temperature minus the temperature at which the air becomes saturated. Smaller margin = closer to condensation.

| Signal | Threshold | Where shown |
|--------|-----------|-------------|
| Condensation risk hint | `dewMargin < 2` °C | Chart hover dock (temperature metric) |
| Condensation chart | Temp line vs dew point line | Window at least **6 hours**, 2+ readings |

When the temp and dew lines converge, the shack air is near saturation. Indoor surfaces cooler than air (metal, concrete) can still condense before the reading hits dew point.

This is **current-state risk**, not a forward prediction. No separate forecast model.

---

### Humidity comfort band (chart)

On the humidity history chart, shaded band **40% to 60% RH** (`comfortBand` in chart config).

Logic: common indoor comfort target range. Values outside the band are not labeled as bad; the band is a visual reference only.

---

### Pressure shift (`pressureTrend`)

Separate from the 3h rain delta. Short-term direction label for the **selected chart window**.

**Method:**

1. Need at least **4** readings in the window.
2. `recentAvg` = mean of **last 3** pressures.
3. `olderAvg` = mean of readings **4th, 5th, 6th** from the end (indices -6 to -3).
4. `delta = recentAvg - olderAvg`.

| delta (hPa) | Label | Tone |
|-------------|-------|------|
| above 0.4 | Rising | up |
| below -0.4 | Falling | down |
| otherwise | Stable | neutral |

At 15 minute sampling, this compares roughly the last **45 minutes** vs the previous **45 minutes**. Shown in the trends panel as "Pressure shift" with signed delta.

**Use:** Quick barometer direction inside the window. Rain outlook uses the longer 3h METAR-style delta.

---

### Hourly rate and linear extrapolation

#### Hourly rate (`hourlyRate`)

Across the chart window (oldest to newest):

`rate = (value_end - value_start) / hours_elapsed`

Units per hour for temperature (°C/h), humidity (%/h), or pressure (hPa/h).

Shown in trends panel for all three raw metrics. Sign indicates rising or falling slope over the window.

#### Short extrapolation (`predictNextValue`)

`predicted = latest + hourlyRate × 0.25`

The `0.25` factor is one quarter of an hour (~**15 minutes** ahead), matching the sensor interval.

Implemented in `weather-math.js` but **not currently shown in the UI**. Available for future trend arrows or alerts.

---

### Now vs window average (`chartSummary`)

Compares the latest enriched value to the window mean for the active chart metric:

| Condition | Relation label |
|-----------|----------------|
| `now - avg > 0.02` | above |
| `now - avg < -0.02` | below |
| otherwise | at |

Threshold `0.02` avoids noise from rounding. Shown under the history chart title (e.g. "Now 28.50°C · above window avg 27.80°C").

---

### Solar phase and daylight (`getSolarPhase`, `getSolarState`)

Uses station lat/lon and `getSunTimes` (NOAA-style solar position).

#### Phase bands (`getSolarPhase`)

| Phase | Time relative to sun | Tone |
|-------|----------------------|------|
| Night | Before sunrise, or after sunset | night |
| Dawn | From sunrise to sunrise + **30 min** | dawn |
| Day | From end of dawn to sunset - **30 min** | day |
| Dusk | From sunset - **30 min** to sunset | dusk |

30 minute dawn and dusk windows bracket civil twilight-style transitions for UI theming.

#### Solar countdown (`getSolarState`)

- `isDaylight`: now between sunrise and sunset.
- `nextLabel`: Sunrise or Sunset.
- `nextTime`: Next event (tomorrow sunrise if after sunset today).
- Countdown in hours and minutes to that event.

Shown on the live card solar strip.

#### Night shading on charts (`nightSpansFromTimestamps`)

Preferred: `isNightAt(lat, lon, timestamp)` (outside sunrise to sunset at station).

Fallback (`getTimeOfDay`, IST hour only): night 19:00 to 05:00, dawn 05:00 to 07:00, day 07:00 to 17:00, dusk 17:00 to 19:00.

Shaded regions mark night spans on line charts.

---

### Daily rhythm (pattern, not forecast)

`hourlyBucketsIST` averages a metric per IST hour (0-23) over the selected window.

**Logic:** Group readings by IST hour, average values per hour bucket.

**Use:** Typical shack temperature curve by time of day. Describes history in the window, does not predict tomorrow.

---

## Trends and aggregates

### Window slice (`sliceReadingsByHours`)

Charts use a sliding window ending at the latest reading: **24, 12, 6, or 3 hours**. Preference stored in `localStorage` (`vu35kb_wx_window`).

### Min / avg / max (`summarizeMetric`)

Simple min, mean, and max over the selected window for each raw metric.

### Hourly rate (`hourlyRate`)

`(value_end - value_start) / hours_elapsed` across the window (units per hour). See **Hourly rate and linear extrapolation** above for trends panel and `predictNextValue`.

### Pressure shift (`pressureTrend`)

Compares average of the **last 3** readings vs the **previous 3** in the window. Full logic in **Pressure shift** under Predictions and inference logic.

| Delta (hPa) | Label |
|-------------|-------|
| above 0.4 | Rising |
| below -0.4 | Falling |
| otherwise | Stable |

---

## Rain outlook (reference)

Full algorithm, modifiers, UI wiring, and decision flow are documented under **Rain outlook** in Predictions and inference logic above.

Quick reference for tendency classes on 3h delta (hPa):

| delta3h | Label |
|---------|-------|
| at or below -3 | Falling rapidly |
| at or below -1.5 | Falling |
| at or below -0.5 | Falling slowly |
| under 0.5 | Steady |
| under 1.5 | Rising slowly |
| under 3 | Rising |
| 3 or more | Rising rapidly |

Pressure & rain chart plots **3h delta** (line) and **rain score** (bars) over time.

---

## Solar and time context

### Station location

Bangalore coordinates from `src/data/stations.json` (lat/lon, grid MK82uu).

### Sunrise / sunset (`getSunTimes`)

Solar position algorithm ( NOAA-style ): equation of time, solar declination, hour angle at 90.833° zenith (refraction). Used for daylight strip and night bands on charts.

### Night shading on charts (`nightSpansFromTimestamps`)

Shaded regions where the timestamp is between sunset and sunrise at the station. Fallback if sun times unavailable: IST hour bands (night 19:00 to 05:00, dawn 05:00 to 07:00, day 07:00 to 17:00, dusk 17:00 to 19:00).

### Display time

All user-facing times use **12-hour IST** (`Asia/Kolkata`).

---

## Daily rhythm chart

`hourlyBucketsIST` groups readings by **IST hour (0-23)** and averages temperature (or another enriched field) per hour within the selected window.

**Use:** See when the shack typically warms or cools during the day.

---

## Page sections (UI)

| Section | Content |
|---------|---------|
| Intro | Collapsible note: 3 sensors, formula-only, no AI |
| Live card | Raw values + feels like, dew point, SLP, VPD; comfort label; solar strip |
| Rain outlook card | Current summary and 3h tendency |
| History chart | One of temp / humidity / pressure; hover dock shows derived fields for that metric |
| Pressure & rain | 3h delta and rain score history |
| Condensation | Temperature vs dew point dual line |
| Daily rhythm | Hourly average temperature (IST) |
| Rates & range | Per-hour rates and min/avg/max |
| Hardware | Sensor and sampling summary |

Chart metric and window preferences persist in `localStorage` (`vu35kb_wx_metric`, `vu35kb_wx_window`, `vu35kb_wx_introCollapsed`).

### History chart hover (derived by metric)

| Active metric | Extra hover fields |
|---------------|-------------------|
| Temperature | Feels like, dew point, dew margin |
| Humidity | Dew point, VPD, dew margin |
| Pressure | Sea-level pressure, 3h change (when available) |

Humidity chart shows a **40 to 60% RH** comfort band.

---

## Chart scaling (`chartYDomain`)

Y-axis uses data min/max with a minimum span so small changes stay visible:

| Metric | Min span |
|--------|----------|
| Temperature | 2 °C |
| Humidity | 8 % |
| Pressure | 3 hPa |

Dashed line: window average for the active metric.

---

## Source files

| Path | Role |
|------|------|
| `src/pages/weather.astro` | Page shell |
| `src/components/WeatherDashboard.jsx` | Layout and live stats |
| `src/components/WeatherChart.jsx` | Charts and hover dock |
| `src/lib/weather-math.js` | All calculations |
| `src/lib/weather-cache.js` | Fetch and client cache |
| `src/lib/weather-ui-prefs.js` | UI preference storage |
| `src/lib/ham-utils.js` | Sun times, IST formatting, solar phase |
| `src/hooks/useWeatherData.js` | React data hook |
| `src/styles/weather.css` | Page styles |
| `src/data/stations.json` | Station lat/lon/altitude |

---

## Limitations

- Indoor air lags and differs from outside weather.
- Rain outlook is a **rule-based barometer hint**, not a forecast model. Score is an ordinal index, not rain probability.
- Rain timing in detail text (12 to 24 hours, next day) is heuristic from barometric folklore, not computed from a model.
- Condensation hint uses a fixed 2 °C dew margin threshold; surface temperature is not measured.
- Comfort labels and RH comfort band are subjective references, not health standards.
- `predictNextValue` linear extrapolation assumes the window slope continues; not shown in UI.
- No wind, rain, or UV sensors; feels-like assumes zero wind.
- 15 minute sampling smooths short spikes.
- Sea-level pressure depends on configured station altitude.
- Requires several hours of history for 3h pressure delta and rain outlook charts.
- Solar phase uses astronomical sun times; does not account for local cloud cover.

---

## Related

- Resource guide: `/resources/shack-weather-beacon` (public article version of this doc).
- Station page: solar countdowns and operating context for the same location.
- APRS beacon: [VU35KB-13 on APRS.fi](https://aprs.fi/#!call=a/VU35KB-13).
- ENV III and ESP32 firmware / n8n workflow: outside this repo.
