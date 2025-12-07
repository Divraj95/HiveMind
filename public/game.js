const socket = io();

// DOM Elements
const screens = {
  home: document.getElementById('home-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  results: document.getElementById('results-screen'),
  winner: document.getElementById('winner-screen')
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
  settingsSection: document.getElementById('settings-section'),
  settingsDisplay: document.getElementById('settings-display'),
  timerDisplay: document.getElementById('timer-display'),
  pointsDisplay: document.getElementById('points-display'),
  startBtn: document.getElementById('start-btn'),
  waitingMsg: document.getElementById('waiting-msg'),
  roundNumber: document.getElementById('round-number'),
  timerValue: document.getElementById('timer-value'),
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
  winnerAvatar: document.getElementById('winner-avatar'),
  winnerName: document.getElementById('winner-name'),
  winnerScore: document.getElementById('winner-score'),
  finalScoresList: document.getElementById('final-scores-list'),
  playAgainBtn: document.getElementById('play-again-btn'),
  waitingPlayAgain: document.getElementById('waiting-play-again'),
  errorToast: document.getElementById('error-toast')
};

// Game state
let isHost = false;
let currentRoomCode = null;
let myPlayerId = null;
let hostId = null;
let currentSettings = { timer: 30, pointsToWin: 10 };
let playersData = {};

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

function updatePlayerList(players, currentHostId) {
  hostId = currentHostId;
  elements.playerList.innerHTML = '';

  // Store player data for later use
  players.forEach(player => {
    playersData[player.id] = player;
  });

  players.forEach(player => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="player-info">
        <div class="player-avatar" style="background-color: ${player.color}20">${player.avatar}</div>
        <span class="player-name">${player.name}</span>
      </div>
      ${player.id === hostId ? '<span class="host-badge">HOST</span>' : ''}
    `;
    elements.playerList.appendChild(li);
  });
}

function updateSettingsDisplay(settings) {
  currentSettings = settings;
  elements.timerDisplay.textContent = `${settings.timer}s timer`;
  elements.pointsDisplay.textContent = `First to ${settings.pointsToWin}`;

  // Update active buttons
  document.querySelectorAll('[data-timer]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.timer) === settings.timer);
  });
  document.querySelectorAll('[data-points]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.points) === settings.pointsToWin);
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
  elements.submitBtn.disabled = true;
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

elements.playAgainBtn.addEventListener('click', () => {
  socket.emit('playAgain');
});

// Settings buttons
document.querySelectorAll('[data-timer]').forEach(btn => {
  btn.addEventListener('click', () => {
    const timer = parseInt(btn.dataset.timer);
    socket.emit('updateSettings', { timer });
  });
});

document.querySelectorAll('[data-points]').forEach(btn => {
  btn.addEventListener('click', () => {
    const pointsToWin = parseInt(btn.dataset.points);
    socket.emit('updateSettings', { pointsToWin });
  });
});

// Socket event handlers
socket.on('connect', () => {
  myPlayerId = socket.id;
});

socket.on('roomCreated', ({ code, players, settings }) => {
  isHost = true;
  hostId = socket.id;
  currentRoomCode = code;
  elements.displayCode.textContent = code;
  updatePlayerList(players, socket.id);
  updateSettingsDisplay(settings);

  elements.settingsSection.classList.remove('hidden');
  elements.settingsDisplay.classList.add('hidden');
  elements.startBtn.classList.remove('hidden');
  elements.waitingMsg.classList.add('hidden');

  showScreen('lobby');
});

socket.on('joinedRoom', ({ code, players, isHost: hostStatus, settings }) => {
  isHost = hostStatus;
  currentRoomCode = code;
  elements.displayCode.textContent = code;

  // Find the host from players
  const host = players.find(p => p.id === players[0]?.id);
  hostId = players[0]?.id;

  updatePlayerList(players, hostId);
  updateSettingsDisplay(settings);

  if (isHost) {
    elements.settingsSection.classList.remove('hidden');
    elements.settingsDisplay.classList.add('hidden');
    elements.startBtn.classList.remove('hidden');
    elements.waitingMsg.classList.add('hidden');
  } else {
    elements.settingsSection.classList.add('hidden');
    elements.settingsDisplay.classList.remove('hidden');
    elements.startBtn.classList.add('hidden');
    elements.waitingMsg.classList.remove('hidden');
  }

  showScreen('lobby');
});

socket.on('playerJoined', ({ players }) => {
  updatePlayerList(players, hostId);
});

socket.on('playerLeft', ({ players, leftPlayer }) => {
  updatePlayerList(players, hostId);
});

socket.on('newHost', ({ hostId: newHostId }) => {
  hostId = newHostId;
  if (newHostId === socket.id) {
    isHost = true;
    elements.settingsSection.classList.remove('hidden');
    elements.settingsDisplay.classList.add('hidden');
    elements.startBtn.classList.remove('hidden');
    elements.waitingMsg.classList.add('hidden');
    elements.nextRoundBtn.classList.remove('hidden');
    elements.waitingNextMsg.classList.add('hidden');
    elements.playAgainBtn.classList.remove('hidden');
    elements.waitingPlayAgain.classList.add('hidden');
  }
});

socket.on('settingsUpdated', (settings) => {
  updateSettingsDisplay(settings);
});

socket.on('gameStarted', ({ prompt, round, timer }) => {
  elements.roundNumber.textContent = round;
  elements.promptText.textContent = prompt;
  elements.answerInput.value = '';
  elements.answerSection.classList.remove('hidden');
  elements.waitingSection.classList.add('hidden');
  elements.submitBtn.disabled = false;
  elements.timerValue.textContent = timer;
  elements.timerValue.parentElement.classList.remove('warning');
  showScreen('game');
});

socket.on('timerTick', ({ timeLeft }) => {
  elements.timerValue.textContent = timeLeft;
  if (timeLeft <= 5) {
    elements.timerValue.parentElement.classList.add('warning');
  }
});

socket.on('playerSubmitted', ({ answeredCount, totalPlayers }) => {
  elements.answerCount.textContent = `${answeredCount} / ${totalPlayers} answered`;
});

socket.on('roundResults', ({ results, herdAnswer, herdCount, round, winner }) => {
  // Update player data with new scores
  results.forEach(r => {
    if (playersData[r.id]) {
      playersData[r.id].score = r.score;
    }
  });

  if (winner) {
    // Show winner screen
    const winnerData = playersData[winner.id] || winner;
    elements.winnerAvatar.textContent = winnerData.avatar || '🏆';
    elements.winnerName.textContent = winner.name;
    elements.winnerScore.textContent = winner.score;

    // Sort by score and show final standings
    results.sort((a, b) => b.score - a.score);
    elements.finalScoresList.innerHTML = '';
    results.forEach(result => {
      const playerData = playersData[result.id] || result;
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="player-info">
          <span>${playerData.avatar || '👤'}</span>
          <span>${result.name}</span>
        </div>
        <span class="score">${result.score}</span>
      `;
      elements.finalScoresList.appendChild(li);
    });

    if (isHost) {
      elements.playAgainBtn.classList.remove('hidden');
      elements.waitingPlayAgain.classList.add('hidden');
    } else {
      elements.playAgainBtn.classList.add('hidden');
      elements.waitingPlayAgain.classList.remove('hidden');
    }

    showScreen('winner');
  } else {
    // Show regular results
    elements.resultsRound.textContent = round;
    elements.herdAnswerText.textContent = herdAnswer || 'No consensus';
    elements.herdCount.textContent = herdCount > 1 ? `(${herdCount} players)` : '(no points awarded)';

    const tbody = elements.resultsTable.querySelector('tbody');
    tbody.innerHTML = '';

    results.sort((a, b) => b.score - a.score);

    results.forEach(result => {
      const playerData = playersData[result.id] || result;
      const tr = document.createElement('tr');
      if (result.gotPoint) {
        tr.classList.add('got-point');
      }
      tr.innerHTML = `
        <td>
          <div class="player-cell">
            <span class="avatar">${playerData.avatar || '👤'}</span>
            <span>${result.name}</span>
          </div>
        </td>
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
  }
});

socket.on('newRound', ({ prompt, round, timer }) => {
  elements.roundNumber.textContent = round;
  elements.promptText.textContent = prompt;
  elements.answerInput.value = '';
  elements.answerSection.classList.remove('hidden');
  elements.waitingSection.classList.add('hidden');
  elements.submitBtn.disabled = false;
  elements.timerValue.textContent = timer;
  elements.timerValue.parentElement.classList.remove('warning');
  showScreen('game');
});

socket.on('gameReset', ({ players, settings }) => {
  updatePlayerList(players, hostId);
  updateSettingsDisplay(settings);
  playersData = {};
  players.forEach(p => {
    playersData[p.id] = p;
  });

  if (isHost) {
    elements.settingsSection.classList.remove('hidden');
    elements.settingsDisplay.classList.add('hidden');
    elements.startBtn.classList.remove('hidden');
    elements.waitingMsg.classList.add('hidden');
  } else {
    elements.settingsSection.classList.add('hidden');
    elements.settingsDisplay.classList.remove('hidden');
    elements.startBtn.classList.add('hidden');
    elements.waitingMsg.classList.remove('hidden');
  }

  showScreen('lobby');
});

socket.on('error', (message) => {
  showError(message);
});
