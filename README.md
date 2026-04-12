# VU35KB | Amateur Radio Explorer

A high-performance, static-site generated (SSG) portal for **VU35KB** (Srinivasan KB), a newcomer exploring the world of Amateur Radio and QRP operations from Rajapalayam, IN.

🌐 **Live at**: [https://ham.srinikb.in/](https://ham.srinikb.in/)

## 🚀 Features

- **Personal Portal**: High-level introduction and bio on the homepage.
- **Radio Journal**: A lightweight blog system using Markdown and Astro Content Collections.
- **Multi-Station Dashboard**: Real-time telemetry for multiple stations (Rajapalayam and Bangalore) including local time, UTC, weather (OpenWeatherMap API), and sun times.
- **Resource Library**: A curated collection of HAM radio guides, frequency charts, and technical resources.
- **Maidenhead Grid Explorer**: Interactive tool to visualize grid square boundaries and locate coordinates with "click-to-copy" convenience.
- **PWA Ready**: Manifest support and optimized for a high-performance experience on all devices.
- **Responsive Design**: Modern, high-density layout featuring a collapsible mobile menu and elegant desktop navigation.
- **Privacy First Analytics**: Lightweight visit tracking via Plausible Analytics.

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
