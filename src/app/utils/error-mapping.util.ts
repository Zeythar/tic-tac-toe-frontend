/**
 * Centralized error message mapping for consistent user-facing error messages.
 * Provides a single source of truth for error text across the application.
 */

/**
 * Error message catalog. Maps error codes from the server to user-friendly messages.
 * This is the single source for all error text, making it easy to:
 * - Update messaging for UX improvements
 * - Add internationalization (i18n)
 * - Maintain consistency across the app
 */
export const ERROR_MESSAGES = {
  // Join/Room errors
  RoomFull: 'Room is full — please ask creator for a new code.',
  AlreadyInRoom: "You're already in this room.",
  NotFound: 'Invalid or expired game code.',
  PlayerIdInUse: 'This playerId is already in use.',
  ReconnectRequired: 'Reconnect required.',
  ReconnectFailed: 'Reconnect failed. Please try again.',
  JoinFailed: 'Failed to join game.',
  NoPayload: 'No game data received.',

  // Move errors
  NotYourTurn: 'Not your turn',
  CellTaken: 'Cell already taken',
  GameOver: 'Game is over',
  InvalidMove: 'Invalid move',

  // Generic errors
  Exception: 'An unexpected error occurred',
  DEFAULT: 'An error occurred',
} as const;

/**
 * Error severity levels for potential future use (logging, UI styling, etc.)
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Error metadata for advanced error handling
 */
export interface ErrorInfo {
  message: string;
  severity: ErrorSeverity;
  code?: string;
}

/**
 * Map an error code to a user-friendly message.
 * Falls back to server message if code is not recognized, or default message if neither exists.
 *
 * @param errorCode - The error code from the server (e.g., 'RoomFull', 'NotYourTurn')
 * @param serverMessage - Optional fallback message from the server
 * @returns User-friendly error message
 *
 * @example
 * ```typescript
 * const msg = mapError('RoomFull'); // "Room is full — please ask creator for a new code."
 * const msg2 = mapError('UnknownCode', 'Server said: bad request'); // "Server said: bad request"
 * const msg3 = mapError(null, null); // "An error occurred"
 * ```
 */
export function mapError(errorCode?: string | null, serverMessage?: string | null): string {
  if (errorCode && errorCode in ERROR_MESSAGES) {
    return ERROR_MESSAGES[errorCode as keyof typeof ERROR_MESSAGES];
  }
  return serverMessage || ERROR_MESSAGES.DEFAULT;
}

/**
 * Map an error code to detailed error information including severity.
 * Useful for logging, analytics, or conditional UI rendering.
 *
 * @param errorCode - The error code from the server
 * @param serverMessage - Optional fallback message from the server
 * @returns Error information with message and severity
 */
export function mapErrorInfo(errorCode?: string | null, serverMessage?: string | null): ErrorInfo {
  const message = mapError(errorCode, serverMessage);

  // Determine severity based on error code
  let severity = ErrorSeverity.ERROR;
  if (errorCode === 'AlreadyInRoom' || errorCode === 'ReconnectRequired') {
    severity = ErrorSeverity.INFO;
  } else if (errorCode === 'RoomFull' || errorCode === 'NotYourTurn') {
    severity = ErrorSeverity.WARNING;
  } else if (errorCode === 'Exception' || errorCode === 'ReconnectFailed') {
    severity = ErrorSeverity.CRITICAL;
  }

  return {
    message,
    severity,
    code: errorCode || undefined,
  };
}
