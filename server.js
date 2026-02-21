// ============================================
// Chinese Chess (Xiangqi) - Game Server
// ============================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// ── Room Management ──────────────────────────

const rooms = new Map();

function generateRoomId() {
    return crypto.randomBytes(3).toString('hex'); // 6-char hex ID
}

io.on('connection', (socket) => {
    console.log(`🔌 Connected: ${socket.id}`);

    // ── Create Room ──
    socket.on('create-room', () => {
        const roomId = generateRoomId();
        rooms.set(roomId, {
            players: [{ id: socket.id, side: 'red' }],
            moves: [],
            started: false,
        });
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerSide = 'red';

        socket.emit('room-created', { roomId });
        console.log(`🏠 Room ${roomId} created by ${socket.id}`);
    });

    // ── Join Room ──
    socket.on('join-room', ({ roomId }) => {
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('join-error', { message: 'Room not found. Check the link and try again.' });
            return;
        }

        if (room.players.length >= 2) {
            socket.emit('join-error', { message: 'Room is full. The game has already started.' });
            return;
        }

        if (room.players[0].id === socket.id) {
            socket.emit('join-error', { message: 'You cannot join your own room.' });
            return;
        }

        room.players.push({ id: socket.id, side: 'black' });
        room.started = true;
        socket.join(roomId);
        socket.roomId = roomId;
        socket.playerSide = 'black';

        // Notify both players the game is starting
        io.to(roomId).emit('game-start', {
            red: room.players[0].id,
            black: room.players[1].id,
        });

        console.log(`🎮 Room ${roomId} game started!`);
    });

    // ── Make Move ──
    socket.on('make-move', ({ fromRow, fromCol, toRow, toCol }) => {
        const roomId = socket.roomId;
        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room || !room.started) return;

        // Store move
        room.moves.push({ fromRow, fromCol, toRow, toCol, side: socket.playerSide });

        // Relay to opponent
        socket.to(roomId).emit('opponent-move', { fromRow, fromCol, toRow, toCol });
    });

    // ── Restart Request ──
    socket.on('request-restart', () => {
        const roomId = socket.roomId;
        if (!roomId) return;
        socket.to(roomId).emit('restart-request', { from: socket.playerSide });
    });

    socket.on('accept-restart', () => {
        const roomId = socket.roomId;
        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        room.moves = [];
        io.to(roomId).emit('game-restart');
    });

    socket.on('decline-restart', () => {
        const roomId = socket.roomId;
        if (!roomId) return;
        socket.to(roomId).emit('restart-declined');
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
        console.log(`❌ Disconnected: ${socket.id}`);
        const roomId = socket.roomId;
        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        // Notify opponent
        socket.to(roomId).emit('opponent-disconnect');

        // Clean up room
        rooms.delete(roomId);
        console.log(`🗑️ Room ${roomId} deleted`);
    });
});

// ── Start ────────────────────────────────────

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   🏯 Chinese Chess Server Running!      ║
║   → http://localhost:${PORT}               ║
╚══════════════════════════════════════════╝
    `);
});
