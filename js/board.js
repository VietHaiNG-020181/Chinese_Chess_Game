// ============================================
// Chinese Chess (Xiangqi) - Board Renderer
// ============================================

import {
    COLS, ROWS, CELL_SIZE, PADDING, PIECE_RADIUS,
    CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, PIECE_CHARS, SIDE, PIECE
} from './constants.js';

export class BoardRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        this.animatingPiece = null;
        this.flipped = false;
    }

    /**
     * Convert board coordinates to canvas pixel coordinates
     */
    toPixel(row, col) {
        const r = this.flipped ? (ROWS - 1 - row) : row;
        const c = this.flipped ? (COLS - 1 - col) : col;
        return {
            x: PADDING + c * CELL_SIZE,
            y: PADDING + r * CELL_SIZE,
        };
    }

    /**
     * Convert canvas pixel coordinates to board coordinates
     */
    toBoard(x, y) {
        let col = Math.round((x - PADDING) / CELL_SIZE);
        let row = Math.round((y - PADDING) / CELL_SIZE);
        if (this.flipped) {
            row = ROWS - 1 - row;
            col = COLS - 1 - col;
        }
        if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
            return { row, col };
        }
        return null;
    }

    /**
     * Full render
     */
    render(game) {
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        this.drawBoard();
        this.drawLastMove(game.lastMove);
        this.drawPieces(game.board, game.selectedPiece, game.inCheck, game.currentTurn);
        this.drawValidMoves(game.validMoves);
        this.drawSelectedHighlight(game.selectedPiece);
    }

    drawBoard() {
        const ctx = this.ctx;

        // Background
        ctx.fillStyle = COLORS.boardBg;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Subtle wood grain texture via gradient
        const grad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        grad.addColorStop(0, 'rgba(180, 140, 60, 0.15)');
        grad.addColorStop(0.5, 'rgba(220, 180, 100, 0.05)');
        grad.addColorStop(1, 'rgba(180, 140, 60, 0.15)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.strokeStyle = COLORS.boardLine;
        ctx.lineWidth = 1.5;

        // Draw horizontal lines
        for (let r = 0; r < ROWS; r++) {
            const { x: x1, y } = this.toPixel(r, 0);
            const { x: x2 } = this.toPixel(r, COLS - 1);
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
            ctx.stroke();
        }

        // Draw vertical lines
        for (let c = 0; c < COLS; c++) {
            // Top half
            const { x, y: y1 } = this.toPixel(0, c);
            const { y: y2 } = this.toPixel(4, c);
            ctx.beginPath();
            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
            ctx.stroke();

            // Bottom half
            const { y: y3 } = this.toPixel(5, c);
            const { y: y4 } = this.toPixel(9, c);
            ctx.beginPath();
            ctx.moveTo(x, y3);
            ctx.lineTo(x, y4);
            ctx.stroke();
        }

        // Left and right border lines span the full height
        const { x: leftX } = this.toPixel(0, 0);
        const { x: rightX } = this.toPixel(0, COLS - 1);
        const { y: topY } = this.toPixel(0, 0);
        const { y: botY } = this.toPixel(ROWS - 1, 0);
        ctx.beginPath();
        ctx.moveTo(leftX, topY);
        ctx.lineTo(leftX, botY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rightX, topY);
        ctx.lineTo(rightX, botY);
        ctx.stroke();

        // Outer border
        ctx.strokeStyle = COLORS.boardLine;
        ctx.lineWidth = 3;
        ctx.strokeRect(
            PADDING - 10, PADDING - 10,
            (COLS - 1) * CELL_SIZE + 20,
            (ROWS - 1) * CELL_SIZE + 20
        );
        ctx.lineWidth = 1.5;

        // Palace diagonals - Black side (top)
        this.drawPalaceDiagonals(0, 3);
        // Palace diagonals - Red side (bottom)
        this.drawPalaceDiagonals(7, 3);

        // River text
        this.drawRiver();

        // Draw star points (cannon and soldier positions)
        this.drawStarPoints();
    }

    drawPalaceDiagonals(startRow, startCol) {
        const ctx = this.ctx;
        ctx.strokeStyle = COLORS.boardLine;
        ctx.lineWidth = 1.5;

        const { x: x1, y: y1 } = this.toPixel(startRow, startCol);
        const { x: x2, y: y2 } = this.toPixel(startRow + 2, startCol + 2);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const { x: x3, y: y3 } = this.toPixel(startRow, startCol + 2);
        const { x: x4, y: y4 } = this.toPixel(startRow + 2, startCol);
        ctx.beginPath();
        ctx.moveTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.stroke();
    }

    drawRiver() {
        const ctx = this.ctx;
        const { y: y1 } = this.toPixel(4, 0);
        const { y: y2 } = this.toPixel(5, 0);
        const midY = (y1 + y2) / 2;

        // River background
        ctx.fillStyle = 'rgba(180, 160, 100, 0.25)';
        ctx.fillRect(PADDING, y1, (COLS - 1) * CELL_SIZE, y2 - y1);

        // River text
        ctx.fillStyle = COLORS.boardLine;
        ctx.font = 'bold 28px "Noto Serif SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const leftX = PADDING + (COLS - 1) * CELL_SIZE * 0.25;
        const rightX = PADDING + (COLS - 1) * CELL_SIZE * 0.75;

        if (this.flipped) {
            // Rotate text 180° for the black player's perspective
            ctx.save();
            ctx.translate(leftX, midY);
            ctx.rotate(Math.PI);
            ctx.fillText('漢 界', 0, 0);
            ctx.restore();
            ctx.save();
            ctx.translate(rightX, midY);
            ctx.rotate(Math.PI);
            ctx.fillText('楚 河', 0, 0);
            ctx.restore();
        } else {
            ctx.fillText('楚 河', leftX, midY);
            ctx.fillText('漢 界', rightX, midY);
        }
    }

    drawStarPoints() {
        const ctx = this.ctx;
        const positions = [
            // Cannon positions
            [2, 1], [2, 7], [7, 1], [7, 7],
            // Soldier positions
            [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
            [6, 0], [6, 2], [6, 4], [6, 6], [6, 8],
        ];

        for (const [r, c] of positions) {
            this.drawStarPoint(r, c);
        }
    }

    drawStarPoint(row, col) {
        const ctx = this.ctx;
        const { x, y } = this.toPixel(row, col);
        const s = 6;
        const g = 3;

        ctx.strokeStyle = COLORS.boardLine;
        ctx.lineWidth = 1.2;

        const drawCorner = (dx, dy) => {
            ctx.beginPath();
            ctx.moveTo(x + dx * g, y + dy * (g + s));
            ctx.lineTo(x + dx * g, y + dy * g);
            ctx.lineTo(x + dx * (g + s), y + dy * g);
            ctx.stroke();
        };

        if (col > 0) {
            drawCorner(-1, -1);
            drawCorner(-1, 1);
        }
        if (col < COLS - 1) {
            drawCorner(1, -1);
            drawCorner(1, 1);
        }
    }

    drawLastMove(lastMove) {
        if (!lastMove) return;
        const ctx = this.ctx;

        for (const pos of [{ row: lastMove.fromRow, col: lastMove.fromCol }, { row: lastMove.toRow, col: lastMove.toCol }]) {
            const { x, y } = this.toPixel(pos.row, pos.col);
            ctx.fillStyle = COLORS.lastMove;
            ctx.fillRect(x - CELL_SIZE / 2, y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
        }
    }

    drawPieces(board, selectedPiece, inCheck, currentTurn) {
        const ctx = this.ctx;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const piece = board[r][c];
                if (!piece) continue;

                // Skip the animating piece at its original position
                if (this.animatingPiece && this.animatingPiece.fromRow === r && this.animatingPiece.fromCol === c) continue;

                const { x, y } = this.toPixel(r, c);
                const isSelected = selectedPiece && selectedPiece.row === r && selectedPiece.col === c;
                const isKingInCheck = inCheck && piece.type === PIECE.KING && piece.side === currentTurn;

                this.drawPiece(x, y, piece, isSelected, isKingInCheck);
            }
        }

        // Draw animating piece
        if (this.animatingPiece) {
            this.drawPiece(
                this.animatingPiece.x,
                this.animatingPiece.y,
                this.animatingPiece.piece,
                false, false
            );
        }
    }

    drawPiece(x, y, piece, isSelected, isKingInCheck) {
        const ctx = this.ctx;
        const r = PIECE_RADIUS;

        // Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;

        // Outer circle
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = piece.side === SIDE.RED ? '#f5e6c8' : '#e8dcc8';
        ctx.fill();
        ctx.restore();

        // Border ring
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.pieceBorder;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Inner border ring
        ctx.beginPath();
        ctx.arc(x, y, r - 4, 0, Math.PI * 2);
        ctx.strokeStyle = piece.side === SIDE.RED ? '#c0392b' : '#2c3e50';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Character
        const char = PIECE_CHARS[piece.side][piece.type];
        ctx.fillStyle = piece.side === SIDE.RED ? COLORS.redPiece : COLORS.blackPiece;
        ctx.font = `bold ${r * 1.1}px "Noto Serif SC", "SimSun", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char, x, y + 1);

        // Selected glow effect
        if (isSelected) {
            ctx.beginPath();
            ctx.arc(x, y, r + 4, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.selectedGlow;
            ctx.lineWidth = 3;
            ctx.shadowColor = COLORS.selectedGlow;
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Check warning glow
        if (isKingInCheck) {
            ctx.beginPath();
            ctx.arc(x, y, r + 5, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.checkGlow;
            ctx.lineWidth = 3;
            ctx.save();
            ctx.shadowColor = COLORS.checkGlow;
            ctx.shadowBlur = 18;
            ctx.stroke();
            ctx.restore();
        }
    }

    drawValidMoves(validMoves) {
        const ctx = this.ctx;
        for (const move of validMoves) {
            const { x, y } = this.toPixel(move.row, move.col);
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.validMove;
            ctx.fill();

            // Outer ring for capture squares
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    drawSelectedHighlight(selectedPiece) {
        if (!selectedPiece) return;
        // Already handled in drawPiece via isSelected flag
    }

    /**
     * Animate a piece moving from one position to another
     */
    animateMove(game, fromRow, fromCol, toRow, toCol, callback) {
        const from = this.toPixel(fromRow, fromCol);
        const to = this.toPixel(toRow, toCol);
        const piece = game.board[fromRow][fromCol];
        if (!piece) { callback(); return; }

        const duration = 200; // ms
        const startTime = performance.now();

        this.animatingPiece = {
            piece,
            fromRow, fromCol,
            x: from.x,
            y: from.y,
        };

        const animate = (time) => {
            const elapsed = time - startTime;
            const t = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - t, 3);

            this.animatingPiece.x = from.x + (to.x - from.x) * ease;
            this.animatingPiece.y = from.y + (to.y - from.y) * ease;

            this.render(game);

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                this.animatingPiece = null;
                callback();
            }
        };

        requestAnimationFrame(animate);
    }
}
