import { Component, type ComponentChildren } from 'preact';
import { t } from '../i18n';
import { Icon } from './Icon';

interface State {
  error: Error | null;
}

/**
 * Catches a crash in one screen and shows a calm error card instead of a blank page.
 * It wraps only the screen content, so the app shell (status badge and the emergency Stop
 * bar) keeps working. The machine also stops by itself if the app stops sending heartbeats.
 */
export class ErrorBoundary extends Component<{ children: ComponentChildren; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[MOTION-X] screen error', error);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Navigating to another screen clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section class="screen" role="alert">
        <div class="card empty">
          <span class="empty-ic" style={{ background: 'var(--warn-soft)', color: 'var(--warn-text)' }}>
            <Icon name="triangleAlert" />
          </span>
          <h1 style={{ fontSize: '22px' }}>{t('error.title')}</h1>
          <p class="muted">{t('error.text')}</p>
          <button type="button" class="btn btn-primary btn-lg btn-block" onClick={() => location.reload()}>
            <Icon name="rotateCw" />
            {t('error.reload')}
          </button>
          <details class="muted small" style={{ textAlign: 'left', width: '100%' }}>
            <summary>{t('error.details')}</summary>
            <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(this.state.error.message)}</code>
          </details>
        </div>
      </section>
    );
  }
}
