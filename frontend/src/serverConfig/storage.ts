/**
 * Persistance de l’URL du serveur établissement (localStorage).
 * Gestion des erreurs (quota, désactivé, navigation privée).
 */

import { STORAGE_KEY } from './constants';
import { normalizeServerUrl } from './validation';

export type StorageResult = { success: true; url: string } | { success: false; error: string };

function isStorageAvailable(): boolean {
  try {
    const key = '__nodle_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lit l’URL stockée. Retourne une chaîne vide si absente ou en erreur.
 */
export function readStoredServerUrl(): string {
  if (typeof window === 'undefined') return '';
  if (!isStorageAvailable()) return '';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const t = raw != null ? raw.trim() : '';
    if (!t) return '';
    const normalized = normalizeServerUrl(t);
    return normalized;
  } catch {
    return '';
  }
}

/**
 * Enregistre l’URL (normalisée). Vide = suppression.
 */
export function writeStoredServerUrl(url: string): StorageResult {
  const normalized = normalizeServerUrl(url);
  if (typeof window === 'undefined') {
    return { success: true, url: normalized };
  }
  if (!isStorageAvailable()) {
    return { success: false, error: 'Stockage local indisponible.' };
  }
  try {
    if (normalized) {
      localStorage.setItem(STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    return { success: true, url: normalized };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Impossible d’enregistrer.',
    };
  }
}
