/**
 * Contexte React pour les réglages Nodle. Applique le thème (clair/sombre) et persiste en localStorage.
 */

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { NodleSettings } from './types';
import { loadSettings, saveSettings } from './storage';

type SettingsContextValue = {
  settings: NodleSettings;
  update: (partial: Partial<NodleSettings>) => void;
};

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<NodleSettings>(loadSettings);

  const update = useCallback((partial: Partial<NodleSettings>) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        ...(partial.video && { video: { ...prev.video, ...partial.video } }),
        ...(partial.audio && { audio: { ...prev.audio, ...partial.audio } }),
        ...(partial.appearance && { appearance: { ...prev.appearance, ...partial.appearance } }),
        ...(partial.notifications && { notifications: { ...prev.notifications, ...partial.notifications } }),
        ...(partial.audioBehavior && { audioBehavior: { ...prev.audioBehavior, ...partial.audioBehavior } }),
        ...(partial.network && { network: { ...prev.network, ...partial.network } }),
      };
      saveSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);

  const theme = settings.appearance.theme;
  const resolved = theme === 'system'
    ? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
    if (settings.appearance.reducedMotion) {
      document.documentElement.setAttribute('data-reduced-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-reduced-motion');
    }
  }, [resolved, settings.appearance.reducedMotion]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
