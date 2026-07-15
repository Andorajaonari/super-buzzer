const socket = io();

const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const playersList = document.getElementById('playersList');
const playerCount = document.getElementById('playerCount');
const questionInput = document.getElementById('questionInput');
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

let currentRoomCode = null;
let currentBuzzerId = null;

// Création automatique d'une salle
socket.emit('createRoom', 'Admin');

socket.on('roomCreated', ({ roomCode }) => {
    currentRoomCode = roomCode;
    roomCodeDisplay.textContent = roomCode;
    document.title = `Admin - Salle ${roomCode}`;
});

// Mise à jour des joueurs
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

// Mise à jour des timers
socket.on('timersUpdated', ({ answerTime, questionTime }) => {
    answerTimeInput.value = answerTime;
    questionTimeInput.value = questionTime;
});

// Tick du timer
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

// Nouvelle question
socket.on('newQuestion', ({ question, isLocked, questionTime }) => {
    buzzAction.style.display = 'none';
    currentBuzzerId = null;
    buzzStatus.innerHTML = `<div class="waiting">Question envoyée. En attente d'un buzzer...</div>`;
    generalTimerValue.textContent = questionTime;
    generalTimerValue.style.color = '#f5c842';
});

// Un joueur buzz
socket.on('playerBuzzed', ({ playerId, playerName }) => {
    buzzPlayerName.textContent = playerName;
    currentBuzzerId = playerId;
    buzzAction.style.display = 'block';
    buzzStatus.innerHTML = `<div class="winner">${playerName} a buzzé !</div>`;
});

// Validation
validateBtn.addEventListener('click', () => {
    if (!currentRoomCode || !currentBuzzerId) return;
    socket.emit('validateBuzz', { roomCode: currentRoomCode, playerId: currentBuzzerId });
    buzzAction.style.display = 'none';
    currentBuzzerId = null;
});

// Refus
rejectBtn.addEventListener('click', () => {
    if (!currentRoomCode || !currentBuzzerId) return;
    socket.emit('rejectBuzz', { roomCode: currentRoomCode, playerId: currentBuzzerId });
    buzzAction.style.display = 'none';
    currentBuzzerId = null;
    buzzStatus.innerHTML = `<div class="waiting">Réponse refusée. En attente d'un autre buzzer...</div>`;
});

// Question validée
socket.on('questionValidated', ({ winnerName, newScore }) => {
    buzzAction.style.display = 'none';
    buzzStatus.innerHTML = `<div class="winner" style="color:#4caf50;">${winnerName} a gagné 1 point (score: ${newScore})</div>`;
});

// Question timeout (temps général écoulé)
socket.on('questionTimeout', () => {
    buzzAction.style.display = 'none';
    buzzStatus.innerHTML = `<div class="waiting" style="color:#e53935;">Temps écoulé. Personne n'a répondu.</div>`;
    generalTimerValue.textContent = '0';
});

// Envoyer question
sendQuestionBtn.addEventListener('click', () => {
    const text = questionInput.value.trim();
    if (!text) { alert('Veuillez saisir une question.'); return; }
    if (!currentRoomCode) return;
    socket.emit('sendQuestion', { roomCode: currentRoomCode, questionText: text });
});

// Réinitialiser buzzer (déverrouiller)
resetBuzzerBtn.addEventListener('click', () => {
    if (!currentRoomCode) return;
    socket.emit('resetBuzzer', { roomCode: currentRoomCode });
});

// Appliquer les timers
applyTimersBtn.addEventListener('click', () => {
    const answerTime = parseInt(answerTimeInput.value);
    const questionTime = parseInt(questionTimeInput.value);
    if (answerTime < 3 || answerTime > 60) { alert('Temps de réponse entre 3 et 60s'); return; }
    if (questionTime < 10 || questionTime > 120) { alert('Temps question entre 10 et 120s'); return; }
    if (!currentRoomCode) return;
    socket.emit('setTimers', { roomCode: currentRoomCode, answerTime, questionTime });
});

// Gestion des scores manuels (via boutons + et -)
// déjà géré via les event listeners dynamiques

// Gestion de la fermeture
socket.on('roomClosed', () => {
    alert('La salle a été fermée.');
    location.reload();
});