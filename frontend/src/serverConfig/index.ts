/**
 * Serveur de l’établissement : configuration, validation, persistance.
 * Permet aux écoles, AFPA, entreprises de pointer vers leur instance Nodle.
 */

export { ServerConfigProvider, useServerConfig } from './context';
export type { ServerConfigValue } from './context';
export { ServerConfigPanel } from './ServerConfigPanel';
export { validateServerUrl, normalizeServerUrl } from './validation';
export type { ValidationResult } from './validation';
export { readStoredServerUrl, writeStoredServerUrl } from './storage';
export type { StorageResult } from './storage';
export { STORAGE_KEY, MAX_URL_LENGTH } from './constants';
