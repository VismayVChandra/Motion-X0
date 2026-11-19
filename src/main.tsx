import { render } from 'preact';
import { App } from './app';
import { startDevice } from './device/instance';
import { startThemeSync } from './ui/theme';
import './styles.css';

startThemeSync();
startDevice();
render(<App />, document.getElementById('app')!);
