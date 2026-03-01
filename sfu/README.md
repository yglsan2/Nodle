# Nodle SFU (mediasoup)

Serveur **SFU** (Selective Forwarding Unit) pour permettre à **une classe entière (10–20+ participants)** de se connecter dans une même salle.

Sans SFU, le mode mesh (P2P) impose une connexion entre chaque paire de participants : au-delà de 6–8 personnes, la bande passante et le CPU deviennent insuffisants. Avec le SFU, chaque client envoie **un seul flux** au serveur, qui le relaie à tous les autres : l’appareil de chaque élève ne gère plus que 1 envoi + N réceptions au lieu de N connexions complètes.

## Démarrage

```bash
cd sfu
npm install
npm start
```

Le serveur écoute par défaut sur le port **3001** (WebSocket). Pour une autre URL :

```bash
PORT=3002 npm start
```

## Configuration backend Java

Dans `backend/src/main/resources/application.properties` (ou variables d’environnement) :

```properties
nodle.sfu.ws-url=ws://localhost:3001/
```

En production, utilisez l’URL réelle du serveur SFU (ex. `wss://sfu.etablissement.fr/`).

## Protocole WebSocket (pour le client)

Connexion : `ws://host:3001/?roomId=ROOM_ID&peerId=PEER_ID`

Messages (client → serveur) :

- `getRouterRtpCapabilities` → réponse `routerRtpCapabilities` + `existingProducers`
- `createWebRtcTransport` avec `direction: 'send'` ou `'recv'`
- `connectWebRtcTransport` avec `transportId`, `dtlsParameters`
- `produce` avec `transportId`, `kind`, `rtpParameters`
- `consume` avec `producerId`, `rtpCapabilities`

Le client frontend Nodle utilisera **mediasoup-client** pour gérer Device, Transport, Producer et Consumer. L’intégration dans l’interface (mode SFU lorsque `sfuWsUrl` est renseigné) est en cours.

## Déploiement

- Exposer le port du SFU (ex. 3001) ou le mettre derrière un reverse proxy (WebSocket).
- Ouvrir la plage de ports RTP (ex. 10000–10100) pour les flux média si le SFU est derrière un NAT.
