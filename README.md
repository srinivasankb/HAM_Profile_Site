# VU35KB | Amateur Radio Explorer

A high-performance, static-site generated (SSG) portal for **VU35KB** (Srinivasan KB), a newcomer exploring the world of Amateur Radio and QRP operations from Rajapalayam, IN.

🌐 **Live at**: [https://ham.srinikb.in/](https://ham.srinikb.in/)

## 🚀 Features

- **Personal Portal**: High-level introduction and bio on the homepage.
- **Radio Journal**: A lightweight blog system using Markdown and Astro Content Collections.
- **Station Dashboard**: Real-time telemetry for operating locations including local/UTC times, solar countdowns (sunrise/sunset), and dynamic status indicators.
- **Echolink Live Status**: Integrated realtime status for **VU35KB** (Node: 526521) with signal animations and session-level caching for performance.
- **Event Roadmap**: Automated event tracker with distance-to-event countdowns, country flags, and "Happening Now" status badges for upcoming HAM meets.
- **Resource Library**: A curated collection of HAM radio guides, frequency charts, and technical resources.
- **Maidenhead Grid Explorer**: Interactive tool to visualize grid square boundaries and locate coordinates with "click-to-copy" convenience.
- **PWA Ready**: Manifest support and optimized for high-performance experience on all devices.
- **Responsive Design**: Modern, high-density layout featuring elegant desktop and mobile navigation.
- **Privacy First**: License validity simplified for privacy; visit tracking via Plausible Analytics.

## 🛠️ Tech Stack

- **Framework**: [Astro v6](https://astro.build/) (Static Site Generation)
- **UI Components**: React (Island architecture for maps and interactive tools)
- **Styling**: Vanilla CSS (Custom Design System)
- **Interactive Tools**: 
  - **Maps**: React Leaflet
  - **Icons**: Lucide React
  - **Comments**: Giscus (GitHub Discussions)
- **Analytics**: Plausible Analytics (Privacy-focused tracking)
- **RSS**: @astrojs/rss

## 📊 Data Management & Configuration

The portal uses a **JSON-driven architecture**, allowing you to update almost all site content without editing code. All data files are located in `src/data/`.

### 🪪 Global Profile (`profile.json`)
Managed your identity, social links, and SEO metadata.
```json
{
  "callsign": "VU35KB",
  "name": "Srinivasan KB",
  "social": { "twitter": "srinikb", "github": "srinivasankb" },
  "analytics": { "domain": "ham.srinikb.in" }
}
```

### 🗺️ Operating Stations (`stations.json`)
Configure your home stations and portable locations.
```json
{
  "id": "rajapalayam",
  "name": "Rajapalayam",
  "lat": 9.4503, "lon": 77.5516,
  "grid": "MJ89sk"
}
```

### 🛠️ Hardware & Rigs (`hardware.json`)
Manage your primary radio and your accessories collection.
```json
{
  "primary": {
    "name": "Baofeng M13 Pro",
    "category": "Handheld Transceiver",
    "specs": ["2m/70cm", "QRP Operation", "Mobile Ready"],
    "status": "Active"
  },
  "accessories": [
    { "name": "Nagoya NA-771", "details": "High Gain Whip Antenna" },
    { "name": "UV-K5 Battery", "details": "1600mAh Spares" }
  ]
}
```

### 🗓️ Event Roadmap (`events.json`)
The dashboard automatically calculates the status based on `startDate` and `endDate`.
```json
[
  {
    "id": "hamfest-2026",
    "name": "Hamfest India 2026",
    "location": "Mangaluru, India",
    "countryId": "in",
    "venue": "NITK Surathkal",
    "startDate": "2026-11-28",
    "endDate": "2026-11-29",
    "url": "https://hfi2026.nitk.ac.in/"
  }
]
```

### 📔 Radio Journal (Blog Posts)
Journal entries are managed as Markdown files in `src/content/blogs/`.
```markdown
---
title: "Understanding Maidenhead Grid Squares"
description: "A deep dive into how radio operators locate themselves globally."
date: 2026-03-05
unlisted: false
---
Your technical notes or journal content goes here...
```

### 🧭 Navigation & Icons (`navigation.json`)
You can add new menu items by providing a name, path, and icon.
```json
[
  { "name": "New Page", "path": "/new", "icon": "PlusCircle" }
]
```
> [!TIP]
> Icon names must match [Lucide React](https://lucide.dev/icons) keys (e.g., `MapPin`, `Activity`, `HardDrive`).

## ⚡ Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run dev server**:
   ```bash
   npm run dev
   ```

3. **Build local static site**:
   ```bash
   npm run build
   ```

4. **Add a Blog Post**:
   Create a new `.md` file in `src/content/blogs/`. The homepage and journal list will update automatically.

## 73 de VU35KB
Wishing you clear skies and 5/9 signals. Happy DXing!
