# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Space Jukebox is a web-based audio/visual experience that plays Grateful Dead "Space" jams from Archive.org over NASA space footage. It features audio-reactive visual effects (trippy filters, glitch effects) synchronized to the music via Web Audio API frequency analysis.

## Commands

```bash
# Development
pnpm dev          # Start Vite dev server on port 3000

# Build & Production
pnpm build        # Build client (Vite) + server (esbuild)
pnpm start        # Run production server (NODE_ENV=production)

# Quality
pnpm check        # TypeScript type checking (tsc --noEmit)
pnpm format       # Format code with Prettier
```

## Architecture

### Monorepo Structure
- **client/** - React SPA (Vite, Tailwind v4, shadcn/ui)
- **server/** - Express static file server for production
- **shared/** - Code shared between client and server

### Path Aliases
```typescript
@/*       → client/src/*
@shared/* → shared/*
@assets   → attached_assets/
```

### Key Files
- `client/src/pages/Home.tsx` - Main application: audio player, video background, visual effects engine
- `client/src/index.css` - Tailwind config + vaporwave color scheme + CRT effects
- `client/public/space_tracks.json` - Grateful Dead track metadata (Archive.org identifiers)
- `client/public/space_videos.json` - NASA video URLs

### Visual Effects System (Home.tsx)
The audio-reactive visuals use Web Audio API with optimized CSS transforms:
1. `AudioContext` + `AnalyserNode` processes audio frequencies
2. FFT data split into bass/mids/highs bands (pre-allocated arrays)
3. Intensity slider (0-1) controls effect magnitude
4. CSS filters applied via JavaScript (30fps throttled):
   - Hue rotation (mids-driven + auto-cycle at high intensity)
   - Saturation boost (bass+mids)
   - Brightness/contrast (highs-driven)
   - Scale transform (bass-driven)
   - Glitch shake on strong bass hits
5. `effectSeed` randomizes which frequency band drives which effect
6. Note: WebGL effects (VFX-JS) don't work due to cross-origin video CORS restrictions

### UI Components
Uses shadcn/ui (new-york style) with Radix primitives. Components in `client/src/components/ui/`.

### Styling
- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Vaporwave theme: neon purple/cyan, hot pink accents, deep space black
- CRT scanline overlay effect
- Custom fonts: VT323 (pixelated), Space Mono

### Data Flow
1. On mount, load tracks from bundled JSON and videos from bundled video list
2. Random track selected, audio URL constructed from Archive.org pattern
3. Audio plays through `<audio>` element connected to AnalyserNode
4. Background `<video>` loops NASA footage
5. `requestAnimationFrame` loop (30fps throttled) analyzes audio frequencies
6. CSS transforms/filters applied to video element based on frequency data
