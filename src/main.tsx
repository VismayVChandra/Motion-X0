import { render } from 'preact';
import { App } from './app';
import { startDevice } from './device/instance';
import { startSessions } from './session/instance';
import { startThemeSync } from './ui/theme';
import './styles.css';

startThemeSync();
startDevice();
startSessions();
render(<App />, document.getElementById('app')!);
