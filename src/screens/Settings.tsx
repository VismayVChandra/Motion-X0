import { settingsStore, type Role, type ThemePref } from '../store/settings';

export function Settings() {
  const s = settingsStore.settings.value;
  const update = settingsStore.update;

  return (
    <section class="screen">
      <h1>Settings</h1>

      <div class="card stack">
        <h2>Device</h2>
        <label class="row-toggle">
          <span>
            <strong>Demo mode</strong>
            <small>Use a simulated device. Everything works without hardware.</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={s.demoMode}
            onChange={(e) => update({ demoMode: e.currentTarget.checked })}
          />
        </label>
        <label class="field">
          <span>Device address</span>
          <input
            type="url"
            inputMode="url"
            value={s.deviceUrl}
            disabled={s.demoMode}
            spellcheck={false}
            onChange={(e) => update({ deviceUrl: e.currentTarget.value.trim() })}
          />
          <small>Default ws://192.168.4.1/ws (the MOTION-X Wi-Fi hotspot).</small>
        </label>
      </div>

      <div class="card stack">
        <h2>Appearance</h2>
        <fieldset class="segmented">
          <legend>Theme</legend>
          {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
            <label key={t}>
              <input type="radio" name="theme" checked={s.theme === t} onChange={() => update({ theme: t })} />
              <span>{t[0].toUpperCase() + t.slice(1)}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div class="card stack">
        <h2>Role</h2>
        <fieldset class="segmented">
          <legend>Who is using this device?</legend>
          {(['patient', 'therapist'] as Role[]).map((r) => (
            <label key={r}>
              <input type="radio" name="role" checked={s.role === r} onChange={() => update({ role: r })} />
              <span>{r[0].toUpperCase() + r.slice(1)}</span>
            </label>
          ))}
        </fieldset>
        <small class="muted">Local switch for the prototype. No login.</small>
      </div>

      <button type="button" class="btn btn-ghost" onClick={() => settingsStore.reset()}>
        Reset settings
      </button>
    </section>
  );
}
