const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Routes pour servir les pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'player.html'));
});
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/spectator', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'spectator.html'));
});

// État du jeu
const rooms = {};

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

io.on('connection', (socket) => {
    console.log('Client connecté:', socket.id);

    // Créer une salle (admin)
    socket.on('createRoom', (adminName) => {
        let roomCode = generateRoomCode();
        while (rooms[roomCode]) {
            roomCode = generateRoomCode();
        }
        rooms[roomCode] = {
            adminId: socket.id,
            players: {},
            currentQuestion: null,
            buzzedThisRound: [],
            isLocked: false,
            lastBuzzerWinner: null,
            excludedPlayers: [],
            // Timers (en secondes)
            answerTime: 10,      // temps individuel par défaut
            questionTime: 30,    // temps général par défaut
            timerRunning: false,
            timerInterval: null,
            questionStartTime: null,
            // Gestion du tour
            awaitingValidation: false,
            currentBuzzerId: null
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode });
        console.log(`Salle ${roomCode} créée par ${adminName}`);
    });

    // Rejoindre (joueur)
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (!room) {
            socket.emit('joinError', 'Salle inexistante');
            return;
        }
        room.players[socket.id] = { name: playerName, score: 0 };
        socket.join(roomCode);
        socket.emit('joinedRoom', {
            roomCode,
            playerId: socket.id,
            currentQuestion: room.currentQuestion,
            isLocked: room.isLocked,
            scores: getScores(room),
            answerTime: room.answerTime,
            questionTime: room.questionTime,
            remainingTime: room.timerRunning ? getRemainingTime(room) : null
        });
        io.to(roomCode).emit('playersUpdate', getPlayersList(room));
        console.log(`${playerName} a rejoint ${roomCode}`);
    });

    // Spectateur
    socket.on('joinSpectator', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) {
            socket.emit('joinError', 'Salle inexistante');
            return;
        }
        socket.join(roomCode);
        socket.emit('spectatorJoined', {
            roomCode,
            currentQuestion: room.currentQuestion,
            isLocked: room.isLocked,
            players: getPlayersList(room),
            lastWinner: room.lastBuzzerWinner,
            answerTime: room.answerTime,
            questionTime: room.questionTime,
            remainingTime: room.timerRunning ? getRemainingTime(room) : null
        });
        console.log(`Spectateur connecté à ${roomCode}`);
    });

    // Admin envoie une question
    socket.on('sendQuestion', ({ roomCode, questionText }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;

        // Arrêter l'ancien timer s'il existe
        clearInterval(room.timerInterval);
        room.timerRunning = false;

        room.currentQuestion = questionText;
        room.buzzedThisRound = [];
        room.excludedPlayers = [];
        room.isLocked = false;
        room.lastBuzzerWinner = null;
        room.awaitingValidation = false;
        room.currentBuzzerId = null;

        io.to(roomCode).emit('newQuestion', {
            question: questionText,
            isLocked: false,
            questionTime: room.questionTime
        });

        // Démarrer le timer général
        startGeneralTimer(room, roomCode);

        console.log(`Question envoyée: ${questionText}`);
    });

    // Admin définit les timers
    socket.on('setTimers', ({ roomCode, answerTime, questionTime }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        room.answerTime = answerTime;
        room.questionTime = questionTime;
        io.to(roomCode).emit('timersUpdated', { answerTime, questionTime });
    });

    // Joueur buzz
    socket.on('buzz', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        if (room.isLocked || room.awaitingValidation) {
            socket.emit('buzzResult', { success: false, message: 'Buzzer verrouillé' });
            return;
        }
        if (room.excludedPlayers.includes(socket.id)) {
            socket.emit('buzzResult', { success: false, message: 'Vous êtes exclu pour cette question' });
            return;
        }
        if (room.buzzedThisRound.includes(socket.id)) {
            socket.emit('buzzResult', { success: false, message: 'Vous avez déjà buzzé' });
            return;
        }

        // Enregistrer le buzz
        room.buzzedThisRound.push(socket.id);
        room.isLocked = true;
        room.awaitingValidation = true;
        room.currentBuzzerId = socket.id;
        const playerName = room.players[socket.id]?.name || 'Anonyme';
        room.lastBuzzerWinner = { playerId: socket.id, playerName };

        socket.emit('buzzResult', { success: true, message: 'Buzz enregistré' });
        io.to(roomCode).emit('playerBuzzed', { playerId: socket.id, playerName });

        // Arrêter le timer général
        clearInterval(room.timerInterval);
        room.timerRunning = false;

        // Démarrer le timer individuel
        startAnswerTimer(room, roomCode, socket.id);

        console.log(`${playerName} a buzzé`);
    });

    // Admin valide la réponse
    socket.on('validateBuzz', ({ roomCode, playerId }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        if (!room.awaitingValidation || room.currentBuzzerId !== playerId) return;

        // Arrêter le timer individuel
        clearInterval(room.timerInterval);
        room.timerRunning = false;

        // Ajouter 1 point
        if (room.players[playerId]) {
            room.players[playerId].score += 1;
        }
        const playerName = room.players[playerId]?.name || 'Anonyme';
        const newScore = room.players[playerId].score;

        // Réinitialiser pour la prochaine question
        room.buzzedThisRound = [];
        room.excludedPlayers = [];
        room.isLocked = false;
        room.awaitingValidation = false;
        room.currentBuzzerId = null;
        room.lastBuzzerWinner = null;

        io.to(roomCode).emit('questionValidated', {
            winnerName: playerName,
            newScore,
            scores: getScores(room)
        });
        io.to(roomCode).emit('scoresUpdate', getScores(room));
        io.to(roomCode).emit('playersUpdate', getPlayersList(room));

        console.log(`Réponse validée pour ${playerName}`);
    });

    // Admin refuse la réponse (mauvaise réponse)
    socket.on('rejectBuzz', ({ roomCode, playerId }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        if (!room.awaitingValidation || room.currentBuzzerId !== playerId) return;

        // Arrêter le timer individuel
        clearInterval(room.timerInterval);
        room.timerRunning = false;

        // Exclure le joueur
        if (!room.excludedPlayers.includes(playerId)) {
            room.excludedPlayers.push(playerId);
        }
        room.awaitingValidation = false;
        room.currentBuzzerId = null;
        room.isLocked = false; // déverrouiller pour les autres

        const playerName = room.players[playerId]?.name || 'Anonyme';
        io.to(roomCode).emit('buzzRejected', {
            playerName,
            excludedPlayers: room.excludedPlayers
        });
        // Informer le joueur
        io.to(roomCode).emit('playerExcluded', { playerId });

        // Redémarrer le timer général pour laisser le temps aux autres
        startGeneralTimer(room, roomCode);

        console.log(`Réponse refusée pour ${playerName}`);
    });

    // Timer individuel expiré
    function startAnswerTimer(room, roomCode, playerId) {
        clearInterval(room.timerInterval);
        let remaining = room.answerTime;
        room.timerRunning = true;
        room.timerInterval = setInterval(() => {
            remaining--;
            io.to(roomCode).emit('timerTick', { type: 'answer', remaining });
            if (remaining <= 0) {
                clearInterval(room.timerInterval);
                room.timerRunning = false;
                // Exclure le joueur
                if (!room.excludedPlayers.includes(playerId)) {
                    room.excludedPlayers.push(playerId);
                }
                room.awaitingValidation = false;
                room.currentBuzzerId = null;
                room.isLocked = false;
                io.to(roomCode).emit('answerTimeout', { playerId });
                // Redémarrer le timer général
                startGeneralTimer(room, roomCode);
            }
        }, 1000);
    }

    // Timer général
    function startGeneralTimer(room, roomCode) {
        clearInterval(room.timerInterval);
        let remaining = room.questionTime;
        room.timerRunning = true;
        room.timerInterval = setInterval(() => {
            remaining--;
            io.to(roomCode).emit('timerTick', { type: 'general', remaining });
            if (remaining <= 0) {
                clearInterval(room.timerInterval);
                room.timerRunning = false;
                // Temps écoulé, personne n'a validé
                io.to(roomCode).emit('questionTimeout');
                // Réinitialiser pour passer à la suite (mais on ne change pas la question automatiquement, on laisse l'admin)
                // L'admin devra envoyer une nouvelle question.
                room.isLocked = true; // bloquer pour éviter de buzzer après le temps
                room.awaitingValidation = false;
                room.currentBuzzerId = null;
            }
        }, 1000);
    }

    function getRemainingTime(room) {
        // non utilisé dans cette version, on envoie via timerTick
        return null;
    }

    // Déconnexion
    socket.on('disconnect', () => {
        for (const [roomCode, room] of Object.entries(rooms)) {
            if (room.players[socket.id]) {
                delete room.players[socket.id];
                io.to(roomCode).emit('playersUpdate', getPlayersList(room));
            }
            if (room.adminId === socket.id) {
                clearInterval(room.timerInterval);
                delete rooms[roomCode];
                io.to(roomCode).emit('roomClosed', 'L\'hôte a quitté');
            }
        }
    });
});

// Fonctions utilitaires
function getPlayersList(room) {
    const list = [];
    for (const [id, data] of Object.entries(room.players)) {
        list.push({ id, name: data.name, score: data.score });
    }
    return list;
}

function getScores(room) {
    const scores = {};
    for (const [id, data] of Object.entries(room.players)) {
        scores[id] = data.score;
    }
    return scores;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin`);
    console.log(`Joueur: http://localhost:${PORT}/`);
    console.log(`Spectateur: http://localhost:${PORT}/spectator`);
});