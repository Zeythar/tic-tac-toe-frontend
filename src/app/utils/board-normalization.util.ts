/**
 * Utilities for normalizing and validating tic-tac-toe board state.
 * Provides a single source of truth for cell value interpretation.
 */

/**
 * Empty 9-cell tic-tac-toe board constant.
 * Use this instead of Array(9).fill(null) for consistency.
 */
export const EMPTY_BOARD: ReadonlyArray<null> = Object.freeze(Array(9).fill(null));

/**
 * Create a new empty board array.
 * Returns a mutable copy of EMPTY_BOARD for state initialization.
 *
 * @returns New empty 9-cell board array
 *
 * @example
 * ```typescript
 * const board = createEmptyBoard();
 * board[0] = 'X'; // Mutable array
 * ```
 */
export function createEmptyBoard(): Array<string | null> {
  return Array(9).fill(null);
}

/**
 * Normalize a cell value from various server formats to canonical 'X' | 'O' | null.
 *
 * Handles multiple server encodings:
 * - null/undefined -> null (empty cell)
 * - 0 or '0' -> null (server encodes empty as 0)
 * - 1, '1', 'X', 'x' -> 'X'
 * - 2, '2', 'O', 'o' -> 'O'
 *
 * @param value - Raw cell value from server or UI
 * @returns Normalized cell value
 */
export function normalizeCell(value: any): 'X' | 'O' | null {
  if (value === null || typeof value === 'undefined') return null;

  // Treat numeric 0 or string '0' as an empty cell (server may encode empty as 0)
  if (value === 0 || value === '0') return null;

  // Accept numbers or strings for X/O
  if (value === 1 || value === '1' || String(value).toUpperCase() === 'X') return 'X';
  if (value === 2 || value === '2' || String(value).toUpperCase() === 'O') return 'O';

  // Fallback: try string conversion and uppercase
  try {
    const s = String(value).trim().toUpperCase();
    if (s === 'X') return 'X';
    if (s === 'O') return 'O';
  } catch (e) {
    // ignore conversion errors
  }

  return null;
}

/**
 * Normalize a board array from server format to canonical format.
 * Ensures board is always exactly 9 cells with normalized values.
 *
 * @param board - Raw board array from server (may be any length)
 * @returns Normalized 9-cell board array
 */
export function normalizeBoard(board: any[]): Array<string | null> {
  const result = createEmptyBoard();

  if (!Array.isArray(board)) {
    return result;
  }

  for (let i = 0; i < 9; i++) {
    result[i] = i < board.length ? normalizeCell(board[i]) : null;
  }

  return result;
}

/**
 * Check if there's a winner on the board.
 *
 * @param board - Normalized board array
 * @returns Winner symbol ('X' or 'O') or null if no winner
 */
export function checkWinner(board: Array<string | null>): string | null {
  const lines = [
    [0, 1, 2], // top row
    [3, 4, 5], // middle row
    [6, 7, 8], // bottom row
    [0, 3, 6], // left column
    [1, 4, 7], // middle column
    [2, 5, 8], // right column
    [0, 4, 8], // diagonal top-left to bottom-right
    [2, 4, 6], // diagonal top-right to bottom-left
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}

/**
 * Check if the board is full (no empty cells).
 *
 * @param board - Normalized board array
 * @returns True if all cells are filled
 */
export function isBoardFull(board: Array<string | null>): boolean {
  return board.every((cell) => cell !== null);
}
