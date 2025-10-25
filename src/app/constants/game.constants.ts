/**
 * Game-wide constants for timeouts, durations, and default values.
 * Centralized to avoid magic numbers throughout the codebase.
 */

/**
 * Turn timer constants
 */
export const TURN_DURATION_SECONDS = 30;
export const TURN_TICK_TIMEOUT_MS = 3500; // How long before clearing a stale countdown
export const TURN_WARNING_THRESHOLD_SECONDS = 10; // When to show warning state (if needed)

/**
 * UI timing constants
 */
export const GAME_OVER_MODAL_DELAY_MS = 1500; // Delay before showing game over modal
export const COPY_FEEDBACK_DURATION_MS = 1500; // How long "Copied!" feedback persists
export const RECONNECT_SYNC_TIMEOUT_MS = 1200; // Timeout for waiting on SyncedState during reconnection

/**
 * Animation/transition durations (match SCSS)
 */
export const FADE_IN_DURATION_MS = 300;
export const CELL_ICON_ANIMATION_MS = 500;
export const TIMER_TRANSITION_MS = 300;

/**
 * Board constants
 */
export const BOARD_SIZE = 9;
export const BOARD_ROWS = 3;
export const BOARD_COLS = 3;
export const WINNING_LINE_LENGTH = 3;

/**
 * Z-index layers
 */
export const Z_INDEX_DISCONNECT_BANNER = 30;
export const Z_INDEX_MODAL = 50;

/**
 * AI difficulty settings
 */
export const AI_MOVE_DELAY_MS = 600; // Slight delay to make AI feel more natural
