/** Injected by Vite from package.json. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** "1" when building the copy served by the ESP32 (npm run build:device). */
  readonly VITE_DEVICE_BUILD?: string;
}
