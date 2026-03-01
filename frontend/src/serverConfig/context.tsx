import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { readStoredServerUrl, writeStoredServerUrl } from './storage';
import { STORAGE_KEY } from './constants';

export type ServerConfigValue = {
  /** URL de base du serveur (ex. https://nodle.mon-ecole.fr). Vide = même origine. */
  serverBaseUrl: string;
  /** Préfixe pour les appels API (ex. https://nodle.mon-ecole.fr/api ou /api) */
  apiBase: string;
  /** Origine WebSocket (ex. wss://nodle.mon-ecole.fr) pour signaling par défaut */
  wsOrigin: string;
  /** Définit le serveur (URL normalisée). Retourne un message d’erreur éventuel. */
  setServerBaseUrl: (url: string) => string | null;
  /** Revient au serveur par défaut (même origine). */
  clearServer: () => void;
};

function buildWsOrigin(serverBaseUrl: string): string {
  if (!serverBaseUrl) {
    return typeof location !== 'undefined'
      ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`
      : '';
  }
  try {
    const u = new URL(serverBaseUrl);
    return (u.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + u.host;
  } catch {
    return serverBaseUrl.replace(/^http/, 'ws');
  }
}

const defaultValue: ServerConfigValue = {
  serverBaseUrl: '',
  apiBase: '/api',
  wsOrigin: typeof location !== 'undefined' ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}` : '',
  setServerBaseUrl: () => null,
  clearServer: () => {},
};

const ServerConfigContext = React.createContext<ServerConfigValue>(defaultValue);

export function ServerConfigProvider({ children }: { children: React.ReactNode }) {
  const [serverBaseUrl, setServerBaseUrlState] = useState(readStoredServerUrl);

  const setServerBaseUrl = useCallback((url: string): string | null => {
    const result = writeStoredServerUrl(url);
    if (result.success) {
      setServerBaseUrlState(result.url);
      return null;
    }
    return result.error;
  }, []);

  const clearServer = useCallback(() => {
    const result = writeStoredServerUrl('');
    if (result.success) {
      setServerBaseUrlState('');
    }
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== undefined) {
        setServerBaseUrlState(readStoredServerUrl());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const apiBase = useMemo(
    () => (serverBaseUrl ? `${serverBaseUrl}/api` : '/api'),
    [serverBaseUrl]
  );

  const wsOrigin = useMemo(() => buildWsOrigin(serverBaseUrl), [serverBaseUrl]);

  const value = useMemo<ServerConfigValue>(
    () => ({
      serverBaseUrl,
      apiBase,
      wsOrigin,
      setServerBaseUrl,
      clearServer,
    }),
    [serverBaseUrl, apiBase, wsOrigin, setServerBaseUrl, clearServer]
  );

  return (
    <ServerConfigContext.Provider value={value}>
      {children}
    </ServerConfigContext.Provider>
  );
}

export function useServerConfig(): ServerConfigValue {
  const ctx = React.useContext(ServerConfigContext);
  return ctx ?? defaultValue;
}
