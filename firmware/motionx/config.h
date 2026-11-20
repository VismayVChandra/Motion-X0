// =====================================================================================
//  MOTION-X firmware configuration
//  >>> Everything you need to calibrate is in this file. <<<
//
//  Not a medical device. Prototype. Use under supervision.
//  Start with the motor DISCONNECTED from the mechanism (see docs/firmware.md).
// =====================================================================================
#pragma once

// ---------------------------------------------------------------- Wi-Fi access point
#define AP_SSID      "MOTION-X"
#define AP_PASSWORD  "motionx123"   // CHANGE ME. 8+ characters. Put it on a label on the machine.
#define AP_CHANNEL   6
#define AP_MAX_CLIENTS 4            // phone + laptop + spare
// Transmit power. 11 dBm covers a room and keeps the start-up current spike small
// (helps on weak USB supplies). Options: WIFI_POWER_8_5dBm ... WIFI_POWER_19_5dBm.
#define AP_TX_POWER  WIFI_POWER_11dBm

// ---------------------------------------------------------------- Pins (CHANGE to match your wiring)
#define PIN_ESC      18   // ESC signal wire (servo-style PWM)
#define PIN_IR       4    // IR receiver OUT pin (e.g. VS1838B / TSOP38238)
#define PIN_HALL     27   // optional hall sensor on the crank (open-collector, active LOW)
#define PIN_I2C_SDA  21   // optional INA219 current sensor
#define PIN_I2C_SCL  22

// ---------------------------------------------------------------- ESC pulse widths (CALIBRATE)
// Standard hobby ESC: 1000 us = stop/idle, 2000 us = full throttle.
// START CONSERVATIVE: the defaults below only reach ~16 % throttle at level 3.
// Raise LEVEL_PULSE_US one step (10-20 us) at a time on the bench.
#define ESC_FREQ_HZ        50       // 50 Hz servo frame (20 ms)
#define ESC_STOP_US        1000     // motor stopped (also used during arming)
#define ESC_MAX_US_LIMIT   1300     // hard ceiling: the firmware never outputs more than this
#define ESC_ARM_MS         3000     // hold ESC_STOP_US this long after boot so the ESC arms

// Pulse width reached at each speed level (index 0 = stop, must equal ESC_STOP_US).
// Between levels the output is ramped smoothly (see RAMP_* below).
static const uint16_t LEVEL_PULSE_US[4] = {
  ESC_STOP_US,  // 0: stop
  1080,         // 1: Gentle   <- calibrate: the lowest pulse where the motor turns smoothly
  1120,         // 2: Steady
  1160          // 3: Brisk
};

// ---------------------------------------------------------------- Safety (matches docs/protocol.md)
#define RAMP_UP_PER_S      0.25f    // max output change per second when speeding up (stop -> level 3 >= 4 s)
#define RAMP_DOWN_PER_S    0.50f    // max output change per second when slowing / stopping
#define HEARTBEAT_TIMEOUT_MS 2000   // app silent this long while it controls the motor -> stop
#define STATE_INTERVAL_MS  1000     // periodic state broadcast

// ---------------------------------------------------------------- IR remote key codes (CALIBRATE)
// Defaults are the NEC "command" bytes of the common 21-key "Car MP3" remote.
// To find yours: open Serial Monitor at 115200 baud, press a key, read "IR command 0x..".
#define IR_KEY_0  0x16    // stop
#define IR_KEY_1  0x0C    // level 1
#define IR_KEY_2  0x18    // level 2
#define IR_KEY_3  0x5E    // level 3

// ---------------------------------------------------------------- Optional telemetry
// Set to 1 only when the sensor is fitted. When 0 the app receives "null" and estimates.
#ifndef USE_HALL_RPM
#define USE_HALL_RPM   0
#endif
#define HALL_PULSES_PER_REV 1       // magnets on the crank
#define HALL_DEBOUNCE_US   2000     // ignore pulses closer than this (bounce / noise)

#ifndef USE_INA219
#define USE_INA219     0            // needs the "Adafruit INA219" library when enabled
#endif
