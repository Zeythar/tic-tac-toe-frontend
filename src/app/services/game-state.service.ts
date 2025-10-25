import { Injectable, Signal } from '@angular/core';
import { GameState } from '../types/game.types';
import { ExtendedModalType } from '../types/modal.types';
import { createSignalPair } from '../utils/signal-factory.util';
import { normalizeBoard, normalizeCell, createEmptyBoard } from '../utils/board-normalization.util';

/**
 * Central game state management using Angular signals.
 *
 * Each state property uses createSignalPair() for readonly public access
 * with private setter methods.
 */
@Injectable({
  providedIn: 'root',
})
export class GameStateService {
  // Game board state
  private readonly _board = createSignalPair<Array<string | null>>(createEmptyBoard());
  public readonly board: Signal<Array<string | null>> = this._board.signal;

  // Player's assigned symbol (X or O)
  private readonly _mySymbol = createSignalPair<string | null>(null);
  public readonly mySymbol: Signal<string | null> = this._mySymbol.signal;

  // Current turn symbol
  private readonly _currentTurn = createSignalPair<string | null>(null);
  public readonly currentTurn: Signal<string | null> = this._currentTurn.signal;

  // Game over flag
  private readonly _isGameOver = createSignalPair<boolean>(false);
  public readonly isGameOver: Signal<boolean> = this._isGameOver.signal;

  // Winner symbol (null if draw or game not over)
  private readonly _winner = createSignalPair<string | null>(null);
  public readonly winner: Signal<string | null> = this._winner.signal;

  // Room/game code
  private readonly _gameCode = createSignalPair<string | null>(null);
  public readonly gameCode: Signal<string | null> = this._gameCode.signal;

  // Opponent presence flag
  private readonly _opponentPresent = createSignalPair<boolean>(false);
  public readonly opponentPresent: Signal<boolean> = this._opponentPresent.signal;

  // Player ID assigned by server
  private readonly _playerId = createSignalPair<string | null>(null);
  public readonly playerId: Signal<string | null> = this._playerId.signal;

  // Join error message
  private readonly _joinError = createSignalPair<string | null>(null);
  public readonly joinError: Signal<string | null> = this._joinError.signal;

  // Current value of join input
  private readonly _codeValue = createSignalPair<string>('');
  public readonly codeValue: Signal<string> = this._codeValue.signal;

  // Blocked game code (full room)
  private readonly _blockedGameCode = createSignalPair<string | null>(null);
  public readonly blockedGameCode: Signal<string | null> = this._blockedGameCode.signal;

  // Disconnected player ID
  private readonly _disconnectedPlayerId = createSignalPair<string | null>(null);
  public readonly disconnectedPlayerId: Signal<string | null> = this._disconnectedPlayerId.signal;

  // Countdown seconds for reconnection
  private readonly _countdownSeconds = createSignalPair<number | null>(null);
  public readonly countdownSeconds: Signal<number | null> = this._countdownSeconds.signal;

  // Per-turn countdowns (separate numeric timers for local player and opponent)
  private readonly _myTurnCountdown = createSignalPair<number | null>(null);
  public readonly myTurnCountdown: Signal<number | null> = this._myTurnCountdown.signal;

  private readonly _opponentTurnCountdown = createSignalPair<number | null>(null);
  public readonly opponentTurnCountdown: Signal<number | null> = this._opponentTurnCountdown.signal;

  // Copy feedback
  private readonly _copied = createSignalPair<boolean>(false);
  public readonly copied: Signal<boolean> = this._copied.signal;

  // System modal for important notifications (forfeit/room expired)
  private readonly _systemModal = createSignalPair<{
    type: ExtendedModalType;
    title: string;
    message: string;
    code?: string | null;
    isLocal?: boolean;
    // Rematch-specific fields
    offeredByOpponent?: boolean;
    rematchOfferedByMe?: boolean;
    rematchCancelled?: boolean;
    remainingSeconds?: number | null;
  } | null>(null);
  public readonly systemModal: Signal<{
    type: ExtendedModalType;
    title: string;
    message: string;
    code?: string | null;
    isLocal?: boolean;
    offeredByOpponent?: boolean;
    rematchOfferedByMe?: boolean;
    rematchCancelled?: boolean;
    remainingSeconds?: number | null;
  } | null> = this._systemModal.signal;

  // Move error message
  private readonly _moveError = createSignalPair<string | null>(null);
  public readonly moveError: Signal<string | null> = this._moveError.signal;

  // ============================================================================
  // State Update Methods
  // ============================================================================

  /**
   * Update the game board
   */
  setBoard(board: Array<string | null>): void {
    this._board.set(normalizeBoard(board));
  }

  /** Update player's symbol */
  setMySymbol(symbol: string | null): void {
    this._mySymbol.set(symbol);
  }

  /** Update current turn */
  setCurrentTurn(turn: string | null): void {
    this._currentTurn.set(turn);
  }

  /** Update game over status */
  setIsGameOver(isOver: boolean): void {
    this._isGameOver.set(isOver);
  }

  /** Update winner */
  setWinner(winner: string | null): void {
    this._winner.set(winner);
  }

  /** Update game code */
  setGameCode(code: string | null): void {
    this._gameCode.set(code);
  }

  /** Update opponent presence */
  setOpponentPresent(present: boolean): void {
    this._opponentPresent.set(present);
  }

  /** Update player ID */
  setPlayerId(id: string | null): void {
    this._playerId.set(id);
  }

  /** Update join error */
  setJoinError(error: string | null): void {
    this._joinError.set(error);
  }

  /** Update code input value */
  setCodeValue(value: string): void {
    this._codeValue.set(value);
  }

  /** Update blocked game code */
  setBlockedGameCode(code: string | null): void {
    this._blockedGameCode.set(code);
  }

  /** Update disconnected player ID */
  setDisconnectedPlayerId(id: string | null): void {
    this._disconnectedPlayerId.set(id);
  }

  /** Update countdown seconds */
  setCountdownSeconds(seconds: number | null): void {
    this._countdownSeconds.set(seconds);
  }

  /** Set the remaining seconds for the local player's turn timer */
  setMyTurnCountdown(seconds: number | null): void {
    this._myTurnCountdown.set(seconds);
  }

  /** Set the remaining seconds for the opponent player's turn timer */
  setOpponentTurnCountdown(seconds: number | null): void {
    this._opponentTurnCountdown.set(seconds);
  }

  /** Clear both per-turn countdown timers */
  clearTurnCountdowns(): void {
    this._myTurnCountdown.set(null);
    this._opponentTurnCountdown.set(null);
  }

  /** Update copied flag */
  setCopied(copied: boolean): void {
    this._copied.set(copied);
  }

  /** Update move error */
  setMoveError(error: string | null): void {
    this._moveError.set(error);
  }

  /** Show a system modal for important state changes (forfeits, expired rooms) */
  setSystemModal(
    modal: {
      type: ExtendedModalType;
      title: string;
      message: string;
      code?: string | null;
      isLocal?: boolean;
      offeredByOpponent?: boolean;
      rematchOfferedByMe?: boolean;
      rematchCancelled?: boolean;
      remainingSeconds?: number | null;
    } | null
  ): void {
    this._systemModal.set(modal ?? null);
  }

  /**
   * Update full game state from server response
   */
  updateGameState(state: GameState): void {
    // Normalize and apply board (ensure length 9). Accept both `board` and `Board`.
    const incomingBoard = (state as any).board ?? (state as any).Board;
    if (Array.isArray(incomingBoard)) {
      this.setBoard(normalizeBoard(incomingBoard));
    }

    // current turn (accept currentTurn or CurrentTurn)
    const current = (state as any).currentTurn ?? (state as any).CurrentTurn;
    if (typeof current !== 'undefined') {
      this.setCurrentTurn(current ?? null);
    }

    // isOver / IsGameOver
    const isOver = (state as any).isOver ?? (state as any).IsGameOver;
    if (typeof isOver !== 'undefined') {
      this.setIsGameOver(Boolean(isOver));
    }

    // winner / Winner
    const winner = (state as any).winner ?? (state as any).Winner;
    if (typeof winner !== 'undefined') {
      this.setWinner(winner ?? null);
    }

    // Accept either `mySymbol`, `symbol`, or `Symbol` field from server payloads
    const symbol = (state as any).mySymbol ?? (state as any).symbol ?? (state as any).Symbol;
    if (typeof symbol !== 'undefined') {
      this.setMySymbol(symbol ?? null);
    }
  }

  /**
   * Reset game state to initial values.
   *
   * Use this when starting a new game within the same session
   * (e.g., rematch, new round with same room/players).
   *
   * Resets: board, symbols, turn, winner, game-over flag, opponent presence
   * Preserves: room code, player ID, join errors, UI state
   */
  resetGameState(): void {
    this._board.set(createEmptyBoard());
    this._mySymbol.set(null);
    this._currentTurn.set(null);
    this._isGameOver.set(false);
    this._winner.set(null);
    this._opponentPresent.set(false);
  }

  /**
   * Reset all state (including room/session data).
   *
   * Use this when returning to home screen or abandoning a session completely.
   * This is a full reset that clears everything except SignalR connection.
   *
   * Note: Does NOT clear localStorage - use clearStoredGameSession() separately if needed.
   * Note: Does NOT disconnect SignalR - call signalR.disconnect() separately if needed.
   *
   * Resets: All game state + room code + player ID + UI state + modals + errors
   */
  resetAllState(): void {
    this.resetGameState();
    this._gameCode.set(null);
    this._playerId.set(null);
    this._joinError.set(null);
    this._codeValue.set('');
    this._blockedGameCode.set(null);
    this._disconnectedPlayerId.set(null);
    this._countdownSeconds.set(null);
    this._copied.set(false);
    this._moveError.set(null);
    // Clear any system modal
    this._systemModal.set(null);
  }
}
