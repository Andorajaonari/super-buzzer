const socket = io();

// Éléments DOM
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const playersList = document.getElementById('playersList');
const playerCount = document.getElementById('playerCount');
const questionInput = document.getElementById('questionInput');
const answerInput = document.getElementById('answerInput');
const sendQuestionBtn = document.getElementById('sendQuestionBtn');
const resetBuzzerBtn = document.getElementById('resetBuzzerBtn');
const buzzStatus = document.getElementById('buzzStatus');
const buzzAction = document.getElementById('buzzAction');
const buzzPlayerName = document.getElementById('buzzPlayerName');
const validateBtn = document.getElementById('validateBtn');
const rejectBtn = document.getElementById('rejectBtn');
const answerTimeInput = document.getElementById('answerTimeInput');
const questionTimeInput = document.getElementById('questionTimeInput');
const applyTimersBtn = document.getElementById('applyTimersBtn');
const generalTimerValue = document.getElementById('generalTimerValue');

// Éléments de la banque de questions
const questionsList = document.getElementById('questionsList');
const modeSelect = document.getElementById('modeSelect');
const loadQuestionsBtn = document.getElementById('loadQuestionsBtn');
const startQuizBtn = document.getElementById('startQuizBtn');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');
const autoNextCheck = document.getElementById('autoNextCheck');
const quizStatus = document.getElementById('quizStatus');

let currentRoomCode = null;
let currentBuzzerId = null;

// --- Création automatique de la salle ---
socket.emit('createRoom', 'Admin');

socket.on('roomCreated', ({ roomCode }) => {
    currentRoomCode = roomCode;
    roomCodeDisplay.textContent = roomCode;
    document.title = `Admin - Salle ${roomCode}`;
});

// --- Mise à jour des joueurs ---
socket.on('playersUpdate', (players) => {
    if (!players || players.length === 0) {
        playersList.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">Aucun joueur</div>';
        playerCount.textContent = '0';
        return;
    }
    playerCount.textContent = players.length;
    let html = '';
    players.forEach(p => {
        html += `
            <div class="player-item" data-id="${p.id}">
                <span class="player-name">${p.name}</span>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span class="player-score">${p.score || 0}</span>
                    <div class="score-btns">
                        <button class="plus" data-id="${p.id}" data-delta="1">+</button>
                        <button class="minus" data-id="${p.id}" data-delta="-1">-</button>
                    </div>
                </div>
            </div>
        `;
    });
    playersList.innerHTML = html;

    // Écouteurs pour les boutons + et -
    document.querySelectorAll('.score-btns button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const playerId = btn.dataset.id;
            const delta = parseInt(btn.dataset.delta);
            if (currentRoomCode) {
                socket.emit('updateScore', { roomCode: currentRoomCode, playerId, delta });
            }
        });
    });
});

// --- Mise à jour des scores uniquement (optionnel) ---
socket.on('scoresUpdate', (scores) => {
    // Les scores sont déjà mis à jour via playersUpdate, donc on ne fait rien ici.
    // Mais on pourrait raffraîchir si besoin.
});

// --- Mise à jour des timers ---
socket.on('timersUpdated', ({ answerTime, questionTime }) => {
    answerTimeInput.value = answerTime;
    questionTimeInput.value = questionTime;
});

// --- Tick du timer général ---
socket.on('timerTick', ({ type, remaining }) => {
    if (type === 'general') {
        generalTimerValue.textContent = remaining;
        if (remaining <= 5) {
            generalTimerValue.style.color = '#e53935';
        } else {
            generalTimerValue.style.color = '#f5c842';
        }
    }
});

// --- Nouvelle question (automatique ou manuelle) ---
socket.on('newQuestion', ({ question, isLocked, questionTime, manual }) => {
    buzzAction.style.display = 'none';
    currentBuzzerId = null;
    buzzStatus.innerHTML = `<div class="waiting">Question envoyée. En attente d'un buzzer...</div>`;
    generalTimerValue.textContent = questionTime;
    generalTimerValue.style.color = '#f5c842';
    if (!manual) {
        quizStatus.textContent = `Question en cours : "${question}"`;
    }
});

// --- Un joueur buzz ---
socket.on('playerBuzzed', ({ playerId, playerName }) => {
    buzzPlayerName.textContent = playerName;
    currentBuzzerId = playerId;
    buzzAction.style.display = 'block';
    buzzStatus.innerHTML = `<div class="winner">${playerName} a buzzé !</div>`;
});

// --- Validation (bonne réponse) ---
validateBtn.addEventListener('click', () => {
    if (!currentRoomCode || !currentBuzzerId) return;
    socket.emit('validateBuzz', { roomCode: currentRoomCode, playerId: currentBuzzerId });
    buzzAction.style.display = 'none';
    currentBuzzerId = null;
});

// --- Refus (mauvaise réponse) ---
rejectBtn.addEventListener('click', () => {
    if (!currentRoomCode || !currentBuzzerId) return;
    socket.emit('rejectBuzz', { roomCode: currentRoomCode, playerId: currentBuzzerId });
    buzzAction.style.display = 'none';
    currentBuzzerId = null;
    buzzStatus.innerHTML = `<div class="waiting">Réponse refusée. En attente d'un autre buzzer...</div>`;
});

// --- Question validée (retour serveur) ---
socket.on('questionValidated', ({ winnerName, newScore }) => {
    buzzAction.style.display = 'none';
    buzzStatus.innerHTML = `<div class="winner" style="color:#4caf50;">${winnerName} a gagné 1 point (score: ${newScore})</div>`;
});

// --- Affichage de la réponse ---
socket.on('showAnswer', ({ answer, winnerName }) => {
    let msg = winnerName ? `${winnerName} a répondu : ` : 'La réponse était : ';
    buzzStatus.innerHTML = `<div class="winner" style="color:#f5c842;">${msg} ${answer}</div>`;
});

// --- Temps écoulé pour la question ---
socket.on('questionTimeout', () => {
    buzzAction.style.display = 'none';
    buzzStatus.innerHTML = `<div class="waiting" style="color:#e53935;">Temps écoulé. Personne n'a répondu.</div>`;
    generalTimerValue.textContent = '0';
});

// --- Confirmation du chargement des questions ---
socket.on('questionsLoaded', ({ count, mode }) => {
    quizStatus.textContent = `${count} questions chargées, mode ${mode}`;
});

// --- Envoyer une question manuelle ---
sendQuestionBtn.addEventListener('click', () => {
    const question = questionInput.value.trim();
    const answer = answerInput.value.trim();
    if (!question) { alert('Veuillez saisir une question.'); return; }
    if (!currentRoomCode) return;
    socket.emit('sendQuestion', { roomCode: currentRoomCode, questionText: question, answerText: answer || null });
    questionInput.value = '';
    answerInput.value = '';
});

// --- Charger les questions depuis le textarea ---
loadQuestionsBtn.addEventListener('click', function() {
    const text = questionsList.value.trim();
    if (!text) {
        alert('Veuillez coller la liste des questions (une par ligne avec "Question | Réponse").');
        return;
    }
    const lines = text.split('\n').filter(l => l.trim() !== '');
    const questions = lines.map(line => {
        const parts = line.split('|').map(s => s.trim());
        return { question: parts[0] || 'Question vide', answer: parts[1] || '' };
    });
    if (questions.length === 0) {
        alert('Aucune question valide.');
        return;
    }
    const mode = modeSelect.value;
    socket.emit('loadQuestions', { roomCode: currentRoomCode, questions, mode });
    quizStatus.textContent = `${questions.length} questions chargées (mode ${mode})`;
});

// --- Démarrer le quiz (première question) ---
startQuizBtn.addEventListener('click', function() {
    if (!currentRoomCode) {
        alert('Pas de salle.');
        return;
    }
    socket.emit('startQuiz', { roomCode: currentRoomCode });
});

// --- Question suivante (manuel) ---
nextQuestionBtn.addEventListener('click', function() {
    if (!currentRoomCode) {
        alert('Pas de salle.');
        return;
    }
    socket.emit('nextQuestion', { roomCode: currentRoomCode });
});

// --- Auto-next (case à cocher) ---
autoNextCheck.addEventListener('change', function() {
    if (!currentRoomCode) return;
    socket.emit('setAutoNext', { roomCode: currentRoomCode, auto: autoNextCheck.checked });
});

// --- Réinitialiser le buzzer (déverrouillage) ---
resetBuzzerBtn.addEventListener('click', () => {
    if (!currentRoomCode) return;
    socket.emit('resetBuzzer', { roomCode: currentRoomCode });
});

// --- Appliquer les timers ---
applyTimersBtn.addEventListener('click', () => {
    const answerTime = parseInt(answerTimeInput.value);
    const questionTime = parseInt(questionTimeInput.value);
    if (answerTime < 3 || answerTime > 60) { alert('Temps réponse entre 3 et 60s'); return; }
    if (questionTime < 10 || questionTime > 120) { alert('Temps question entre 10 et 120s'); return; }
    if (!currentRoomCode) return;
    socket.emit('setTimers', { roomCode: currentRoomCode, answerTime, questionTime });
});

// --- Gestion de la fermeture de la salle ---
socket.on('roomClosed', (msg) => {
    alert('La salle a été fermée.');
    location.reload();
});

// --- Gestion des messages d'erreur ---
socket.on('errorMessage', (msg) => {
    alert(msg);
});