import { hrefFor, route } from './router';
import { Shell } from './ui/Shell';
import { Placeholder } from './screens/Placeholder';
import { Settings } from './screens/Settings';

function Screen() {
  switch (route.value) {
    case 'home':
      return (
        <Placeholder title="Welcome">
          <p>MOTION-X supports guided lower-limb exercise with exercise tracking.</p>
          <p>Today's plan and sessions arrive in a later version.</p>
          <a class="btn btn-primary" href={hrefFor('device')}>
            Go to device
          </a>
        </Placeholder>
      );
    case 'device':
      return (
        <Placeholder title="Device">
          <p>Connection and motor controls arrive in Wave 1.</p>
        </Placeholder>
      );
    case 'history':
      return (
        <Placeholder title="History">
          <p>No sessions yet. Your exercise history will appear here.</p>
        </Placeholder>
      );
    case 'settings':
      return <Settings />;
  }
}

export function App() {
  return (
    <Shell>
      <Screen />
    </Shell>
  );
}
