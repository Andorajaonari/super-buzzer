const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'player.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/spectator', (req, res) => res.sendFile(path.join(__dirname, 'public', 'spectator.html')));

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

function getPlayersList(room) {
    return Object.entries(room.players).map(([id, data]) => ({ id, ...data }));
}

function getScores(room) {
    const scores = {};
    for (const [id, data] of Object.entries(room.players)) {
        scores[id] = data.score;
    }
    return scores;
}

io.on('connection', (socket) => {
    console.log('Client connecté:', socket.id);

    // --- Créer une salle ---
    socket.on('createRoom', (adminName) => {
        let roomCode = generateRoomCode();
        while (rooms[roomCode]) roomCode = generateRoomCode();
        rooms[roomCode] = {
            adminId: socket.id,
            players: {},
            // Quiz
            questions: [],          // [{question, answer}]
            currentIndex: -1,
            mode: 'successive',     // 'successive' ou 'random'
            usedIndices: [],        // pour le mode aléatoire
            currentQuestion: null,
            currentAnswer: null,
            // État buzzer
            buzzedThisRound: [],
            excludedPlayers: [],
            isLocked: false,
            awaitingValidation: false,
            currentBuzzerId: null,
            lastBuzzerWinner: null,
            // Timers
            answerTime: 10,
            questionTime: 30,
            timerRunning: false,
            timerInterval: null,
            // Contrôle du flux
            autoNext: true,        // enchaînement automatique après affichage réponse
            showingAnswer: false,
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode });
        console.log(`Salle ${roomCode} créée`);
    });

    // --- Rejoindre (joueur) ---
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (!room) { socket.emit('joinError', 'Salle inexistante'); return; }
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
        });
        io.to(roomCode).emit('playersUpdate', getPlayersList(room));
        console.log(`${playerName} a rejoint ${roomCode}`);
    });

    // --- Spectateur ---
    socket.on('joinSpectator', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) { socket.emit('joinError', 'Salle inexistante'); return; }
        socket.join(roomCode);
        socket.emit('spectatorJoined', {
            roomCode,
            currentQuestion: room.currentQuestion,
            isLocked: room.isLocked,
            players: getPlayersList(room),
            lastWinner: room.lastBuzzerWinner,
            answerTime: room.answerTime,
            questionTime: room.questionTime,
            currentAnswer: room.currentAnswer,
            showingAnswer: room.showingAnswer,
        });
        console.log(`Spectateur connecté à ${roomCode}`);
    });

    // --- Charger la liste de questions ---
    socket.on('loadQuestions', ({ roomCode, questions, mode }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        room.questions = questions; // [{question, answer}]
        room.mode = mode || 'successive';
        room.currentIndex = -1;
        room.usedIndices = [];
        io.to(roomCode).emit('questionsLoaded', { count: questions.length, mode: room.mode });
        console.log(`${questions.length} questions chargées en mode ${room.mode}`);
    });

    // --- Démarrer le quiz (envoie la première question) ---
    socket.on('startQuiz', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        if (room.questions.length === 0) {
            socket.emit('errorMessage', 'Aucune question chargée.');
            return;
        }
        room.currentIndex = -1;
        room.usedIndices = [];
        sendNextQuestion(room, roomCode);
    });

    // --- Passer à la question suivante (manuel) ---
    socket.on('nextQuestion', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        if (room.showingAnswer) {
            // Si on affiche la réponse, on passe directement sans attendre
            clearTimeout(room.answerDisplayTimeout);
            room.showingAnswer = false;
        }
        sendNextQuestion(room, roomCode);
    });

    // --- Fonction pour envoyer la question suivante ---
    function sendNextQuestion(room, roomCode) {
        if (room.questions.length === 0) return;

        // Choisir l'index
        let index;
        if (room.mode === 'random') {
            // Toutes les questions ont-elles été utilisées ?
            if (room.usedIndices.length >= room.questions.length) {
                // On réinitialise si on veut boucler
                room.usedIndices = [];
            }
            let available = [];
            for (let i = 0; i < room.questions.length; i++) {
                if (!room.usedIndices.includes(i)) available.push(i);
            }
            if (available.length === 0) {
                // tout utilisé, on réinitialise
                room.usedIndices = [];
                available = room.questions.map((_, i) => i);
            }
            const rand = Math.floor(Math.random() * available.length);
            index = available[rand];
            room.usedIndices.push(index);
        } else {
            // successif
            room.currentIndex = (room.currentIndex + 1) % room.questions.length;
            index = room.currentIndex;
        }

        const q = room.questions[index];
        if (!q) return;

        // Préparer la question
        room.currentQuestion = q.question;
        room.currentAnswer = q.answer;
        room.buzzedThisRound = [];
        room.excludedPlayers = [];
        room.isLocked = false;
        room.awaitingValidation = false;
        room.currentBuzzerId = null;
        room.lastBuzzerWinner = null;
        room.showingAnswer = false;

        // Arrêter les timers précédents
        clearInterval(room.timerInterval);
        room.timerRunning = false;

        // Diffuser la question
        io.to(roomCode).emit('newQuestion', {
            question: q.question,
            isLocked: false,
            questionTime: room.questionTime
        });

        // Démarrer le timer général
        startGeneralTimer(room, roomCode);

        console.log(`Question ${index+1}/${room.questions.length}: ${q.question}`);
    }

    // --- Envoi manuel d'une question (avec réponse optionnelle) ---
    socket.on('sendQuestion', ({ roomCode, questionText, answerText }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;

        // Arrêter le quiz automatique
        clearInterval(room.timerInterval);
        room.timerRunning = false;
        room.showingAnswer = false;

        room.currentQuestion = questionText;
        room.currentAnswer = answerText || null;
        room.buzzedThisRound = [];
        room.excludedPlayers = [];
        room.isLocked = false;
        room.awaitingValidation = false;
        room.currentBuzzerId = null;
        room.lastBuzzerWinner = null;

        io.to(roomCode).emit('newQuestion', {
            question: questionText,
            isLocked: false,
            questionTime: room.questionTime,
            manual: true
        });

        startGeneralTimer(room, roomCode);
    });

    // --- Timer général ---
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
                // Temps écoulé : afficher la réponse et passer
                if (room.currentAnswer) {
                    revealAnswer(room, roomCode, null); // null = pas de gagnant
                } else {
                    io.to(roomCode).emit('questionTimeout');
                    room.isLocked = true;
                    room.awaitingValidation = false;
                    room.currentBuzzerId = null;
                    // Si autoNext, on passe après un délai
                    if (room.autoNext && room.questions.length > 0) {
                        setTimeout(() => sendNextQuestion(room, roomCode), 3000);
                    }
                }
            }
        }, 1000);
    }

    // --- Timer individuel ---
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
                // Si réponse existe, on l'affiche après un court délai ?
                // On laisse les autres buzzer, on ne révèle pas encore.
                // On redémarre le timer général
                startGeneralTimer(room, roomCode);
            }
        }, 1000);
    }

    // --- Révéler la réponse (après validation ou timeout) ---
    function revealAnswer(room, roomCode, winnerName) {
        room.showingAnswer = true;
        room.isLocked = true;
        room.awaitingValidation = false;
        room.currentBuzzerId = null;

        const answer = room.currentAnswer || 'Pas de réponse enregistrée';
        io.to(roomCode).emit('showAnswer', {
            answer,
            winnerName: winnerName || null,
        });

        // Arrêter les timers
        clearInterval(room.timerInterval);
        room.timerRunning = false;

        // Après un délai, passer à la question suivante si autoNext
        if (room.autoNext && room.questions.length > 0) {
            clearTimeout(room.answerDisplayTimeout);
            room.answerDisplayTimeout = setTimeout(() => {
                room.showingAnswer = false;
                sendNextQuestion(room, roomCode);
            }, 5000); // 5 secondes d'affichage de la réponse
        }
    }

    // --- Validation d'un buzz ---
    socket.on('validateBuzz', ({ roomCode, playerId }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        if (!room.awaitingValidation || room.currentBuzzerId !== playerId) return;

        // Arrêter timer individuel
        clearInterval(room.timerInterval);
        room.timerRunning = false;

        // Ajouter point
        if (room.players[playerId]) {
            room.players[playerId].score += 1;
        }
        const playerName = room.players[playerId]?.name || 'Anonyme';
        const newScore = room.players[playerId].score;

        // Réinitialiser pour la validation
        room.buzzedThisRound = [];
        room.excludedPlayers = [];
        room.isLocked = false;
        room.awaitingValidation = false;
        room.currentBuzzerId = null;
        room.lastBuzzerWinner = { playerId, playerName };

        io.to(roomCode).emit('questionValidated', {
            winnerName: playerName,
            newScore,
            scores: getScores(room)
        });
        io.to(roomCode).emit('scoresUpdate', getScores(room));
        io.to(roomCode).emit('playersUpdate', getPlayersList(room));

        // Révéler la réponse
        revealAnswer(room, roomCode, playerName);
    });

    // --- Refus d'un buzz ---
    socket.on('rejectBuzz', ({ roomCode, playerId }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        if (!room.awaitingValidation || room.currentBuzzerId !== playerId) return;

        clearInterval(room.timerInterval);
        room.timerRunning = false;

        if (!room.excludedPlayers.includes(playerId)) {
            room.excludedPlayers.push(playerId);
        }
        room.awaitingValidation = false;
        room.currentBuzzerId = null;
        room.isLocked = false;

        const playerName = room.players[playerId]?.name || 'Anonyme';
        io.to(roomCode).emit('buzzRejected', {
            playerName,
            excludedPlayers: room.excludedPlayers
        });
        io.to(roomCode).emit('playerExcluded', { playerId });

        // Redémarrer timer général
        startGeneralTimer(room, roomCode);
    });

    // --- Joueur buzz ---
    socket.on('buzz', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        if (room.isLocked || room.awaitingValidation || room.showingAnswer) {
            socket.emit('buzzResult', { success: false, message: 'Buzzer verrouillé' });
            return;
        }
        if (room.excludedPlayers.includes(socket.id)) {
            socket.emit('buzzResult', { success: false, message: 'Vous êtes exclu' });
            return;
        }
        if (room.buzzedThisRound.includes(socket.id)) {
            socket.emit('buzzResult', { success: false, message: 'Vous avez déjà buzzé' });
            return;
        }

        room.buzzedThisRound.push(socket.id);
        room.isLocked = true;
        room.awaitingValidation = true;
        room.currentBuzzerId = socket.id;
        const playerName = room.players[socket.id]?.name || 'Anonyme';
        room.lastBuzzerWinner = { playerId: socket.id, playerName };

        socket.emit('buzzResult', { success: true, message: 'Buzz enregistré' });
        io.to(roomCode).emit('playerBuzzed', { playerId: socket.id, playerName });

        // Arrêter timer général
        clearInterval(room.timerInterval);
        room.timerRunning = false;

        // Démarrer timer individuel
        startAnswerTimer(room, roomCode, socket.id);
    });

    // --- Réinitialiser buzzer (déverrouillage manuel) ---
    socket.on('resetBuzzer', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        room.isLocked = false;
        room.awaitingValidation = false;
        room.currentBuzzerId = null;
        io.to(roomCode).emit('buzzerReset', { isLocked: false, question: room.currentQuestion });
        if (!room.timerRunning) {
            startGeneralTimer(room, roomCode);
        }
    });

    // --- Modifier les timers ---
    socket.on('setTimers', ({ roomCode, answerTime, questionTime }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        room.answerTime = answerTime;
        room.questionTime = questionTime;
        io.to(roomCode).emit('timersUpdated', { answerTime, questionTime });
    });

    // --- Modifier le mode autoNext ---
    socket.on('setAutoNext', ({ roomCode, auto }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        room.autoNext = auto;
    });

    // --- Déconnexion ---
    socket.on('disconnect', () => {
        for (const [roomCode, room] of Object.entries(rooms)) {
            if (room.players[socket.id]) {
                delete room.players[socket.id];
                io.to(roomCode).emit('playersUpdate', getPlayersList(room));
            }
            if (room.adminId === socket.id) {
                clearInterval(room.timerInterval);
                clearTimeout(room.answerDisplayTimeout);
                delete rooms[roomCode];
                io.to(roomCode).emit('roomClosed', 'L\'hôte a quitté');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
    console.log(`Admin : http://localhost:${PORT}/admin`);
    console.log(`Joueur : http://localhost:${PORT}/player.html`);
    console.log(`Spectateur : http://localhost:${PORT}/spectator.html`);
});