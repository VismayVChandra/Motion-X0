# MOTION-X architecture

> Student prototype. Not a medical device. Use under supervision.

## Overview

```
 Phone / laptop browser                         ESP32
┌─────────────────────────────┐   Wi-Fi AP   ┌─────────────────────────┐
│ Preact UI (screens)         │  "MOTION-X"  │ HTTP: serves app from   │
│   │                         │◀────────────▶│   LittleFS (gzip)       │
│ device controller (Wave 1)  │              │ WS /ws: protocol.md     │
│   │  heartbeat, lost-link   │  ws://       │ ramp limiter            │
│ DeviceClient ──┬─ RealDevice├─────────────▶│ heartbeat timeout (2 s) │
│                └─ SimDevice │ 192.168.4.1  │ ESC (arming) ── motor   │
│ stores: settings, sessions  │              │ IR receiver (0/1/2/3)   │
│   localStorage / IndexedDB  │              └─────────────────────────┘
└─────────────────────────────┘
```

- **No backend, no internet.** The ESP32 serves the static build and the WebSocket on the same origin.
- **Demo mode** swaps `RealDevice` for `SimDevice`. Everything above the `DeviceClient` interface is identical in both modes.

## Stack

| Concern | Choice | Why |
|---|---|---|
| UI | Preact + TypeScript | Small runtime (~4 KB gz) for flash storage. |
| State | `@preact/signals` | Tiny, no boilerplate. |
| Build | Vite | Fast dev server; relative `base` so the build runs from the ESP32 root. |
| Styling | Plain CSS + custom properties | Light and dark themes via `data-theme` on `<html>`. |
| Routing | Hand-rolled hash router | No dependency; hash URLs work from a static file server. |
| Tests | Vitest | Logic only: SimDevice, protocol parsing, stores, later plan/adherence maths. |
| Charts (Wave 3) | Hand-rolled SVG | No library weight. |

Bundle budget: **< 300 KB gzipped** (expected well under 100 KB).

## Source layout

```
src/
  device/
    types.ts       DeviceState, Command, DeviceClient interface
    protocol.ts    encode commands, parse/validate device messages, nominal rpm
    motorModel.ts  pure model of the firmware (ramp, heartbeat timeout, faults)
    sim.ts         SimDevice: MotorModel + timers behind the DeviceClient interface
    real.ts        RealDevice: WebSocket client (Wave 1)
  store/
    settings.ts    persisted settings (theme, demo mode, device URL, role, language)
  ui/              shared components (header, nav, notice)
  screens/         one file per screen
  app.tsx          shell + router
  main.tsx         entry
docs/              protocol, architecture, firmware (Wave 5), demo (Wave 6)
firmware/          PlatformIO project (Wave 5)
```

## Key decisions

1. **The firmware is the safety authority.** Ramping, the heartbeat timeout and the e-stop latch run on the ESP32. The app never ramps by itself; it sends the target level and shows what the device reports.
2. **`MotorModel` mirrors the firmware rules** in pure TypeScript (time passed in explicitly), so the simulator behaves like the real device and the rules are unit-tested. The Wave 5 firmware implements the same rules.
3. **The simulator talks JSON.** `SimDevice` encodes commands and parses state strings through `protocol.ts`, just like `RealDevice`, so protocol parsing is exercised in Demo mode too.
4. **Data stays on one browser.** IndexedDB/localStorage is per browser and per origin. For the prototype the patient and therapist roles share one device (a local role switch). Demo mode on `localhost` and the real device on `192.168.4.1` keep separate data.
5. **PWA is progressive.** Service workers need HTTPS or `localhost`, so they do not run when the ESP32 serves the app over plain HTTP. The app must work fully without one. Offline use on the device is automatic (the ESP32 serves it); install/offline caching applies when run from `localhost` or an HTTPS host.
6. **Protocol additions beyond the brief:** `reset` command, `target_level`, `v` and `source` fields. They settle e-stop latching, ramp display and IR-vs-app priority. The app tolerates their absence.

## Safety behaviour (summary)

| Rule | Where |
|---|---|
| Boots stopped | Firmware; `SimDevice` starts stopped |
| 500 ms heartbeat while a session runs | App device controller (Wave 1) |
| 2 s silence → motor stops | Firmware / `MotorModel` |
| "Connection lost, motor stopped" | App, when no state arrives for 2 s |
| Smooth ramps | Firmware / `MotorModel` |
| Emergency Stop on every session screen | App UI (Wave 1+) |
| Not-a-medical-device notice | App shell footer, always visible |
