# MOTION-X: 2-minute demo script

> Not a medical device. Prototype. Use under supervision.
> Say this once at the start, and keep the notice visible (it is on every screen).

Two people works best: **presenter** (talks, holds the phone) and **operator** (stands by the machine with the IR remote / power switch).

## Before the judges arrive (10 minutes)

- [ ] Phone charged, **auto-lock off** (Settings → Display), volume up, Do Not Disturb on.
- [ ] Mobile data **off** so the phone stays on the MOTION-X Wi-Fi.
- [ ] Machine powered, ESP32 booted (serial or app shows **Connected**). Mechanism empty.
- [ ] App open at `http://192.168.4.1`, language and theme as you want them (Settings).
- [ ] Plan exists (therapist view). For a richer story: **Settings → Demo mode on → Load sample data**, then turn Demo mode back off. Sample data is marked "Demo mode (simulated)" in reports, so say so if asked.
- [ ] Role = **Patient**, Home tab showing "Today's plan".
- [ ] Backup: a second phone or laptop with the **Vercel link** in Demo mode.
- [ ] Do one dry run of the whole script.

## The script

| Time | Screen | Do | Say |
|---|---|---|---|
| **0:00–0:15** | Home | Show the phone. Point at "Today's plan" and the streak. | "This is MOTION-X: a motor-assisted leg exercise machine and its app. The app supports exercise tracking for patients and therapists. It's a prototype, used under supervision." |
| **0:15–0:30** | Device | Tap **Device**. Point at **Connected**, the live readouts. | "The phone talks straight to the machine over its own Wi-Fi. No internet, no cloud. Every half-second the app sends a heartbeat; if it stops, the machine stops by itself." |
| **0:30–0:55** | Setup → Live | **Home → Start next session**. Show "Your therapist's plan is selected". Tap **Start session**. | "The therapist's plan is preselected. Watch the speed ramp up gently: the firmware never jumps to full speed." |
| **0:55–1:10** | Live | Point at the ring, phase badge, rpm and **cycles** counting. | "Live: time left, the current phase, pedal speed and cycles, all saved as we go." |
| **1:10–1:20** | Live | Press the red **EMERGENCY STOP**. | "Stop is on every screen and always works. It cuts the motor instantly and latches until someone resets it." |
| **1:20–1:35** | Comfort check | Tap **8**. Point at the amber advice. Tap **Save and finish**. | "After each session the patient rates comfort. A high score advises them to stop and consult their therapist, and flags it for the therapist." |
| **1:35–1:52** | Therapist view | Home → **Therapist view**. Point at adherence, the high-score flag, the comfort trend. | "The therapist sets the plan here and sees adherence, comfort trends and anything to review." |
| **1:52–2:00** | Report | Tap a session in **Latest sessions** → show the one-page report. | "And every session prints as a one-page report. Thank you!" |

After the demo: **Device → Reset emergency stop** (it stays latched on purpose).

## If something goes wrong

| Problem | Do this (keep talking) |
|---|---|
| Machine/Wi-Fi not available | Settings → **Demo mode on** (or switch to the backup device with the Vercel link). Say: "The same app runs against a simulator." |
| "Connection lost: motor stopped" appears | Great safety moment: "The link dropped, so the machine stopped itself." Tap **Reconnect**. |
| Phone left the Wi-Fi | Rejoin "MOTION-X"; the app reconnects automatically. |
| Motor does not start | Check the badge says Connected and no emergency stop is latched (Device screen). Use the IR remote as a fallback. |
| Running long | Skip the report; end on the therapist view. |

## Optional extras (only if asked or time allows)

- **Connection drop (Demo mode):** Device → Demo tools → *Simulate connection drop*. The alarm appears within 2 s and the motor stops.
- **Hindi:** Settings → Language → हिन्दी. Everything, including voice prompts and the report, switches.
- **Simple mode:** Settings → Simple mode. One screen with huge Start/Stop buttons for low vision or low dexterity.
- **IR remote:** keys 0/1/2/3 still control the machine without the app.

## Likely questions

- **What makes it safe?** Safety is in the firmware, not the app: it boots stopped, ramps every change, has a hard speed ceiling, stops after 2 s without the app, and the emergency stop latches.
- **Does it need internet?** No. The ESP32 is its own hotspot and serves the app.
- **Is it a medical device?** No. It's a student prototype for exercise tracking, used under supervision.
- **Where is the data?** On the phone (browser storage). Nothing leaves the device.
