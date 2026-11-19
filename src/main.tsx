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
