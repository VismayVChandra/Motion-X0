import type { ComponentChildren } from 'preact';

export function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <span class="switch-wrap">
      <span aria-hidden="true">{checked ? 'On' : 'Off'}</span>
      <button
        type="button"
        class="switch"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      />
    </span>
  );
}

export interface SegOption<T> {
  value: T;
  main: ComponentChildren;
  sub?: ComponentChildren;
}

/** Radio-group of big buttons (design: `.seg`). */
export function Seg<T extends string | number>({
  options,
  value,
  label,
  compact,
  onChange,
}: {
  options: SegOption<T>[];
  value: T;
  label: string;
  compact?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div class={`seg${compact ? ' compact' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          class="seg-btn"
          role="radio"
          aria-checked={o.value === value}
          aria-label={typeof o.main === 'string' ? o.main : undefined}
          onClick={() => onChange(o.value)}
        >
          <span class="seg-main">{o.main}</span>
          {o.sub && <span class="seg-sub">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}
