import { render } from 'preact';
import { App } from './app';
import { startThemeSync } from './ui/theme';
import './styles.css';

startThemeSync();
render(<App />, document.getElementById('app')!);
