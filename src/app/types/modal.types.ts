/**
 * Shared type definitions for modal/dialog components throughout the application.
 * Centralizes modal type unions to prevent duplication and ensure consistency.
 */

/**
 * Base modal type representing game outcomes and system messages.
 * Used for game-over modals and system notifications.
 *
 * - `win`: Player won the game
 * - `loss`: Player lost the game
 * - `draw`: Game ended in a draw
 * - `forfeit`: Game ended by forfeit/abandonment
 * - `roomExpired`: Room/session was cancelled or expired
 * - `info`: Generic informational modal
 */
export type ModalType = 'forfeit' | 'roomExpired' | 'info' | 'win' | 'loss' | 'draw';

/**
 * Extended modal type that includes rematch-specific modals.
 * Used in contexts where rematch functionality is available.
 *
 * Includes all base ModalType values plus:
 * - `rematch`: Modal for rematch offers/confirmations
 */
export type ExtendedModalType = ModalType | 'rematch';

/**
 * Modal data structure passed to modal components.
 * Contains all information needed to display a modal dialog.
 */
export interface ModalData {
  /** Type of modal (determines styling and behavior) */
  type: ExtendedModalType;
  /** Modal title text */
  title: string;
  /** Modal body message */
  message: string;
  /** Optional game/room code to display */
  code?: string | null;
}

/**
 * Type guard to check if a modal type is a game outcome (win/loss/draw).
 *
 * @param type - Modal type to check
 * @returns True if type represents a game outcome
 *
 * @example
 * ```typescript
 * if (isGameOutcome(modal.type)) {
 *   // Handle game-over logic
 * }
 * ```
 */
export function isGameOutcome(type: ExtendedModalType): type is 'win' | 'loss' | 'draw' {
  return type === 'win' || type === 'loss' || type === 'draw';
}

/**
 * Type guard to check if a modal type is an error/cancellation.
 *
 * @param type - Modal type to check
 * @returns True if type represents an error or cancellation
 *
 * @example
 * ```typescript
 * if (isErrorModal(modal.type)) {
 *   // Handle error cleanup
 * }
 * ```
 */
export function isErrorModal(type: ExtendedModalType): type is 'forfeit' | 'roomExpired' {
  return type === 'forfeit' || type === 'roomExpired';
}
