// ============================================
// Chinese Chess (Xiangqi) - Piece Movement Rules
// ============================================

import { PIECE, SIDE, COLS, ROWS } from './constants.js';

/**
 * Check if a position is within the board
 */
export function inBounds(row, col) {
    return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

/**
 * Check if position is within the palace
 */
function inPalace(row, col, side) {
    if (col < 3 || col > 5) return false;
    if (side === SIDE.RED) return row >= 7 && row <= 9;
    return row >= 0 && row <= 2;
}

/**
 * Check if a soldier has crossed the river
 */
function hasCrossedRiver(row, side) {
    if (side === SIDE.RED) return row <= 4;
    return row >= 5;
}

/**
 * Get all pseudo-legal moves for a piece (doesn't check for self-check)
 */
export function getPieceMoves(board, row, col) {
    const piece = board[row][col];
    if (!piece) return [];

    switch (piece.type) {
        case PIECE.KING: return getKingMoves(board, row, col, piece.side);
        case PIECE.ADVISOR: return getAdvisorMoves(board, row, col, piece.side);
        case PIECE.ELEPHANT: return getElephantMoves(board, row, col, piece.side);
        case PIECE.HORSE: return getHorseMoves(board, row, col, piece.side);
        case PIECE.CHARIOT: return getChariotMoves(board, row, col, piece.side);
        case PIECE.CANNON: return getCannonMoves(board, row, col, piece.side);
        case PIECE.SOLDIER: return getSoldierMoves(board, row, col, piece.side);
        default: return [];
    }
}

function getKingMoves(board, row, col, side) {
    const moves = [];
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (inPalace(nr, nc, side)) {
            const target = board[nr][nc];
            if (!target || target.side !== side) {
                moves.push({ row: nr, col: nc });
            }
        }
    }

    // Flying general: king can "capture" opposing king if on same column with no pieces between
    const oppSide = side === SIDE.RED ? SIDE.BLACK : SIDE.RED;
    // Search for opposing king on same column
    const startR = oppSide === SIDE.RED ? 7 : 0;
    const endR = oppSide === SIDE.RED ? 9 : 2;
    for (let r = startR; r <= endR; r++) {
        const p = board[r][col];
        if (p && p.type === PIECE.KING && p.side === oppSide) {
            // Check if path is clear
            const minR = Math.min(row, r);
            const maxR = Math.max(row, r);
            let clear = true;
            for (let rr = minR + 1; rr < maxR; rr++) {
                if (board[rr][col]) { clear = false; break; }
            }
            if (clear) {
                moves.push({ row: r, col: col });
            }
        }
    }

    return moves;
}

function getAdvisorMoves(board, row, col, side) {
    const moves = [];
    const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (inPalace(nr, nc, side)) {
            const target = board[nr][nc];
            if (!target || target.side !== side) {
                moves.push({ row: nr, col: nc });
            }
        }
    }
    return moves;
}

function getElephantMoves(board, row, col, side) {
    const moves = [];
    const dirs = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
    const blocks = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let i = 0; i < dirs.length; i++) {
        const [dr, dc] = dirs[i];
        const [br, bc] = blocks[i];
        const nr = row + dr;
        const nc = col + dc;
        if (!inBounds(nr, nc)) continue;
        // Can't cross river
        if (hasCrossedRiver(nr, side)) continue;
        // Check blocking piece (elephant eye)
        if (board[row + br][col + bc]) continue;
        const target = board[nr][nc];
        if (!target || target.side !== side) {
            moves.push({ row: nr, col: nc });
        }
    }
    return moves;
}

function getHorseMoves(board, row, col, side) {
    const moves = [];
    // Horse moves: first step orthogonal, then diagonal
    const patterns = [
        { block: [-1, 0], moves: [[-2, -1], [-2, 1]] },
        { block: [1, 0], moves: [[2, -1], [2, 1]] },
        { block: [0, -1], moves: [[-1, -2], [1, -2]] },
        { block: [0, 1], moves: [[-1, 2], [1, 2]] },
    ];
    for (const p of patterns) {
        const br = row + p.block[0];
        const bc = col + p.block[1];
        if (!inBounds(br, bc)) continue;
        if (board[br][bc]) continue; // Blocked (hobbling the horse's leg)
        for (const [dr, dc] of p.moves) {
            const nr = row + dr;
            const nc = col + dc;
            if (!inBounds(nr, nc)) continue;
            const target = board[nr][nc];
            if (!target || target.side !== side) {
                moves.push({ row: nr, col: nc });
            }
        }
    }
    return moves;
}

function getChariotMoves(board, row, col, side) {
    const moves = [];
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of dirs) {
        let nr = row + dr;
        let nc = col + dc;
        while (inBounds(nr, nc)) {
            const target = board[nr][nc];
            if (!target) {
                moves.push({ row: nr, col: nc });
            } else {
                if (target.side !== side) {
                    moves.push({ row: nr, col: nc });
                }
                break;
            }
            nr += dr;
            nc += dc;
        }
    }
    return moves;
}

function getCannonMoves(board, row, col, side) {
    const moves = [];
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of dirs) {
        let nr = row + dr;
        let nc = col + dc;
        let jumped = false;
        while (inBounds(nr, nc)) {
            const target = board[nr][nc];
            if (!jumped) {
                if (!target) {
                    moves.push({ row: nr, col: nc });
                } else {
                    jumped = true; // Found the platform piece
                }
            } else {
                if (target) {
                    if (target.side !== side) {
                        moves.push({ row: nr, col: nc });
                    }
                    break;
                }
            }
            nr += dr;
            nc += dc;
        }
    }
    return moves;
}

function getSoldierMoves(board, row, col, side) {
    const moves = [];
    const forward = side === SIDE.RED ? -1 : 1;
    const crossed = hasCrossedRiver(row, side);

    // Always can move forward
    const nr = row + forward;
    if (inBounds(nr, col)) {
        const target = board[nr][col];
        if (!target || target.side !== side) {
            moves.push({ row: nr, col: col });
        }
    }

    // After crossing river, can also move sideways
    if (crossed) {
        for (const dc of [-1, 1]) {
            const nc = col + dc;
            if (inBounds(row, nc)) {
                const target = board[row][nc];
                if (!target || target.side !== side) {
                    moves.push({ row: row, col: nc });
                }
            }
        }
    }

    return moves;
}
