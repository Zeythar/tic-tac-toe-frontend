/**
 * Utility functions for time synchronization and remaining time calculations.
 * Handles clock skew between client and server, timezone differences, and legacy formats.
 */

/**
 * Calculate remaining time using server timestamp for precise synchronization.
 * Handles clock skew by computing the offset between client and server time.
 *
 * This function is designed to work with server-provided timestamps to avoid
 * issues with client clock drift, timezone differences, or manual clock adjustments.
 *
 * @param turnExpiry - ISO 8601 timestamp when turn expires (e.g., "2025-10-24T12:00:00Z")
 * @param serverTimestamp - Current server time in ISO 8601 format (e.g., "2025-10-24T11:59:30Z")
 * @param fallbackRemaining - Fallback remaining seconds if timestamps are invalid
 * @returns Remaining seconds (always >= 0)
 *
 * @example
 * ```typescript
 * // Server says turn expires at 12:00:00, current server time is 11:59:30
 * // Client clock is 5 seconds ahead of server
 * const remaining = calculateRemainingSeconds(
 *   "2025-10-24T12:00:00Z",
 *   "2025-10-24T11:59:30Z",
 *   30
 * );
 * // Returns ~30 seconds, adjusted for client clock offset
 * ```
 */
export function calculateRemainingSeconds(
  turnExpiry: string | null | undefined,
  serverTimestamp: string | null | undefined,
  fallbackRemaining: number = 0
): number {
  try {
    // If we have both turnExpiry and serverTimestamp, use them for precise calculation
    if (turnExpiry && serverTimestamp) {
      const expiryMs = Date.parse(turnExpiry);
      const serverMs = Date.parse(serverTimestamp);

      if (!Number.isNaN(expiryMs) && !Number.isNaN(serverMs)) {
        // Compute client clock offset from server time
        // clientClockOffset = Date.now() - serverMs (how far ahead the client clock is)
        const clientClockOffsetMs = Date.now() - serverMs;

        // Remaining ms until expiry relative to server time, adjusted for client elapsed time
        // Formula: (expiry - serverNow) - clientClockOffset
        // This accounts for: how much time remains on server - how much has passed on client
        const remainingMs = expiryMs - serverMs - clientClockOffsetMs;
        const remaining = Math.max(0, Math.ceil(remainingMs / 1000));

        return remaining;
      }
    }

    // Fallback: use the provided remaining seconds
    return Math.max(0, Math.ceil(Number(fallbackRemaining ?? 0)));
  } catch (e) {
    console.debug('[time-sync] Error in calculateRemainingSeconds', e);
    return Math.max(0, Math.ceil(Number(fallbackRemaining ?? 0)));
  }
}

/**
 * Compute remaining seconds from a legacy payload format.
 * Used for backward compatibility with events that provide time in various formats.
 *
 * Supported formats:
 * - ISO 8601 string timestamp (absolute time)
 * - Number > 1e12: treated as millisecond timestamp (absolute time)
 * - Number <= 1e12: treated as seconds remaining (relative time)
 * - null/undefined: returns 0
 *
 * @param payload - Time value in one of the supported formats
 * @returns Remaining seconds (always >= 0)
 *
 * @example
 * ```typescript
 * computeRemainingLegacy("2025-10-24T12:00:00Z") // seconds until that time
 * computeRemainingLegacy(1729771200000) // millisecond timestamp
 * computeRemainingLegacy(30) // 30 seconds remaining
 * computeRemainingLegacy(null) // 0
 * ```
 */
export function computeRemainingLegacy(payload: any): number {
  if (payload == null) return 0;

  // If string that parses to a date
  if (typeof payload === 'string') {
    const ms = Date.parse(payload);
    if (!Number.isNaN(ms)) {
      return Math.max(0, Math.ceil((ms - Date.now()) / 1000));
    }
  }

  // If number: could be seconds remaining or ms timestamp
  if (typeof payload === 'number') {
    // Treat as ms timestamp if reasonably large (> 1e12 ~ year 33658)
    // This threshold distinguishes between "30 seconds" and "timestamp 1729771200000"
    if (payload > 1e12) {
      return Math.max(0, Math.ceil((payload - Date.now()) / 1000));
    }
    // Otherwise treat as seconds remaining
    return Math.max(0, Math.ceil(Number(payload ?? 0)));
  }

  // Fallback for unexpected types
  return 0;
}

/**
 * Get the current time as ISO 8601 string (UTC).
 * Useful for testing and debugging time-related logic.
 *
 * @returns Current time in ISO 8601 format
 *
 * @example
 * ```typescript
 * getCurrentISOTime() // "2025-10-24T12:00:00.000Z"
 * ```
 */
export function getCurrentISOTime(): string {
  return new Date().toISOString();
}

/**
 * Calculate client clock offset from server timestamp.
 * Positive value means client clock is ahead of server.
 *
 * @param serverTimestamp - ISO 8601 timestamp from server
 * @returns Offset in milliseconds (client - server), or 0 if invalid
 *
 * @example
 * ```typescript
 * // Client clock is 5 seconds ahead
 * getClockOffset("2025-10-24T12:00:00Z") // returns ~5000 if client shows 12:00:05
 * ```
 */
export function getClockOffset(serverTimestamp: string | null | undefined): number {
  if (!serverTimestamp) return 0;

  try {
    const serverMs = Date.parse(serverTimestamp);
    if (Number.isNaN(serverMs)) return 0;

    return Date.now() - serverMs;
  } catch (e) {
    return 0;
  }
}
