# Serveur de l’établissement

Module qui permet aux **écoles, AFPA, entreprises** de pointer l’application vers leur propre instance Nodle (leur serveur) pour plus d’efficacité et de maîtrise.

## Architecture

- **`constants.ts`** : clé localStorage, limites (longueur URL), protocoles autorisés, détection contexte sécurisé (HTTPS).
- **`validation.ts`** : logique **pure** de validation et normalisation d’URL (testable sans DOM). Retourne un `ValidationResult` (ok + url normalisée, ou erreur avec message).
- **`storage.ts`** : lecture/écriture localStorage avec gestion d’erreurs (quota, stockage désactivé). Expose `readStoredServerUrl` et `writeStoredServerUrl`.
- **`context.tsx`** : React Context qui expose `serverBaseUrl`, `apiBase`, `wsOrigin`, `setServerBaseUrl` (retourne une erreur éventuelle), `clearServer`. Écoute l’événement `storage` pour synchroniser les onglets.
- **`ServerConfigPanel.tsx`** : UI (landing) : champ URL, validation en temps réel, boutons Appliquer / Utiliser le serveur par défaut, vérification de connectivité (GET /api/health) après application.
- **`index.ts`** : réexport des symboles publics.

## Flux

1. Au chargement, le contexte lit `readStoredServerUrl()` et initialise l’état.
2. Tous les appels API et le signaling utilisent `apiBase` et `wsOrigin` (via `useServerConfig()`).
3. L’utilisateur peut ouvrir « Serveur de l’établissement », saisir une URL, appliquer. La validation refuse les URLs invalides, les protocoles non autorisés (ex. `javascript:`), et en HTTPS exige HTTPS pour le serveur (sauf localhost).
4. En cas d’erreur d’écriture (localStorage), `setServerBaseUrl` retourne un message affiché dans le panel.
5. Après application, un GET vers `/api/health` indique si le serveur est joignable (sans bloquer l’usage).

## Sécurité

- Seuls les protocoles `http:` et `https:` sont acceptés.
- En contexte sécurisé (page en HTTPS), le serveur personnalisé doit être en HTTPS (sauf localhost).
- Longueur max de l’URL (constante `MAX_URL_LENGTH`) pour limiter les abus.
- Pas de redirection ouverte : on ne fait que préfixer les requêtes par l’origine configurée.
