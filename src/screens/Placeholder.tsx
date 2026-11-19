import type { ComponentChildren } from 'preact';

/** Temporary screen body for features that arrive in later waves. */
export function Placeholder({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="screen">
      <h1>{title}</h1>
      <div class="card muted">{children}</div>
    </section>
  );
}
