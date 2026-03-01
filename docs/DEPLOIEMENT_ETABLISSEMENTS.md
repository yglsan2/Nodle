# Déploiement Nodle pour établissements

Ce document décrit comment déployer Nodle en **on-premise** ou en environnement mutualisé pour des écoles, AFPA, centres de formation, etc.

## Prérequis

- **Backend** : Java 17+, Maven
- **Frontend** : Node.js 18+, npm
- Pour la visio en conditions difficiles : serveur TURN (optionnel, ex. coturn)

## Déploiement type

1. **Backend** : construire et lancer le serveur Spring Boot (signaling WebSocket + API REST).
   ```bash
   cd backend && ./mvnw -DskipTests package && java -jar target/nodle-*.jar
   ```
   Par défaut le backend écoute sur le port 8080.

2. **Frontend** : build de production puis servir les fichiers statiques.
   ```bash
   cd frontend && npm ci && npm run build
   ```
   Déployer le contenu de `frontend/dist` sur un serveur web (Nginx, Apache) ou derrière le même domaine que le backend.

3. **Reverse proxy** (recommandé) : exposer une seule URL (ex. `https://nodle.etablissement.fr`) avec :
   - `/api` et `/ws` → backend (HTTP + WebSocket)
   - `/` → frontend (fichiers statiques)

Exemple Nginx (à adapter) :

```nginx
server {
    listen 443 ssl;
    server_name nodle.etablissement.fr;

    location /api/ { proxy_pass http://127.0.0.1:8080/; proxy_http_version 1.1; }
    location /ws/  { proxy_pass http://127.0.0.1:8080/; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }

    location / {
        root /var/www/nodle/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

## Mode 100 % P2P

Pour de très petits groupes (ex. 2–4 personnes) et si le réseau le permet, les flux audio/vidéo peuvent rester en P2P. Le backend sert alors uniquement au **signaling** (offre/réponse WebRTC, ICE) et au **chat / tableau blanc / fichiers** dans le même espace de salle.

## Mode hybride (recommandé en classe)

Pour des salles plus grandes ou des réseaux restrictifs (NAT, pare-feu) :

- Le **signaling** passe par le backend (une connexion WebSocket par participant).
- Le **chat**, le **tableau blanc** et les **métadonnées** (lever la main, réactions) passent par la même connexion — pas de serveur de chat séparé.
- Configurer des **serveurs TURN** (optionnel) dans le frontend si les connexions P2P échouent souvent.

## Sécurité et conformité

- HTTPS obligatoire en production.
- Adapter CORS et les en-têtes de sécurité selon la politique de l’établissement.
- Les pièces jointes et fichiers partagés sont stockés côté backend ; prévoir une politique de rétention et de confidentialité.
