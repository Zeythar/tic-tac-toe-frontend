/**
 * Type definitions for the tic-tac-toe game
 */

/**
 * Generic API response wrapper used by backend for all endpoints
 * Provides consistent success/failure handling and metadata (correlation IDs, timestamps)
 */
export interface ApiResponse<T> {
  success: boolean;
  payload?: T | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  // Optional opaque details object for diagnostics (do not display raw to end users)
  details?: any;
  correlationId?: string | null;
  serverTimestamp?: string | null;
}

/**
 * Result type returned by the server when joining a room
 * Now uses ApiResponse wrapper for consistency
 */
export type JoinRoomResult = ApiResponse<GameJoinResult>;

/**
 * Result type returned by the server when creating a game
 * Now uses ApiResponse wrapper for consistency
 */
export type CreateGameResult = ApiResponse<GameJoinResult>;

/**
 * Game join result payload - returned by CreateGame and JoinGame endpoints
 * Contains full game state so no extra fetch is needed
 */
export interface GameJoinResult {
  code: string;
  playerId?: string;
  board: Array<string | null>;
  symbol: string | null;
  currentTurn: string | null;
  isGameOver: boolean;
  winner?: string | null;
}

/**
 * Move result payload (what goes inside ApiResponse<MoveResult>)
 */
export interface MoveResult {
  success: boolean;
  board?: Array<string | null> | null;
  currentTurn?: string | null;
  isGameOver: boolean;
  winner?: string | null;
  gameOver?: GameOverDto | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

/**
 * Result type returned by the server when making a move
 * Now uses ApiResponse wrapper for consistency
 */
export type MakeMoveResult = ApiResponse<MoveResult>;

/**
 * Game state returned by the server
 */
export interface GameState {
  board?: Array<string | null>;
  currentTurn?: string | null;
  isOver?: boolean;
  winner?: string | null;
  mySymbol?: string | null;
}

/**
 * Join game result with full state
 */
export interface JoinGameFullResult {
  success: boolean;
  code?: string;
  board?: Array<string | null>;
  symbol?: string | null;
  currentTurn?: string | null;
  playerId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Result returned by Reconnect which now includes authoritative game state.
 */
export interface GameStateResult {
  success?: boolean;
  code?: string;
  playerId?: string;
  board?: Array<string | null>;
  symbol?: string | null;
  currentTurn?: string | null;
  isGameOver?: boolean;
  winner?: string | null;
}

/**
 * DTO sent by server when a game ends (unified GameOver payload)
 */
export interface GameOverDto {
  roomCode?: string;
  code?: string;
  result?: 'Winner' | 'Forfeit' | 'Draw' | 'Cancelled' | string;
  Result?: string; // accept PascalCase during migration
  winnerId?: string | null;
  winnerSymbol?: string | null;
  forfeiterId?: string | null;
  boardSnapshot?: Array<string | null>;
  currentTurn?: string | null;
  isGameOver: boolean;
  message?: string | null;
  // Correlation id to dedupe GameOver events emitted synchronously with RPCs
  correlationId?: string | null;
  // Server timestamp (ISO or ms) to help clients synchronize timers
  serverTimestamp?: string | null;
}

/**
 * Information about a disconnected player provided by GetRoomState
 */
export interface DisconnectedPlayerInfoDto {
  playerId?: string | null;
  // Authoritative remaining seconds for reconnection grace period
  remainingReconnectionSeconds?: number | null;
  // Optional: when the disconnection occurred (ISO timestamp)
  disconnectedAt?: string | null;
}

/**
 * Lightweight opponent info
 */
export interface OpponentDto {
  playerId?: string | null;
  connected?: boolean;
  name?: string | null;
}

/**
 * Room state DTO returned by GetRoomState. Contains high-level flags for
 * opponent presence/connection as well as detailed disconnectedPlayers info.
 */
export interface RoomStateDto {
  code?: string;
  playerId?: string | null;
  board?: Array<string | null>;
  currentTurn?: string | null;
  isOver?: boolean;
  winner?: string | null;
  mySymbol?: string | null;
  // Convenience flags for frontend
  opponentPresent?: boolean;
  opponentConnected?: boolean;
  disconnectedPlayerId?: string | null;
  // Detailed per-player info when available
  disconnectedPlayers?: Array<DisconnectedPlayerInfoDto> | null;
  opponent?: OpponentDto | null;
  // Server timestamp to help with timer sync if present
  serverTimestamp?: string | null;
}
