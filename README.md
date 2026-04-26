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
