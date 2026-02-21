// ============================================
// Chinese Chess (Xiangqi) - Network Client
// ============================================

export class Network {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.playerSide = null;
        this.connected = false;

        // Callbacks set by main.js
        this.onRoomCreated = null;
        this.onGameStart = null;
        this.onOpponentMove = null;
        this.onOpponentDisconnect = null;
        this.onJoinError = null;
        this.onRestartRequest = null;
        this.onGameRestart = null;
        this.onRestartDeclined = null;
        this.onRoomsList = null;
        this.onRoomsUpdated = null;
        this.onEmoteReceived = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.socket && this.connected) {
                resolve();
                return;
            }

            // Socket.IO is loaded globally via script tag
            this.socket = io();

            this.socket.on('connect', () => {
                this.connected = true;
                console.log('🔌 Connected to server');
                resolve();
            });

            this.socket.on('connect_error', (err) => {
                this.connected = false;
                console.error('Connection error:', err);
                reject(err);
            });

            this.socket.on('disconnect', () => {
                this.connected = false;
                console.log('⚡ Disconnected from server');
            });

            // ── Room Events ──
            this.socket.on('room-created', ({ roomId }) => {
                this.roomId = roomId;
                this.playerSide = 'red';
                if (this.onRoomCreated) this.onRoomCreated(roomId);
            });

            this.socket.on('join-error', ({ message }) => {
                if (this.onJoinError) this.onJoinError(message);
            });

            this.socket.on('game-start', (data) => {
                if (this.onGameStart) this.onGameStart(data);
            });

            // ── Room Browser Events ──
            this.socket.on('rooms-list', (rooms) => {
                if (this.onRoomsList) this.onRoomsList(rooms);
            });

            this.socket.on('rooms-updated', (rooms) => {
                if (this.onRoomsUpdated) this.onRoomsUpdated(rooms);
            });

            // ── Gameplay Events ──
            this.socket.on('opponent-move', (moveData) => {
                if (this.onOpponentMove) this.onOpponentMove(moveData);
            });

            this.socket.on('opponent-disconnect', () => {
                if (this.onOpponentDisconnect) this.onOpponentDisconnect();
            });

            // ── Emote Events ──
            this.socket.on('opponent-emote', ({ emote, from }) => {
                if (this.onEmoteReceived) this.onEmoteReceived(emote, from);
            });

            // ── Restart Events ──
            this.socket.on('restart-request', ({ from }) => {
                if (this.onRestartRequest) this.onRestartRequest(from);
            });

            this.socket.on('game-restart', () => {
                if (this.onGameRestart) this.onGameRestart();
            });

            this.socket.on('restart-declined', () => {
                if (this.onRestartDeclined) this.onRestartDeclined();
            });
        });
    }

    requestRooms() {
        if (this.socket) {
            this.socket.emit('get-rooms');
        }
    }

    createRoom(playerName) {
        if (this.socket) {
            this.socket.emit('create-room', { playerName });
        }
    }

    joinRoom(roomId, playerName) {
        if (this.socket) {
            this.roomId = roomId;
            this.playerSide = 'black';
            this.socket.emit('join-room', { roomId, playerName });
        }
    }

    sendMove(fromRow, fromCol, toRow, toCol) {
        if (this.socket) {
            this.socket.emit('make-move', { fromRow, fromCol, toRow, toCol });
        }
    }

    sendEmote(emote) {
        if (this.socket) {
            this.socket.emit('send-emote', { emote });
        }
    }

    requestRestart() {
        if (this.socket) {
            this.socket.emit('request-restart');
        }
    }

    acceptRestart() {
        if (this.socket) {
            this.socket.emit('accept-restart');
        }
    }

    declineRestart() {
        if (this.socket) {
            this.socket.emit('decline-restart');
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            this.roomId = null;
            this.playerSide = null;
        }
    }
}
