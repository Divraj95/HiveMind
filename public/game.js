const socket = io();

// DOM Elements
const screens = {
  home: document.getElementById('home-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  results: document.getElementById('results-screen')
};

const elements = {
  playerName: document.getElementById('player-name'),
  createBtn: document.getElementById('create-btn'),
  joinBtn: document.getElementById('join-btn'),
  joinForm: document.getElementById('join-form'),
  roomCode: document.getElementById('room-code'),
  joinRoomBtn: document.getElementById('join-room-btn'),
  displayCode: document.getElementById('display-code'),
  playerList: document.getElementById('player-list'),
  startBtn: document.getElementById('start-btn'),
  waitingMsg: document.getElementById('waiting-msg'),
  roundNumber: document.getElementById('round-number'),
  promptText: document.getElementById('prompt-text'),
  answerInput: document.getElementById('answer-input'),
  submitBtn: document.getElementById('submit-btn'),
  answerSection: document.getElementById('answer-section'),
  waitingSection: document.getElementById('waiting-section'),
  answerCount: document.getElementById('answer-count'),
  resultsRound: document.getElementById('results-round'),
  herdAnswerText: document.getElementById('herd-answer-text'),
  herdCount: document.getElementById('herd-count'),
  resultsTable: document.getElementById('results-table'),
  nextRoundBtn: document.getElementById('next-round-btn'),
  waitingNextMsg: document.getElementById('waiting-next-msg'),
  errorToast: document.getElementById('error-toast')
};

// Game state
let isHost = false;
let currentRoomCode = null;
let myPlayerId = null;

// Utility functions
function showScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screenName].classList.add('active');
}

function showError(message) {
  elements.errorToast.textContent = message;
  elements.errorToast.classList.remove('hidden');
  setTimeout(() => {
    elements.errorToast.classList.add('hidden');
  }, 3000);
}

function updatePlayerList(players, hostId) {
  elements.playerList.innerHTML = '';
  players.forEach(player => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${player.name}</span>
      ${player.id === hostId ? '<span class="host-badge">HOST</span>' : ''}
    `;
    elements.playerList.appendChild(li);
  });
}

// Event listeners
elements.createBtn.addEventListener('click', () => {
  const name = elements.playerName.value.trim();
  if (!name) {
    showError('Please enter your name');
    return;
  }
  socket.emit('createRoom', name);
});

elements.joinBtn.addEventListener('click', () => {
  elements.joinForm.classList.toggle('hidden');
});

elements.joinRoomBtn.addEventListener('click', () => {
  const name = elements.playerName.value.trim();
  const code = elements.roomCode.value.trim().toUpperCase();

  if (!name) {
    showError('Please enter your name');
    return;
  }
  if (!code || code.length !== 4) {
    showError('Please enter a valid 4-character room code');
    return;
  }

  socket.emit('joinRoom', { code, playerName: name });
});

elements.startBtn.addEventListener('click', () => {
  socket.emit('startGame');
});

elements.submitBtn.addEventListener('click', () => {
  const answer = elements.answerInput.value.trim();
  if (!answer) {
    showError('Please enter an answer');
    return;
  }
  socket.emit('submitAnswer', answer);
  elements.answerSection.classList.add('hidden');
  elements.waitingSection.classList.remove('hidden');
});

elements.answerInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    elements.submitBtn.click();
  }
});

elements.roomCode.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    elements.joinRoomBtn.click();
  }
});

elements.nextRoundBtn.addEventListener('click', () => {
  socket.emit('nextRound');
});

// Socket event handlers
socket.on('connect', () => {
  myPlayerId = socket.id;
});

socket.on('roomCreated', ({ code, players }) => {
  isHost = true;
  currentRoomCode = code;
  elements.displayCode.textContent = code;
  updatePlayerList(players, socket.id);
  elements.startBtn.classList.remove('hidden');
  elements.waitingMsg.classList.add('hidden');
  showScreen('lobby');
});

socket.on('joinedRoom', ({ code, players, isHost: hostStatus }) => {
  isHost = hostStatus;
  currentRoomCode = code;
  elements.displayCode.textContent = code;
  updatePlayerList(players, null);

  if (isHost) {
    elements.startBtn.classList.remove('hidden');
    elements.waitingMsg.classList.add('hidden');
  } else {
    elements.startBtn.classList.add('hidden');
    elements.waitingMsg.classList.remove('hidden');
  }

  showScreen('lobby');
});

socket.on('playerJoined', ({ players }) => {
  // Find the host (first player or current host)
  updatePlayerList(players, isHost ? socket.id : null);
});

socket.on('playerLeft', ({ players, leftPlayer }) => {
  updatePlayerList(players, isHost ? socket.id : null);
});

socket.on('newHost', ({ hostId }) => {
  if (hostId === socket.id) {
    isHost = true;
    elements.startBtn.classList.remove('hidden');
    elements.waitingMsg.classList.add('hidden');
    elements.nextRoundBtn.classList.remove('hidden');
    elements.waitingNextMsg.classList.add('hidden');
  }
});

socket.on('gameStarted', ({ prompt, round }) => {
  elements.roundNumber.textContent = round;
  elements.promptText.textContent = prompt;
  elements.answerInput.value = '';
  elements.answerSection.classList.remove('hidden');
  elements.waitingSection.classList.add('hidden');
  showScreen('game');
});

socket.on('playerSubmitted', ({ answeredCount, totalPlayers }) => {
  elements.answerCount.textContent = `${answeredCount} / ${totalPlayers} answered`;
});

socket.on('roundResults', ({ results, herdAnswer, herdCount, round }) => {
  elements.resultsRound.textContent = round;
  elements.herdAnswerText.textContent = herdAnswer || 'No consensus';
  elements.herdCount.textContent = herdCount > 1 ? `(${herdCount} players)` : '(no points awarded)';

  const tbody = elements.resultsTable.querySelector('tbody');
  tbody.innerHTML = '';

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  results.forEach(result => {
    const tr = document.createElement('tr');
    if (result.gotPoint) {
      tr.classList.add('got-point');
    }
    tr.innerHTML = `
      <td>${result.name}</td>
      <td>${result.answer}</td>
      <td class="score-cell">${result.score}</td>
    `;
    tbody.appendChild(tr);
  });

  if (isHost) {
    elements.nextRoundBtn.classList.remove('hidden');
    elements.waitingNextMsg.classList.add('hidden');
  } else {
    elements.nextRoundBtn.classList.add('hidden');
    elements.waitingNextMsg.classList.remove('hidden');
  }

  showScreen('results');
});

socket.on('newRound', ({ prompt, round }) => {
  elements.roundNumber.textContent = round;
  elements.promptText.textContent = prompt;
  elements.answerInput.value = '';
  elements.answerSection.classList.remove('hidden');
  elements.waitingSection.classList.add('hidden');
  showScreen('game');
});

socket.on('error', (message) => {
  showError(message);
});
