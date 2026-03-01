# Nodle

**Dépôt :** [github.com/yglsan2/Nodle](https://github.com/yglsan2/Nodle)

Visioconférence **pour les salles de classe** : conçu pour connecter **une classe entière (10 à 20 personnes ou plus)**. Prof en grand, grille d’élèves, lever la main, chat, tableau blanc, fichiers partagés. P2P quand c’est possible ; **TURN** et **SFU** pour scaler.

## Stack

- **Frontend** : JavaScript/TypeScript (Vite + React) — visio WebRTC, chat, partage d’écran, réactions, GIFs
- **Backend (mode hybride)** : Java (Spring Boot) — relais TURN/signaling, salles, organisations, stockage GIFs

## Trois façons d’utiliser Nodle

L’application peut être utilisée en **mode logiciel Java**, en **mode web**, ou en **application Android (APK)**.

| Mode | Description |
|------|-------------|
| **Mode logiciel Java** | Un seul JAR exécutable : le backend sert aussi l’interface. Idéal pour déployer sur une machine (serveur d’établissement) et ouvrir l’app dans le navigateur à une seule adresse (ex. http://localhost:8080). |
| **Mode web** | Frontend (Vite) et backend (Spring Boot) lancés séparément ; on utilise l’app dans le navigateur (développement ou déploiement avec reverse proxy). |
| **Mode Android (APK)** | L’interface est packagée en application Android (Capacitor). L’utilisateur installe l’APK sur téléphone/tablette et configure l’URL du serveur (établissement) dans l’app. |

### Mode logiciel Java (un JAR = tout)

1. Construire le frontend : `cd frontend && npm install && npm run build`
2. Construire le backend avec le frontend inclus : `cd backend && mvn package -Pwith-frontend`
3. Lancer : `java -jar backend/target/backend-1.0.0-SNAPSHOT.jar`
4. Ouvrir dans le navigateur : http://localhost:8080

Sans le profil `-Pwith-frontend`, le JAR contient uniquement le backend ; une page d’accueil indique comment intégrer le frontend.

### Mode web (développement ou déploiement séparé)

```bash
cd backend && ./mvnw spring-boot:run   # terminal 1
cd frontend && npm install && npm run dev   # terminal 2
```

Ouvrir http://localhost:5173 (le proxy Vite envoie `/api` et `/ws` vers le backend).

### Mode Android (APK)

1. Une fois : `cd frontend && npm install && npx cap add android`
2. À chaque build : `npm run cap:sync` puis ouvrir le projet Android : `npm run cap:android` (Android Studio) ou `npx cap run android` pour lancer sur un appareil.

Voir **docs/ANDROID_APK.md** pour le détail (prérequis, génération de l’APK, configuration du serveur dans l’app).

## Chat en partage d’espace

Le chat est **intégré à la salle** : une seule connexion (WebSocket de signaling) pour la visio, le chat, le tableau blanc et les présences. Pas de serveur de chat séparé — tout circule dans le même « espace » de la salle. Les nouveaux arrivants reçoivent automatiquement l’**historique des derniers messages** (100 derniers) pour reprendre le fil. Indicateur « écrit en cours » et badge de **messages non lus** sur l’onglet Chat.

## Orienté pédagogie (salles de classe)

- **Rôles** : à l’entrée, choisir **Enseignant**, **Élève** ou **Participant**. Affichage dans l’en-tête et dans la liste des participants pour que le prof et les élèves s’identifient.
- **Lever la main** : visible dans la liste des participants et sur la tuile vidéo.
- **Liste des participants** : qui est là, micro/caméra, main levée, rôle.
- **Partage d’écran**, **tableau blanc**, **chat**, **fichiers partagés**.

## Échanges type Teams (travail + détente)

- **Chat enrichi** : texte, GIFs (tous formats), **pièces jointes** (PDF, images, schémas, texte, etc.), **blocs code / texte** pour partager du code ou des extraits.
- **Tableau blanc collaboratif** : schémas et diagrammes dessinés en direct, partagés avec toute la salle.
- **Fichiers partagés** : onglet dédié pour déposer et télécharger des **documents, schémas, diagrammes, PDF, texte** — toute la salle y a accès, pour travailler ensemble ou en groupe.

## GIFs : tous fournisseurs, sans partenariat exclusif

- **Bibliothèque intégrée** : plusieurs catégories (réactions, humour, cours, etc.) pour que les étudiants “puissent se marrer librement”
- **Import libre** : accepter **n’importe quel type de GIF** provenant de **n’importe quel éditeur** :
  - **GIF** (`.gif`) — classique
  - **WebP animé** (`.webp`)
  - **APNG** (`.png` animé)
  - **Vidéos courtes** (`.mp4`, `.webm`) utilisées comme GIFs (comme sur Giphy)

Tous ces formats sont affichés correctement dans le chat et les réactions.

## Connexion d’une classe entière (10–20+)

- **Vue classe** : un intervenant principal (prof ou partage d’écran) en grand, les autres en grille scrollable — jusqu’à 20+ tuiles.
- **ICE/TURN** : le client récupère les serveurs STUN/TURN via `/api/config`. En établissement, configurer un TURN (ex. coturn) dans `application.properties` pour que tous les élèves derrière NAT se connectent.
- **Vidéo adaptative** : au-delà de 6 participants, la résolution et le débit sont réduits automatiquement pour limiter la charge.
- **SFU (mediasoup)** : pour des salles vraiment grandes (10–20+), un serveur SFU relaie les flux au lieu du mesh. Voir `sfu/` : lancer le service Node puis configurer `nodle.sfu.ws-url`. L’intégration client SFU dans l’interface est prévue (serveur prêt).

Sans SFU, le mode mesh reste utilisable jusqu’à environ 6–8 participants avec un bon réseau ; au-delà, déployer le SFU ou répartir en plusieurs salles.

## Mode sans serveur (petit groupe, partage d’espace)

- **Relais de signaling** : un petit groupe peut se connecter **sans héberger le backend Nodle**. Lancer le relais dans `relay/` (Node), puis ouvrir l’app avec `?signaling=ws://localhost:9090` (ou configurer `nodle.signaling.ws-url`). Visio et chat passent par le relais ; les flux restent P2P.
- **Partage d’espace** : chat et tableau blanc circulent dans la même connexion (relais ou backend). Le partage de fichiers **P2P** (direct entre pairs, sans serveur) pour le mode relais est prévu (Data Channels).

## Pour les structures (écoles, AFPA, entreprises)

- **Serveur de l’établissement** : dans l’app, section « Serveur de l’établissement » sur la page d’accueil. Saisir l’URL de votre instance Nodle (ex. https://nodle.mon-ecole.fr) pour que tous les appels (API, signaling) passent par votre serveur — plus efficace et maîtrisé. Le choix est enregistré (localStorage) et reste actif jusqu’à « Utiliser le serveur par défaut ».
- Déploiement possible **on-premise** ou mutualisé
- Mode **100 % sans backend** : relais seul pour petits groupes (voir `relay/`)
- Mode **hybride** : backend Java + TURN pour salles plus grandes ou réseaux restrictifs
- Documentation dédiée dans `docs/DEPLOIEMENT_ETABLISSEMENTS.md`

## Démarrage rapide

Depuis le dossier **Nodle** :

```bash
# Backend Java (signaling + relais optionnel)
cd backend && ./mvnw spring-boot:run

# Frontend (autre terminal)
cd frontend && npm install && npm run dev
```

Puis ouvrir http://localhost:5173. En dev, le frontend (Vite) proxyfe `/api` et `/ws` vers le backend (port 8080).

Pour une salle 10–20+ avec SFU (optionnel) :

```bash
# Terminal 3 : SFU mediasoup
cd sfu && npm install && npm start
```

Puis configurer `nodle.sfu.ws-url=ws://localhost:3001/` dans le backend (voir `sfu/README.md`).
