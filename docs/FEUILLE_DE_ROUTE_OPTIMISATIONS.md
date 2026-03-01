# Feuille de route – Optimisations Nodle (recommandations type ChatGPT)

Ce document structure les pistes d’optimisation pour rendre Nodle plus résilient, décentralisé et performant, en priorité et par thème.

---

## 1. Priorités (ordre conseillé)

| # | Thème | Objectif | Statut |
|---|--------|----------|--------|
| 1 | **Topologie réseau** | Remplacer le full mesh par une topologie en arbre (relais volontaires) | À faire |
| 2 | **NAT / résilience** | STUN + TURN communautaire ou micro-nœud cloud de secours | Partiel (STUN présent) |
| 3 | **Bande passante** | Qualité adaptative déjà en place ; affiner selon débit mesuré | Partiel |
| 4 | **Stockage partagé** | Déduplication, chunks hashés, réplication limitée (type IPFS/Syncthing) | À faire |
| 5 | **Sécurité E2E** | Chiffrement bout-en-bout, clés éphémères par session | À faire |
| 6 | **UX** | Indicateur de contribution, mode éco, mode souverain | À faire |

---

## 2. Topologie hybride (pas de full mesh)

**Problème** : En full mesh, chaque participant envoie son flux à tous les autres → coût CPU et bande passante élevé.

**Piste** :
- **Arbre adaptatif** : certains participants avec bonne connexion deviennent *relay nodes* temporaires.
- Les flux sont relayés en cascade au lieu d’être envoyés N fois par la source.
- **Élection** des relais selon : débit montant, latence, stabilité (score = upload × stabilité / latence).

**Implémentation possible** :
- Côté client : estimer sa capacité (upload, stabilité) et l’annoncer dans le signaling (`capabilities`).
- Un participant “super-nœud” reçoit les flux de plusieurs pairs et les renvoie (SFU-like côté client, ou petit serveur SFU optionnel).
- Alternative progressive : utiliser le **SFU** existant (`sfu/server.js`) pour les grandes salles et garder le P2P pour les petits groupes.

**Fichiers concernés** : `frontend/src/useWebRTC.ts`, `sfu/server.js`, signaling (nouveaux types de messages).

---

## 3. NAT et résilience réseau

**Déjà en place** :
- STUN (ex. `stun.l.google.com:19302`) pour le NAT traversal.
- Configuration ICE côté client.

**À renforcer** :
- **TURN** : relais TURN communautaire ou hébergé minimal pour les cas où le P2P échoue.
- **Fallback** : si aucun chemin P2P ni TURN ne marche, activer un micro-nœud cloud temporaire (stream relay) pour ne jamais bloquer l’utilisateur.
- **Détection** : afficher “Connexion directe” vs “Relais” pour transparence.

**Fichiers** : configuration ICE (backend `ConfigController`, frontend `useWebRTC`), éventuel serveur TURN.

---

## 4. Flux vidéo/audio – codec et streaming

**Pistes** :
- **Codec adaptatif** : préférer VP9/AV1 si le CPU le permet, sinon H264 (déjà souvent utilisé par WebRTC).
- **Détection accélération matérielle** : préférer le codec géré par le GPU quand c’est possible.
- **Streaming différentiel** : en théorie, envoyer seulement les zones modifiées (macro-blocs) ; en pratique WebRTC gère déjà une partie de l’adaptation ; on peut réduire la résolution quand la fenêtre est réduite (déjà partiellement couvert par la qualité adaptative).

**Priorité** : moyenne (amélioration incrémentale après topologie et NAT).

---

## 5. Partage d’espace disque (cache distribué)

**Vision** : mutualiser le stockage entre participants (fichiers partagés, cache) de façon décentralisée.

**Pistes** :
- **Chunks hashés** (ex. SHA-256) pour déduplication.
- **Réplication limitée** : chaque chunk sur 2 ou 3 nœuds au plus (pas sur tous).
- Inspiration : IPFS, Syncthing.

**Complexité** : élevée (couche applicative au-dessus du signaling actuel, gestion de la découverte et de la confiance). À traiter après stabilisation topologie + NAT + E2E.

---

## 6. Sécurité (E2E, clés éphémères)

**Objectifs** :
- Chiffrement **bout-en-bout** des flux et des messages (chat, fichiers).
- **Clés éphémères** par session (pas de réutilisation à long terme).
- **Signature des chunks** partagés pour intégrité.

**Pistes** :
- Protocole type **Double Ratchet** (Signal) ou cadre type **Matrix** pour la fédération.
- Pour la visio : WebRTC avec **DTLS-SRTP** (déjà chiffré entre pairs) ; s’assurer qu’aucun intermédiaire ne déchiffre (relais TURN/SFU “dumb” qui ne font que relayer).

**Fichiers** : couche crypto (lib JS), signaling (échange de clés ou de références), éventuel backend minimal pour la confiance initiale.

---

## 7. UX – Indicateurs et modes

**À ajouter** :
- **Indicateur de contribution** : “Vous contribuez à la stabilité du réseau” (quand le client relaie ou a une bonne connexion).
- **Mode éco** : réduire la contribution (débit, relais) si batterie faible ou préférence utilisateur.
- **Mode souverain** : aucune donnée persistée localement après la réunion (pas d’historique chat, pas de cache fichiers).

**Implémentation** :
- Réglages (ex. dans `SettingsPanel`) : “Contribuer au relais”, “Mode éco”, “Ne rien enregistrer après la réunion”.
- Côté topologie : ne pas élire en relais un client en mode éco ou batterie faible (si l’info est exposée).

**Fichiers** : `frontend/src/Room.tsx`, `frontend/src/settings/`, composants d’indicateurs.

---

## 8. Élection adaptative des super-nœuds

**Idée** : chaque client calcule (ou reçoit) un **score** :
- `score = (débit_montant × stabilité × uptime) / latence`
- Les N meilleurs deviennent relais vidéo / nœuds de stockage pour la salle.

**Implémentation** :
- Signaling : messages `capabilities` (upload, latence, batterie, préférence “ne pas relayer”).
- Un “coordinateur” (premier arrivé ou désigné) ou un petit service côté backend calcule les scores et envoie les rôles (relay / leaf).
- Les clients en mode “relay” ouvrent des connexions supplémentaires ou utilisent le SFU.

**Fichiers** : signaling (nouveaux types), `useWebRTC` ou module dédié “topology”.

---

## 9. Fonctionnalités “innovantes” (plus long terme)

- **Enregistrement distribué chiffré** : chaque participant peut enregistrer sa vue ; les morceaux sont chiffrés et partagés de façon décentralisée.
- **IA locale** : suppression de bruit, transcription locale (sans cloud).
- **Sync multi-appareils P2P** : rejoindre la même salle depuis plusieurs appareils avec sync d’état (qui parle, main levée, etc.) en P2P.

---

## 10. Prochaines étapes concrètes

1. **Backend** : verrouillage de salle + mot de passe + expulsion (kick) → **fait** (RoomStateStore, RoomController, RoomSessions, frontend).
2. **Doc** : cette feuille de route → **fait**.
3. **Topologie** : définir le protocole (qui envoie `capabilities`, qui décide des relais) et soit étendre le SFU existant, soit introduire des “relay clients” dans le mesh.
4. **UX** : ajouter l’**indicateur de contribution** et les options **mode éco** / **mode souverain** dans les réglages (sans encore changer la topologie).
5. **NAT** : ajouter une option TURN dans la config (backend + frontend) et documenter un déploiement TURN minimal.
6. **E2E** : spécifier un schéma d’échange de clés (ou adoption d’une lib existante) puis l’intégrer au chat et aux fichiers.

---

*Document créé pour aligner Nodle sur une vision décentralisée, résiliente et souveraine, en suivant les priorités ci-dessus.*
