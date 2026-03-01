# Comparatif des fonctionnalités : Jitsi Meet, MiroTalk, Jami et Nodle

Ce document liste les fonctionnalités des trois plateformes de référence et indique si Nodle dispose d’un équivalent. Les cases marquées **À ajouter** ont été ou seront implémentées pour aligner Nodle sur ces outils.

---

## Légende

| Symbole | Signification |
|--------|----------------|
| ✅ | Équivalent présent dans Nodle |
| 🔶 | Partiel ou à améliorer |
| ❌ | Absent ; **À ajouter** |

---

## 1. Vidéo et audio

| Fonctionnalité | Jitsi Meet | MiroTalk | Jami | Nodle |
|----------------|------------|----------|------|--------|
| Appel vidéo / audio | ✅ | ✅ | ✅ | ✅ |
| Qualité vidéo réglable (HD, 720p, etc.) | ✅ | ✅ | ✅ | ✅ |
| Qualité adaptative (selon connexion / nombre) | ✅ | ✅ | ✅ | ✅ |
| Couper / activer le micro | ✅ | ✅ | ✅ | ✅ |
| Couper / activer la caméra | ✅ | ✅ | ✅ | ✅ |
| **Choix du micro** (périphérique) | ✅ | ✅ | ✅ | ✅ |
| **Choix des haut-parleurs** | ✅ | ✅ | ✅ | ✅ |
| **Choix de la caméra** | ✅ | ✅ | ✅ | ✅ |
| Mode **audio seul** (rejoindre sans vidéo) | ✅ | - | ✅ | ✅ |
| **Push-to-talk** (parler en maintenant une touche) | ✅ | ✅ | ✅ | ✅ |
| Annulation d’écho / réduction du bruit | ✅ | ✅ | ✅ | ✅ |
| Indicateur « en train de parler » (voice activity) | ✅ | - | ✅ | 🔶 (micro actif visible, pas de détection niveau) |

---

## 2. Partage et collaboration

| Fonctionnalité | Jitsi Meet | MiroTalk | Jami | Nodle |
|----------------|------------|----------|------|--------|
| Partage d’écran | ✅ | ✅ | ✅ | ✅ |
| Chat texte intégré | ✅ | ✅ | ✅ | ✅ |
| **Chat privé** (message à un participant) | - | ✅ | ✅ (hors réunion) | ✅ |
| Réactions / emojis pendant l’appel | ✅ | ✅ | ✅ | ✅ |
| Tableau blanc / dessin collaboratif | (Etherpad) | ✅ | - | ✅ |
| Partage de fichiers | - | ✅ | ✅ | ✅ |
| Édition de document partagé (type Etherpad) | ✅ | - | - | ❌ (hors scope actuel) |

---

## 3. Gestion des participants et de la salle

| Fonctionnalité | Jitsi Meet | MiroTalk | Jami | Nodle |
|----------------|------------|----------|------|--------|
| Liste des participants | ✅ | ✅ | ✅ | ✅ |
| Lever / baisser la main | ✅ | ✅ | - | ✅ |
| Épingler / mettre en avant un participant | ✅ | ✅ | ✅ (layout) | ✅ |
| Vue grille / intervenant principal | ✅ | ✅ | ✅ | ✅ |
| Rôle enseignant / élève / participant | - | - | - | ✅ (spécifique Nodle) |
| **Lien d’invitation** (copier l’URL de la salle) | ✅ | ✅ | - | ❌ **À ajouter** |
| Verrouillage de salle / mot de passe | ✅ | - | - | ✅ (backend + UI Verrouiller / mot de passe au join) |
| Expulser un participant | ✅ | - | - | ✅ (hôte peut expulser ; backend kick) |

---

## 4. Interactivité et pédagogie

| Fonctionnalité | Jitsi Meet | MiroTalk | Jami | Nodle |
|----------------|------------|----------|------|--------|
| Vote / sondage rapide | - | - | - | ✅ |
| Météo du cours (humeur) | - | - | - | ✅ |
| Badges / cadres (frames) | - | - | - | ✅ |
| Indicateur de connexion / réessayer | - | - | - | ✅ |
| Raccourcis clavier (M, V, S, H, etc.) | ✅ | ✅ | - | ✅ |
| Sous-titres en direct (live captions) | ✅ | ✅ | - | ❌ (complexe, STT externe) |

---

## 5. Confort et technique

| Fonctionnalité | Jitsi Meet | MiroTalk | Jami | Nodle |
|----------------|------------|----------|------|--------|
| Réglages qualité / thème / disposition | ✅ | ✅ | ✅ | ✅ |
| Pas de compte requis | ✅ | ✅ | ✅ | ✅ |
| Connexion P2P / décentralisée | (option) | ✅ (P2P/SFU) | ✅ | ✅ (P2P + relais signaling) |
| Enregistrement de l’appel | ✅ (Jibri) | ✅ | ✅ (local) | ❌ (hors scope actuel) |
| Notification d’enregistrement | - | - | ✅ | - |

---

## 6. Synthèse des ajouts réalisés pour Nodle

Les équivalents suivants ont été ajoutés pour se rapprocher de Jitsi Meet, MiroTalk et Jami :

1. **Réglages** : choix du micro, des haut-parleurs et de la caméra (liste des périphériques dans l’UI).
2. **Lien d’invitation** : bouton « Copier le lien » dans la salle pour partager l’URL.
3. **Mode audio seul** : option « Rejoindre avec la caméra coupée » (équivalent rejoindre en audio seul).
4. **Push-to-talk** : option dans les réglages + touche (ex. Espace) pour parler uniquement quand elle est maintenue.
5. **Chat privé** : envoyer un message à un participant précis (champ optionnel `toPeerId`), affiché comme « Message privé à [nom] » / « De [nom] (privé) ».

Les fonctionnalités plus lourdes (verrouillage de salle, expulsion, enregistrement, sous-titres) restent hors scope pour l’instant et pourraient faire l’objet de versions ultérieures.
