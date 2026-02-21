// ============================================
// Chinese Chess (Xiangqi) - Constants
// ============================================

export const COLS = 9;
export const ROWS = 10;
export const CELL_SIZE = 64;
export const PADDING = 40;
export const PIECE_RADIUS = 26;

export const CANVAS_WIDTH = PADDING * 2 + (COLS - 1) * CELL_SIZE;
export const CANVAS_HEIGHT = PADDING * 2 + (ROWS - 1) * CELL_SIZE;

// Colors
export const COLORS = {
    background: '#2a1810',
    boardBg: '#e8c87a',
    boardLine: '#5a3a1a',
    river: '#d4b76a',
    redPiece: '#c0392b',
    redPieceText: '#fff',
    blackPiece: '#1a1a2e',
    blackPieceText: '#f0e6d3',
    pieceBorder: '#8b6914',
    pieceBorderInner: '#d4a843',
    selectedGlow: '#f1c40f',
    validMove: 'rgba(46, 204, 113, 0.6)',
    lastMove: 'rgba(241, 196, 15, 0.35)',
    checkGlow: '#e74c3c',
    highlight: 'rgba(255, 255, 255, 0.15)',
};

// Piece types
export const PIECE = {
    KING: 'king',
    ADVISOR: 'advisor',
    ELEPHANT: 'elephant',
    HORSE: 'horse',
    CHARIOT: 'chariot',
    CANNON: 'cannon',
    SOLDIER: 'soldier',
};

// Sides
export const SIDE = {
    RED: 'red',
    BLACK: 'black',
};

// Chinese characters for pieces
export const PIECE_CHARS = {
    [SIDE.RED]: {
        [PIECE.KING]: '帥',
        [PIECE.ADVISOR]: '仕',
        [PIECE.ELEPHANT]: '相',
        [PIECE.HORSE]: '馬',
        [PIECE.CHARIOT]: '車',
        [PIECE.CANNON]: '砲',
        [PIECE.SOLDIER]: '兵',
    },
    [SIDE.BLACK]: {
        [PIECE.KING]: '將',
        [PIECE.ADVISOR]: '士',
        [PIECE.ELEPHANT]: '象',
        [PIECE.HORSE]: '馬',
        [PIECE.CHARIOT]: '車',
        [PIECE.CANNON]: '炮',
        [PIECE.SOLDIER]: '卒',
    },
};

// Piece values for AI evaluation
export const PIECE_VALUES = {
    [PIECE.KING]: 10000,
    [PIECE.CHARIOT]: 900,
    [PIECE.CANNON]: 450,
    [PIECE.HORSE]: 400,
    [PIECE.ELEPHANT]: 200,
    [PIECE.ADVISOR]: 200,
    [PIECE.SOLDIER]: 100,
};

// Positional bonuses for soldiers (after crossing river, they're more valuable)
export const SOLDIER_ADVANCE_BONUS = 80;

// Initial board layout: null = empty, { type, side }
// Board is indexed as board[row][col], row 0 = top (black side), row 9 = bottom (red side)
function p(type, side) {
    return { type, side };
}

const R = SIDE.RED;
const B = SIDE.BLACK;

export const INITIAL_BOARD = [
    // Row 0: Black back rank
    [p(PIECE.CHARIOT, B), p(PIECE.HORSE, B), p(PIECE.ELEPHANT, B), p(PIECE.ADVISOR, B), p(PIECE.KING, B), p(PIECE.ADVISOR, B), p(PIECE.ELEPHANT, B), p(PIECE.HORSE, B), p(PIECE.CHARIOT, B)],
    // Row 1: empty
    [null, null, null, null, null, null, null, null, null],
    // Row 2: Black cannons
    [null, p(PIECE.CANNON, B), null, null, null, null, null, p(PIECE.CANNON, B), null],
    // Row 3: Black soldiers
    [p(PIECE.SOLDIER, B), null, p(PIECE.SOLDIER, B), null, p(PIECE.SOLDIER, B), null, p(PIECE.SOLDIER, B), null, p(PIECE.SOLDIER, B)],
    // Row 4: empty (river)
    [null, null, null, null, null, null, null, null, null],
    // Row 5: empty (river)
    [null, null, null, null, null, null, null, null, null],
    // Row 6: Red soldiers
    [p(PIECE.SOLDIER, R), null, p(PIECE.SOLDIER, R), null, p(PIECE.SOLDIER, R), null, p(PIECE.SOLDIER, R), null, p(PIECE.SOLDIER, R)],
    // Row 7: Red cannons
    [null, p(PIECE.CANNON, R), null, null, null, null, null, p(PIECE.CANNON, R), null],
    // Row 8: empty
    [null, null, null, null, null, null, null, null, null],
    // Row 9: Red back rank
    [p(PIECE.CHARIOT, R), p(PIECE.HORSE, R), p(PIECE.ELEPHANT, R), p(PIECE.ADVISOR, R), p(PIECE.KING, R), p(PIECE.ADVISOR, R), p(PIECE.ELEPHANT, R), p(PIECE.HORSE, R), p(PIECE.CHARIOT, R)],
];
