// ============================================
// Chinese Chess (Xiangqi) - Game State & Logic
// ============================================

import { PIECE, SIDE, COLS, ROWS, INITIAL_BOARD } from './constants.js';
import { getPieceMoves, inBounds } from './pieces.js';

export class Game {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = this.cloneBoard(INITIAL_BOARD);
        this.currentTurn = SIDE.RED;
        this.selectedPiece = null;
        this.validMoves = [];
        this.lastMove = null;
        this.moveHistory = [];
        this.gameOver = false;
        this.winner = null;
        this.loseReason = null; // 'checkmate' or 'perpetual-check'
        this.inCheck = false;
        this.consecutiveChecks = { [SIDE.RED]: 0, [SIDE.BLACK]: 0 };
        this.checkHistory = { [SIDE.RED]: [], [SIDE.BLACK]: [] }; // track {pieceKey, toRow, toCol}
        this.checkLimitReached = false;
    }

    cloneBoard(board) {
        return board.map(row =>
            row.map(cell => cell ? { ...cell } : null)
        );
    }

    /**
     * Find the king position for a given side
     */
    findKing(board, side) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = board[r][c];
                if (p && p.type === PIECE.KING && p.side === side) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }

    /**
     * Check if the flying general rule is violated
     * (two kings facing each other on the same column with nothing in between)
     */
    isFlyingGeneral(board) {
        const redKing = this.findKing(board, SIDE.RED);
        const blackKing = this.findKing(board, SIDE.BLACK);
        if (!redKing || !blackKing) return false;
        if (redKing.col !== blackKing.col) return false;

        for (let r = blackKing.row + 1; r < redKing.row; r++) {
            if (board[r][redKing.col]) return false;
        }
        return true;
    }

    /**
     * Check if a side's king is under attack
     */
    isInCheck(board, side) {
        const king = this.findKing(board, side);
        if (!king) return true; // King captured = in check

        const oppSide = side === SIDE.RED ? SIDE.BLACK : SIDE.RED;

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = board[r][c];
                if (p && p.side === oppSide) {
                    const moves = getPieceMoves(board, r, c);
                    for (const m of moves) {
                        if (m.row === king.row && m.col === king.col) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * Apply a move to a board (mutates the board)
     */
    applyMove(board, fromRow, fromCol, toRow, toCol) {
        const captured = board[toRow][toCol];
        board[toRow][toCol] = board[fromRow][fromCol];
        board[fromRow][fromCol] = null;
        return captured;
    }

    /**
     * Get all legal moves for a piece (filters out self-check)
     */
    getLegalMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];

        const pseudoMoves = getPieceMoves(this.board, row, col);
        const legalMoves = [];
        const oppSide = piece.side === SIDE.RED ? SIDE.BLACK : SIDE.RED;

        // Check if this side has a perpetual check pattern to avoid
        const checkHist = this.checkHistory[piece.side];
        const mustAvoidRepeat = this.consecutiveChecks[piece.side] >= 3;

        for (const move of pseudoMoves) {
            const testBoard = this.cloneBoard(this.board);
            this.applyMove(testBoard, row, col, move.row, move.col);

            // Filter out moves that leave own king in check
            if (this.isInCheck(testBoard, piece.side) || this.isFlyingGeneral(testBoard)) {
                continue;
            }

            // If at perpetual check limit, block moves that repeat the same check pattern
            if (mustAvoidRepeat && this.isInCheck(testBoard, oppSide)) {
                const pieceKey = `${piece.type}_${row}_${col}`;
                const repeatCount = checkHist.filter(
                    h => h.pieceKey === pieceKey && h.toRow === move.row && h.toCol === move.col
                ).length;
                if (repeatCount >= 1) {
                    continue; // This exact check pattern has been used before
                }
            }

            legalMoves.push(move);
        }
        return legalMoves;
    }

    /**
     * Get all legal moves for a side
     */
    getAllLegalMoves(side) {
        const moves = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = this.board[r][c];
                if (p && p.side === side) {
                    const pieceMoves = this.getLegalMoves(r, c);
                    for (const m of pieceMoves) {
                        moves.push({ fromRow: r, fromCol: c, toRow: m.row, toCol: m.col });
                    }
                }
            }
        }
        return moves;
    }

    /**
     * Execute a move
     */
    makeMove(fromRow, fromCol, toRow, toCol) {
        if (this.gameOver) return false;

        const piece = this.board[fromRow][fromCol];
        if (!piece || piece.side !== this.currentTurn) return false;

        // Validate move is legal
        const legalMoves = this.getLegalMoves(fromRow, fromCol);
        const isLegal = legalMoves.some(m => m.row === toRow && m.col === toCol);
        if (!isLegal) return false;

        const captured = this.board[toRow][toCol];

        // Save move history for undo
        this.moveHistory.push({
            fromRow, fromCol, toRow, toCol,
            piece: { ...piece },
            captured: captured ? { ...captured } : null,
            board: this.cloneBoard(this.board),
            prevConsecutiveChecks: { ...this.consecutiveChecks },
            prevCheckHistory: {
                [SIDE.RED]: [...this.checkHistory[SIDE.RED]],
                [SIDE.BLACK]: [...this.checkHistory[SIDE.BLACK]],
            },
        });

        // Apply the move
        this.applyMove(this.board, fromRow, fromCol, toRow, toCol);
        this.lastMove = { fromRow, fromCol, toRow, toCol };

        // Switch turn
        this.currentTurn = this.currentTurn === SIDE.RED ? SIDE.BLACK : SIDE.RED;

        // Check game state
        this.inCheck = this.isInCheck(this.board, this.currentTurn);

        // Track consecutive checks
        const movingSide = piece.side;
        if (this.inCheck) {
            this.consecutiveChecks[movingSide]++;
            // Record check pattern: which piece from where to where
            const pieceKey = `${piece.type}_${fromRow}_${fromCol}`;
            this.checkHistory[movingSide].push({ pieceKey, toRow, toCol });
        } else {
            this.consecutiveChecks[movingSide] = 0;
            this.checkHistory[movingSide] = [];
        }

        // Flag if current player has hit the check limit
        this.checkLimitReached = this.consecutiveChecks[this.currentTurn] >= 3;

        const hasLegalMoves = this.getAllLegalMoves(this.currentTurn).length > 0;

        if (!hasLegalMoves) {
            this.gameOver = true;
            this.winner = this.currentTurn === SIDE.RED ? SIDE.BLACK : SIDE.RED;
            // Determine if it's checkmate or perpetual check loss
            if (this.checkLimitReached) {
                this.loseReason = 'perpetual-check';
            } else {
                this.loseReason = 'checkmate';
            }
        }

        return true;
    }

    /**
     * Undo the last move
     */
    undoMove() {
        if (this.moveHistory.length === 0) return false;

        const lastEntry = this.moveHistory.pop();
        this.board = lastEntry.board;
        this.currentTurn = lastEntry.piece.side;
        this.gameOver = false;
        this.winner = null;
        this.loseReason = null;

        // Restore consecutive checks
        this.consecutiveChecks = lastEntry.prevConsecutiveChecks || { [SIDE.RED]: 0, [SIDE.BLACK]: 0 };
        this.checkHistory = lastEntry.prevCheckHistory || { [SIDE.RED]: [], [SIDE.BLACK]: [] };
        this.checkLimitReached = this.consecutiveChecks[this.currentTurn] >= 3;

        // Restore last move indicator
        if (this.moveHistory.length > 0) {
            const prev = this.moveHistory[this.moveHistory.length - 1];
            this.lastMove = { fromRow: prev.fromRow, fromCol: prev.fromCol, toRow: prev.toRow, toCol: prev.toCol };
        } else {
            this.lastMove = null;
        }

        this.inCheck = this.isInCheck(this.board, this.currentTurn);
        this.selectedPiece = null;
        this.validMoves = [];
        return true;
    }

    /**
     * Select a piece and compute its valid moves
     */
    selectPiece(row, col) {
        const piece = this.board[row][col];
        if (!piece || piece.side !== this.currentTurn) {
            this.selectedPiece = null;
            this.validMoves = [];
            return false;
        }
        this.selectedPiece = { row, col };
        this.validMoves = this.getLegalMoves(row, col);
        return true;
    }

    clearSelection() {
        this.selectedPiece = null;
        this.validMoves = [];
    }

    /**
     * Serialize game state to a plain object (for localStorage)
     */
    toJSON() {
        return {
            board: this.board,
            currentTurn: this.currentTurn,
            moveHistory: this.moveHistory,
            lastMove: this.lastMove,
            gameOver: this.gameOver,
            winner: this.winner,
            loseReason: this.loseReason,
            inCheck: this.inCheck,
            consecutiveChecks: this.consecutiveChecks,
            checkHistory: this.checkHistory,
        };
    }

    /**
     * Restore game state from a plain object
     */
    fromJSON(data) {
        this.board = data.board;
        this.currentTurn = data.currentTurn;
        this.moveHistory = data.moveHistory || [];
        this.lastMove = data.lastMove || null;
        this.gameOver = data.gameOver || false;
        this.winner = data.winner || null;
        this.loseReason = data.loseReason || null;
        this.inCheck = data.inCheck || false;
        this.consecutiveChecks = data.consecutiveChecks || { [SIDE.RED]: 0, [SIDE.BLACK]: 0 };
        this.checkHistory = data.checkHistory || { [SIDE.RED]: [], [SIDE.BLACK]: [] };
        this.checkLimitReached = this.consecutiveChecks[this.currentTurn] >= 3;
        this.selectedPiece = null;
        this.validMoves = [];
    }
}
