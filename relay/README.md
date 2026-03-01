# Relais de signaling Nodle

Relais WebSocket **sans état** : il ne fait que transférer les messages entre participants d’une même salle (même protocole que le backend Java). Aucun stockage, aucune logique métier.

## Pourquoi ?

Pour qu’un **petit groupe** puisse se connecter en visio et au chat **sans héberger le backend Nodle** : chaque participant pointe son navigateur vers ce relais (ou un relais public). Les flux audio/vidéo restent en P2P (WebRTC) ; seul le signaling (offres, réponses, ICE, chat, etc.) passe par le relais.

## Démarrage

```bash
cd relay
npm install
npm start
```

Par défaut le relais écoute sur le port **9090**.

## Utilisation côté client

- **Avec le backend Nodle** : dans `application.properties`, définir  
  `nodle.signaling.ws-url=ws://localhost:9090`  
  Le client récupère cette URL via `/api/config` et s’y connecte.

- **Sans backend (100 % sans serveur Nodle)** : ouvrir l’app avec le paramètre d’URL  
  `?signaling=ws://localhost:9090`  
  (ou l’URL du relais déployé). Le client se connecte directement au relais. Les appels à `/api/config` échoueront ; prévoir des valeurs par défaut (ex. STUN Google) si besoin.

## Partage d’espace

Avec ce relais, le **chat** et le **tableau blanc** circulent comme en mode classique (messages WebSocket par salle). Le **partage de fichiers** via l’onglet « Fichiers » du backend Nodle n’est pas disponible sans backend ; un partage de fichiers **P2P** (directement entre pairs via WebRTC Data Channels) peut être ajouté pour ce mode.
