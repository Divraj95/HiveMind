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

// Sample prompts
const prompts = [
  "Name a popular pizza topping",
  "Name a color of the rainbow",
  "Name a pet that people keep at home",
  "Name a fruit that's yellow",
  "Name a superhero",
  "Name something you find in a kitchen",
  "Name a sport played with a ball",
  "Name a month of the year",
  "Name a type of weather",
  "Name something you'd bring to the beach"
];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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

  // Award points to players who matched the herd (only if more than 1 person)
  const results = [];
  for (const [playerId, player] of room.players) {
    const normalized = player.currentAnswer?.toLowerCase().trim();
    const gotPoint = maxCount > 1 && normalized === herdAnswer;

    if (gotPoint) {
      player.score += 1;
    }

    results.push({
      id: playerId,
      name: player.name,
      answer: player.currentAnswer || '(no answer)',
      gotPoint,
      score: player.score
    });
  }

  return { results, herdAnswer, herdCount: maxCount };
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
      round: 0
    };

    room.players.set(socket.id, {
      name: playerName,
      score: 0,
      currentAnswer: null
    });

    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;

    socket.emit('roomCreated', { code, players: [{ id: socket.id, name: playerName, score: 0 }] });
    console.log(`Room ${code} created by ${playerName}`);
  });

  // Join an existing room
  socket.on('joinRoom', ({ code, playerName }) => {
    const room = rooms.get(code.toUpperCase());

    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (room.state !== 'lobby') {
      socket.emit('error', 'Game already in progress');
      return;
    }

    room.players.set(socket.id, {
      name: playerName,
      score: 0,
      currentAnswer: null
    });

    socket.join(code);
    socket.roomCode = code;

    const playerList = Array.from(room.players).map(([id, p]) => ({
      id,
      name: p.name,
      score: p.score
    }));

    io.to(code).emit('playerJoined', { players: playerList });
    socket.emit('joinedRoom', { code, players: playerList, isHost: false });
    console.log(`${playerName} joined room ${code}`);
  });

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
      round: room.round
    });
  });

  // Submit an answer
  socket.on('submitAnswer', (answer) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.state !== 'playing') return;

    const player = room.players.get(socket.id);
    if (!player) return;

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
      room.state = 'results';
      const { results, herdAnswer, herdCount } = calculateScores(room);
      io.to(socket.roomCode).emit('roundResults', {
        results,
        herdAnswer,
        herdCount,
        round: room.round
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
      round: room.round
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    room.players.delete(socket.id);

    if (room.players.size === 0) {
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
        score: p.score
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
