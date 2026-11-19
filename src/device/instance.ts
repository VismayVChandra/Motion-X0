import { effect, signal, untracked } from '@preact/signals';
import { settingsStore } from '../store/settings';
import { DeviceController } from './controller';
import { RealDevice } from './real';
import { SimDevice } from './sim';

/** App-wide device controller. Demo mode → SimDevice, otherwise RealDevice at the saved address. */
export const device = new DeviceController(() => {
  const s = settingsStore.settings.peek();
  return s.demoMode ? new SimDevice() : new RealDevice(s.deviceUrl);
});

/** Ticks once per second, for "12 s ago" and retry countdowns. */
export const now = signal(Date.now());

let started = false;

export function startDevice(): void {
  if (started) return;
  started = true;
  setInterval(() => (now.value = Date.now()), 1000);

  // Swap the client when Demo mode or the address changes.
  let key = '';
  effect(() => {
    const { demoMode, deviceUrl } = settingsStore.settings.value;
    const next = `${demoMode}|${deviceUrl}`;
    if (key && next !== key) untracked(() => device.reconfigure());
    key = next;
  });

  // Connect on launch: the app is normally opened from the device itself.
  void device.connect();

  // Stop the motor if the page is closed or reloaded mid-session.
  window.addEventListener('pagehide', () => {
    if (device.active.peek()) device.stop();
  });
}
