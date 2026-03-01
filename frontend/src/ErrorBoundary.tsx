/**
 * Périmètre d'erreur React : évite qu'une exception dans l'arbre de composants
 * (ex. visioconférence) ne fasse planter toute l'application. Affiche un fallback
 * avec message et bouton « Réessayer ».
 * @module ErrorBoundary
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from './logger';

const MODULE = 'ErrorBoundary';

type Props = {
  /** Enfants à protéger */
  children: ReactNode;
  /** Contenu affiché en cas d'erreur (optionnel) */
  fallback?: ReactNode;
  /** Callback appelé quand une erreur est capturée */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    try {
      return { hasError: true, error };
    } catch (e) {
      logger.error(MODULE, 'getDerivedStateFromError', e);
      return { hasError: true, error };
    } finally {
      // no cleanup
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    try {
      logger.error(MODULE, 'componentDidCatch', error.message, errorInfo.componentStack);
      this.props.onError?.(error, errorInfo);
    } catch (e) {
      logger.error(MODULE, 'onError callback failed', e);
    } finally {
      // no cleanup
    }
  }

  render() {
    try {
      if (this.state.hasError && this.state.error) {
        if (this.props.fallback) return this.props.fallback;
        return (
          <div style={styles.container}>
            <p style={styles.title}>Une erreur est survenue</p>
            <p style={styles.message}>{this.state.error.message}</p>
            <button
              type="button"
              style={styles.button}
              onClick={() => {
                try {
                  this.setState({ hasError: false, error: null });
                  logger.info(MODULE, 'retry clicked');
                } catch (e) {
                  logger.warn(MODULE, 'setState on retry failed', e);
                } finally {
                  // no cleanup
                }
              }}
            >
              Réessayer
            </button>
          </div>
        );
      }
      return this.props.children;
    } catch (e) {
      logger.error(MODULE, 'render failed', e);
      return (
        <div style={styles.container}>
          <p style={styles.title}>Erreur d'affichage</p>
          <p style={styles.message}>{String(e)}</p>
        </div>
      );
    } finally {
      // no cleanup
    }
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '2rem',
    textAlign: 'center',
    background: 'var(--surface)',
    color: 'var(--text)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
  },
  title: { margin: 0, fontSize: '1.25rem', fontWeight: 600 },
  message: { margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' },
  button: {
    padding: '0.5rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
  },
};
