# MOTION-X

Web app for MOTION-X, a motor-assisted lower-limb rehabilitation machine (student prototype). It supports guided exercise sessions with exercise tracking for patients and therapists.

> **Not a medical device. Prototype. Use under supervision.**

The ESP32 runs its own Wi-Fi hotspot and serves this app; the app talks to it over WebSocket (`ws://192.168.4.1/ws`). **Demo mode** (on by default) uses a simulated device, so everything works without hardware.

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run dev      # dev server (also on your LAN, for testing on a phone)
npm run check    # typecheck + lint + unit tests
npm run build    # production build in dist/ (web / Vercel, Demo mode on)
npm run build:device  # build for the ESP32 into firmware/motionx/data/ (Demo mode off)
```

## Docs

- [docs/protocol.md](docs/protocol.md): device protocol (JSON over WebSocket)
- [docs/architecture.md](docs/architecture.md): structure and key decisions
- [docs/i18n.md](docs/i18n.md): languages, and how to add Kannada
- [docs/firmware.md](docs/firmware.md): ESP32 firmware, upload commands, bench test checklist

## Status

- [x] Wave 0: foundations (tooling, protocol, DeviceClient, SimDevice, settings, app shell)
- [x] Wave 1: device control and safety (v0 design, connect / control / connection-lost screens, heartbeat, auto-reconnect, e-stop)
- [x] Wave 2: session flow (setup, live session with ring and timeline, comfort check, sessions saved)
- [x] Wave 3: therapist and progress (role switch, plan editor, plan-driven home, charts, streaks)
- [x] Wave 4: accessibility, languages, report (English + Hindi, Simple mode, high contrast, voice prompts, printable report)
- [x] Wave 5: firmware (ESP32 sketch, LittleFS web app, ESC ramp and heartbeat safety, IR remote, bench checklist)
- [ ] Wave 6: polish and demo readiness
