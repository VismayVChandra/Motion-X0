// =====================================================================================
//  MOTION-X firmware (ESP32)
//
//  - Wi-Fi access point "MOTION-X", serves the web app from LittleFS (gzip) at 192.168.4.1
//  - WebSocket /ws speaking docs/protocol.md (JSON)
//  - ESC output with arming sequence, ramp limiting and a hard pulse ceiling
//  - 2 s heartbeat timeout while the app controls the motor
//  - IR remote still works: 0 = stop, 1/2/3 = speed levels
//  - Optional telemetry: hall-sensor rpm, INA219 current (report null when absent)
//
//  Safety authority lives HERE, not in the app: boot stopped, ramp, timeout, e-stop latch.
//  Not a medical device. Prototype. Use under supervision.
//
//  Libraries: ESP Async WebServer + Async TCP (ESP32Async), ArduinoJson 7, IRremote 4.
//  Calibration constants: config.h
// =====================================================================================
#include <Arduino.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <LittleFS.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#define NO_LED_FEEDBACK_CODE   // no status LED on this board; also silences an IRremote notice
#include <IRremote.hpp>
#include "config.h"

#if USE_INA219
#include <Wire.h>
#include <Adafruit_INA219.h>
Adafruit_INA219 ina219;
#endif

static const char *FW_VERSION = "0.6.0";

// ---------------------------------------------------------------- Motor state (loop task only)
enum Source : uint8_t { SRC_NONE, SRC_APP, SRC_IR };
enum Fault : uint8_t { FAULT_NONE, FAULT_ESTOP, FAULT_HEARTBEAT, FAULT_NOT_ARMED };

struct Motor {
  float output = 0.0f;          // 0..1 (0 = ESC_STOP_US)
  uint8_t target = 0;           // requested level 0..3
  Fault fault = FAULT_NOT_ARMED;
  Source source = SRC_NONE;
  uint32_t lastAppMsgMs = 0;
  uint32_t armedAtMs = 0;
} motor;

// ---------------------------------------------------------------- Commands from the WebSocket task
// AsyncWebServer callbacks run in the async_tcp task, so they only enqueue; loop() applies.
enum CmdType : uint8_t { CMD_SET_SPEED, CMD_STOP, CMD_ESTOP, CMD_RESET, CMD_PING };
struct Cmd {
  CmdType type;
  uint8_t level;
  uint32_t clientId;
};
static QueueHandle_t cmdQueue;

// ---------------------------------------------------------------- Telemetry
#if USE_HALL_RPM
static volatile uint32_t hallPulses = 0;
static volatile uint32_t hallLastUs = 0;
#endif
static float rpmValue = 0;
static bool rpmAvailable = false;
static float currentValue = 0;
static bool currentAvailable = false;

// ---------------------------------------------------------------- Network
static DNSServer dns;
static AsyncWebServer server(80);
static AsyncWebSocket ws("/ws");

// ---------------------------------------------------------------- ESC output (works on ESP32 core 2.x and 3.x)
static const uint8_t ESC_RES_BITS = 16;
#if ESP_ARDUINO_VERSION_MAJOR < 3
static const uint8_t ESC_CHANNEL = 0;
#endif

static void escWriteUs(uint32_t us) {
  if (us > ESC_MAX_US_LIMIT) us = ESC_MAX_US_LIMIT;   // hard ceiling, whatever the maths says
  if (us < ESC_STOP_US) us = ESC_STOP_US;
  const uint32_t periodUs = 1000000UL / ESC_FREQ_HZ;
  const uint32_t duty = (uint32_t)(((uint64_t)us * ((1UL << ESC_RES_BITS) - 1)) / periodUs);
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(PIN_ESC, duty);
#else
  ledcWrite(ESC_CHANNEL, duty);
#endif
}

static void escBegin() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PIN_ESC, ESC_FREQ_HZ, ESC_RES_BITS);
#else
  ledcSetup(ESC_CHANNEL, ESC_FREQ_HZ, ESC_RES_BITS);
  ledcAttachPin(PIN_ESC, ESC_CHANNEL);
#endif
  escWriteUs(ESC_STOP_US);   // boot stopped
}

/** Output 0..1 → pulse, interpolated between the calibrated per-level pulses. */
static uint32_t outputToUs(float output) {
  if (output <= 0.0005f) return ESC_STOP_US;
  float scaled = output * 3.0f;
  int lo = (int)scaled;
  if (lo >= 3) return LEVEL_PULSE_US[3];
  float frac = scaled - lo;
  return (uint32_t)(LEVEL_PULSE_US[lo] + (LEVEL_PULSE_US[lo + 1] - LEVEL_PULSE_US[lo]) * frac + 0.5f);
}

// ---------------------------------------------------------------- Motor rules (mirror src/device/motorModel.ts)
static bool motorRunning() { return motor.output > 0.0005f; }
static bool motorActive() { return motorRunning() || motor.target > 0; }

/** Level the output has actually reached (rounds toward where it came from while ramping). */
static uint8_t reachedLevel() {
  const float eps = 1e-4f;
  float scaled = motor.output * 3.0f;
  float goal = motor.target / 3.0f;
  int lvl = motor.output >= goal ? (int)ceilf(scaled - eps) : (int)floorf(scaled + eps);
  if (lvl < 0) lvl = 0;
  if (lvl > 3) lvl = 3;
  return (uint8_t)lvl;
}

static void applyCommand(const Cmd &c, Source from) {
  if (from == SRC_APP) motor.lastAppMsgMs = millis();   // every valid app command is a heartbeat
  switch (c.type) {
    case CMD_PING:
      break;
    case CMD_ESTOP:
      motor.output = 0;          // immediate, no ramp
      motor.target = 0;
      motor.fault = FAULT_ESTOP;
      escWriteUs(ESC_STOP_US);
      Serial.println(F("[motor] EMERGENCY STOP"));
      break;
    case CMD_STOP:
      motor.target = 0;           // stop always wins, from any source
      break;
    case CMD_RESET:
      if (!motorRunning() && (motor.fault == FAULT_ESTOP || motor.fault == FAULT_HEARTBEAT)) {
        motor.fault = FAULT_NONE;
        Serial.println(F("[motor] fault reset"));
      }
      break;
    case CMD_SET_SPEED:
      if (c.level == 0) {
        motor.target = 0;
        break;
      }
      if (motor.fault == FAULT_ESTOP || motor.fault == FAULT_NOT_ARMED) break;  // latched / not ready
      // A deliberate new speed request (app back online, or the IR remote at the machine)
      // clears a heartbeat timeout. The e-stop latch above is never cleared this way.
      if (motor.fault == FAULT_HEARTBEAT) motor.fault = FAULT_NONE;
      motor.target = c.level;
      motor.source = from;
      break;
  }
}

/** Ramp + heartbeat timeout. Called every ~10 ms. */
static void motorStep(uint32_t dtMs) {
  const uint32_t now = millis();

  if (motor.fault == FAULT_NOT_ARMED && (int32_t)(now - motor.armedAtMs) >= 0) {
    motor.fault = FAULT_NONE;
    Serial.println(F("[esc] armed"));
  }

  if (motor.source == SRC_APP && motorActive() && motor.fault == FAULT_NONE &&
      now - motor.lastAppMsgMs > HEARTBEAT_TIMEOUT_MS) {
    motor.target = 0;
    motor.fault = FAULT_HEARTBEAT;
    Serial.println(F("[motor] heartbeat timeout -> stopping"));
  }

  const float goal = motor.target / 3.0f;
  if (motor.output < goal) {
    motor.output = fminf(goal, motor.output + RAMP_UP_PER_S * dtMs / 1000.0f);
  } else if (motor.output > goal) {
    motor.output = fmaxf(goal, motor.output - RAMP_DOWN_PER_S * dtMs / 1000.0f);
  }
  if (motor.output < 0.0005f) motor.output = 0;

  if (motor.fault == FAULT_NOT_ARMED) escWriteUs(ESC_STOP_US);
  else escWriteUs(outputToUs(motor.output));
}

// ---------------------------------------------------------------- State message
static const char *faultName(Fault f) {
  switch (f) {
    case FAULT_ESTOP: return "estop";
    case FAULT_HEARTBEAT: return "heartbeat_timeout";
    case FAULT_NOT_ARMED: return "esc_not_armed";
    default: return nullptr;
  }
}

static const char *sourceName(Source s) {
  return s == SRC_APP ? "app" : s == SRC_IR ? "ir" : "none";
}

static String stateJson() {
  JsonDocument doc;
  doc["type"] = "state";
  doc["v"] = 1;
  doc["level"] = reachedLevel();
  doc["target_level"] = motor.target;
  doc["running"] = motorRunning();
  if (rpmAvailable) doc["rpm"] = roundf(rpmValue * 10) / 10;
  else doc["rpm"] = nullptr;
  if (currentAvailable) doc["current"] = roundf(currentValue * 100) / 100;
  else doc["current"] = nullptr;
  const char *f = faultName(motor.fault);
  if (f) doc["fault"] = f;
  else doc["fault"] = nullptr;
  doc["source"] = sourceName(motor.source);
  String out;
  serializeJson(doc, out);
  return out;
}

/** Key of the fields whose change triggers an immediate broadcast (not continuous telemetry). */
static uint32_t stateKey() {
  return (uint32_t)reachedLevel() | ((uint32_t)motor.target << 4) | ((uint32_t)motorRunning() << 8) |
         ((uint32_t)motor.fault << 12) | ((uint32_t)motor.source << 16);
}

static void broadcastState() {
  if (ws.count() == 0) return;
  ws.textAll(stateJson());
}

// ---------------------------------------------------------------- WebSocket
static void handleWsText(AsyncWebSocketClient *client, const uint8_t *data, size_t len) {
  JsonDocument doc;
  if (deserializeJson(doc, data, len)) return;  // malformed: ignored, not a heartbeat
  const char *cmd = doc["cmd"];
  if (!cmd) return;
  Cmd c{CMD_PING, 0, client->id()};
  if (!strcmp(cmd, "ping")) c.type = CMD_PING;
  else if (!strcmp(cmd, "stop")) c.type = CMD_STOP;
  else if (!strcmp(cmd, "estop")) c.type = CMD_ESTOP;
  else if (!strcmp(cmd, "reset")) c.type = CMD_RESET;
  else if (!strcmp(cmd, "set_speed")) {
    if (!doc["level"].is<int>()) return;
    int lvl = doc["level"].as<int>();
    if (lvl < 0 || lvl > 3) return;
    c.type = CMD_SET_SPEED;
    c.level = (uint8_t)lvl;
  } else {
    return;  // unknown command: ignored
  }
  // E-stop must never be dropped: if the queue is full, wait briefly for space.
  xQueueSend(cmdQueue, &c, c.type == CMD_ESTOP ? pdMS_TO_TICKS(20) : 0);
}

static void onWsEvent(AsyncWebSocket *, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data,
                      size_t len) {
  switch (type) {
    case WS_EVT_CONNECT: {
      Serial.printf("[ws] client %u connected (%u total)\n", client->id(), ws.count());
      Cmd c{CMD_PING, 0, client->id()};  // loop() answers with the current state
      xQueueSend(cmdQueue, &c, 0);
      break;
    }
    case WS_EVT_DISCONNECT:
      Serial.printf("[ws] client %u disconnected\n", client->id());
      break;
    case WS_EVT_DATA: {
      AwsFrameInfo *info = (AwsFrameInfo *)arg;
      if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
        handleWsText(client, data, len);
      }
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------- IR remote
static void pollIr() {
  if (!IrReceiver.decode()) return;
  const IRData &d = IrReceiver.decodedIRData;
  if (!(d.flags & IRDATA_FLAGS_IS_REPEAT) && d.protocol != UNKNOWN) {
    Serial.printf("[ir] IR command 0x%02X (protocol %s)\n", d.command, getProtocolString(d.protocol));
    Cmd c{CMD_PING, 0, 0};
    bool known = true;
    switch (d.command) {
      case IR_KEY_0: c.type = CMD_STOP; break;
      case IR_KEY_1: c.type = CMD_SET_SPEED; c.level = 1; break;
      case IR_KEY_2: c.type = CMD_SET_SPEED; c.level = 2; break;
      case IR_KEY_3: c.type = CMD_SET_SPEED; c.level = 3; break;
      default: known = false;
    }
    if (known) {
      applyCommand(c, SRC_IR);
      broadcastState();
    }
  }
  IrReceiver.resume();
}

// ---------------------------------------------------------------- Telemetry
#if USE_HALL_RPM
static void IRAM_ATTR onHallPulse() {
  uint32_t now = micros();
  if (now - hallLastUs >= HALL_DEBOUNCE_US) {
    hallPulses++;
    hallLastUs = now;
  }
}
#endif

static void updateTelemetry(uint32_t dtMs) {
#if USE_HALL_RPM
  noInterrupts();
  uint32_t pulses = hallPulses;
  hallPulses = 0;
  interrupts();
  float instant = dtMs ? (pulses * 60000.0f) / (HALL_PULSES_PER_REV * (float)dtMs) : 0;
  rpmValue = rpmAvailable ? rpmValue * 0.6f + instant * 0.4f : instant;  // light smoothing
  rpmAvailable = true;
#else
  (void)dtMs;
#endif
#if USE_INA219
  if (currentAvailable) currentValue = fabsf(ina219.getCurrent_mA()) / 1000.0f;
#endif
}

// ---------------------------------------------------------------- Setup
void setup() {
  Serial.begin(115200);
  delay(50);
  Serial.printf("\n\nMOTION-X firmware %s\nNot a medical device. Prototype. Use under supervision.\n", FW_VERSION);
  Serial.flush();

  // 1) Motor first: stopped, ESC arming.
  escBegin();
  motor.armedAtMs = millis() + ESC_ARM_MS;
  Serial.printf("[esc] arming: holding %u us for %u ms\n", ESC_STOP_US, ESC_ARM_MS);
  Serial.flush();

  cmdQueue = xQueueCreate(16, sizeof(Cmd));

  // 2) Optional sensors.
#if USE_HALL_RPM
  pinMode(PIN_HALL, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_HALL), onHallPulse, FALLING);
  Serial.println(F("[telemetry] hall rpm enabled"));
#endif
#if USE_INA219
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  currentAvailable = ina219.begin();
  Serial.printf("[telemetry] INA219 %s\n", currentAvailable ? "found" : "NOT found (current = null)");
#endif

  // 3) IR receiver.
  IrReceiver.begin(PIN_IR, DISABLE_LED_FEEDBACK);

  // 4) Wi-Fi access point. The radio start draws a current spike; reduced TX power and a
  //    short settle delay help boards on weak USB supplies. Logs are flushed so a brownout
  //    reset still shows how far startup got.
  Serial.println(F("[wifi] starting radio..."));
  Serial.flush();
  delay(200);
  WiFi.mode(WIFI_AP);
  WiFi.setTxPower(AP_TX_POWER);
  WiFi.softAP(AP_SSID, AP_PASSWORD, AP_CHANNEL, 0, AP_MAX_CLIENTS);
  WiFi.setTxPower(AP_TX_POWER);
  WiFi.setSleep(false);  // lower latency for the heartbeat
  IPAddress ip = WiFi.softAPIP();
  Serial.printf("[wifi] AP \"%s\" at %s\n", AP_SSID, ip.toString().c_str());

  // Answer every DNS name with our IP so phones find the app.
  dns.start(53, "*", ip);

  // 5) Files + WebSocket.
  if (!LittleFS.begin(false)) {
    Serial.println(F("[fs] LittleFS not found. Upload the web app: see docs/firmware.md (uploadfs)."));
  }
  ws.onEvent(onWsEvent);
  server.addHandler(&ws);

  // Phone "is there internet?" checks: answer "yes" so the phone stays on this Wi-Fi.
  server.on("/generate_204", HTTP_GET, [](AsyncWebServerRequest *r) { r->send(204); });
  server.on("/gen_204", HTTP_GET, [](AsyncWebServerRequest *r) { r->send(204); });
  server.on("/hotspot-detect.html", HTTP_GET, [](AsyncWebServerRequest *r) {
    r->send(200, "text/html", "<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>");
  });
  server.on("/connecttest.txt", HTTP_GET, [](AsyncWebServerRequest *r) {
    r->send(200, "text/plain", "Microsoft Connect Test");
  });

  // Bench-test helper: current state as JSON (curl http://192.168.4.1/api/state).
  server.on("/api/state", HTTP_GET, [](AsyncWebServerRequest *r) {
    r->send(200, "application/json", stateJson());
  });

  // Web app (files are stored gzipped: index.html.gz etc.; served with Content-Encoding: gzip).
  server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html").setCacheControl("no-cache");
  server.onNotFound([](AsyncWebServerRequest *r) { r->redirect("/"); });
  server.begin();
  Serial.println(F("[http] ready: open http://192.168.4.1"));
}

// ---------------------------------------------------------------- Loop
void loop() {
  static uint32_t lastStepMs = millis();
  static uint32_t lastBroadcastMs = 0;
  static uint32_t lastTelemetryMs = 0;
  static uint32_t lastKey = 0xFFFFFFFF;
  static uint32_t lastCleanupMs = 0;

  dns.processNextRequest();

  // Apply queued WebSocket commands (each one is also a heartbeat).
  Cmd c;
  bool answered = false;
  while (xQueueReceive(cmdQueue, &c, 0) == pdTRUE) {
    applyCommand(c, SRC_APP);
    answered = true;
  }

  pollIr();

  const uint32_t now = millis();
  const uint32_t dt = now - lastStepMs;
  if (dt >= 10) {
    motorStep(dt);
    lastStepMs = now;
  }

  if (now - lastTelemetryMs >= 1000) {
    updateTelemetry(now - lastTelemetryMs);
    lastTelemetryMs = now;
  }

  // Broadcast on any change, after every command (protocol: the device answers), and once a second.
  const uint32_t key = stateKey();
  if (key != lastKey || answered || now - lastBroadcastMs >= STATE_INTERVAL_MS) {
    if (key != lastKey) Serial.printf("[state] %s\n", stateJson().c_str());
    broadcastState();
    lastKey = key;
    lastBroadcastMs = now;
  }

  if (now - lastCleanupMs >= 1000) {
    ws.cleanupClients(AP_MAX_CLIENTS);
    lastCleanupMs = now;
  }
}
