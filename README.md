# MOTION-X

Web app and ESP32 firmware for **MOTION-X**, a motor-assisted lower-limb exercise machine (student prototype). A patient runs an exercise session on the device; a therapist sets the plan and sees the data. The app supports exercise tracking only.

> **Not a medical device. Prototype. Use under supervision.**

The ESP32 runs its own Wi-Fi hotspot (`MOTION-X`) and serves the app at `http://192.168.4.1`; the app talks to it over WebSocket. No internet or backend. **Demo mode** uses a simulated device, so everything works without hardware.

## Screenshots

> Replace these placeholders with real captures (phone at 375 px wide). Suggested files in `docs/screenshots/`.

| | | |
|---|---|---|
| ![Patient home with today's plan](docs/screenshots/home.png) | ![Live session with progress ring](docs/screenshots/live.png) | ![Emergency stop and connection lost](docs/screenshots/connection-lost.png) |
| Patient home | Live session | Connection lost: motor stopped |
| ![Comfort check with advice](docs/screenshots/comfort.png) | ![Therapist dashboard](docs/screenshots/therapist.png) | ![Printable report](docs/screenshots/report.png) |
| Comfort check | Therapist dashboard | One-page report |
| ![Hindi interface](docs/screenshots/hindi.png) | ![Simple mode](docs/screenshots/simple.png) | ![ESP32 hardware](docs/screenshots/hardware.jpg) |
| हिन्दी | Simple mode | The machine |

## Features

- **Device control:** connect with auto-reconnect, start/stop, speed levels 1–3 with gentle ramps, live rpm/current.
- **Safety:** emergency Stop on every screen, 500 ms heartbeat, "Connection lost: motor stopped", firmware-side ramping, timeout and e-stop latch.
- **Sessions:** duration, level and pattern (constant, warm-up/hold/cool-down, intervals); countdown ring, cycle count; comfort check (1–10) with advice at 7+; every session saved.
- **Therapist:** plan editor (level, duration, sessions per day), adherence, comfort trend, high scores to review.
- **Progress:** minutes per day, weekly adherence, comfort trend charts (hand-rolled SVG), streaks.
- **Access:** English and हिन्दी (add Kannada with one JSON file), Simple mode, high contrast, voice prompts, 48 px+ touch targets.
- **Report:** one-page printable session report (saves as PDF).
- **Offline:** installable PWA on HTTPS; served from the ESP32 flash on the device (~50 KB gzipped).

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run dev           # dev server (also on your LAN, for testing on a phone)
npm run check         # typecheck + lint + unit tests
npm run build         # web / Vercel build in dist/ (Demo mode on by default)
npm run build:device  # ESP32 build into firmware/motionx/data/ (Demo mode off)
npm run size          # gzipped size report against the 300 KB budget
```

Open the app, keep **Demo mode** on, and follow the in-app **Quick start** (Settings → Help and data). For a full history to explore: Settings → **Load sample data**.

## Hardware

ESP32 + hobby ESC + motor + IR receiver (optional hall sensor and INA219). Firmware, wiring, upload commands and the bench test checklist: **[docs/firmware.md](docs/firmware.md)**.

## Docs

- [docs/demo.md](docs/demo.md): 2-minute demo script, prep checklist and fallbacks
- [docs/protocol.md](docs/protocol.md): device protocol (JSON over WebSocket)
- [docs/architecture.md](docs/architecture.md): structure and key decisions
- [docs/firmware.md](docs/firmware.md): ESP32 firmware, upload, calibration, bench checklist
- [docs/i18n.md](docs/i18n.md): languages, and how to add Kannada

## Project layout

```
src/            Preact + TypeScript app (device layer, session runner, stores, screens, i18n)
public/         icons, PWA manifest, service worker
firmware/       ESP32 sketch (motionx/) and PlatformIO project
scripts/        device build (gzip into LittleFS data) and size check
docs/           protocol, architecture, firmware, demo, i18n
```

## Status

- [x] Wave 0: foundations (tooling, protocol, DeviceClient, SimDevice, settings, app shell)
- [x] Wave 1: device control and safety (v0 design, connect / control / connection-lost screens, heartbeat, auto-reconnect, e-stop)
- [x] Wave 2: session flow (setup, live session with ring and timeline, comfort check, sessions saved)
- [x] Wave 3: therapist and progress (role switch, plan editor, plan-driven home, charts, streaks)
- [x] Wave 4: accessibility, languages, report (English + Hindi, Simple mode, high contrast, voice prompts, printable report)
- [x] Wave 5: firmware (ESP32 sketch, LittleFS web app, ESC ramp and heartbeat safety, IR remote, bench checklist)
- [x] Wave 6: polish and demo readiness (PWA, loading/error/empty states, quick start, sample data, demo script, Lighthouse)

## Safety and wording

The app never claims diagnosis, treatment or cure; tests check every language for this. Safety-critical behaviour (boot stopped, ramping, 2 s heartbeat timeout, e-stop latch, speed ceiling) lives in the firmware, so it holds even if the phone fails.
