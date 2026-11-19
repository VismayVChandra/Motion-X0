import { useState } from 'preact/hooks';
import { displayDeviceAddress, normalizeDeviceUrl } from '../device/url';
import { settingsStore, type Role, type ThemePref } from '../store/settings';
import { Icon } from '../ui/Icon';
import { Seg, Switch } from '../ui/controls';

export function Settings() {
  const s = settingsStore.settings.value;
  const update = settingsStore.update;
  const [addr, setAddr] = useState(displayDeviceAddress(s.deviceUrl));
  const [addrError, setAddrError] = useState<string | null>(null);

  const saveAddress = () => {
    const url = normalizeDeviceUrl(addr);
    if (!url) {
      setAddrError('Enter an address like 192.168.4.1');
      return;
    }
    setAddrError(null);
    setAddr(displayDeviceAddress(url));
    if (url !== s.deviceUrl) update({ deviceUrl: url });
  };

  return (
    <section class="screen" aria-labelledby="settings-title">
      <h1 id="settings-title">Settings</h1>

      <section class="card" style={{ gap: 0 }} aria-label="Device">
        <p class="eyebrow" style={{ marginBottom: '4px' }}>
          Device
        </p>
        <div class="set-row first">
          <div class="set-left">
            <span class="set-ic">
              <Icon name="flask" />
            </span>
            <div>
              <strong>Demo mode</strong>
              <span class="desc">Uses a simulated machine. Nothing moves.</span>
            </div>
          </div>
          <Switch checked={s.demoMode} label="Demo mode" onChange={(v) => update({ demoMode: v })} />
        </div>
        <div class="set-row column">
          <div class="set-left">
            <span class="set-ic">
              <Icon name="router" />
            </span>
            <div>
              <strong>
                <label for="device-addr">Device address</label>
              </strong>
              <span class="desc">Used when Demo mode is off</span>
            </div>
          </div>
          <input
            id="device-addr"
            class="input"
            value={addr}
            inputMode="url"
            autoComplete="off"
            spellcheck={false}
            aria-invalid={addrError ? true : undefined}
            aria-describedby={addrError ? 'device-addr-err' : undefined}
            onInput={(e) => setAddr(e.currentTarget.value)}
            onBlur={saveAddress}
            onKeyDown={(e) => e.key === 'Enter' && saveAddress()}
          />
          {addrError && (
            <span id="device-addr-err" class="field-error">
              {addrError}
            </span>
          )}
        </div>
      </section>

      <section class="card" style={{ gap: 0 }} aria-label="Display">
        <p class="eyebrow" style={{ marginBottom: '4px' }}>
          Display
        </p>
        <div class="set-row first column">
          <div class="set-left">
            <span class="set-ic">
              <Icon name="sunMoon" />
            </span>
            <strong>Theme</strong>
          </div>
          <Seg<ThemePref>
            compact
            label="Theme"
            value={s.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'light', main: 'Light' },
              { value: 'dark', main: 'Dark' },
              { value: 'system', main: 'Auto' },
            ]}
          />
        </div>
      </section>

      <section class="card" style={{ gap: 0 }} aria-label="Who is using the app">
        <p class="eyebrow" style={{ marginBottom: '4px' }}>
          Who is using the app?
        </p>
        <div class="set-row first column">
          <Seg<Role>
            compact
            label="Role"
            value={s.role}
            onChange={(role) => update({ role })}
            options={[
              { value: 'patient', main: 'Patient' },
              { value: 'therapist', main: 'Therapist' },
            ]}
          />
          <span class="muted small">A simple local switch for the prototype. No login.</span>
        </div>
      </section>

      <button
        type="button"
        class="btn btn-ghost btn-block"
        onClick={() => {
          settingsStore.reset();
          setAddr(displayDeviceAddress(settingsStore.settings.peek().deviceUrl));
          setAddrError(null);
        }}
      >
        <Icon name="rotateCcw" />
        Reset settings
      </button>
      <p class="muted" style={{ textAlign: 'center', fontSize: '14px' }}>
        MOTION-X app {__APP_VERSION__} · student prototype
      </p>
    </section>
  );
}
