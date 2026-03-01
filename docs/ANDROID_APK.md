# Nodle en application Android (APK)

L’application web Nodle peut être packagée en **APK Android** avec Capacitor. L’interface est la même ; le backend (API + signaling) reste sur un serveur : en établissement, configurez l’URL dans l’app via « Serveur de l’établissement ».

## Prérequis

- Node.js (LTS)
- **Android Studio** (ou SDK Android + Gradle)
- JDK 17

## Étapes

### 1. Ajouter la plateforme Android (une seule fois)

À la racine du projet Nodle :

```bash
cd frontend
npm install
npx cap add android
```

Cela crée le dossier `frontend/android/` (projet Android natif).

### 2. Construire le frontend et synchroniser

À chaque modification du frontend à inclure dans l’APK :

```bash
cd frontend
npm run cap:sync
```

Cela exécute `npm run build` puis copie `dist/` dans le projet Android.

### 3. Ouvrir dans Android Studio ou lancer sur un appareil

```bash
cd frontend
npm run cap:android
```

Ou manuellement : ouvrir le dossier `frontend/android` dans Android Studio, puis **Build → Build Bundle(s) / APK(s) → Build APK(s)**. L’APK se trouve dans `android/app/build/outputs/apk/`.

Pour lancer sur un émulateur ou un appareil connecté :

```bash
npx cap run android
```

### 4. Utilisation de l’app sur téléphone

- Au premier lancement, dans Nodle, ouvrez « Serveur de l’établissement » et saisissez l’URL de votre instance (ex. `https://nodle.mon-ecole.fr`). Les appels API et le WebSocket utiliseront cette URL.
- Si vous ne configurez rien, l’app utilise l’origine par défaut (même serveur que celui qui a servi l’app, ou localhost en dev).

## Résumé des commandes

| Action              | Commande              |
|---------------------|------------------------|
| Ajouter Android     | `npx cap add android`  |
| Build + sync        | `npm run cap:sync`     |
| Ouvrir Android Studio | `npm run cap:android` |
| Lancer sur appareil | `npx cap run android`  |

## Mode Java, Web et Android

- **Mode logiciel Java** : un seul JAR sert le backend et le frontend (voir README, section « Mode logiciel Java »).
- **Mode web** : frontend (Vite) et backend (Spring Boot) séparés ; on ouvre l’app dans le navigateur.
- **Mode Android** : même frontend, packagé en APK ; le backend reste sur un serveur (ou en mode JAR sur une machine du réseau).
