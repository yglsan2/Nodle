# Inspirations et références (open source)

Nodle s’inspire de logiciels libres et de projets « partage d’espace » pour la fluidité, la simplicité et le mode hybride (P2P / relais → serveur).

## Visioconférence

### Jitsi Meet
- **Simplicité** : pas de compte, un nom de réunion puis démarrage. Même nom = même salle.
- **Barre d’outils** : une seule barre regroupant les contrôles (micro, caméra, partage, chat, etc.) plutôt que des menus éparpillés.
- **Intégration** : chat, partage d’écran, collaboration (Etherpad) dans le même espace.
- Nodle reprend : entrée « un nom de réunion » → créer ou rejoindre la même salle (slug), barre de contrôles unifiée.

### MiroTalk
- **Modes multiples** : P2P, SFU, diffusion, etc. avec bascule possible.
- **Self-hosted** : déploiement on-premise, WebRTC, qualité vidéo élevée.
- **Fonctionnalités** : chat, partage d’écran, tableau blanc, sous-titres, enregistrement.
- Nodle reprend : mode relais (P2P signaling) + mode serveur, avec bascule automatique si l’un échoue (hybride).

## Partage d’espace sans serveur (P2P)

### Zero Share
- Partage de fichiers en P2P via WebRTC, pas de serveur (STUN public pour ICE).
- Échange de SDP par QR code ou lien.
- Nodle : objectif d’un mode « relais minimal » ou échange de signaling sans héberger un backend lourd.

### RTCPortal / p2p-data-channel / Switchboard.js
- Projets WebRTC Data Channel pour transfert de données P2P.
- Nodle : le partage de fichiers P2P (Data Channels) en mode relais est prévu pour ne pas dépendre du serveur de fichiers.

## Principe hybride (Nodle)

La techno est **mixte** : si le mode actuel ne fonctionne plus, l’app ne bloque pas et bascule sur une autre connexion.

1. **Signaling** : essai des URLs dans l’ordre (ex. relais puis serveur). Si le relais est injoignable ou tombe, passage automatique au serveur.
2. **Affichage** : indicateur « Relais » ou « Serveur » pour que l’utilisateur sache quel mode est actif.
3. **Fichiers** : à terme, partage via serveur quand disponible, sinon P2P (Data Channels) en mode relais.

Ainsi, on peut utiliser Nodle en « partage d’espace » (relais, petit groupe) sans serveur dédié, tout en restant utilisable en mode serveur ou mutualisé lorsque c’est nécessaire.
