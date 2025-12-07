const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const rooms = new Map();

// Prompts organized by category
const prompts = [
  // Food & Drink
  "Name a popular pizza topping",
  "Name a fruit that's yellow",
  "Name a vegetable that's green",
  "Name a fast food restaurant",
  "Name a flavor of ice cream",
  "Name something you put on a sandwich",
  "Name a breakfast food",
  "Name a type of pasta",
  "Name a dessert",
  "Name a type of cheese",
  "Name a soft drink",
  "Name a type of candy",

  // Animals
  "Name a pet that people keep at home",
  "Name an animal you'd see at a zoo",
  "Name an animal that lives in the ocean",
  "Name a bird",
  "Name an insect",
  "Name an animal with stripes",
  "Name an animal that's dangerous",
  "Name a farm animal",

  // Entertainment
  "Name a superhero",
  "Name a Disney movie",
  "Name a TV show everyone has seen",
  "Name a famous singer",
  "Name a video game",
  "Name a board game",
  "Name a musical instrument",
  "Name a movie genre",
  "Name a famous actor",
  "Name a social media platform",

  // Sports & Activities
  "Name a sport played with a ball",
  "Name an Olympic sport",
  "Name something you do at the gym",
  "Name a hobby",
  "Name a water sport",
  "Name a card game",

  // Places
  "Name a country in Europe",
  "Name a US state",
  "Name a famous city",
  "Name somewhere you'd go on vacation",
  "Name a place in a house",
  "Name something you find in a kitchen",
  "Name something in a bathroom",
  "Name a type of store",

  // Nature & Weather
  "Name a color of the rainbow",
  "Name a type of weather",
  "Name a flower",
  "Name a tree",
  "Name something in the sky",
  "Name a season",

  // Time & Occasions
  "Name a month of the year",
  "Name a day of the week",
  "Name a holiday",
  "Name something you'd bring to a party",
  "Name something you'd bring to the beach",

  // Objects & Things
  "Name something in your pocket or purse",
  "Name a piece of furniture",
  "Name something with buttons",
  "Name something you plug in",
  "Name a type of shoe",
  "Name something you wear on your head",
  "Name a vehicle",
  "Name a tool",

  // School & Work
  "Name a school subject",
  "Name something in an office",
  "Name a profession",
  "Name something a teacher says",

  // Miscellaneous
  "Name something that's cold",
  "Name something that's hot",
  "Name something you're afraid of",
  "Name something you do every morning",
  "Name something you lose often",
  "Name a bad habit",
  "Name something that smells good",
  "Name a reason to call in sick",
  "Name something you save up to buy",
  "Name a New Year's resolution"
];

// Avatar options
const avatars = ['🦊', '🐸', '🦉', '🐙', '🦋', '🐢', '🦁', '🐼', '🐨', '🦄', '🐯', '🐮'];
const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#58D68D'
];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getPlayerAppearance(room) {
  const usedAvatars = new Set();
  const usedColors = new Set();

  for (const player of room.players.values()) {
    usedAvatars.add(player.avatar);
    usedColors.add(player.color);
  }

  let avatar = avatars[Math.floor(Math.random() * avatars.length)];
  let color = colors[Math.floor(Math.random() * colors.length)];

  // Try to find unused avatar
  for (const a of avatars) {
    if (!usedAvatars.has(a)) {
      avatar = a;
      break;
    }
  }

  // Try to find unused color
  for (const c of colors) {
    if (!usedColors.has(c)) {
      color = c;
      break;
    }
  }

  return { avatar, color };
}

function getRandomPrompt(usedPrompts) {
  const available = prompts.filter(p => !usedPrompts.includes(p));
  if (available.length === 0) return prompts[Math.floor(Math.random() * prompts.length)];
  return available[Math.floor(Math.random() * available.length)];
}

function calculateScores(room) {
  const answers = {};

  // Count answers (case-insensitive, trimmed)
  for (const [playerId, player] of room.players) {
    if (player.currentAnswer) {
      const normalized = player.currentAnswer.toLowerCase().trim();
      if (!answers[normalized]) {
        answers[normalized] = [];
      }
      answers[normalized].push(playerId);
    }
  }

  // Find the most common answer (the "herd")
  let maxCount = 0;
  let herdAnswer = null;

  for (const [answer, players] of Object.entries(answers)) {
    if (players.length > maxCount) {
      maxCount = players.length;
      herdAnswer = answer;
    }
  }

  // Find unique answers (only 1 person gave that answer) for Queen Bee
  const uniqueAnswerers = [];
  for (const [answer, players] of Object.entries(answers)) {
    if (players.length === 1) {
      uniqueAnswerers.push(players[0]);
    }
  }

  // Queen Bee logic: if someone gave a unique answer, they get the Queen Bee
  let newQueenBee = null;
  let previousQueenBee = room.queenBee;

  if (uniqueAnswerers.length > 0) {
    // Pick a random unique answerer to get the Queen Bee
    // (In the original game, it's the "worst" unique answer, but we'll just pick randomly)
    newQueenBee = uniqueAnswerers[Math.floor(Math.random() * uniqueAnswerers.length)];
    room.queenBee = newQueenBee;
  }

  // Award points to players who matched the herd (only if more than 1 person)
  const results = [];
  for (const [playerId, player] of room.players) {
    const normalized = player.currentAnswer?.toLowerCase().trim();
    const gotPoint = maxCount > 1 && normalized === herdAnswer;
    const gotQueen = playerId === newQueenBee;
    const hasQueen = playerId === room.queenBee;

    if (gotPoint) {
      player.score += 1;
    }

    results.push({
      id: playerId,
      name: player.name,
      answer: player.currentAnswer || '(no answer)',
      gotPoint,
      gotQueen,
      hasQueen,
      score: player.score
    });
  }

  return {
    results,
    herdAnswer,
    herdCount: maxCount,
    newQueenBee,
    previousQueenBee,
    queenBeeHolder: room.queenBee
  };
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create a new room
  socket.on('createRoom', (playerName) => {
    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }

    const room = {
      code,
      host: socket.id,
      players: new Map(),
      state: 'lobby', // lobby, playing, results
      currentPrompt: null,
      usedPrompts: [],
      round: 0,
      settings: {
        timer: 30,        // seconds (10, 30, 60)
        pointsToWin: 10   // points needed to win
      },
      timerInterval: null,
      queenBee: null      // player ID who holds the Queen Bee
    };

    const { avatar, color } = getPlayerAppearance(room);
    room.players.set(socket.id, {
      name: playerName,
      score: 0,
      currentAnswer: null,
      avatar,
      color
    });

    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;

    const player = room.players.get(socket.id);
    socket.emit('roomCreated', {
      code,
      players: [{ id: socket.id, name: playerName, score: 0, avatar, color }],
      settings: room.settings
    });
    console.log(`Room ${code} created by ${playerName}`);
  });

  // Join an existing room
  socket.on('joinRoom', ({ code, playerName }) => {
    const upperCode = code.toUpperCase();
    const room = rooms.get(upperCode);

    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (room.state !== 'lobby') {
      socket.emit('error', 'Game already in progress');
      return;
    }

    const { avatar, color } = getPlayerAppearance(room);
    room.players.set(socket.id, {
      name: playerName,
      score: 0,
      currentAnswer: null,
      avatar,
      color
    });

    socket.join(upperCode);
    socket.roomCode = upperCode;

    const playerList = Array.from(room.players).map(([id, p]) => ({
      id,
      name: p.name,
      score: p.score,
      avatar: p.avatar,
      color: p.color
    }));

    io.to(upperCode).emit('playerJoined', { players: playerList });
    socket.emit('joinedRoom', { code: upperCode, players: playerList, isHost: false, settings: room.settings });
    console.log(`${playerName} joined room ${upperCode}`);
  });

  // Update game settings (host only)
  socket.on('updateSettings', (settings) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) return;

    if (settings.timer) {
      room.settings.timer = settings.timer;
    }
    if (settings.pointsToWin) {
      room.settings.pointsToWin = settings.pointsToWin;
    }

    io.to(socket.roomCode).emit('settingsUpdated', room.settings);
  });

  // Helper to start a round with timer
  function startRoundWithTimer(room, roomCode) {
    // Clear any existing timer
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
    }

    let timeLeft = room.settings.timer;
    room.timerInterval = setInterval(() => {
      timeLeft--;
      io.to(roomCode).emit('timerTick', { timeLeft });

      if (timeLeft <= 0) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;

        // Force end the round
        if (room.state === 'playing') {
          room.state = 'results';
          const { results, herdAnswer, herdCount, newQueenBee, queenBeeHolder } = calculateScores(room);

          // Winner must have enough points AND not hold the Queen Bee
          const winner = results.find(r => r.score >= room.settings.pointsToWin && r.id !== queenBeeHolder);

          // Get Queen Bee holder name for display
          const queenBeePlayer = newQueenBee ? room.players.get(newQueenBee) : null;

          io.to(roomCode).emit('roundResults', {
            results,
            herdAnswer,
            herdCount,
            round: room.round,
            winner: winner || null,
            newQueenBee: newQueenBee ? { id: newQueenBee, name: queenBeePlayer?.name } : null,
            queenBeeHolder
          });
        }
      }
    }, 1000);
  }

  // Start the game (host only)
  socket.on('startGame', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) return;

    if (room.players.size < 2) {
      socket.emit('error', 'Need at least 2 players to start');
      return;
    }

    room.state = 'playing';
    room.round = 1;
    room.currentPrompt = getRandomPrompt(room.usedPrompts);
    room.usedPrompts.push(room.currentPrompt);

    // Reset answers
    for (const player of room.players.values()) {
      player.currentAnswer = null;
    }

    io.to(socket.roomCode).emit('gameStarted', {
      prompt: room.currentPrompt,
      round: room.round,
      timer: room.settings.timer
    });

    startRoundWithTimer(room, socket.roomCode);
  });

  // Submit an answer
  socket.on('submitAnswer', (answer) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.state !== 'playing') return;

    const player = room.players.get(socket.id);
    if (!player || player.currentAnswer) return; // Already answered

    player.currentAnswer = answer;

    // Check if all players have answered
    let allAnswered = true;
    for (const p of room.players.values()) {
      if (!p.currentAnswer) {
        allAnswered = false;
        break;
      }
    }

    // Notify others that this player submitted
    io.to(socket.roomCode).emit('playerSubmitted', {
      playerId: socket.id,
      answeredCount: Array.from(room.players.values()).filter(p => p.currentAnswer).length,
      totalPlayers: room.players.size
    });

    if (allAnswered) {
      // Clear the timer
      if (room.timerInterval) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
      }

      room.state = 'results';
      const { results, herdAnswer, herdCount, newQueenBee, queenBeeHolder } = calculateScores(room);

      // Winner must have enough points AND not hold the Queen Bee
      const winner = results.find(r => r.score >= room.settings.pointsToWin && r.id !== queenBeeHolder);

      // Get Queen Bee holder name for display
      const queenBeePlayer = newQueenBee ? room.players.get(newQueenBee) : null;

      io.to(socket.roomCode).emit('roundResults', {
        results,
        herdAnswer,
        herdCount,
        round: room.round,
        winner: winner || null,
        newQueenBee: newQueenBee ? { id: newQueenBee, name: queenBeePlayer?.name } : null,
        queenBeeHolder
      });
    }
  });

  // Next round (host only)
  socket.on('nextRound', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) return;

    room.state = 'playing';
    room.round += 1;
    room.currentPrompt = getRandomPrompt(room.usedPrompts);
    room.usedPrompts.push(room.currentPrompt);

    // Reset answers
    for (const player of room.players.values()) {
      player.currentAnswer = null;
    }

    io.to(socket.roomCode).emit('newRound', {
      prompt: room.currentPrompt,
      round: room.round,
      timer: room.settings.timer
    });

    startRoundWithTimer(room, socket.roomCode);
  });

  // Play again (host only) - reset scores and start fresh
  socket.on('playAgain', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) return;

    // Reset all scores
    for (const player of room.players.values()) {
      player.score = 0;
      player.currentAnswer = null;
    }

    room.state = 'lobby';
    room.round = 0;
    room.usedPrompts = [];
    room.queenBee = null;  // Reset Queen Bee

    const playerList = Array.from(room.players).map(([id, p]) => ({
      id,
      name: p.name,
      score: p.score,
      avatar: p.avatar,
      color: p.color
    }));

    io.to(socket.roomCode).emit('gameReset', { players: playerList, settings: room.settings });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    room.players.delete(socket.id);

    if (room.players.size === 0) {
      // Clean up timer
      if (room.timerInterval) {
        clearInterval(room.timerInterval);
      }
      rooms.delete(socket.roomCode);
      console.log(`Room ${socket.roomCode} deleted (empty)`);
    } else {
      // If host left, assign new host
      if (room.host === socket.id) {
        room.host = room.players.keys().next().value;
        io.to(socket.roomCode).emit('newHost', { hostId: room.host });
      }

      const playerList = Array.from(room.players).map(([id, p]) => ({
        id,
        name: p.name,
        score: p.score,
        avatar: p.avatar,
        color: p.color
      }));

      io.to(socket.roomCode).emit('playerLeft', {
        players: playerList,
        leftPlayer: player?.name
      });
    }

    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HiveMind server running on port ${PORT}`);
});
