import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GameStateService } from '../game-state.service';
import { ModalService } from '../modal.service';
import { ErrorLoggingService, ErrorSeverity } from './error-logging.service';
import { clearStoredGameSession } from '../../utils/storage.util';

/**
 * Recovery strategy result
 */
export interface RecoveryResult {
  success: boolean;
  message?: string;
}

/**
 * Centralized error recovery strategies for common failure scenarios
 *
 * Provides automated recovery for:
 * - Connection failures
 * - Session state corruption
 * - Game state inconsistencies
 * - Navigation failures
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorRecoveryService {
  private readonly router = inject(Router);
  private readonly gameState = inject(GameStateService);
  private readonly modalService = inject(ModalService);
  private readonly errorLog = inject(ErrorLoggingService);

  /**
   * Attempt to recover from a SignalR connection failure
   */
  async recoverFromConnectionFailure(error: unknown): Promise<RecoveryResult> {
    this.errorLog.logError(
      error,
      {
        source: 'ErrorRecovery',
        operation: 'recoverFromConnectionFailure',
      },
      ErrorSeverity.Warning
    );

    // Clear any corrupted session state
    clearStoredGameSession();

    // Show user-friendly message with modal
    this.showErrorModal(
      'Connection Lost',
      "The connection to the server was lost. You'll be returned to the home screen."
    );

    // Navigate back to home
    await this.router.navigate(['/']);

    return { success: true, message: 'Navigated to home screen' };
  }

  /**
   * Attempt to recover from corrupted game state
   */
  async recoverFromCorruptedState(error: unknown): Promise<RecoveryResult> {
    this.errorLog.logError(
      error,
      {
        source: 'ErrorRecovery',
        operation: 'recoverFromCorruptedState',
      },
      ErrorSeverity.Error
    );

    // Clear all state
    this.resetGameState();
    clearStoredGameSession();

    // Show user-friendly message
    this.showErrorModal(
      'Game State Error',
      'An error occurred with the game state. The game has been reset.'
    );

    // Navigate back to home
    await this.router.navigate(['/']);

    return { success: true, message: 'State cleared and navigated home' };
  }

  /**
   * Attempt to recover from a failed move
   */
  async recoverFromFailedMove(error: unknown, cellIndex: number): Promise<RecoveryResult> {
    this.errorLog.logError(
      error,
      {
        source: 'ErrorRecovery',
        operation: 'recoverFromFailedMove',
        metadata: { cellIndex },
      },
      ErrorSeverity.Warning
    );

    // The move likely wasn't applied on the server, so don't update local state
    // Just show an error message
    this.showErrorModal('Move Failed', "Your move couldn't be processed. Please try again.");

    return { success: true, message: 'Displayed error to user' };
  }

  /**
   * Attempt to recover from a session creation/join failure
   */
  async recoverFromSessionFailure(
    error: unknown,
    operation: 'create' | 'join'
  ): Promise<RecoveryResult> {
    this.errorLog.logError(
      error,
      {
        source: 'ErrorRecovery',
        operation: 'recoverFromSessionFailure',
        metadata: { operation },
      },
      ErrorSeverity.Error
    );

    // Clear stored session since it's invalid
    clearStoredGameSession();

    // Show appropriate message
    const title = operation === 'create' ? 'Game Creation Failed' : 'Join Failed';
    const message =
      operation === 'create'
        ? 'Unable to create a new game. Please try again.'
        : 'Unable to join the game. The room code may be invalid or the game may have ended.';

    this.showErrorModal(title, message);

    // Stay on home screen (don't navigate if already there)
    if (this.router.url !== '/') {
      await this.router.navigate(['/']);
    }

    return { success: true, message: 'Session cleared and user notified' };
  }

  /**
   * Attempt to recover from a rematch failure
   */
  async recoverFromRematchFailure(error: unknown): Promise<RecoveryResult> {
    this.errorLog.logError(
      error,
      {
        source: 'ErrorRecovery',
        operation: 'recoverFromRematchFailure',
      },
      ErrorSeverity.Warning
    );

    // Clear system modal (rematch info shown there)
    this.modalService.dismiss();

    this.showErrorModal('Rematch Failed', 'Unable to start a rematch. Please create a new game.');

    // Navigate back to home
    await this.router.navigate(['/']);

    return { success: true, message: 'Rematch state cleared and navigated home' };
  }

  /**
   * Generic recovery: clear state and go home
   */
  async recoverGeneric(error: unknown, userMessage?: string): Promise<RecoveryResult> {
    this.errorLog.logError(
      error,
      {
        source: 'ErrorRecovery',
        operation: 'recoverGeneric',
        userMessage,
      },
      ErrorSeverity.Error
    );

    // Clear state
    this.resetGameState();
    clearStoredGameSession();

    // Show message
    this.showErrorModal(
      'Something Went Wrong',
      userMessage || 'An unexpected error occurred. The game has been reset.'
    );

    // Go home
    await this.router.navigate(['/']);

    return { success: true, message: 'Generic recovery completed' };
  }

  /**
   * Silent recovery for non-critical errors (e.g., timer cleanup failures).
   * Logs without interrupting user experience.
   */
  recoverSilently(error: unknown, context: string): RecoveryResult {
    this.errorLog.logWarning(error, {
      source: 'ErrorRecovery',
      operation: 'recoverSilently',
      metadata: { context },
      recovered: true,
    });

    return { success: true, message: 'Logged and recovered silently' };
  }

  private showErrorModal(title: string, message: string): void {
    this.modalService.showInfo(title, message);
  }

  private resetGameState(): void {
    this.gameState.setBoard([null, null, null, null, null, null, null, null, null]);
    this.gameState.setMySymbol(null);
    this.gameState.setCurrentTurn(null);
    this.gameState.setIsGameOver(false);
    this.gameState.setWinner(null);
    this.gameState.setGameCode(null);
    this.gameState.setOpponentPresent(false);
    this.gameState.setPlayerId(null);
    this.gameState.setJoinError(null);
    this.gameState.setMoveError(null);
    this.modalService.dismiss();
    this.gameState.clearTurnCountdowns();
  }
}
