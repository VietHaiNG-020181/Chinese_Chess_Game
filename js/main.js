// ============================================
// Chinese Chess (Xiangqi) - Main Application
// ============================================

import { Game } from './game.js';
import { BoardRenderer } from './board.js';
import { AI } from './ai.js';
import { Network } from './network.js';
import { SIDE } from './constants.js';

const SAVE_KEY = 'xiangqi-save';

class ChineseChessApp {
    constructor() {
        this.game = new Game();
        this.renderer = null;
        this.ai = null;
        this.network = null;
        this.mode = null; // 'pvp', 'pvsbot', 'online'
        this.playerSide = SIDE.RED;
        this.botThinking = false;
        this.opponentDisconnected = false;
        this.emoteCooldown = false;

        this.initUI();
        this.checkSavedGame();
        this.checkUrlForRoom();
    }

    initUI() {
        // Mode selection buttons
        document.getElementById('btn-pvp').addEventListener('click', () => this.startGame('pvp'));
        document.getElementById('btn-pvsbot').addEventListener('click', () => this.showDifficultyPicker());
        document.getElementById('btn-online').addEventListener('click', () => this.showLobby());
        document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());

        // Difficulty buttons
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const depth = parseInt(btn.dataset.depth);
                const randomChance = parseFloat(btn.dataset.random);
                this.aiDepth = depth;
                this.aiRandomChance = randomChance;
                document.getElementById('difficulty-modal').classList.add('hidden');
                this.startGame('pvsbot');
            });
        });

        // Control buttons
        document.getElementById('btn-undo').addEventListener('click', () => this.handleUndo());
        document.getElementById('btn-restart').addEventListener('click', () => this.handleRestart());
        document.getElementById('btn-menu').addEventListener('click', () => this.showMenu());

        // Canvas click
        const canvas = document.getElementById('game-canvas');
        canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Lobby buttons
        document.getElementById('btn-lobby-back').addEventListener('click', () => this.showMenu());
        document.getElementById('btn-create-room').addEventListener('click', () => this.handleCreateRoom());
        document.getElementById('btn-join-room').addEventListener('click', () => this.handleJoinRoom());
        document.getElementById('btn-copy-link').addEventListener('click', () => this.handleCopyLink());
        document.getElementById('btn-refresh-rooms').addEventListener('click', () => this.refreshRooms());
        document.getElementById('btn-cancel-wait').addEventListener('click', () => this.handleCancelWait());

        // Room ID input: Enter to join
        document.getElementById('input-room-id').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleJoinRoom();
        });

        // Restart modal
        document.getElementById('btn-restart-accept').addEventListener('click', () => {
            document.getElementById('restart-modal').classList.add('hidden');
            if (this.network) this.network.acceptRestart();
        });
        document.getElementById('btn-restart-decline').addEventListener('click', () => {
            document.getElementById('restart-modal').classList.add('hidden');
            if (this.network) this.network.declineRestart();
        });

        // Emote buttons
        document.querySelectorAll('.emote-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const emote = btn.dataset.emote;
                this.handleSendEmote(emote);
            });
        });
    }

    /**
     * Check URL for ?room=XXXXXX query param (direct join link)
     */
    checkUrlForRoom() {
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get('room');
        if (roomId) {
            // Clear the URL param
            window.history.replaceState({}, '', window.location.pathname);
            this.showLobby();
            document.getElementById('input-room-id').value = roomId;
            this.handleJoinRoom();
        }
    }

    // ── Screen Management ─────────────────────

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
    }

    showMenu() {
        if (this.network) {
            this.network.disconnect();
            this.network = null;
        }
        this.mode = null;
        this.opponentDisconnected = false;
        document.getElementById('connection-badge').classList.add('hidden');
        document.getElementById('emote-bar').classList.add('hidden');
        this.checkSavedGame();
        this.showScreen('menu-screen');
    }

    // ── Save / Load ───────────────────────────

    saveGame() {
        if (this.mode === 'online') return; // don't save online games
        try {
            const data = {
                mode: this.mode,
                playerSide: this.playerSide,
                gameState: this.game.toJSON(),
                savedAt: Date.now(),
                aiDepth: this.aiDepth || 3,
                aiRandomChance: this.aiRandomChance || 0,
            };
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save game:', e);
        }
    }

    clearSave() {
        localStorage.removeItem(SAVE_KEY);
        const section = document.getElementById('resume-section');
        if (section) section.classList.add('hidden');
    }

    checkSavedGame() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!data || !data.gameState || data.gameState.gameOver) {
                this.clearSave();
                return;
            }
            // Show resume button
            const section = document.getElementById('resume-section');
            section.classList.remove('hidden');
            const info = document.getElementById('resume-info');
            const diffName = data.aiDepth === 2 ? 'Easy' : data.aiDepth === 4 ? 'Hard' : 'Medium';
            const modeLabel = data.mode === 'pvsbot' ? `vs Bot (${diffName})` : 'PvP';
            const turnLabel = data.gameState.currentTurn === SIDE.RED ? 'Red' : 'Black';
            const moves = (data.gameState.moveHistory || []).length;
            info.textContent = `${modeLabel} · ${turnLabel}'s turn · ${moves} moves`;
        } catch (e) {
            this.clearSave();
        }
    }

    resumeGame() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);

            this.mode = data.mode;
            this.playerSide = data.playerSide || SIDE.RED;
            this.aiDepth = data.aiDepth || 3;
            this.aiRandomChance = data.aiRandomChance || 0;
            this.game.fromJSON(data.gameState);
            this.botThinking = false;
            this.opponentDisconnected = false;

            const canvas = document.getElementById('game-canvas');
            this.renderer = new BoardRenderer(canvas);

            if (this.mode === 'pvsbot') {
                this.ai = new AI(SIDE.BLACK, this.aiDepth, this.aiRandomChance);
            } else {
                this.ai = null;
            }

            this.showScreen('game-screen');

            let modeLabel;
            if (this.mode === 'pvp') modeLabel = '⚔️ Player vs Player';
            else if (this.mode === 'pvsbot') {
                const diffName = this.aiDepth === 2 ? 'Easy' : this.aiDepth === 4 ? 'Hard' : 'Medium';
                modeLabel = `🤖 Bot (${diffName})`;
            }
            else modeLabel = '🌐 Online';
            document.getElementById('mode-label').textContent = modeLabel;

            document.getElementById('btn-undo').style.display = '';
            document.getElementById('connection-badge').classList.add('hidden');
            document.getElementById('emote-bar').classList.add('hidden');

            this.updateStatus();
            this.renderer.render(this.game);
            this.showToast('💾 Game resumed');

            // If it's the bot's turn, trigger bot
            if (this.mode === 'pvsbot' && !this.game.gameOver && this.game.currentTurn === this.ai.side) {
                this.triggerBotMove();
            }
        } catch (e) {
            console.error('Failed to resume game:', e);
            this.clearSave();
            this.showToast('❌ Failed to resume');
        }
    }

    async showLobby() {
        this.showScreen('lobby-screen');
        // Reset lobby state
        document.getElementById('lobby-choice').classList.remove('hidden');
        document.getElementById('lobby-waiting').classList.add('hidden');
        document.getElementById('lobby-error').classList.add('hidden');
        document.getElementById('input-room-id').value = '';

        // Connect and fetch rooms
        try {
            await this.ensureConnected();
            this.network.requestRooms();
        } catch (e) {
            this.renderRoomList([]);
        }
    }

    // ── Online Lobby ──────────────────────────

    async ensureConnected() {
        if (!this.network) {
            this.network = new Network();
            this.setupNetworkCallbacks();
        }
        if (!this.network.connected) {
            await this.network.connect();
        }
    }

    getPlayerName() {
        const input = document.getElementById('input-player-name');
        return (input && input.value.trim()) || 'Anonymous';
    }

    setupNetworkCallbacks() {
        this.network.onRoomCreated = (roomId) => {
            // Show waiting UI with link
            document.getElementById('lobby-choice').classList.add('hidden');
            document.getElementById('lobby-waiting').classList.remove('hidden');

            const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
            document.getElementById('invite-link').value = link;
            document.getElementById('room-code-text').textContent = roomId.toUpperCase();
        };

        this.network.onJoinError = (message) => {
            this.showLobbyError(message);
        };

        this.network.onGameStart = (data) => {
            // Determine which side we are
            this.playerSide = this.network.playerSide === 'red' ? SIDE.RED : SIDE.BLACK;
            this.startGame('online');
        };

        this.network.onOpponentMove = (moveData) => {
            const { fromRow, fromCol, toRow, toCol } = moveData;
            // Animate the opponent's move
            this.renderer.animateMove(this.game, fromRow, fromCol, toRow, toCol, () => {
                this.game.makeMove(fromRow, fromCol, toRow, toCol);
                this.updateStatus();
                this.renderer.render(this.game);
            });
        };

        this.network.onOpponentDisconnect = () => {
            this.opponentDisconnected = true;
            this.showToast('⚡ Opponent disconnected');
            this.updateStatus();
        };

        this.network.onRestartRequest = (from) => {
            document.getElementById('restart-modal').classList.remove('hidden');
        };

        this.network.onGameRestart = () => {
            this.game.reset();
            this.updateStatus();
            this.renderer.render(this.game);
            this.showToast('🔄 Game restarted');
        };

        this.network.onRestartDeclined = () => {
            this.showToast('❌ Restart declined');
        };

        // ── Room Browser ──
        this.network.onRoomsList = (rooms) => {
            this.renderRoomList(rooms);
        };

        this.network.onRoomsUpdated = (rooms) => {
            // Only update if we're on the lobby screen and not waiting
            const lobbyChoice = document.getElementById('lobby-choice');
            if (!lobbyChoice.classList.contains('hidden')) {
                this.renderRoomList(rooms);
            }
        };

        // ── Emotes ──
        this.network.onEmoteReceived = (emote, from) => {
            this.showFloatingEmote(emote);
        };
    }

    // ── Room List ─────────────────────────────

    renderRoomList(rooms) {
        const container = document.getElementById('room-list');

        if (!rooms || rooms.length === 0) {
            container.innerHTML = '<div class="room-empty">No open tables — create one!</div>';
            return;
        }

        container.innerHTML = rooms.map(room => {
            const age = this.formatAge(room.createdAt);
            return `
                <div class="room-card" data-room="${room.roomId}">
                    <div class="room-card-info">
                        <span class="room-card-name">${this.escapeHtml(room.creatorName)}</span>
                        <span class="room-card-meta">1/2 · ${age}</span>
                    </div>
                    <button class="room-card-join" data-room="${room.roomId}">Join</button>
                </div>
            `;
        }).join('');

        // Bind join buttons
        container.querySelectorAll('.room-card-join').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomId = e.target.dataset.room;
                this.handleJoinRoomById(roomId);
            });
        });
    }

    formatAge(timestamp) {
        if (!timestamp) return '';
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        return `${Math.floor(minutes / 60)}h ago`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    refreshRooms() {
        if (this.network && this.network.connected) {
            this.network.requestRooms();
        }
    }

    async handleCreateRoom() {
        try {
            await this.ensureConnected();
            this.network.createRoom(this.getPlayerName());
        } catch (e) {
            this.showLobbyError('Failed to connect to server. Is the server running?');
        }
    }

    async handleJoinRoom() {
        const input = document.getElementById('input-room-id');
        const roomId = input.value.trim().toLowerCase();
        if (!roomId) {
            this.showLobbyError('Please enter a room code.');
            return;
        }
        try {
            await this.ensureConnected();
            this.network.joinRoom(roomId, this.getPlayerName());
        } catch (e) {
            this.showLobbyError('Failed to connect to server. Is the server running?');
        }
    }

    async handleJoinRoomById(roomId) {
        try {
            await this.ensureConnected();
            this.network.joinRoom(roomId, this.getPlayerName());
        } catch (e) {
            this.showLobbyError('Failed to connect to server.');
        }
    }

    handleCancelWait() {
        // Go back to lobby choice, disconnect and reconnect
        if (this.network) {
            this.network.disconnect();
            this.network = null;
        }
        this.showLobby();
    }

    showLobbyError(message) {
        const errEl = document.getElementById('lobby-error');
        errEl.textContent = message;
        errEl.classList.remove('hidden');
        setTimeout(() => errEl.classList.add('hidden'), 4000);
    }

    handleCopyLink() {
        const linkInput = document.getElementById('invite-link');
        navigator.clipboard.writeText(linkInput.value).then(() => {
            this.showToast('📋 Link copied!');
        }).catch(() => {
            linkInput.select();
            document.execCommand('copy');
            this.showToast('📋 Link copied!');
        });
    }

    // ── Emotes ────────────────────────────────

    handleSendEmote(emote) {
        if (this.mode !== 'online' || !this.network || this.emoteCooldown) return;

        this.network.sendEmote(emote);
        this.showFloatingEmote(emote, true); // Show own emote too

        // Cooldown to prevent spam
        this.emoteCooldown = true;
        setTimeout(() => { this.emoteCooldown = false; }, 1500);
    }

    showFloatingEmote(emote, isSelf = false) {
        const container = document.getElementById('emote-float');
        const el = document.createElement('div');
        el.className = `emote-bubble ${isSelf ? 'self' : 'opponent'}`;
        el.textContent = emote;
        container.appendChild(el);

        // Remove after animation completes
        setTimeout(() => {
            el.remove();
        }, 2000);
    }

    // ── Difficulty Picker ─────────────────────

    showDifficultyPicker() {
        this.showScreen('game-screen');
        document.getElementById('difficulty-modal').classList.remove('hidden');
    }

    // ── Game Start ────────────────────────────

    startGame(mode) {
        this.mode = mode;
        this.game.reset();
        this.botThinking = false;
        this.opponentDisconnected = false;

        const canvas = document.getElementById('game-canvas');
        this.renderer = new BoardRenderer(canvas);

        // Flip board for black player in online mode
        if (mode === 'online' && this.playerSide === SIDE.BLACK) {
            this.renderer.flipped = true;
        }

        if (mode === 'pvsbot') {
            this.ai = new AI(SIDE.BLACK, this.aiDepth || 3, this.aiRandomChance || 0);
            this.playerSide = SIDE.RED;
        } else if (mode === 'pvp') {
            this.ai = null;
        }
        // For 'online', playerSide is already set by the network callback

        this.showScreen('game-screen');

        // Update mode indicator
        let modeLabel;
        if (mode === 'pvp') modeLabel = '⚔️ Player vs Player';
        else if (mode === 'pvsbot') {
            const diffName = this.aiDepth === 2 ? 'Easy' : this.aiDepth === 4 ? 'Hard' : 'Medium';
            modeLabel = `🤖 Bot (${diffName})`;
        }
        else modeLabel = '🌐 Online';
        document.getElementById('mode-label').textContent = modeLabel;

        // Show/hide undo based on mode
        const undoBtn = document.getElementById('btn-undo');
        undoBtn.style.display = mode === 'online' ? 'none' : '';

        // Show connection badge in online mode
        const badge = document.getElementById('connection-badge');
        if (mode === 'online') {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        // Show emote bar in online mode
        const emoteBar = document.getElementById('emote-bar');
        if (mode === 'online') {
            emoteBar.classList.remove('hidden');
        } else {
            emoteBar.classList.add('hidden');
        }

        // Show which side you are in online mode
        if (mode === 'online') {
            const sideTag = this.playerSide === SIDE.RED ? '🔴 You are Red' : '⚫ You are Black';
            this.showToast(sideTag);
        }

        this.updateStatus();
        this.renderer.render(this.game);
    }

    // ── Canvas Click ──────────────────────────

    handleCanvasClick(e) {
        if (this.game.gameOver || this.botThinking) return;

        const rect = e.target.getBoundingClientRect();
        const scaleX = e.target.width / rect.width;
        const scaleY = e.target.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const pos = this.renderer.toBoard(x, y);
        if (!pos) return;

        const { row, col } = pos;

        // In PvsBot mode, only allow on player's turn
        if (this.mode === 'pvsbot' && this.game.currentTurn !== this.playerSide) return;

        // In Online mode, only allow on player's turn and own side
        if (this.mode === 'online' && this.game.currentTurn !== this.playerSide) return;
        if (this.mode === 'online' && this.opponentDisconnected) return;

        if (this.game.selectedPiece) {
            const isValidMove = this.game.validMoves.some(m => m.row === row && m.col === col);

            if (isValidMove) {
                const fromRow = this.game.selectedPiece.row;
                const fromCol = this.game.selectedPiece.col;
                this.game.clearSelection();

                this.renderer.animateMove(this.game, fromRow, fromCol, row, col, () => {
                    this.game.makeMove(fromRow, fromCol, row, col);
                    this.updateStatus();
                    this.renderer.render(this.game);
                    this.saveGame();

                    // Warn when check limit reached
                    if (this.game.checkLimitReached) {
                        this.showToast('⛔ 3 consecutive checks! Must make a different move.');
                    }

                    // Clear save on game over
                    if (this.game.gameOver) this.clearSave();

                    // Send move to server in online mode
                    if (this.mode === 'online' && this.network) {
                        this.network.sendMove(fromRow, fromCol, row, col);
                    }

                    // Trigger bot
                    if (this.mode === 'pvsbot' && !this.game.gameOver && this.game.currentTurn === this.ai.side) {
                        this.triggerBotMove();
                    }
                });
                return;
            }

            // Clicking another own piece = reselect
            const piece = this.game.board[row][col];
            if (piece && piece.side === this.game.currentTurn) {
                this.game.selectPiece(row, col);
                this.renderer.render(this.game);
                return;
            }

            this.game.clearSelection();
            this.renderer.render(this.game);
            return;
        }

        // Try to select
        const piece = this.game.board[row][col];
        if (piece && piece.side === this.game.currentTurn) {
            // In online mode, only select own pieces
            if (this.mode === 'online' && piece.side !== this.playerSide) return;
            this.game.selectPiece(row, col);
            this.renderer.render(this.game);
        }
    }

    // ── Bot ───────────────────────────────────

    async triggerBotMove() {
        this.botThinking = true;
        this.updateStatus();

        const move = await this.ai.getBestMove(this.game);
        if (move) {
            this.renderer.animateMove(this.game, move.fromRow, move.fromCol, move.toRow, move.toCol, () => {
                this.game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                this.botThinking = false;
                this.updateStatus();
                this.renderer.render(this.game);
            });
        } else {
            this.botThinking = false;
            this.updateStatus();
        }
    }

    // ── Controls ──────────────────────────────

    handleUndo() {
        if (this.botThinking || this.mode === 'online') return;

        if (this.mode === 'pvsbot') {
            this.game.undoMove();
            this.game.undoMove();
        } else {
            this.game.undoMove();
        }

        this.updateStatus();
        this.renderer.render(this.game);
        this.saveGame();
    }

    handleRestart() {
        if (this.mode === 'online') {
            // Request restart from opponent
            if (this.network && !this.opponentDisconnected) {
                this.network.requestRestart();
                this.showToast('🔄 Restart request sent...');
            } else if (this.opponentDisconnected) {
                // Opponent gone, just go back to menu
                this.showMenu();
            }
            return;
        }

        if (this.mode) {
            this.startGame(this.mode);
        }
    }

    // ── Status ────────────────────────────────

    updateStatus() {
        const statusEl = document.getElementById('game-status');
        const turnIndicator = document.getElementById('turn-indicator');

        if (this.opponentDisconnected && this.mode === 'online') {
            statusEl.textContent = '⚡ Opponent disconnected';
            statusEl.className = 'status-text game-over';
            return;
        }

        if (this.game.gameOver) {
            const winnerName = this.game.winner === SIDE.RED ? 'Red' : 'Black';
            const winnerChar = this.game.winner === SIDE.RED ? '紅方' : '黑方';
            const loserName = this.game.winner === SIDE.RED ? 'Black' : 'Red';
            const loserChar = this.game.winner === SIDE.RED ? '黑方' : '紅方';

            let text;
            if (this.game.loseReason === 'perpetual-check') {
                text = `⛔ ${loserChar} (${loserName}) loses by perpetual check!`;
            } else {
                text = `🏆 ${winnerChar} (${winnerName}) Wins!`;
            }

            if (this.mode === 'online') {
                text += this.game.winner === this.playerSide ? ' — You Win! 🎉' : ' — You Lose';
            }

            statusEl.textContent = text;
            statusEl.className = 'status-text game-over';
            turnIndicator.className = `turn-dot ${this.game.winner}`;
            return;
        }

        if (this.botThinking) {
            statusEl.textContent = '🤔 Bot is thinking...';
            statusEl.className = 'status-text thinking';
            turnIndicator.className = 'turn-dot black';
            return;
        }

        const turnName = this.game.currentTurn === SIDE.RED ? 'Red' : 'Black';
        const turnChar = this.game.currentTurn === SIDE.RED ? '紅方' : '黑方';
        let text = `${turnChar} (${turnName})'s Turn`;

        if (this.mode === 'online') {
            text += this.game.currentTurn === this.playerSide ? ' — Your move' : ' — Waiting...';
        }

        if (this.game.inCheck) {
            text += ' — ⚠️ CHECK!';
        }

        if (this.game.checkLimitReached) {
            text += ' — ⛔ No more checks!';
        }

        statusEl.textContent = text;
        statusEl.className = `status-text ${this.game.inCheck ? 'in-check' : ''} ${this.game.checkLimitReached ? 'check-limited' : ''}`;
        turnIndicator.className = `turn-dot ${this.game.currentTurn}`;
    }

    // ── Toast ─────────────────────────────────

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
    }
}

// Initialize the app
window.addEventListener('DOMContentLoaded', () => {
    new ChineseChessApp();
});
