/**
 * Validation et normalisation de l’URL du serveur établissement.
 * Logique pure, testable sans DOM.
 */

import { ALLOWED_PROTOCOLS, MAX_URL_LENGTH, isSecureContext } from './constants';

export type ValidationResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'protocol' | 'length' | 'origin'; message: string };

/**
 * Normalise une entrée utilisateur en une origine valide (sans chemin, sans query).
 * Retourne une chaîne vide si l’entrée est vide ou invalide.
 */
export function normalizeServerUrl(input: string): string {
  const t = input.trim();
  if (!t) return '';
  try {
    const url = new URL(t.startsWith('http') ? t : `https://${t}`);
    return url.origin;
  } catch {
    return '';
  }
}

/**
 * Valide l’URL du serveur : format, protocole, longueur, et (optionnel) refus du même origin
 * pour éviter de pointer inutilement vers soi-même.
 */
export function validateServerUrl(input: string): ValidationResult {
  const t = input.trim();
  if (!t) {
    return { ok: true, url: '' };
  }

  if (t.length > MAX_URL_LENGTH) {
    return {
      ok: false,
      reason: 'length',
      message: `URL trop longue (max ${MAX_URL_LENGTH} caractères).`,
    };
  }

  let url: URL;
  try {
    url = new URL(t.startsWith('http') ? t : `https://${t}`);
  } catch {
    return {
      ok: false,
      reason: 'invalid',
      message: 'URL invalide. Ex. : https://nodle.mon-etablissement.fr',
    };
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol as (typeof ALLOWED_PROTOCOLS)[number])) {
    return {
      ok: false,
      reason: 'protocol',
      message: 'Seuls http et https sont autorisés.',
    };
  }

  if (isSecureContext() && url.protocol === 'http:' && url.hostname !== 'localhost' && !url.hostname.endsWith('.localhost')) {
    return {
      ok: false,
      reason: 'protocol',
      message: 'En HTTPS, le serveur doit utiliser HTTPS (sauf localhost).',
    };
  }

  if (typeof location !== 'undefined' && url.origin === location.origin) {
    return {
      ok: false,
      reason: 'origin',
      message: 'Cette URL est déjà le serveur actuel. Laissez vide pour le défaut.',
    };
  }

  return { ok: true, url: url.origin };
}
