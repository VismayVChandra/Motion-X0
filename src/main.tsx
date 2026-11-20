import { render } from 'preact';
import { App } from './app';
import { startDevice } from './device/instance';
import { runner, startSessions } from './session/instance';
import { startVoice } from './voice/voice';
import { startThemeSync } from './ui/theme';
import './styles.css';

startThemeSync();
startDevice();
startSessions();
startVoice(runner);
render(<App />, document.getElementById('app')!);

// Installable / offline PWA on secure origins (Vercel, localhost). The ESP32 copy is plain
// HTTP, where service workers are not allowed and not needed.
if (import.meta.env.PROD && import.meta.env.VITE_DEVICE_BUILD !== '1' && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}
