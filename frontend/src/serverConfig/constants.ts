/**
 * Configuration du serveur établissement : constantes partagées.
 */

export const STORAGE_KEY = 'nodle_server_url';

/** Longueur max de l’URL stockée (éviter abus). */
export const MAX_URL_LENGTH = 512;

/** Protocoles autorisés pour le serveur (éviter javascript:, data:, etc.). */
export const ALLOWED_PROTOCOLS = ['https:', 'http:'] as const;

/** En production (origin HTTPS), n’accepter que HTTPS pour le serveur personnalisé (sauf localhost). */
export function isSecureContext(): boolean {
  if (typeof location === 'undefined') return false;
  return location.protocol === 'https:';
}
