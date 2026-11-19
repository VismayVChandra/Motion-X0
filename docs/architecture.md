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
| Design | v0 design system (tokens, components) ported to plain CSS | Icons bundled inline (Lucide paths); system fonts only, so it works offline. |

Bundle budget: **< 300 KB gzipped** (expected well under 100 KB).

## Source layout

```
src/
  device/
    types.ts       DeviceState, Command, DeviceClient interface
    protocol.ts    encode commands, parse/validate device messages, nominal rpm
    motorModel.ts  pure model of the firmware (ramp, heartbeat timeout, faults)
    sim.ts         SimDevice: MotorModel + timers behind the DeviceClient interface
    real.ts        RealDevice: WebSocket client (connect timeout, mixed-content check)
    url.ts         turn "192.168.4.1" into ws://192.168.4.1/ws
    controller.ts  DeviceController: heartbeat, lost-link watchdog, reconnect backoff, e-stop retries
    instance.ts    app-wide controller wired to settings (Demo mode / address)
  session/
    patterns.ts    pattern → timed phases (levels), cycle counting
    runner.ts      SessionRunner: timer, phase levels, pause/auto-pause, result
    instance.ts    app-wide runner; saves every finished session
  store/
    settings.ts    persisted settings (theme, demo mode, device URL, role, language)
    sessions.ts    saved sessions + comfort scores (localStorage)
    plan.ts        therapist plan for the patient (localStorage)
  progress/
    stats.ts       today vs plan, minutes per day, weekly adherence, streaks, comfort trend
  ui/              shell (status badge, e-stop bar, notice, tabs), icons, controls
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

## Device controller (Wave 1)

`DeviceController` sits between the screens and the active `DeviceClient`:

| Behaviour | Detail |
|---|---|
| Heartbeat | `ping` every 500 ms whenever connected (always, not only in sessions: simpler and harmless). |
| Lost link | No `state` for 2 s → link `lost` → "Connection lost: motor stopped". A real socket silent for 6 s is closed and reopened. |
| Reconnect | Automatic, backoff 1 s → 2 s → 4 s → 5 s (then every 5 s). "Try now" skips the wait. |
| E-stop | Sent immediately, then re-sent every 200 ms until the device reports `fault: "estop"` (max ~2 s). |
| Disconnect / page close | Sends `stop` first if the motor is active. |
| Auto-connect | On launch, in both modes (the app is normally opened from the device itself). |

The emergency Stop bar is part of the app shell, so it appears on every tab while the motor is running or ramping.

## Sessions (Wave 2)

| Topic | Rule |
|---|---|
| Durations | 2, 5, 10, 15, 20 min (2 min is there for quick demos). |
| Patterns | Constant · Warm-up → Hold → Cool-down (20 % / 60 % / 20 %, edges one level lower, never below 1) · Intervals (busy at the chosen level, rest at level 1; 30 s spells up to 5 min, 60 s above). |
| Timer | Counts only active (unpaused) time. Gaps over 1 s (browser asleep) are not counted. |
| Cycles | Integral of rpm over running time; uses the nominal rpm per level when no hall sensor is fitted. |
| Auto-pause | Link lost → paused ("Connection lost: motor stopped"). Device target drops to 0 without the app asking (IR remote, device safety stop) → paused. Resume is manual. |
| Emergency stop | Ends the session; saved with `endReason: "estop"`. The latch is reset on the Device screen. |
| Saving | Every session is saved the moment it ends (completed, ended early, e-stop, or page closed). The comfort score (1–10) and note are added afterwards; skipping leaves `comfort: null`. |
| Comfort advice | Score ≥ 7 shows "Please stop and consult your therapist before your next session." |
| Storage | localStorage (`motionx.sessions.v1`), validated on load. Records are ~250 bytes, so years of sessions fit. |

## Plans and progress (Wave 3)

| Topic | Rule |
|---|---|
| Roles | Local switch (Settings, or the buttons on Home). Therapist sees the dashboard on the Home tab; patient sees today's plan. No login. |
| Plan | One patient per device: name, level, duration (2/5/10/15/20 min), sessions per day (1–6), optional note. Editing keeps the original start date. |
| Counting | A session counts toward the plan if it lasted at least 80 % of the prescribed time. |
| Adherence | Per week (Monday start): sum over days of min(done, target) ÷ (target × days covered). Only days from the plan start up to today count. |
| Streak | Consecutive days meeting the daily target (any session without a plan). An unfinished today does not break it. |
| Charts | Hand-rolled: minutes per day (7 or 30 days, goal line = duration × sessions per day), weekly adherence (4 or 8 weeks), comfort trend (threshold line at 7). Each has a text summary for screen readers. |
