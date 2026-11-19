import { route } from './router';
import { DeviceScreen } from './screens/DeviceScreen';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { LiveSession } from './screens/LiveSession';
import { SessionDone } from './screens/SessionDone';
import { SessionSetup } from './screens/SessionSetup';
import { Settings } from './screens/Settings';
import { TherapistDashboard } from './screens/Therapist';
import { settingsStore } from './store/settings';
import { Shell } from './ui/Shell';

function Screen() {
  switch (route.value) {
    case 'home':
      return settingsStore.settings.value.role === 'therapist' ? <TherapistDashboard /> : <Home />;
    case 'device':
      return <DeviceScreen />;
    case 'history':
      return <History />;
    case 'settings':
      return <Settings />;
    case 'setup':
      return <SessionSetup />;
    case 'live':
      return <LiveSession />;
    case 'done':
      return <SessionDone />;
  }
}

export function App() {
  return (
    <Shell>
      <Screen />
    </Shell>
  );
}
