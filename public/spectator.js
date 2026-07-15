const socket = io();

const joinScreen = document.getElementById('joinScreen');
const gameScreen = document.getElementById('gameScreen');
const roomCodeInput = document.getElementById('roomCodeInput');
const joinBtn = document.getElementById('joinBtn');
const errorMsg = document.getElementById('errorMsg');
const questionDisplay = document.getElementById('questionDisplay');
const playersList = document.getElementById('playersList');
const winnerOverlay = document.getElementById('winnerOverlay');
const winnerNameDisplay = document.getElementById('winnerNameDisplay');
const closeWinnerBtn = document.getElementById('closeWinnerBtn');
const generalTimerValue = document.getElementById('generalTimerValue');

let currentRoomCode = null;
let currentPlayers = [];

// Sons
function playTone(freq, duration, type = 'sine') {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
}
function playBuzzSound() { playTone(800, 0.3, 'square'); }
function playCorrectSound() { playTone(523, 0.15); setTimeout(() => playTone(659, 0.15), 150); setTimeout(() => playTone(784, 0.2), 300); }
function playWrongSound() { playTone(300, 0.4, 'sawtooth'); }
function playTimeoutSound() { playTone(200, 0.5, 'sawtooth'); }

joinBtn.addEventListener('click', () => {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!roomCode || roomCode.length !== 4) { errorMsg.textContent = 'Code invalide'; return; }
    errorMsg.textContent = '';
    socket.emit('joinSpectator', { roomCode });
});

roomCodeInput.addEventListener('keypress', e => { if (e.key === 'Enter') joinBtn.click(); });

socket.on('spectatorJoined', ({ roomCode, currentQuestion, isLocked, players, lastWinner, answerTime, questionTime, remainingTime }) => {
    currentRoomCode = roomCode;
    joinScreen.style.display = 'none';
    gameScreen.style.display = 'flex';

    if (currentQuestion) {
        questionDisplay.innerHTML = currentQuestion;
    } else {
        questionDisplay.innerHTML = '<span class="waiting">En attente de la question...</span>';
    }

    if (lastWinner) {
        showWinner(lastWinner.playerName);
        playBuzzSound();
    }

    currentPlayers = players;
    renderPlayers(players);

    if (remainingTime !== null) {
        generalTimerValue.textContent = remainingTime;
    } else {
        generalTimerValue.textContent = '--';
    }
});

socket.on('joinError', (msg) => { errorMsg.textContent = msg; });

socket.on('newQuestion', ({ question, isLocked, questionTime }) => {
    questionDisplay.innerHTML = question;
    winnerOverlay.classList.remove('show');
    document.querySelectorAll('.score-item.highlight').forEach(el => el.classList.remove('highlight'));
    generalTimerValue.textContent = questionTime;
});

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

socket.on('playerBuzzed', ({ playerId, playerName }) => {
    showWinner(playerName);
    highlightPlayer(playerId);
    playBuzzSound();
});

socket.on('questionValidated', ({ winnerName, newScore }) => {
    // On peut afficher un message temporaire
    questionDisplay.innerHTML = `<div style="color:#4caf50;">${winnerName} a trouvé la réponse (+1 point)</div>`;
    winnerOverlay.classList.remove('show');
    playCorrectSound();
    setTimeout(() => {
        // On remettra la question quand l'admin en enverra une nouvelle
    }, 3000);
});

socket.on('buzzRejected', ({ playerName, excludedPlayers }) => {
    // Afficher un message dans la question
    questionDisplay.innerHTML = `<div style="color:#f5c842;">${playerName} a donné une mauvaise réponse. Autre joueur?</div>`;
    playWrongSound();
});

socket.on('questionTimeout', () => {
    questionDisplay.innerHTML = `<span style="color:#e53935;">Temps écoulé ! Personne n'a répondu.</span>`;
    generalTimerValue.textContent = '0';
    playTimeoutSound();
});

socket.on('scoresUpdate', (scores) => {
    // On peut re-render les joueurs (mais on a déjà playersUpdate)
});

socket.on('playersUpdate', (players) => {
    currentPlayers = players;
    renderPlayers(players);
});

socket.on('roomClosed', () => {
    alert('La salle a été fermée');
    location.reload();
});

function showWinner(playerName) {
    winnerNameDisplay.textContent = playerName;
    winnerOverlay.classList.add('show');
}

closeWinnerBtn.addEventListener('click', () => {
    winnerOverlay.classList.remove('show');
});

winnerOverlay.addEventListener('click', (e) => {
    if (e.target === winnerOverlay) {
        winnerOverlay.classList.remove('show');
    }
});

function renderPlayers(players) {
    if (!players || players.length === 0) {
        playersList.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">Aucun joueur</div>';
        return;
    }
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    let html = '';
    sorted.forEach((p, index) => {
        const medal = index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : '';
        html += `
            <div class="score-item" data-id="${p.id}">
                <span class="name">${medal}${p.name}</span>
                <span class="score">${p.score || 0}</span>
            </div>
        `;
    });
    playersList.innerHTML = html;
}

function highlightPlayer(playerId) {
    document.querySelectorAll('.score-item.highlight').forEach(el => el.classList.remove('highlight'));
    const item = document.querySelector(`.score-item[data-id="${playerId}"]`);
    if (item) item.classList.add('highlight');
}