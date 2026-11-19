# MOTION-X device protocol (v1)

JSON text frames over a WebSocket at `ws://192.168.4.1/ws`. The ESP32 runs its own Wi-Fi access point and serves the web app from the same address, so the page and the socket share an origin (no mixed-content problem).

> Prototype. Not a medical device. Use under supervision.

## Principles

1. **The device is the safety authority.** Ramping, the heartbeat timeout and the e-stop latch live in firmware. The app only requests; it never assumes a command took effect until a `state` message says so.
2. **Stop always wins.** `stop` and `estop` are accepted in every state, from every source (app or IR remote).
3. **Boot stopped.** After power-on the motor is stopped, `level = 0`, `target_level = 0`.

## App → device

| Message | Meaning |
|---|---|
| `{"cmd":"set_speed","level":N}` | Request speed level `N` (integer 0–3). `0` is the same as `stop`. The device ramps toward it. Ignored (state is re-sent) while a fault is latched. |
| `{"cmd":"stop"}` | Ramp down to stopped (fast ramp). |
| `{"cmd":"estop"}` | Emergency stop: cut motor output **immediately** (no ramp) and latch `fault = "estop"`. |
| `{"cmd":"reset"}` | Clear a latched fault. Only accepted when the motor is stopped. Does not restart the motor. |
| `{"cmd":"ping"}` | Heartbeat. The device answers with a `state` message. |

Level mapping matches the existing IR remote: `0` = stop, `1` / `2` / `3` = speed levels.

Unknown or malformed messages are ignored. They do **not** count as a heartbeat.

## Device → app

```json
{"type":"state","v":1,"level":1,"target_level":2,"running":true,"rpm":18.5,"current":null,"fault":null,"source":"app"}
```

| Field | Type | Meaning |
|---|---|---|
| `type` | `"state"` | Message type. |
| `v` | number | Protocol version (`1`). |
| `level` | 0–3 | Speed level the output has actually reached. |
| `target_level` | 0–3 | Level requested. Differs from `level` while ramping. |
| `running` | bool | `true` while motor output is above zero (including while ramping down). |
| `rpm` | number \| null | Crank rpm from the hall sensor; `null` when no sensor is fitted. |
| `current` | number \| null | Motor current in amps from the INA219; `null` when absent. |
| `fault` | string \| null | Latched fault code, or `null`. |
| `source` | `"app"` \| `"ir"` \| `"none"` | Who issued the last motion command. |

Sent about once per second, and immediately after any change (level reached, command accepted, fault set or cleared).

The app must accept messages that lack `v`, `target_level` or `source` (an older or simpler firmware): it treats missing `target_level` as equal to `level`, and missing `source` as `"none"`.

### Fault codes

| Code | Cause | Cleared by |
|---|---|---|
| `estop` | `estop` command received | `reset` |
| `heartbeat_timeout` | App was in control and sent nothing for 2 s | `reset`, or any new `set_speed` from the app after the connection returns |
| `esc_not_armed` | ESC arming sequence has not finished | Clears itself after arming |

## Heartbeat

- While a session runs (the app is in control), the app sends `{"cmd":"ping"}` every **500 ms**. Any valid command also counts as a heartbeat.
- If the app is in control (`source = "app"`, motor running) and the device hears **no valid message for 2 s**, it stops the motor (fast ramp to 0) and sets `fault = "heartbeat_timeout"`.
- If the app sees no `state` message for 2 s, it shows **"Connection lost, motor stopped"**. It knows the device will have stopped by itself.
- The timeout does not apply when the IR remote started the motor (`source = "ir"`). The remote is a separate, local control.

## IR remote vs app

- IR `0` (stop) always wins, whoever started the motor.
- An IR speed key takes control: `source` becomes `"ir"`.
- An app `set_speed` takes control back: `source` becomes `"app"`.
- An IR key does not clear an `estop` latch; only `reset` from the app or a power cycle does.

## Ramping (firmware)

- Speed-up: at most ¼ of full output per second (stopped → level 3 takes at least 4 s).
- Slow-down and `stop`: at most ½ of full output per second.
- `estop` and heartbeat timeout: `estop` is immediate; timeout uses the fast slow-down ramp.

## Nominal rpm per level

Used for the simulator and as the cycle-count fallback when `rpm` is `null`. Calibrate on the real machine.

| Level | Nominal crank rpm |
|---|---|
| 0 | 0 |
| 1 | 15 |
| 2 | 25 |
| 3 | 35 |
