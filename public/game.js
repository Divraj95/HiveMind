const socket = io();

// Sound Effects using Web Audio API
class SoundManager {
  constructor() {
    this.enabled = true;
    this.audioContext = null;
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!this.enabled) return;
    this.init();

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // Sound effects
  buzz() {
    this.playTone(220, 0.1, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(280, 0.1, 'sawtooth', 0.2), 100);
  }

  join() {
    this.playTone(523, 0.1, 'sine', 0.2);
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.2), 100);
    setTimeout(() => this.playTone(784, 0.15, 'sine', 0.2), 200);
  }

  submit() {
    this.playTone(440, 0.08, 'square', 0.15);
    setTimeout(() => this.playTone(550, 0.08, 'square', 0.15), 80);
  }

  tick() {
    this.playTone(800, 0.05, 'sine', 0.1);
  }

  warning() {
    this.playTone(400, 0.15, 'sawtooth', 0.2);
  }

  point() {
    this.playTone(523, 0.1, 'sine', 0.25);
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.25), 100);
    setTimeout(() => this.playTone(784, 0.2, 'sine', 0.25), 200);
  }

  queenBee() {
    // Sad trombone-ish sound
    this.playTone(392, 0.3, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(370, 0.3, 'sawtooth', 0.2), 300);
    setTimeout(() => this.playTone(349, 0.3, 'sawtooth', 0.2), 600);
    setTimeout(() => this.playTone(330, 0.5, 'sawtooth', 0.2), 900);
  }

  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'sine', 0.3), i * 150);
    });
  }

  roundStart() {
    this.playTone(440, 0.1, 'sine', 0.2);
    setTimeout(() => this.playTone(880, 0.2, 'sine', 0.2), 100);
  }
}

const sounds = new SoundManager();

// DOM Elements
const screens = {
  home: document.getElementById('home-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  results: document.getElementById('results-screen'),
  winner: document.getElementById('winner-screen')
};

const elements = {
  soundToggle: document.getElementById('sound-toggle'),
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
  queenBeeAlert: document.getElementById('queen-bee-alert'),
  queenBeeText: document.getElementById('queen-bee-text'),
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
let queenBeeHolder = null;

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
    const hasQueen = player.id === queenBeeHolder;
    li.innerHTML = `
      <div class="player-info">
        <div class="player-avatar" style="background-color: ${player.color}20">${player.avatar}</div>
        <span class="player-name">${player.name}</span>
      </div>
      <div class="player-badges">
        ${hasQueen ? '<span class="queen-bee-badge" title="Holds the Queen Bee!">👑🐝</span>' : ''}
        ${player.id === hostId ? '<span class="host-badge">HOST</span>' : ''}
      </div>
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
elements.soundToggle.addEventListener('click', () => {
  sounds.init();
  const enabled = sounds.toggle();
  elements.soundToggle.textContent = enabled ? '🔊' : '🔇';
  elements.soundToggle.classList.toggle('muted', !enabled);
  if (enabled) sounds.buzz();
});

elements.createBtn.addEventListener('click', () => {
  const name = elements.playerName.value.trim();
  if (!name) {
    showError('Please enter your name');
    return;
  }
  sounds.buzz();
  socket.emit('createRoom', name);
});

elements.joinBtn.addEventListener('click', () => {
  sounds.buzz();
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
    showError('Please enter a valid 4-character hive code');
    return;
  }

  sounds.buzz();
  socket.emit('joinRoom', { code, playerName: name });
});

elements.startBtn.addEventListener('click', () => {
  sounds.roundStart();
  socket.emit('startGame');
});

elements.submitBtn.addEventListener('click', () => {
  const answer = elements.answerInput.value.trim();
  if (!answer) {
    showError('Please enter an answer');
    return;
  }
  sounds.submit();
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
  sounds.roundStart();
  socket.emit('nextRound');
});

elements.playAgainBtn.addEventListener('click', () => {
  sounds.buzz();
  socket.emit('playAgain');
});

// Settings buttons
document.querySelectorAll('[data-timer]').forEach(btn => {
  btn.addEventListener('click', () => {
    sounds.buzz();
    const timer = parseInt(btn.dataset.timer);
    socket.emit('updateSettings', { timer });
  });
});

document.querySelectorAll('[data-points]').forEach(btn => {
  btn.addEventListener('click', () => {
    sounds.buzz();
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
  queenBeeHolder = null;
  elements.displayCode.textContent = code;
  updatePlayerList(players, socket.id);
  updateSettingsDisplay(settings);

  elements.settingsSection.classList.remove('hidden');
  elements.settingsDisplay.classList.add('hidden');
  elements.startBtn.classList.remove('hidden');
  elements.waitingMsg.classList.add('hidden');

  sounds.join();
  showScreen('lobby');
});

socket.on('joinedRoom', ({ code, players, isHost: hostStatus, settings }) => {
  isHost = hostStatus;
  currentRoomCode = code;
  queenBeeHolder = null;
  elements.displayCode.textContent = code;

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

  sounds.join();
  showScreen('lobby');
});

socket.on('playerJoined', ({ players }) => {
  sounds.join();
  updatePlayerList(players, hostId);
});

socket.on('playerLeft', ({ players }) => {
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
  sounds.roundStart();
  elements.roundNumber.textContent = round;
  elements.promptText.textContent = prompt;
  elements.answerInput.value = '';
  elements.answerSection.classList.remove('hidden');
  elements.waitingSection.classList.add('hidden');
  elements.submitBtn.disabled = false;
  elements.timerValue.textContent = timer;
  elements.timerValue.parentElement.classList.remove('warning');
  showScreen('game');
  elements.answerInput.focus();
});

socket.on('timerTick', ({ timeLeft }) => {
  elements.timerValue.textContent = timeLeft;
  if (timeLeft <= 5 && timeLeft > 0) {
    elements.timerValue.parentElement.classList.add('warning');
    sounds.warning();
  }
});

socket.on('playerSubmitted', ({ answeredCount, totalPlayers }) => {
  sounds.tick();
  elements.answerCount.textContent = `${answeredCount} / ${totalPlayers} buzzed in`;
});

socket.on('roundResults', ({ results, herdAnswer, herdCount, round, winner, newQueenBee, queenBeeHolder: currentQueenHolder }) => {
  // Update queen bee holder
  queenBeeHolder = currentQueenHolder;

  // Update player data with new scores
  results.forEach(r => {
    if (playersData[r.id]) {
      playersData[r.id].score = r.score;
    }
  });

  if (winner) {
    // Show winner screen
    sounds.win();
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
          <span>${playerData.avatar || '🐝'}</span>
          <span>${result.name}</span>
          ${result.hasQueen ? '<span class="queen-bee-badge">👑🐝</span>' : ''}
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
    elements.herdCount.textContent = herdCount > 1 ? `(${herdCount} bees)` : '(no points awarded)';

    // Show Queen Bee alert if someone got it this round
    if (newQueenBee) {
      sounds.queenBee();
      elements.queenBeeAlert.classList.remove('hidden');
      elements.queenBeeText.textContent = `${newQueenBee.name} got the Queen Bee! They can't win until someone else takes it.`;
    } else {
      elements.queenBeeAlert.classList.add('hidden');
    }

    const tbody = elements.resultsTable.querySelector('tbody');
    tbody.innerHTML = '';

    results.sort((a, b) => b.score - a.score);

    results.forEach(result => {
      if (result.gotPoint) sounds.point();

      const playerData = playersData[result.id] || result;
      const tr = document.createElement('tr');
      if (result.gotPoint) {
        tr.classList.add('got-point');
      }
      if (result.gotQueen) {
        tr.classList.add('got-queen');
      }
      tr.innerHTML = `
        <td>
          <div class="player-cell">
            <span class="avatar">${playerData.avatar || '🐝'}</span>
            <span>${result.name}</span>
            ${result.hasQueen ? '<span class="queen-bee-badge" title="Holds Queen Bee">👑</span>' : ''}
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
  sounds.roundStart();
  elements.roundNumber.textContent = round;
  elements.promptText.textContent = prompt;
  elements.answerInput.value = '';
  elements.answerSection.classList.remove('hidden');
  elements.waitingSection.classList.add('hidden');
  elements.submitBtn.disabled = false;
  elements.timerValue.textContent = timer;
  elements.timerValue.parentElement.classList.remove('warning');
  showScreen('game');
  elements.answerInput.focus();
});

socket.on('gameReset', ({ players, settings }) => {
  queenBeeHolder = null;
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

  sounds.buzz();
  showScreen('lobby');
});

socket.on('error', (message) => {
  showError(message);
});
