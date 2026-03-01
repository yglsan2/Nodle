/**
 * Logger minimal pour Nodle : préfixe par module, niveaux info/warn/error.
 * Permet de tracer le flux et les erreurs sans dépendance externe.
 * Chaque méthode respecte try/catch/finally pour ne jamais faire planter l'app.
 * @module logger
 */

const PREFIX = '[Nodle]';

export const logger = {
  /**
   * Log informatif (connexion, envoi, état).
   * @param module - Nom du module (ex. "Signaling", "WebRTC")
   * @param message - Message court
   * @param args - Arguments additionnels (objets, erreurs)
   */
  info(module: string, message: string, ...args: unknown[]) {
    try {
      console.log(`${PREFIX}[${module}]`, message, ...args);
    } catch {
      // ne pas faire planter si console indisponible
    } finally {
      // no cleanup
    }
  },

  /**
   * Avertissement (échec non bloquant, reconnexion, parse error).
   * @param module - Nom du module
   * @param message - Message court
   * @param args - Arguments additionnels
   */
  warn(module: string, message: string, ...args: unknown[]) {
    try {
      console.warn(`${PREFIX}[${module}]`, message, ...args);
    } catch {
      // no-op
    } finally {
      // no cleanup
    }
  },

  /**
   * Erreur (exception, échec critique).
   * @param module - Nom du module
   * @param message - Message court
   * @param args - Arguments additionnels (souvent l'exception)
   */
  error(module: string, message: string, ...args: unknown[]) {
    try {
      console.error(`${PREFIX}[${module}]`, message, ...args);
    } catch {
      // no-op
    } finally {
      // no cleanup
    }
  },
};
