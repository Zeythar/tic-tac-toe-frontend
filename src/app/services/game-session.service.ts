import { Injectable } from '@angular/core';
import { SignalRService } from './signalr/signalr.service';
import { GameStateService } from './game-state.service';
import { CorrelationIdTrackerService } from './error-handling/correlation-id-tracker.service';
import {
  CreateGameResult,
  JoinGameFullResult,
  GameStateResult,
  ApiResponse,
  GameJoinResult,
} from '../types/game.types';
import {
  setStoredGameCode,
  setStoredPlayerId,
  getStoredPlayerId,
  clearStoredGameSession,
  clearStoredPlayerId,
} from '../utils/storage.util';
import { mapError } from '../utils/error-mapping.util';
import { createEmptyBoard } from '../utils/board-normalization.util';

/**
 * Service for managing game session lifecycle.
 *
 * Handles:
 * - Creating new game rooms
 * - Joining existing games
 * - Session reconnection
 * - Rematch coordination (offer/accept)
 * - Session state persistence
 *
 * This service focuses on session management operations, while
 * GameActionsService handles in-game actions (moves, forfeit, etc.).
 */
@Injectable({
  providedIn: 'root',
})
export class GameSessionService {
  private readonly isDebug =
    typeof window !== 'undefined' && window.location?.hostname === 'localhost';

  constructor(
    private signalR: SignalRService,
    private gameState: GameStateService,
    private correlationTracker: CorrelationIdTrackerService
  ) {}

  /**
   * Create a new game room.
   */
  async createGame(): Promise<void> {
    try {
      const response = await this.signalR.invoke<CreateGameResult>('CreateGame');
      console.debug('[GameSession] CreateGame response:', response);

      // Store correlation ID for deduplication of GameCreated hub events
      if (response?.correlationId) {
        this.correlationTracker.recordRpcCorrelationId(response.correlationId, 'CreateGame');
      }

      // Validate response
      if (!response?.success) {
        this.gameState.setJoinError(response?.errorMessage ?? 'Failed to create game');
        return;
      }

      const payload = response.payload;
      if (!payload) {
        this.gameState.setJoinError('No game data received');
        return;
      }

      // Store game code and reset state for new room
      this.gameState.setGameCode(payload.code);
      this.gameState.setJoinError(null);

      // Clear any previous game state
      this.gameState.setMySymbol(null);
      this.gameState.setCurrentTurn(null);
      this.gameState.setBoard(createEmptyBoard());
      this.gameState.setIsGameOver(false);
      this.gameState.setWinner(null);
      this.gameState.setOpponentPresent(false);
      this.gameState.setPlayerId(null);

      setStoredGameCode(payload.code);
      clearStoredPlayerId();

      console.debug('[GameSession] CreateGame succeeded with code:', payload.code);
    } catch (err) {
      console.error('[GameSession] CreateGame error', err);
      this.gameState.setJoinError('Failed to create game');
    }
  }

  /**
   * Join an existing game room.
   */
  async joinGame(code: string): Promise<{ success: boolean; errorCode?: string }> {
    try {
      const storedPid = getStoredPlayerId();
      const pidToSend = this.gameState.playerId() ?? storedPid ?? undefined;

      const response = await this.signalR.invoke<any>('JoinGame', code, pidToSend);
      console.debug('[GameSession] JoinGame response:', response);

      // Store correlation ID for deduplication
      if (response?.correlationId) {
        this.correlationTracker.recordRpcCorrelationId(response.correlationId, 'JoinGame');
      }

      // Handle error responses
      if (!response?.success) {
        return this.handleJoinError(response, code, pidToSend);
      }

      // Success - apply game state from payload
      return this.applyJoinSuccess(response, code);
    } catch (err) {
      console.error('[GameSession] JoinGame error', err);
      this.gameState.setJoinError('Failed to join game');
      return { success: false, errorCode: 'Exception' };
    }
  }

  /**
   * Offer a rematch to the opponent.
   */
  async offerRematch(): Promise<{
    success: boolean;
    error?: string;
    expiresAt?: string | null;
    remainingSeconds?: number | null;
  }> {
    const code = this.gameState.gameCode();
    if (!code) {
      return { success: false, error: 'No active room' };
    }

    try {
      const response = await this.signalR.invoke<ApiResponse<{ ExpiresAt?: string }>>(
        'OfferRematch',
        code
      );

      if (!response || !response.success) {
        const error = response?.errorMessage ?? 'Failed to offer rematch';
        console.error('[GameSession] OfferRematch error', error);
        return { success: false, error };
      }

      // Calculate remaining seconds from expiry timestamp
      const expiresAt =
        (response.payload && (response.payload.ExpiresAt ?? (response.payload as any).expiresAt)) ||
        null;
      const remainingSeconds = this.calculateRemainingSeconds(expiresAt, response.serverTimestamp);

      return {
        success: true,
        expiresAt: expiresAt ?? null,
        remainingSeconds,
      };
    } catch (e) {
      console.error('[GameSession] OfferRematch error', e);
      return { success: false, error: 'Exception' };
    }
  }

  /**
   * Accept an offered rematch.
   */
  async acceptRematch(): Promise<{
    success: boolean;
    error?: string;
    started?: boolean;
  }> {
    const code = this.gameState.gameCode();
    if (!code) {
      return { success: false, error: 'No active room' };
    }

    try {
      const response = await this.signalR.invoke<ApiResponse<{ Started?: boolean }>>(
        'AcceptRematch',
        code
      );

      if (!response || !response.success) {
        const error = response?.errorMessage ?? 'Failed to accept rematch';
        console.error('[GameSession] AcceptRematch error', error);
        return { success: false, error };
      }

      const started = Boolean(
        response.payload && ((response.payload as any).Started ?? (response.payload as any).started)
      );

      return { success: true, started };
    } catch (e) {
      console.error('[GameSession] AcceptRematch error', e);
      return { success: false, error: 'Exception' };
    }
  }

  private async handleJoinError(
    response: ApiResponse<GameJoinResult>,
    code: string,
    pidToSend?: string
  ): Promise<{ success: boolean; errorCode?: string }> {
    const errCode = response?.errorCode;

    // Handle reconnect required scenario
    if (errCode === 'ReconnectRequired' && pidToSend) {
      return this.attemptReconnect(code, pidToSend);
    }

    // Handle player ID already in use
    if (errCode === 'PlayerIdInUse') {
      this.gameState.setJoinError(
        'This playerId is already in use in another session — open a fresh tab/session without sharing playerId.'
      );
      return { success: false, errorCode: 'PlayerIdInUse' };
    }

    // Handle already in room
    if (errCode === 'AlreadyInRoom') {
      this.gameState.setGameCode(code);
      this.gameState.setJoinError(null);
      return { success: true };
    }

    // Handle other errors
    this.setJoinError(response, code);

    if (errCode === 'NotFound') {
      return { success: false, errorCode: 'NotFound' };
    }

    return { success: false, errorCode: errCode ?? 'JoinFailed' };
  }

  private async attemptReconnect(
    code: string,
    playerId: string
  ): Promise<{ success: boolean; errorCode?: string }> {
    try {
      const response = await this.signalR.invoke<GameStateResult>('Reconnect', code, playerId);
      console.debug('[GameSession] Reconnect result after JoinGame ReconnectRequired:', response);

      if (response?.success) {
        // Apply reconnected state
        this.gameState.setGameCode(response.code ?? code);
        this.gameState.updateGameState({
          board: response.board as Array<string | null> | undefined,
          currentTurn: response.currentTurn ?? undefined,
          isOver:
            typeof response.isGameOver !== 'undefined' ? Boolean(response.isGameOver) : undefined,
          winner: response.winner ?? undefined,
          mySymbol: response.symbol ?? undefined,
        });

        // Persist reconnected session
        if (response.code) setStoredGameCode(response.code);
        if (response.playerId) {
          this.gameState.setPlayerId(response.playerId);
          setStoredPlayerId(response.playerId);
        }

        this.gameState.setJoinError(null);
        return { success: true };
      }

      // Reconnect failed
      this.gameState.setJoinError('Reconnect required but failed. Please try again.');
      return { success: false, errorCode: 'ReconnectFailed' };
    } catch (e) {
      console.warn('[GameSession] Reconnect after JoinGame ReconnectRequired failed', e);
      this.gameState.setJoinError('Reconnect required but failed. Please try again.');
      return { success: false, errorCode: 'ReconnectFailed' };
    }
  }

  private applyJoinSuccess(
    response: ApiResponse<GameJoinResult>,
    code: string
  ): { success: boolean } {
    const payload = response.payload;
    if (!payload) {
      this.gameState.setJoinError('No game data received');
      return { success: false, errorCode: 'NoPayload' } as any;
    }

    // Apply game state from payload
    const gameCode = payload.code ?? code;
    this.gameState.setGameCode(gameCode);
    this.gameState.setBoard(payload.board ?? createEmptyBoard());
    this.gameState.setMySymbol(payload.symbol ?? null);
    this.gameState.setCurrentTurn(payload.currentTurn ?? null);
    this.gameState.setWinner(payload.winner ?? null);
    this.gameState.setIsGameOver(payload.isGameOver ?? false);
    this.gameState.setJoinError(null);
    this.gameState.setBlockedGameCode(null);

    // Persist session
    if (gameCode) setStoredGameCode(gameCode);
    if (payload.playerId) {
      this.gameState.setPlayerId(payload.playerId);
      setStoredPlayerId(payload.playerId);
    }

    console.debug('[GameSession] JoinGame succeeded with code:', gameCode);
    return { success: true };
  }

  private setJoinError(result: ApiResponse<GameJoinResult>, code: string): void {
    const errCode = result?.errorCode;
    const errMsg = result?.errorMessage;

    // Log details for diagnostics (dev only)
    if (result?.details && this.isDebug) {
      console.debug('[GameSession] Join error details:', result.details);
    }

    // Map error code to user-friendly message
    const userMessage = mapError(errCode, errMsg);

    // Clear stored session for NotFound errors
    if (errCode === 'NotFound') {
      try {
        clearStoredGameSession();
      } catch (e) {
        /* ignore */
      }
    }

    this.gameState.setJoinError(userMessage);
  }

  private calculateRemainingSeconds(
    expiresAt: string | null | undefined,
    serverTimestamp?: string | null
  ): number | null {
    if (!expiresAt) return null;

    try {
      const expiryMs = Date.parse(expiresAt);
      if (Number.isNaN(expiryMs)) return null;

      // Adjust for clock skew if server timestamp provided
      if (serverTimestamp) {
        const serverMs = Date.parse(serverTimestamp);
        if (!Number.isNaN(serverMs)) {
          const clientOffset = Date.now() - serverMs;
          const remainingMs = expiryMs - serverMs - clientOffset;
          return Math.max(0, Math.ceil(remainingMs / 1000));
        }
      }

      // Fallback: use client time
      return Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
    } catch (e) {
      return null;
    }
  }
}
