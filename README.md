# Super Buzzer - Système de buzzer multi-joueurs en temps réel

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node.js](https://img.shields.io/badge/Node.js-14+-brightgreen)

Un système complet de buzzer pour jeux, quiz ou animations, conçu pour fonctionner avec des tablettes, ordinateurs et un écran public.

Inspiré des jeux télévisés comme **Question pour un champion**, il propose une gestion complète des tours, des timers et des sons.

---

# Fonctionnalités

## Trois interfaces distinctes

### Admin
- Gère les questions.
- Valide ou refuse les réponses.
- Ajuste les scores.
- Configure les paramètres et les timers.

### Joueur
- Permet de buzzer.
- Affiche le score en temps réel.

### Spectateur
- Affiche la question.
- Affiche le classement.
- Affiche les timers.
- Met en évidence le joueur qui vient de buzzer.
- Mode plein écran.

## Gestion des tours

- Validation d'une réponse (+1 point).
- Refus d'une réponse (exclusion du joueur pour la question).
- Exclusion automatique si le temps individuel est dépassé.

## Timers configurables

- Temps de réponse individuel après un buzz.
- Temps général par question.
- Passage automatique à la question suivante si personne ne buzz.

## Sons intégrés

Générés via **Web Audio API** :

- Buzz
- Bonne réponse
- Mauvaise réponse
- Temps écoulé

## Temps réel

- Communication instantanée via **Socket.IO**.
- Aucun rafraîchissement de page nécessaire.

## Stockage

- Aucune base de données.
- Toutes les informations sont conservées en mémoire.

## Interface

- Sobre.
- Professionnelle.
- Responsive.

---

# Technologies utilisées

## Backend

- Node.js
- Express
- Socket.IO

## Frontend

- HTML5
- CSS3
- JavaScript (Vanilla)

## Audio

- Web Audio API

## Gestion des identifiants

- UUID

---

# Installation

## Prérequis

- Node.js 14 ou supérieur
- Un navigateur moderne (Chrome, Firefox, Edge ou Safari)

## Cloner le dépôt

```bash
git clone https://github.com/votre-utilisateur/super-buzzer.git
cd super-buzzer
```

## Installer les dépendances

```bash
npm install
```

## Lancer le serveur

```bash
node server.js
```

---

# Accès aux interfaces

Sur l'ordinateur qui héberge le serveur :

| Interface | Adresse |
|-----------|----------|
| Admin | http://localhost:3000/admin |
| Joueur | http://localhost:3000/player.html |
| Spectateur | http://localhost:3000/spectator.html |

---

# Utilisation sur plusieurs appareils

1. Trouvez l'adresse IP locale de votre ordinateur (par exemple `192.168.1.42`).
2. Connectez tous les appareils sur le même réseau Wi-Fi.
3. Ouvrez :

```
http://192.168.1.42:3000/player.html
```

ou

```
http://192.168.1.42:3000/admin
```

ou

```
http://192.168.1.42:3000/spectator.html
```

Remplacez l'adresse IP par celle de votre ordinateur.

---

# Utilisation

## Interface Admin

À l'ouverture :

- une salle est automatiquement créée ;
- un code de salle (4 caractères) est généré.

Partagez ce code avec les joueurs.

### Pendant le jeu

- Envoyer une question.
- Valider une réponse (+1 point).
- Refuser une réponse (exclusion).
- Modifier les scores avec les boutons **+** et **-**.
- Modifier les timers.
- Si personne ne buzz avant la fin du temps général, la question est automatiquement passée.

---

## Interface Joueur

1. Entrer le code de la salle.
2. Choisir un pseudo.
3. Attendre qu'une question soit envoyée.
4. Appuyer sur **BUZZ** dès que la réponse est trouvée.

Après le buzz :

- attendre la validation de l'administrateur ;
- si la réponse est refusée ou si le temps est dépassé, le joueur est exclu pour cette question.

---

## Interface Spectateur

Le spectateur :

- rejoint la salle avec son code ;
- suit la partie en direct ;
- voit :
  - la question ;
  - le chronomètre ;
  - le classement ;
  - le joueur ayant buzzé.

Cette interface est uniquement destinée à l'affichage.

---

# Configuration des timers

L'administrateur peut modifier :

## Temps de réponse individuel

Durée accordée au joueur après son buzz.

Si le temps expire :

- le joueur est automatiquement exclu.

## Temps général

Durée maximale pour qu'un joueur buzz.

Si personne ne buzz :

- la question est automatiquement passée.

### Valeurs par défaut

| Paramètre | Valeur |
|-----------|---------|
| Temps individuel | 10 secondes |
| Temps général | 30 secondes |

---

# Sons intégrés

Tous les sons sont générés via **Web Audio API**.

| Événement | Description |
|-----------|-------------|
| Buzz | Signal carré à 800 Hz |
| Bonne réponse | Trois notes ascendantes |
| Mauvaise réponse | Son grave à 300 Hz |
| Temps écoulé | Son d'alerte à 200 Hz |

Aucun fichier audio externe n'est nécessaire.

---

# Déploiement

## Serveur local

Recommandé pour les événements.

Tous les appareils doivent être connectés au même réseau Wi-Fi.

## Déploiement en ligne

Compatible avec les plateformes supportant :

- Node.js
- WebSockets
- Serveurs persistants

Exemples :

- Render
- Fly.io

> **Attention**
>
> Les plateformes serverless comme **Vercel** ou **Netlify** ne sont pas adaptées à cette application en raison de leurs limitations concernant les WebSockets.

---

# Structure du projet

```text
super-buzzer/
├── server.js                 # Serveur Node.js + Socket.IO
├── package.json              # Dépendances
├── public/
│   ├── admin.html            # Interface administrateur
│   ├── admin.js
│   ├── player.html           # Interface joueur
│   ├── player.js
│   ├── spectator.html        # Interface spectateur
│   └── spectator.js
└── README.md
```

---

# Contribution

Les contributions sont les bienvenues.

1. Forkez le projet.

2. Créez une branche :

```bash
git checkout -b feature/ma-fonctionnalite
```

3. Commitez vos modifications :

```bash
git commit -m "Ajout d'une fonctionnalité"
```

4. Poussez la branche :

```bash
git push origin feature/ma-fonctionnalite
```

5. Ouvrez une Pull Request.

---

# Licence

Ce projet est distribué sous licence **MIT**.

Vous êtes libre de l'utiliser, de le modifier et de le redistribuer conformément aux termes de cette licence.

---

# Remerciements

Ce projet est inspiré des jeux télévisés de culture générale, de projets comme **Digibuzzer**, ainsi que des besoins concrets des enseignants, animateurs et organisateurs d'événements souhaitant disposer d'un système de buzzer simple, rapide et entièrement fonctionnel.
