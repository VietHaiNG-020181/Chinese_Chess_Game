// ============================================
// Chinese Chess (Xiangqi) - Main Application
// ============================================

import { Game } from './game.js';
import { BoardRenderer } from './board.js';
import { AI } from './ai.js';
import { Network } from './network.js';
import { SIDE } from './constants.js';

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

        this.initUI();
        this.checkUrlForRoom();
    }

    initUI() {
        // Mode selection buttons
        document.getElementById('btn-pvp').addEventListener('click', () => this.startGame('pvp'));
        document.getElementById('btn-pvsbot').addEventListener('click', () => this.startGame('pvsbot'));
        document.getElementById('btn-online').addEventListener('click', () => this.showLobby());

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
        this.showScreen('menu-screen');
    }

    showLobby() {
        this.showScreen('lobby-screen');
        // Reset lobby state
        document.getElementById('lobby-choice').classList.remove('hidden');
        document.getElementById('lobby-waiting').classList.add('hidden');
        document.getElementById('lobby-error').classList.add('hidden');
        document.getElementById('input-room-id').value = '';
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
            const errEl = document.getElementById('lobby-error');
            errEl.textContent = message;
            errEl.classList.remove('hidden');
            setTimeout(() => errEl.classList.add('hidden'), 4000);
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
    }

    async handleCreateRoom() {
        try {
            await this.ensureConnected();
            this.network.createRoom();
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
            this.network.joinRoom(roomId);
        } catch (e) {
            this.showLobbyError('Failed to connect to server. Is the server running?');
        }
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
            this.ai = new AI(SIDE.BLACK);
            this.playerSide = SIDE.RED;
        } else if (mode === 'pvp') {
            this.ai = null;
        }
        // For 'online', playerSide is already set by the network callback

        this.showScreen('game-screen');

        // Update mode indicator
        let modeLabel;
        if (mode === 'pvp') modeLabel = '⚔️ Player vs Player';
        else if (mode === 'pvsbot') modeLabel = '🤖 Player vs Bot';
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

            let suffix = '';
            if (this.mode === 'online') {
                suffix = this.game.winner === this.playerSide ? ' — You Win! 🎉' : ' — You Lose';
            }

            statusEl.textContent = `🏆 ${winnerChar} (${winnerName}) Wins!${suffix}`;
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

        statusEl.textContent = text;
        statusEl.className = `status-text ${this.game.inCheck ? 'in-check' : ''}`;
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
