Super Buzzer - Application de Quiz en Temps Réel
Application web complète de buzzer pour jeux de quiz, cours ou soirées animées. Permet à un animateur de gérer des questions, recevoir les buzzers des joueurs, valider ou refuser les réponses, et afficher tout cela en direct sur un écran public.

✨ Fonctionnalités
4 interfaces : Admin, Joueur, Spectateur, et une page de connexion.

Gestion des salles : Création automatique d’une salle avec un code à 4 caractères.

Buzz en temps réel : Premier joueur à buzzer, verrouillage du système.

Validation/Refus : L’admin valide ou refuse la réponse. En cas de refus, le joueur est exclu pour la question en cours.

Timers configurables :

Temps individuel de réponse (après un buzz).

Temps général par question.

Sons intégrés (générés par Web Audio) : buzz, bonne réponse, mauvaise réponse, temps écoulé.

Interface spectateur : Affichage grand écran de la question, du classement, du timer, et d’une bannière "BUZZ" pour le gagnant.

Sans émoji (design épuré, professionnel).

Multijoueur : Jusqu’à plusieurs dizaines de joueurs simultanés (limité par le réseau).

🧱 Architecture Technique
Backend : Node.js + Express + Socket.IO

Frontend : HTML/CSS/JS vanille (aucun framework requis)

Communication : WebSocket (temps réel)

Stockage : Mémoire (pas de base de données, idéal pour une utilisation éphémère)

📦 Prérequis
Node.js (version 14 ou supérieure) – Télécharger ici

Un gestionnaire de paquets (npm, inclus avec Node.js)

Un réseau local (WiFi) pour connecter les appareils entre eux.

🚀 Installation et Lancement (en local)
1. Cloner ou télécharger le projet
Placez tous les fichiers dans un dossier, par exemple mon-buzzer/.

2. Installer les dépendances
Ouvrez un terminal dans le dossier du projet et exécutez :

bash
npm install
3. Lancer le serveur
bash
node server.js
Le serveur démarre sur le port 3000 par défaut.

4. Accéder aux interfaces
Admin : http://localhost:3000/admin

Joueur : http://localhost:3000/player.html

Spectateur : http://localhost:3000/spectator.html

Pour que les autres appareils (tablettes, téléphones) se connectent, remplacez localhost par l’adresse IP locale de l’ordinateur serveur.

Exemple
Si l’IP de votre ordinateur est 192.168.1.42 :

Joueur : http://192.168.1.42:3000/player.html

Spectateur : http://192.168.1.42:3000/spectator.html

🕹️ Utilisation
Admin
À l’ouverture, un code de salle est généré automatiquement (ex : A1B2).

Partagez ce code avec les joueurs et spectateurs.

Configurez les timers (temps de réponse et temps par question).

Tapez une question, puis cliquez sur "Envoyer la question".

Dès qu’un joueur buzze, son nom apparaît avec les boutons Valider (+1 point) ou Refuser (exclusion).

Si la réponse est validée, le joueur marque 1 point et la question suivante peut être posée.

Si elle est refusée, le joueur est exclu pour la question en cours, et les autres peuvent encore buzzer.

Si le temps général s’écoule sans réponse, la question est automatiquement passée.

Joueur
Entrez le code de la salle et votre pseudo.

Attendez que l’admin envoie une question.

Appuyez sur le gros bouton "BUZZ" dès que vous connaissez la réponse.

Si vous êtes le premier, attendez la décision de l’admin.

En cas de bonne réponse : +1 point. En cas de mauvaise réponse ou de dépassement de temps : vous êtes exclu pour cette question.

Spectateur
Entrez le même code de salle.

L’écran affiche en temps réel :

La question en cours.

Le classement mis à jour.

Le temps restant.

Une bannière "BUZZ" avec le nom du joueur qui a buzzé en premier.

⚙️ Configuration des Timers
Temps de réponse (individuel) : Temps accordé au joueur après avoir buzzé pour donner sa réponse. (Défaut : 10s)

Temps par question (général) : Temps total alloué pour une question, après lequel elle est automatiquement passée. (Défaut : 30s)

Ces valeurs sont modifiables dans l’interface admin, dans la section "Paramètres des timers".

🔊 Sons Intégrés
L’application génère des sons directement dans le navigateur via l’API Web Audio, sans fichiers audio externes :

Buzz : son carré aigu.

Bonne réponse : mélodie ascendante.

Mauvaise réponse : son grave.

Temps écoulé : son descendant.

📂 Structure des fichiers
text
mon-buzzer/
├── server.js                 # Serveur Node.js (Socket.IO + Express)
├── package.json              # Dépendances et scripts
├── public/
│   ├── admin.html            # Interface admin
│   ├── admin.js              # Logique admin
│   ├── player.html           # Interface joueur
│   ├── player.js             # Logique joueur
│   ├── spectator.html        # Interface spectateur
│   └── spectator.js          # Logique spectateur
└── README.md                 # Ce fichier
🚢 Déploiement
Option 1 : Serveur local (recommandé pour événements)
Idéal pour une utilisation en classe, soirée, atelier.

Tous les appareils doivent être sur le même réseau WiFi.

Procédure décrite dans la section Installation.

Option 2 : Hébergement en ligne (gratuit)
L’application peut être déployée sur des plateformes supportant Node.js et les WebSockets :

Render.com (recommandé) : Hébergement gratuit avec WebSocket. Le service s’endort après 15 minutes d’inactivité, mais redémarre rapidement.

Fly.io : Offre gratuite généreuse, machines virtuelles persistantes.

Déploiement sur Render (exemple)
Poussez votre code sur GitHub.

Créez un compte sur Render.

Créez un Web Service connecté à votre dépôt.

Configuration :

Environment : Node

Build Command : npm install

Start Command : node server.js

Instance Type : Free

Cliquez sur Create Web Service. L’application sera accessible via une URL publique du type https://votre-app.onrender.com.

🤝 Contribuer
Les contributions sont les bienvenues ! Pour toute amélioration :

Forkez le projet.

Créez une branche pour votre fonctionnalité (git checkout -b feature/ma-fonctionnalite).

Commitez vos changements (git commit -m 'Ajout de ma fonctionnalité').

Poussez la branche (git push origin feature/ma-fonctionnalite).

Ouvrez une Pull Request.

📄 Licence
Ce projet est sous licence MIT. Vous êtes libre de l’utiliser, de le modifier et de le redistribuer, à condition de conserver la mention de licence.

📧 Support
Pour toute question ou signalement de bug, merci d’ouvrir une issue sur le dépôt GitHub.

Amusez-vous bien avec Super Buzzer ! 🎉
