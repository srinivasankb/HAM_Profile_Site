# VU35KB | Amateur Radio Explorer

A high-performance, static-site generated (SSG) portal for **VU35KB** (Srinivasan KB), a newcomer exploring the world of Amateur Radio and QRP operations from Rajapalayam, IN.

🌐 **Live at**: [https://ham.srinikb.in/](https://ham.srinikb.in/)

## 🚀 Features

- **Personal Portal**: High-level introduction and bio on the homepage.
- **Radio Journal**: A lightweight blog system using Markdown and Astro Content Collections.
- **Station Dashboard**: Real-time station details including local time, UTC, weather (OpenWeatherMap API), and sun times.
- **Maidenhead Grid Explorer**: Interactive tool to visualize grid square boundaries and locate coordinates.
- **Interactive Interactivity**: Giscus (GitHub-powered) comments and reactions on blog posts.
- **RSS Feed**: Generic RSS support for the radio journal (`/blog/rss.xml`).
- **PWA Ready**: Manifest support for a native-like experience on mobile.
- **Responsive Design**: Fluid layout with a collapsible sidebar for desktop and a burger menu for mobile.

## 🛠️ Tech Stack

- **Framework**: [Astro v6](https://astro.build/) (Static Site Generation)
- **UI Components**: React (Island architecture for maps and interactive tools)
- **Styling**: Vanilla CSS (Custom Design System)
- **Interactive Tools**: 
  - **Maps**: React Leaflet
  - **Icons**: Lucide React
  - **Comments**: Giscus (GitHub Discussions)
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
