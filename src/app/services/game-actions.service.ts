import { Injectable } from '@angular/core';
import { SignalRService } from './signalr/signalr.service';
import { GameStateService } from './game-state.service';
import { CorrelationIdTrackerService } from './error-handling/correlation-id-tracker.service';
import { MakeMoveResult, ApiResponse, MoveResult } from '../types/game.types';
import { getStoredPlayerId } from '../utils/storage.util';
import { mapError } from '../utils/error-mapping.util';
import { TURN_DURATION_SECONDS, COPY_FEEDBACK_DURATION_MS } from '../constants/game.constants';

/**
 * Service for handling in-game actions.
 *
 * Handles:
 * - Making moves
 * - Move validation and error handling
 * - Correlation tracking for event deduplication
 * - Room code utilities
 *
 * For session management (create/join/rematch), see GameSessionService.
 */
@Injectable({
  providedIn: 'root',
})
export class GameActionsService {
  private readonly TURN_MAX_SECONDS = TURN_DURATION_SECONDS;
  private readonly isDebug =
    typeof window !== 'undefined' && window.location?.hostname === 'localhost';

  constructor(
    private signalR: SignalRService,
    private gameState: GameStateService,
    private correlationTracker: CorrelationIdTrackerService
  ) {}

  /**
   * Make a move at the specified board index
   */
  async makeMove(index: number): Promise<void> {
    const code = this.gameState.gameCode();
    if (!code) {
      this.showMoveError('No game joined');
      return;
    }

    // Client-side validation
    const mySym = this.gameState.mySymbol();
    const current = this.gameState.currentTurn();

    if (mySym && current && mySym !== current) {
      this.showMoveError('Not your turn');
      return;
    }

    if (this.gameState.isGameOver()) {
      this.showMoveError('Game is over');
      return;
    }

    try {
      // Get player ID from state or storage
      const pid = this.gameState.playerId() ?? getStoredPlayerId();

      console.debug(
        '[GameActions] MakeMove - connectionState:',
        this.signalR.getConnectionState(),
        'code:',
        code,
        'index:',
        index,
        'playerId:',
        pid
      );

      const response = await this.signalR.invoke<MakeMoveResult>('MakeMove', code, index, pid);
      console.debug('[GameActions] MakeMove response:', response);

      // Store correlation ID for deduplication of GameOver hub events
      if (response?.correlationId) {
        this.correlationTracker.recordRpcCorrelationId(response.correlationId, 'MakeMove');
      }

      // Handle new ApiResponse<MoveResult> pattern
      if (!response?.success) {
        this.handleMoveError(response);
        return;
      }

      // On success, clear any move error
      this.gameState.setMoveError(null);

      // Update board state from the response payload if provided
      if (response.payload) {
        try {
          if (response.payload.board) {
            this.gameState.setBoard(response.payload.board);
          }
          if (response.payload.currentTurn !== undefined) {
            this.gameState.setCurrentTurn(response.payload.currentTurn);
          }
          if (response.payload.winner !== undefined) {
            this.gameState.setWinner(response.payload.winner);
          }
        } catch (e) {
          console.warn('[GameActions] Error updating board state from response', e);
        }
      }

      // If server returned an immediate game-over payload (caller path), apply it
      try {
        if (response.payload?.isGameOver && response.payload?.gameOver) {
          try {
            // Preserve the correlation ID from the parent response for deduplication
            if (response.correlationId && response.payload.gameOver) {
              response.payload.gameOver.correlationId = response.correlationId;
            }
            this.signalR.applyGameOverFromRpc(response.payload.gameOver);
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        /* ignore */
      }

      // Immediately set local player's countdown to full so UI focuses on opponent
      try {
        this.gameState.setMyTurnCountdown(this.TURN_MAX_SECONDS);
      } catch (e) {
        /* ignore */
      }
    } catch (err) {
      console.error('[GameActions] MakeMove error', err);

      // Log detailed error information
      try {
        const serverMsg = (err as any)?.message ?? err?.toString();
        console.warn('[GameActions] MakeMove failure details:', {
          connectionState: this.signalR.getConnectionState(),
          code,
          index,
          serverMessage: serverMsg,
          raw: err,
        });
      } catch (ex) {
        // ignore
      }

      this.showMoveError('Failed to make move');
    }
  }

  /**
   * Handle move error responses
   */
  private handleMoveError(result: MakeMoveResult): void {
    // New pattern: ApiResponse<MoveResult>
    const err = result?.errorCode;
    const serverMsg = result?.errorMessage;

    // Log details for diagnostics (dev only)
    if (result?.details) {
      try {
        if (this.isDebug) console.debug('[GameActions] Move error details:', result.details);
      } catch (e) {
        /* ignore */
      }
    }

    // Map error code to user-friendly message using centralized utility
    const userMessage = mapError(err, serverMsg);

    this.showMoveError(userMessage);
  }

  /**
   * Show a move error message temporarily
   */
  private showMoveError(message: string): void {
    this.gameState.setMoveError(message);
    setTimeout(() => this.gameState.setMoveError(null), 2000);
  }

  /**
   * Copy the room code to clipboard
   */
  async copyRoomCode(): Promise<void> {
    const code = this.gameState.gameCode();
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      this.gameState.setCopied(true);
      setTimeout(() => this.gameState.setCopied(false), COPY_FEEDBACK_DURATION_MS);
    } catch (e) {
      console.error('[GameActions] Copy failed', e);
    }
  }

  /**
   * Get the last seen correlation ID from an RPC response
   * Used by SignalRService for deduplicating hub events
   */
  getLastSeenCorrelationId(): string | null {
    return this.correlationTracker.getLastRpcCorrelationId();
  }
}
