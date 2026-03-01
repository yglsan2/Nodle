import React, { useCallback, useEffect, useState } from 'react';
import { useServerConfig } from './context';
import { validateServerUrl } from './validation';

export function ServerConfigPanel() {
  const { serverBaseUrl, setServerBaseUrl, clearServer } = useServerConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(serverBaseUrl);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [lastAppliedUrl, setLastAppliedUrl] = useState(serverBaseUrl);

  const syncInputFromConfig = useCallback(() => {
    setInputValue(serverBaseUrl);
    setLastAppliedUrl(serverBaseUrl);
    setValidationError(null);
    setStorageError(null);
  }, [serverBaseUrl]);

  useEffect(() => {
    if (isOpen) {
      syncInputFromConfig();
    }
  }, [isOpen, syncInputFromConfig]);

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'pending' | 'ok' | 'error'>('idle');

  const handleApply = useCallback(async () => {
    setStorageError(null);
    setConnectionStatus('idle');
    const result = validateServerUrl(inputValue);
    if (!result.ok) {
      setValidationError(result.message);
      return;
    }
    setValidationError(null);
    const err = setServerBaseUrl(result.url);
    if (err) {
      setStorageError(err);
      return;
    }
    setLastAppliedUrl(result.url);
    setInputValue(result.url);

    if (!result.url) {
      setConnectionStatus('idle');
      return;
    }
    setConnectionStatus('pending');
    const healthUrl = `${result.url}/api/health`;
    try {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(healthUrl, { method: 'GET', signal: ctrl.signal });
      clearTimeout(timeoutId);
      setConnectionStatus(res.ok ? 'ok' : 'error');
    } catch {
      setConnectionStatus('error');
    }
  }, [inputValue, setServerBaseUrl]);

  const handleClear = useCallback(() => {
    setValidationError(null);
    setStorageError(null);
    setConnectionStatus('idle');
    clearServer();
    setInputValue('');
    setLastAppliedUrl('');
  }, [clearServer]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (validationError) setValidationError(null);
    if (storageError) setStorageError(null);
  };

  const handleInputBlur = () => {
    const result = validateServerUrl(inputValue);
    setValidationError(result.ok ? null : result.message);
  };

  const validation = validateServerUrl(inputValue);
  const normalizedInput = validation.ok ? validation.url : '';
  const isUnchanged =
    (inputValue.trim() === '' && lastAppliedUrl === '') || normalizedInput === lastAppliedUrl;
  const hasValidationError = !validation.ok && inputValue.trim() !== '';
  const applyDisabled = isUnchanged || hasValidationError;

  const errorMessage = validationError ?? storageError;

  return (
    <section style={styles.section} aria-labelledby="server-config-heading">
      <button
        type="button"
        id="server-config-heading"
        onClick={() => setIsOpen((v) => !v)}
        style={styles.toggle}
        aria-expanded={isOpen}
        aria-controls="server-config-panel"
      >
        {isOpen ? '− Masquer' : '+ Serveur de l’établissement'}
      </button>
      {isOpen && (
        <div id="server-config-panel" role="region" style={styles.panel}>
          <p id="server-config-desc" style={styles.hint}>
            Écoles, AFPA, entreprises : indiquez l’URL de votre instance Nodle (ex. https://nodle.mon-ecole.fr).
            Laissez vide pour utiliser le serveur par défaut.
          </p>
          <label htmlFor="server-config-input" style={styles.label}>
            URL du serveur
          </label>
          <input
            id="server-config-input"
            type="url"
            inputMode="url"
            autoComplete="url"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder="https://nodle.mon-etablissement.fr"
            style={{
              ...styles.input,
              ...(errorMessage ? styles.inputError : {}),
            }}
            aria-describedby={errorMessage ? 'server-config-error' : 'server-config-desc'}
            aria-invalid={!!errorMessage}
          />
          {errorMessage && (
            <p id="server-config-error" role="alert" style={styles.error}>
              {errorMessage}
            </p>
          )}
          <div style={styles.actions}>
            <button
              type="button"
              onClick={handleApply}
              disabled={applyDisabled}
              style={styles.button}
              aria-describedby="server-config-desc"
            >
              Appliquer
            </button>
            {serverBaseUrl ? (
              <button type="button" onClick={handleClear} style={styles.buttonSecondary}>
                Utiliser le serveur par défaut
              </button>
            ) : null}
          </div>
          {serverBaseUrl ? (
            <p style={styles.active} aria-live="polite">
              Serveur actif : <strong>{serverBaseUrl}</strong>
              {connectionStatus === 'ok' && <span style={styles.statusOk}> · Joignable</span>}
              {connectionStatus === 'error' && (
                <span style={styles.statusError}> · Injoignable (vérifiez l’URL et CORS)</span>
              )}
              {connectionStatus === 'pending' && <span style={styles.statusPending}> · Vérification…</span>}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid var(--border)',
  },
  toggle: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    padding: '0.5rem 0',
    cursor: 'pointer',
  },
  panel: { marginTop: '0.75rem' },
  hint: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    margin: '0 0 0.5rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.35rem',
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
  },
  input: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    marginBottom: '0.5rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '1rem',
  },
  inputError: {
    borderColor: 'var(--danger)',
  },
  error: {
    color: 'var(--danger)',
    fontSize: '0.85rem',
    margin: '0 0 0.5rem',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  button: {
    padding: '0.5rem 1rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  buttonSecondary: {
    padding: '0.5rem 1rem',
    background: 'var(--surface-hover)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  active: {
    fontSize: '0.85rem',
    color: 'var(--accent)',
    margin: 0,
  },
  statusOk: { color: 'var(--text-muted)', fontWeight: 'normal' },
  statusError: { color: 'var(--danger)', fontWeight: 'normal' },
  statusPending: { color: 'var(--text-muted)', fontStyle: 'italic' },
};
