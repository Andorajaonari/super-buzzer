const socket = io();

const joinScreen = document.getElementById('joinScreen');
const gameScreen = document.getElementById('gameScreen');
const roomCodeInput = document.getElementById('roomCodeInput');
const playerNameInput = document.getElementById('playerNameInput');
const joinBtn = document.getElementById('joinBtn');
const joinError = document.getElementById('joinError');
const displayRoomCode = document.getElementById('displayRoomCode');
const displayPlayerName = document.getElementById('displayPlayerName');
const questionDisplay = document.getElementById('questionDisplay');
const buzzerBtn = document.getElementById('buzzerBtn');
const feedbackMsg = document.getElementById('feedbackMsg');
const scoreValue = document.getElementById('scoreValue');
const timerValue = document.getElementById('timerValue');

let currentRoomCode = null;
let myId = null;

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
    const playerName = playerNameInput.value.trim();
    if (!roomCode || roomCode.length !== 4) { joinError.textContent = 'Code invalide'; return; }
    if (!playerName) { joinError.textContent = 'Entrez un pseudo'; return; }
    joinError.textContent = '';
    socket.emit('joinRoom', { roomCode, playerName });
});

roomCodeInput.addEventListener('keypress', e => { if (e.key === 'Enter') joinBtn.click(); });
playerNameInput.addEventListener('keypress', e => { if (e.key === 'Enter') joinBtn.click(); });

socket.on('joinedRoom', ({ roomCode, playerId, currentQuestion, isLocked, scores, answerTime, questionTime }) => {
    currentRoomCode = roomCode;
    myId = playerId;
    displayRoomCode.textContent = roomCode;
    displayPlayerName.textContent = playerNameInput.value;
    joinScreen.style.display = 'none';
    gameScreen.style.display = 'flex';

    if (currentQuestion) {
        questionDisplay.innerHTML = currentQuestion;
        buzzerBtn.disabled = isLocked;
        feedbackMsg.textContent = isLocked ? 'Buzzer verrouillé' : 'Prêt à buzzer';
    } else {
        questionDisplay.innerHTML = '<span class="waiting">En attente de la question...</span>';
        buzzerBtn.disabled = true;
        feedbackMsg.textContent = 'Attendez la question';
    }
    if (scores && scores[myId] !== undefined) {
        scoreValue.textContent = scores[myId];
    }
});

socket.on('joinError', (msg) => { joinError.textContent = msg; });

socket.on('newQuestion', ({ question, isLocked, questionTime }) => {
    questionDisplay.innerHTML = question;
    buzzerBtn.disabled = false;
    feedbackMsg.textContent = 'Prêt à buzzer';
    feedbackMsg.className = 'feedback';
    timerValue.textContent = questionTime;
});

socket.on('timerTick', ({ type, remaining }) => {
    timerValue.textContent = remaining;
});

socket.on('playerBuzzed', ({ playerId, playerName }) => {
    if (playerId !== myId) {
        feedbackMsg.textContent = `${playerName} a buzzé en premier`;
        feedbackMsg.className = 'feedback error';
        buzzerBtn.disabled = true;
        playBuzzSound();
    }
});

socket.on('buzzResult', ({ success, message }) => {
    if (success) {
        feedbackMsg.textContent = 'Buzz enregistré ! Attendez la validation.';
        feedbackMsg.className = 'feedback success';
        buzzerBtn.disabled = true;
        playBuzzSound();
    } else {
        feedbackMsg.textContent = message;
        feedbackMsg.className = 'feedback error';
    }
});

socket.on('questionValidated', ({ winnerName, newScore }) => {
    if (winnerName === displayPlayerName.textContent) {
        feedbackMsg.textContent = 'Bonne réponse ! +1 point';
        feedbackMsg.className = 'feedback success';
        playCorrectSound();
    } else {
        feedbackMsg.textContent = `${winnerName} a trouvé la réponse`;
        feedbackMsg.className = 'feedback';
        playCorrectSound();
    }
    buzzerBtn.disabled = true;
    if (myId && newScore !== undefined) {
        scoreValue.textContent = newScore;
    }
});

socket.on('buzzRejected', ({ playerName }) => {
    if (playerName === displayPlayerName.textContent) {
        feedbackMsg.textContent = 'Mauvaise réponse, vous êtes exclu';
        feedbackMsg.className = 'feedback error';
        playWrongSound();
    } else {
        feedbackMsg.textContent = `${playerName} a donné une mauvaise réponse`;
        feedbackMsg.className = 'feedback';
    }
    buzzerBtn.disabled = false;
});

socket.on('playerExcluded', ({ playerId }) => {
    if (playerId === myId) {
        buzzerBtn.disabled = true;
        feedbackMsg.textContent = 'Vous êtes exclu pour cette question';
        feedbackMsg.className = 'feedback error';
    }
});

socket.on('answerTimeout', ({ playerId }) => {
    if (playerId === myId) {
        feedbackMsg.textContent = 'Temps écoulé ! Vous êtes exclu';
        feedbackMsg.className = 'feedback error';
        playTimeoutSound();
        buzzerBtn.disabled = true;
    }
});

socket.on('showAnswer', ({ answer, winnerName }) => {
    let msg = winnerName ? `${winnerName} a répondu : ` : 'La réponse était : ';
    questionDisplay.innerHTML = `<div style="color:#f5c842;">${msg} ${answer}</div>`;
    buzzerBtn.disabled = true;
    feedbackMsg.textContent = 'Réponse affichée';
    feedbackMsg.className = 'feedback';
});

socket.on('questionTimeout', () => {
    feedbackMsg.textContent = 'Temps écoulé, personne n\'a répondu';
    feedbackMsg.className = 'feedback error';
    buzzerBtn.disabled = true;
    timerValue.textContent = '0';
    playTimeoutSound();
});

socket.on('scoresUpdate', (scores) => {
    if (scores && myId && scores[myId] !== undefined) {
        scoreValue.textContent = scores[myId];
    }
});

socket.on('buzzerReset', ({ isLocked, question }) => {
    if (question) {
        questionDisplay.innerHTML = question;
    }
    buzzerBtn.disabled = false;
    feedbackMsg.textContent = 'Buzzer réinitialisé';
    feedbackMsg.className = 'feedback';
});

buzzerBtn.addEventListener('click', () => {
    if (!currentRoomCode) return;
    if (buzzerBtn.disabled) {
        feedbackMsg.textContent = 'Buzzer indisponible';
        feedbackMsg.className = 'feedback error';
        return;
    }
    socket.emit('buzz', { roomCode: currentRoomCode });
});

socket.on('roomClosed', () => {
    alert('La salle a été fermée');
    location.reload();
});