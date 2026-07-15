Super Buzzer - Système de buzzer multi-joueurs en temps réel
https://img.shields.io/badge/version-1.0.0-blue
https://img.shields.io/badge/license-MIT-green
https://img.shields.io/badge/Node.js-14+-brightgreen

Un système complet de buzzer pour jeux, quiz ou animations, conçu pour fonctionner avec des tablettes, ordinateurs et un écran public. Inspiré des jeux télévisés comme "Question pour un champion", il propose une gestion fine des tours, des timers et des sons.

🎯 Fonctionnalités
3 interfaces distinctes :

Admin : gère les questions, valide/refuse les réponses, ajuste les scores et paramètres.

Joueur : permet de buzzer et de suivre son score en temps réel.

Spectateur : affiche la question, le classement, les timers et le gagnant en plein écran.

Gestion des tours :

Validation (+1 point) ou refus (exclusion du joueur pour la question).

Exclusion automatique en cas de dépassement du temps individuel.

Timers configurables :

Temps de réponse individuel (après un buzz).

Temps général par question (si personne ne buzz, la question est passée).

Sons intégrés (via Web Audio) :

Buzz, bonne réponse, mauvaise réponse, temps écoulé.

Communication temps réel avec Socket.IO.

Aucune base de données nécessaire (tout en mémoire).

Interface sobre et professionnelle (sans émojis).

📦 Technologies utilisées
Backend : Node.js, Express, Socket.IO

Frontend : HTML5, CSS3, JavaScript (vanilla)

Audio : Web Audio API

Gestion d'identifiants : UUID

🚀 Installation et lancement local
Prérequis
Node.js (version 14 ou supérieure) installé sur votre ordinateur.

Un navigateur web moderne (Chrome, Firefox, Edge, Safari).

Étapes
Cloner le dépôt (ou télécharger les fichiers) :

bash
git clone https://github.com/votre-utilisateur/super-buzzer.git
cd super-buzzer
Installer les dépendances :

bash
npm install
Lancer le serveur :

bash
node server.js
Accéder aux interfaces (sur le même ordinateur) :

Admin : http://localhost:3000/admin

Joueur : http://localhost:3000/player.html

Spectateur : http://localhost:3000/spectator.html

Pour que d’autres appareils (tablettes, smartphones) se connectent :

Trouvez l’adresse IP locale de votre ordinateur (ex: 192.168.1.42).

Sur les autres appareils (même réseau WiFi), ouvrez http://192.168.1.42:3000/player.html (ou admin/spectator).

Remplacez 192.168.1.42 par votre propre IP.

🖥️ Utilisation
Admin
À l’ouverture, une salle est automatiquement créée avec un code (4 lettres/chiffres).

Partagez ce code avec les joueurs pour qu’ils rejoignent.

Envoyer une question : saisissez le texte et cliquez sur "Envoyer la question".

Dès qu’un joueur buzz, son nom apparaît avec les boutons Valider (+1 point) ou Refuser (exclusion).

Utilisez les boutons + / - dans la liste des joueurs pour ajuster manuellement les scores.

Ajustez les timers (temps de réponse individuel et temps général) via les champs en bas.

Si aucun joueur ne buzz dans le temps imparti, la question est automatiquement passée.

Joueur
Entrez le code de la salle et votre pseudo.

Attendez que l’admin envoie une question.

Appuyez sur le gros bouton BUZZ dès que vous connaissez la réponse.

Une fois votre buzz validé ou refusé, suivez les instructions à l’écran.

Si vous êtes exclu (mauvaise réponse ou temps dépassé), vous ne pourrez plus buzzer sur cette question.

Spectateur
Entrez le code de la salle pour suivre le jeu en direct.

Visualisez la question, le chronomètre, le classement et le joueur qui vient de buzzer (affichage en plein écran avec badge "BUZZ").

Le spectateur n’a pas d’action, il reflète simplement l’état du jeu.

⚙️ Configuration des timers
Les timers sont entièrement configurables par l’admin :

Temps de réponse (individuel) : durée impartie après qu’un joueur a buzzé pour donner sa réponse. Si le temps est dépassé, le joueur est exclu.

Temps par question (général) : durée maximale autorisée pour que quelqu’un buzz. Si le temps est écoulé sans aucun buzz, la question est passée.

Les valeurs par défaut sont :

Réponse individuelle : 10 secondes

Général : 30 secondes

🎵 Sons intégrés
L’application génère les sons suivants via l’API Web Audio (aucun fichier audio externe requis) :

Buzz : signal carré à 800 Hz.

Bonne réponse : trois notes ascendantes.

Mauvaise réponse : son grave à 300 Hz.

Temps écoulé : son alarmant à 200 Hz.

🌐 Déploiement
Serveur local (recommandé pour les événements)
Suivez les instructions d’installation locale. Tous les appareils doivent être sur le même réseau WiFi.

Déploiement en ligne (gratuit)
Pour une utilisation à distance (joueurs dispersés), vous pouvez déployer sur des plateformes qui supportent les WebSockets et les serveurs Node.js persistants :

Render.com (gratuit avec mise en veille après 15 min d’inactivité) : Créez un Web Service depuis votre dépôt GitHub.

Fly.io (gratuit avec 3 VM) : Utilisez flyctl pour déployer.

Attention : Les plateformes serverless comme Vercel ou Netlify ne sont pas adaptées à cette application à cause de leurs limitations sur les WebSockets.

📁 Structure du projet
text
super-buzzer/
├── server.js              # Serveur Node.js avec Socket.IO
├── package.json           # Dépendances
├── public/
│   ├── admin.html         # Interface administrateur
│   ├── admin.js
│   ├── player.html        # Interface joueur
│   ├── player.js
│   ├── spectator.html     # Interface spectateur
│   └── spectator.js
└── README.md              # Ce fichier
🤝 Contribution
Les contributions sont les bienvenues ! Pour proposer des améliorations :

Forkez le projet.

Créez votre branche (git checkout -b feature/ma-fonctionnalite).

Committez vos changements (git commit -m 'Ajout d\'une fonctionnalité').

Poussez la branche (git push origin feature/ma-fonctionnalite).

Ouvrez une Pull Request.

📄 Licence
Ce projet est sous licence MIT. Vous êtes libre de l’utiliser, de le modifier et de le distribuer.

🙏 Remerciements
Inspiré par des projets comme Digibuzzer et les besoins concrets d’animateurs, enseignants et organisateurs d’événements.

Bonne animation !
