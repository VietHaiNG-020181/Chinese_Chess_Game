// ============================================
// Chinese Chess (Xiangqi) - AI Bot (Minimax)
// ============================================

import { PIECE, SIDE, COLS, ROWS, PIECE_VALUES, SOLDIER_ADVANCE_BONUS } from './constants.js';
import { getPieceMoves } from './pieces.js';

const MAX_DEPTH = 3;

// Positional bonus tables (10x9, row x col)
// Encourages pieces to move to more active squares
const POSITION_BONUS = {
    [PIECE.HORSE]: [
        [0, -4, 0, 0, 0, 0, 0, -4, 0],
        [0, 2, 4, 4, 4, 4, 4, 2, 0],
        [0, 2, 4, 6, 6, 6, 4, 2, 0],
        [0, 2, 6, 8, 8, 8, 6, 2, 0],
        [0, 4, 6, 8, 10, 8, 6, 4, 0],
        [0, 4, 6, 8, 10, 8, 6, 4, 0],
        [0, 2, 6, 8, 8, 8, 6, 2, 0],
        [0, 2, 4, 6, 6, 6, 4, 2, 0],
        [0, 2, 4, 4, 4, 4, 4, 2, 0],
        [0, -4, 0, 0, 0, 0, 0, -4, 0],
    ],
    [PIECE.CANNON]: [
        [0, 0, 2, 4, 4, 4, 2, 0, 0],
        [0, 2, 4, 4, 4, 4, 4, 2, 0],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [0, 2, 4, 4, 4, 4, 4, 2, 0],
        [0, 0, 2, 4, 4, 4, 2, 0, 0],
    ],
};

export class AI {
    constructor(side) {
        this.side = side;
        this.oppSide = side === SIDE.RED ? SIDE.BLACK : SIDE.RED;
    }

    /**
     * Get the best move for the AI using minimax with alpha-beta pruning
     * Returns a promise so we can use setTimeout to avoid UI freeze
     */
    getBestMove(game) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const moves = game.getAllLegalMoves(this.side);
                if (moves.length === 0) {
                    resolve(null);
                    return;
                }

                // Sort moves for better pruning: captures first, then by piece value
                moves.sort((a, b) => {
                    const captA = game.board[a.toRow][a.toCol];
                    const captB = game.board[b.toRow][b.toCol];
                    const valA = captA ? PIECE_VALUES[captA.type] : 0;
                    const valB = captB ? PIECE_VALUES[captB.type] : 0;
                    return valB - valA;
                });

                let bestScore = -Infinity;
                let bestMove = moves[0];

                for (const move of moves) {
                    const board = game.cloneBoard(game.board);
                    this.applyMove(board, move.fromRow, move.fromCol, move.toRow, move.toCol);

                    const score = this.minimax(board, MAX_DEPTH - 1, -Infinity, Infinity, false, game);

                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = move;
                    }
                }

                resolve(bestMove);
            }, 100);
        });
    }

    applyMove(board, fromRow, fromCol, toRow, toCol) {
        board[toRow][toCol] = board[fromRow][fromCol];
        board[fromRow][fromCol] = null;
    }

    cloneBoard(board) {
        return board.map(row => row.map(cell => cell ? { ...cell } : null));
    }

    minimax(board, depth, alpha, beta, isMaximizing, game) {
        if (depth === 0) {
            return this.evaluate(board);
        }

        const side = isMaximizing ? this.side : this.oppSide;
        const moves = this.getAllMovesForBoard(board, side, game);

        if (moves.length === 0) {
            // No moves = loss for the side that can't move
            return isMaximizing ? -99999 + (MAX_DEPTH - depth) : 99999 - (MAX_DEPTH - depth);
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const newBoard = this.cloneBoard(board);
                this.applyMove(newBoard, move.fromRow, move.fromCol, move.toRow, move.toCol);
                const evalScore = this.minimax(newBoard, depth - 1, alpha, beta, false, game);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const newBoard = this.cloneBoard(board);
                this.applyMove(newBoard, move.fromRow, move.fromCol, move.toRow, move.toCol);
                const evalScore = this.minimax(newBoard, depth - 1, alpha, beta, true, game);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    getAllMovesForBoard(board, side, game) {
        const moves = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = board[r][c];
                if (p && p.side === side) {
                    const pieceMoves = getPieceMoves(board, r, c);
                    for (const m of pieceMoves) {
                        // Quick legality check: don't move into self-check
                        const testBoard = this.cloneBoard(board);
                        this.applyMove(testBoard, r, c, m.row, m.col);
                        if (!this.isInCheck(testBoard, side) && !this.isFlyingGeneral(testBoard)) {
                            moves.push({ fromRow: r, fromCol: c, toRow: m.row, toCol: m.col });
                        }
                    }
                }
            }
        }

        // Sort: captures first
        moves.sort((a, b) => {
            const captA = board[a.toRow][a.toCol];
            const captB = board[b.toRow][b.toCol];
            const valA = captA ? PIECE_VALUES[captA.type] : 0;
            const valB = captB ? PIECE_VALUES[captB.type] : 0;
            return valB - valA;
        });

        return moves;
    }

    isInCheck(board, side) {
        let kingRow = -1, kingCol = -1;
        const oppSide = side === SIDE.RED ? SIDE.BLACK : SIDE.RED;

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = board[r][c];
                if (p && p.type === PIECE.KING && p.side === side) {
                    kingRow = r; kingCol = c; break;
                }
            }
            if (kingRow >= 0) break;
        }
        if (kingRow < 0) return true;

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = board[r][c];
                if (p && p.side === oppSide) {
                    const moves = getPieceMoves(board, r, c);
                    for (const m of moves) {
                        if (m.row === kingRow && m.col === kingCol) return true;
                    }
                }
            }
        }
        return false;
    }

    isFlyingGeneral(board) {
        let redKing = null, blackKing = null;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = board[r][c];
                if (p && p.type === PIECE.KING) {
                    if (p.side === SIDE.RED) redKing = { row: r, col: c };
                    else blackKing = { row: r, col: c };
                }
            }
        }
        if (!redKing || !blackKing) return false;
        if (redKing.col !== blackKing.col) return false;
        for (let r = blackKing.row + 1; r < redKing.row; r++) {
            if (board[r][redKing.col]) return false;
        }
        return true;
    }

    /**
     * Board evaluation from the AI's perspective
     */
    evaluate(board) {
        let score = 0;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = board[r][c];
                if (!p) continue;

                let value = PIECE_VALUES[p.type];

                // Positional bonus
                if (POSITION_BONUS[p.type]) {
                    const bonusTable = POSITION_BONUS[p.type];
                    value += bonusTable[r][c];
                }

                // Soldier advancement bonus
                if (p.type === PIECE.SOLDIER) {
                    if (p.side === SIDE.RED && r <= 4) {
                        value += SOLDIER_ADVANCE_BONUS;
                        // Closer to opponent = more bonus
                        value += (4 - r) * 10;
                    } else if (p.side === SIDE.BLACK && r >= 5) {
                        value += SOLDIER_ADVANCE_BONUS;
                        value += (r - 5) * 10;
                    }
                }

                if (p.side === this.side) {
                    score += value;
                } else {
                    score -= value;
                }
            }
        }
        return score;
    }
}
