/**
 * Utility functions for localStorage persistence with safe error handling
 */

/**
 * Type for optional storage error callback
 */
export type StorageErrorCallback = (context: string, error: unknown) => void;

/**
 * Optional global error handler for storage operations
 */
let globalStorageErrorHandler: StorageErrorCallback | null = null;

/**
 * Set a global error handler for all storage operations.
 * Useful for logging, analytics, or debugging.
 *
 * @param handler - Callback to invoke on storage errors
 *
 * @example
 * ```typescript
 * setStorageErrorHandler((context, error) => {
 *   console.error(`Storage error in ${context}:`, error);
 *   analytics.track('storage_error', { context, error });
 * });
 * ```
 */
export function setStorageErrorHandler(handler: StorageErrorCallback | null): void {
  globalStorageErrorHandler = handler;
}

/**
 * Safely execute a storage operation with consistent error handling.
 *
 * @param operation - The storage operation to execute
 * @param fallback - Value to return if operation fails
 * @param context - Description of the operation (for error logging)
 * @returns Result of operation or fallback value
 */
function safeStorageOp<T>(operation: () => T, fallback: T, context: string): T {
  try {
    return operation();
  } catch (e) {
    console.warn(`Storage operation failed: ${context}`, e);

    // Call global error handler if registered
    if (globalStorageErrorHandler) {
      try {
        globalStorageErrorHandler(context, e);
      } catch (handlerError) {
        console.error('Storage error handler failed:', handlerError);
      }
    }

    return fallback;
  }
}

/**
 * Generic storage manager for type-safe localStorage operations.
 * Provides a scalable pattern for managing multiple storage keys.
 *
 * @template T - The type of value stored (must be serializable to/from string)
 *
 * @example
 * ```typescript
 * const themeManager = new StorageManager<string>('app.theme');
 * themeManager.set('dark');
 * const theme = themeManager.get(); // 'dark' | null
 * themeManager.clear();
 * ```
 */
export class StorageManager<T = string> {
  constructor(
    private readonly key: string,
    private readonly serializer: (value: T) => string = String,
    private readonly deserializer: (value: string) => T = ((v: string) => v) as any
  ) {}

  /**
   * Get the value from localStorage
   */
  get(): T | null {
    return safeStorageOp(
      () => {
        const value = localStorage.getItem(this.key);
        return value !== null ? this.deserializer(value) : null;
      },
      null,
      `StorageManager.get(${this.key})`
    );
  }

  /**
   * Set a value in localStorage
   */
  set(value: T): void {
    safeStorageOp(
      () => localStorage.setItem(this.key, this.serializer(value)),
      undefined,
      `StorageManager.set(${this.key})`
    );
  }

  /**
   * Remove the value from localStorage
   */
  clear(): void {
    safeStorageOp(
      () => localStorage.removeItem(this.key),
      undefined,
      `StorageManager.clear(${this.key})`
    );
  }

  /**
   * Check if a value exists in localStorage
   */
  has(): boolean {
    return this.get() !== null;
  }
}

/**
 * Storage keys used throughout the application
 */
const STORAGE_KEYS = {
  GAME_CODE: 'ttt.gameCode',
  PLAYER_ID: 'ttt.playerId',
} as const;

/**
 * Storage managers for application data
 */
const gameCodeManager = new StorageManager<string>(STORAGE_KEYS.GAME_CODE);
const playerIdManager = new StorageManager<string>(STORAGE_KEYS.PLAYER_ID);

/**
 * Get the stored game code
 */
export function getStoredGameCode(): string | null {
  return gameCodeManager.get();
}

/**
 * Set the stored game code
 */
export function setStoredGameCode(code: string): void {
  gameCodeManager.set(code);
}

/**
 * Clear the stored game code
 */
export function clearStoredGameCode(): void {
  gameCodeManager.clear();
}

/**
 * Get the stored player ID
 */
export function getStoredPlayerId(): string | null {
  return playerIdManager.get();
}

/**
 * Set the stored player ID
 */
export function setStoredPlayerId(playerId: string): void {
  playerIdManager.set(playerId);
}

/**
 * Clear the stored player ID
 */
export function clearStoredPlayerId(): void {
  playerIdManager.clear();
}

/**
 * Get both stored game code and player ID
 */
export function getStoredGameSession(): {
  gameCode: string | null;
  playerId: string | null;
} {
  return {
    gameCode: getStoredGameCode(),
    playerId: getStoredPlayerId(),
  };
}

/**
 * Clear all stored game session data from localStorage.
 *
 * This removes:
 * - Game code (ttt.gameCode)
 * - Player ID (ttt.playerId)
 *
 * Typically called in response to server events (GameAbandoned, Disconnected)
 * or when explicitly leaving a game session. Does NOT affect:
 * - Application UI state (use GameStateService.resetAllState())
 * - SignalR connection (use SignalRService.disconnect())
 * - Navigation state (use router/stage updates)
 *
 * @see GameStateService.resetAllState() for UI state cleanup
 * @see SignalRService.disconnect() for connection cleanup
 */
export function clearStoredGameSession(): void {
  clearStoredGameCode();
  clearStoredPlayerId();
}
