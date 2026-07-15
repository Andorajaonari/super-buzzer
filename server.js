const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'player.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/spectator', (req, res) => res.sendFile(path.join(__dirname, 'public', 'spectator.html')));

const rooms = {};

const basicAuth = require('basic-auth');

// --- Middleware d'authentification pour l'admin ---
const auth = function (req, res, next) {
    // Ne protéger que la route /admin et ses sous-routes
    if (!req.path.startsWith('/admin')) {
        return next();
    }

    const user = basicAuth(req);
    // Définissez vos identifiants ici (à mettre dans des variables d'environnement)
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'motdepasse';

    if (!user || user.name !== adminUser || user.pass !== adminPass) {
        res.set('WWW-Authenticate', 'Basic realm="Administration"');
        return res.status(401).send('Authentification requise.');
    }
    next();
};

// Appliquer le middleware avant les routes
app.use(auth);

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'player.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/spectator', (req, res) => res.sendFile(path.join(__dirname, 'public', 'spectator.html')));

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

function getPlayersList(room) {
    return Object.entries(room.players).map(([id, data]) => ({ id, ...data }));
}

function getScores(room) {
    const scores = {};
    for (const [id, data] of Object.entries(room.players)) scores[id] = data.score;
    return scores;
}

io.on('connection', (socket) => {
    console.log('Client connecté:', socket.id);

    socket.on('createRoom', (adminName) => {
        let roomCode = generateRoomCode();
        while (rooms[roomCode]) roomCode = generateRoomCode();
        rooms[roomCode] = {
            adminId: socket.id,
            players: {},
            questions: [],
            currentIndex: -1,
            mode: 'successive',
            usedIndices: [],
            currentQuestion: null,
            currentAnswer: null,
            buzzedThisRound: [],
            excludedPlayers: [],
            isLocked: false,
            awaitingValidation: false,
            currentBuzzerId: null,
            lastBuzzerWinner: null,
            answerTime: 10,
            questionTime: 30,
            timerRunning: false,
            timerInterval: null,
            autoNext: true,
            showingAnswer: false,
            answerDisplayTimeout: null,
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode });
        console.log(`Salle ${roomCode} créée`);
    });

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
    });

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
    });

    socket.on('loadQuestions', ({ roomCode, questions, mode }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        if (!questions || questions.length === 0) {
            socket.emit('errorMessage', 'Aucune question valide.');
            return;
        }
        room.questions = questions;
        room.mode = mode || 'successive';
        room.currentIndex = -1;
        room.usedIndices = [];
        io.to(roomCode).emit('questionsLoaded', { count: questions.length, mode: room.mode });
        console.log(`${questions.length} questions chargées en mode ${room.mode}`);
    });

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

    socket.on('nextQuestion', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        if (room.questions.length === 0) {
            socket.emit('errorMessage', 'Aucune question chargée.');
            return;
        }
        if (room.showingAnswer) {
            clearTimeout(room.answerDisplayTimeout);
            room.showingAnswer = false;
        }
        sendNextQuestion(room, roomCode);
    });

    function sendNextQuestion(room, roomCode) {
        if (room.questions.length === 0) return;
        let index;
        if (room.mode === 'random') {
            if (room.usedIndices.length >= room.questions.length) room.usedIndices = [];
            let available = [];
            for (let i = 0; i < room.questions.length; i++) {
                if (!room.usedIndices.includes(i)) available.push(i);
            }
            if (available.length === 0) {
                room.usedIndices = [];
                available = room.questions.map((_, i) => i);
            }
            const rand = Math.floor(Math.random() * available.length);
            index = available[rand];
            room.usedIndices.push(index);
        } else {
            room.currentIndex = (room.currentIndex + 1) % room.questions.length;
            index = room.currentIndex;
        }
        const q = room.questions[index];
        if (!q) return;
        room.currentQuestion = q.question;
        room.currentAnswer = q.answer;
        room.buzzedThisRound = [];
        room.excludedPlayers = [];
        room.isLocked = false;
        room.awaitingValidation = false;
        room.currentBuzzerId = null;
        room.lastBuzzerWinner = null;
        room.showingAnswer = false;
        clearInterval(room.timerInterval);
        room.timerRunning = false;
        io.to(roomCode).emit('newQuestion', {
            question: q.question,
            isLocked: false,
            questionTime: room.questionTime
        });
        startGeneralTimer(room, roomCode);
        console.log(`Question ${index+1}/${room.questions.length}: ${q.question}`);
    }

    socket.on('sendQuestion', ({ roomCode, questionText, answerText }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        clearInterval(room.timerInterval);
        clearTimeout(room.answerDisplayTimeout);
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
                if (room.currentAnswer) {
                    revealAnswer(room, roomCode, null);
                } else {
                    io.to(roomCode).emit('questionTimeout');
                    room.isLocked = true;
                    room.awaitingValidation = false;
                    room.currentBuzzerId = null;
                    if (room.autoNext && room.questions.length > 0) {
                        setTimeout(() => sendNextQuestion(room, roomCode), 3000);
                    }
                }
            }
        }, 1000);
    }

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
                if (!room.excludedPlayers.includes(playerId)) {
                    room.excludedPlayers.push(playerId);
                }
                room.awaitingValidation = false;
                room.currentBuzzerId = null;
                room.isLocked = false;
                io.to(roomCode).emit('answerTimeout', { playerId });
                startGeneralTimer(room, roomCode);
            }
        }, 1000);
    }

    function revealAnswer(room, roomCode, winnerName) {
        room.showingAnswer = true;
        room.isLocked = true;
        room.awaitingValidation = false;
        room.currentBuzzerId = null;
        const answer = room.currentAnswer || 'Pas de réponse enregistrée';
        io.to(roomCode).emit('showAnswer', { answer, winnerName: winnerName || null });
        clearInterval(room.timerInterval);
        room.timerRunning = false;
        if (room.autoNext && room.questions.length > 0) {
            clearTimeout(room.answerDisplayTimeout);
            room.answerDisplayTimeout = setTimeout(() => {
                room.showingAnswer = false;
                sendNextQuestion(room, roomCode);
            }, 5000);
        }
    }

    socket.on('validateBuzz', ({ roomCode, playerId }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        if (!room.awaitingValidation || room.currentBuzzerId !== playerId) return;
        clearInterval(room.timerInterval);
        room.timerRunning = false;
        if (room.players[playerId]) {
            room.players[playerId].score += 1;
        }
        const playerName = room.players[playerId]?.name || 'Anonyme';
        const newScore = room.players[playerId].score;
        room.buzzedThisRound = [];
        room.excludedPlayers = [];
        room.isLocked = false;
        room.awaitingValidation = false;
        room.currentBuzzerId = null;
        room.lastBuzzerWinner = { playerId, playerName };
        io.to(roomCode).emit('questionValidated', { winnerName: playerName, newScore, scores: getScores(room) });
        io.to(roomCode).emit('scoresUpdate', getScores(room));
        io.to(roomCode).emit('playersUpdate', getPlayersList(room));
        revealAnswer(room, roomCode, playerName);
    });

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
        io.to(roomCode).emit('buzzRejected', { playerName, excludedPlayers: room.excludedPlayers });
        io.to(roomCode).emit('playerExcluded', { playerId });
        startGeneralTimer(room, roomCode);
    });

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
        clearInterval(room.timerInterval);
        room.timerRunning = false;
        startAnswerTimer(room, roomCode, socket.id);
    });

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

    socket.on('setTimers', ({ roomCode, answerTime, questionTime }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        room.answerTime = answerTime;
        room.questionTime = questionTime;
        io.to(roomCode).emit('timersUpdated', { answerTime, questionTime });
    });

    socket.on('setAutoNext', ({ roomCode, auto }) => {
        const room = rooms[roomCode];
        if (!room || room.adminId !== socket.id) return;
        room.autoNext = auto;
    });

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