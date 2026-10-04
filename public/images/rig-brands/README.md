# Rig brand logos

Logos shown next to each entry in **Rig Details** on the profile page.

## Folder

Place files here: `public/images/rig-brands/`

## Recommended dimensions

| Setting | Value |
|--------|--------|
| **Export size (2×)** | **128 × 48 px** |
| **Minimum (1×)** | 64 × 24 px |
| **On-screen box** | 64 × 24 px (CSS); image scales with `object-fit: contain` |
| **Format** | PNG or SVG with **transparent** background |
| **Color** | Full-color or single-color; avoid large padding in the file |

Wide wordmarks (Alinco, Baofeng) fit this aspect ratio. Taller square marks are fine—they will letterbox inside the box.

## File names (current rigs)

Set the `brandLogo` field in `src/data/hardware.json` to the **file name only**:

| Rig | File to add |
|-----|-------------|
| Alinco DR 735T | `alinco.png` (or `alinco.svg`) |
| Baofeng M13 Pro | `baofeng.png` (or `baofeng.svg`) |
| Baofeng UV-5R Mini | same as M13 Pro — use `baofeng.png` |

## Usage in data

```json
"brandLogo": "alinco.png"
```

Public URL: `/images/rig-brands/alinco.png`

If the file is missing, the logo slot is hidden automatically.
