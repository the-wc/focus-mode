<p align="center">
  <img src="public/icon/128.png" width="64" height="64" alt="Focus Mode" />
</p>

<h1 align="center">Focus Mode</h1>

<p align="center">
  A minimalist browser extension that blocks distracting websites and helps you stay focused.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/chrome-extension-blue?style=flat-square" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/built_with-WXT-333?style=flat-square" alt="WXT" />
  <img src="https://img.shields.io/badge/react-19-61dafb?style=flat-square" alt="React 19" />
  <img src="https://img.shields.io/badge/tailwind-v4-38bdf8?style=flat-square" alt="Tailwind v4" />
</p>

---

<p align="center">
  <img src="preview.png" alt="Focus Mode Preview" width="680" />
</p>

## How It Works

1. **Add sites to block** -- from the popup or the dashboard
2. **Visit a blocked site** -- a full-screen overlay prevents access
3. **Request access** -- complete a timed reflection challenge to proceed
4. **Session expires** -- the overlay returns when your browse time runs out

## Features

- **Wildcard patterns** -- block `reddit.com`, `*.twitter.com`, or `reddit.com/r/funny/*`
- **Exceptions** -- allow specific pages even when the domain is blocked
- **Configurable sessions** -- set challenge duration, browse time, and session limits per rule
- **Reflection prompts** -- customizable prompts shown during the challenge timer
- **Presets** -- one-click import for Social Media and Video site blocks
- **Import / Export** -- share configs as JSON files
- **Activity heatmap** -- GitHub-style visualization of blocked distractions over the past year
- **Dark mode** -- follows your system preference

## Quick Start

### Install from source

```sh
git clone <repo-url>
cd focus-mode
pnpm install
pnpm build
```

Load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3` folder

### Development

```sh
pnpm dev            # Start dev server with hot reload
pnpm build          # Production build for Chrome
pnpm build:firefox  # Production build for Firefox
pnpm zip            # Package for distribution
```

## Project Structure

```
focus-mode/
  entrypoints/
    background.ts          # Storage initialization
    content/               # Overlay (Shadow DOM + React)
      index.tsx             # Content script entry
      App.tsx               # Dark mode wrapper
      BlockedOverlay.tsx
      TimerPrompt.tsx       # Challenge timer + prompt
    popup/                  # Browser action popup
    dashboard/              # Full-page settings UI
  lib/
    storage.ts              # Typed storage definitions
    matching.ts             # Wildcard pattern matching
    prompts.ts              # Prompt pool + random selection
    presets.ts              # Built-in presets
  block-configs/            # Preset JSON files
    social-media.json
    videos.json
    default-prompts.json
  components/ui/            # shadcn components
  wxt.config.ts
```

## Config Format

Export and import configs as JSON:

```json
{
  "name": "My Config",
  "rules": [
    {
      "pattern": "reddit.com",
      "timerSeconds": 30,
      "accessLimit": 2,
      "limitPeriod": "day",
      "browseSeconds": 300
    }
  ]
}
```

## Tech Stack

[WXT](https://wxt.dev) -- [React 19](https://react.dev) -- [Tailwind CSS v4](https://tailwindcss.com) -- [shadcn/ui](https://ui.shadcn.com) -- [Lucide Icons](https://lucide.dev)

---

<p align="center">
  <sub>Built to help you focus on what matters.</sub>
</p>
