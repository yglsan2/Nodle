# Nodle

**Dépôt :** [github.com/yglsan2/Nodle](https://github.com/yglsan2/Nodle)

Visioconférence **sans serveur** (P2P) ou **hybride** pour établissements (écoles, AFPA, écoles d’informatique) : cours en commun ou à distance, avec une **offre de GIFs riche** et l’**import de tout type de GIF** (tous formats et tous éditeurs).

## Stack

- **Frontend** : JavaScript/TypeScript (Vite + React) — visio WebRTC, chat, partage d’écran, réactions, GIFs
- **Backend (mode hybride)** : Java (Spring Boot) — relais TURN/signaling, salles, organisations, stockage GIFs

## Fonctionnalités visio “classiques”

- Vidéo et audio entre participants
- Partage d’écran
- Chat enrichi (texte, GIFs, pièces jointes, blocs code/texte)
- Mute / couper la caméra
- Salles nommées (pour cours)

## Échanges type Teams (travail + détente)

- **Chat enrichi** : texte, GIFs (tous formats), **pièces jointes** (PDF, images, schémas, texte, etc.), **blocs code / texte** pour partager du code ou des extraits.
- **Tableau blanc collaboratif** : schémas et diagrammes dessinés en direct, partagés avec toute la salle.
- **Fichiers partagés** : onglet dédié pour déposer et télécharger des **documents, schémas, diagrammes, PDF, texte** — toute la salle y a accès, pour travailler ensemble ou en groupe.

## GIFs : riche et multi-formats

- **Bibliothèque intégrée** : plusieurs catégories (réactions, humour, cours, etc.) pour que les étudiants “puissent se marrer librement”
- **Import libre** : accepter **n’importe quel type de GIF** provenant de **n’importe quel éditeur** :
  - **GIF** (`.gif`) — classique
  - **WebP animé** (`.webp`)
  - **APNG** (`.png` animé)
  - **Vidéos courtes** (`.mp4`, `.webm`) utilisées comme GIFs (comme sur Giphy)

Tous ces formats sont affichés correctement dans le chat et les réactions.

## Pour les structures (écoles, AFPA)

- Déploiement possible **on-premise** ou mutualisé
- Mode **100 % P2P** (sans serveur) pour petits groupes
- Mode **hybride** : relais Java pour salles plus grandes ou réseaux restrictifs
- Documentation dédiée dans `docs/DEPLOIEMENT_ETABLISSEMENTS.md`

## Démarrage rapide

Depuis le dossier **Nodle** :

```bash
# Backend Java (signaling + relais optionnel)
cd backend && ./mvnw spring-boot:run

# Frontend (autre terminal)
cd frontend && npm install && npm run dev
```

Puis ouvrir http://localhost:5173, créer ou rejoindre une salle, et utiliser la visio + les GIFs.
