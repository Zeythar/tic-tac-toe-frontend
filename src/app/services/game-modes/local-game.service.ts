import { Injectable, inject } from '@angular/core';
import { GameStateService } from '../game-state.service';
import { GameOverModalService } from '../game-over-modal.service';
import { ModalService } from '../modal.service';
import { TurnTimerService } from '../turn-timer.service';
import { checkWinner, createEmptyBoard } from '../../utils/board-normalization.util';
import { TURN_DURATION_SECONDS } from '../../constants/game.constants';

/**
 * Service for managing local 2-player hotseat games.
 *
 * Handles:
 * - Local game initialization
 * - Move execution with turn switching
 * - Win/draw detection
 * - Turn timer management
 * - Game reset and rematch
 *
 * This service operates independently of SignalR and is used for
 * pass-and-play games on a single device.
 */
@Injectable({
  providedIn: 'root',
})
export class LocalGameService {
  private readonly gameState = inject(GameStateService);
  private readonly gameOverModal = inject(GameOverModalService);
  private readonly modalService = inject(ModalService);
  private readonly turnTimer = inject(TurnTimerService);

  /**
   * Start a new local hotseat game.
   * Sets up a fresh board with X starting first.
   */
  startGame(): void {
    try {
      // Reset state to clean slate
      this.gameState.resetGameState();
      this.gameState.setBoard(createEmptyBoard());
      this.gameState.setCurrentTurn('X');
      this.gameState.setIsGameOver(false);
      this.gameState.setWinner(null);
      // Local hotseat has no assigned symbol (both players share device)
      this.gameState.setMySymbol(null);

      // Start turn timer
      this.turnTimer.startLocalTimer(TURN_DURATION_SECONDS, () => this.handleTurnTimeout());
    } catch (e) {
      console.error('[LocalGame] Failed to start game', e);
    }
  }

  /**
   * Make a move at the specified board index.
   * Handles turn switching, win/draw detection, and timer management.
   *
   * @param index - Board position (0-8)
   */
  makeMove(index: number): void {
    try {
      const board = this.gameState.board().slice();

      // Validate move
      if (this.gameState.isGameOver() || board[index]) {
        return;
      }

      const turn = this.gameState.currentTurn() || 'X';
      board[index] = turn;
      this.gameState.setBoard(board);

      // Check for winner
      const winner = checkWinner(board);
      if (winner) {
        this.endGame(winner);
        return;
      }

      // Check for draw
      const isFull = board.every((c) => c !== null);
      if (isFull) {
        this.endGame(null); // null = draw
        return;
      }

      // Switch turn
      const nextTurn = turn === 'X' ? 'O' : 'X';
      this.gameState.setCurrentTurn(nextTurn);

      // Restart timer for next player
      this.turnTimer.startLocalTimer(TURN_DURATION_SECONDS, () => this.handleTurnTimeout());
    } catch (e) {
      console.error('[LocalGame] Move failed', e);
    }
  }

  /**
   * Reset the game to initial state while keeping local mode active.
   */
  resetGame(): void {
    try {
      this.gameState.resetGameState();
      this.gameState.setCurrentTurn('X');
      this.gameState.setMySymbol(null);

      // Restart timers
      this.turnTimer.stopLocalTimer();
      this.turnTimer.startLocalTimer(TURN_DURATION_SECONDS, () => this.handleTurnTimeout());
    } catch (e) {
      console.error('[LocalGame] Reset failed', e);
    }
  }

  /**
   * Start a rematch - same as reset but clears modal first.
   */
  rematch(): void {
    try {
      // Clear any visible modal
      this.modalService.dismiss();

      // Reset to fresh game
      this.gameState.resetGameState();
      this.gameState.setBoard(createEmptyBoard());
      this.gameState.setIsGameOver(false);
      this.gameState.setWinner(null);
      this.gameState.setCurrentTurn('X');
      this.gameState.setMySymbol(null);

      // Restart timers
      this.turnTimer.stopLocalTimer();
      this.turnTimer.startLocalTimer(TURN_DURATION_SECONDS, () => this.handleTurnTimeout());
    } catch (e) {
      console.error('[LocalGame] Rematch failed', e);
    }
  }

  /**
   * Stop the game and clean up timers.
   * Called when leaving local game mode.
   */
  stopGame(): void {
    try {
      this.turnTimer.stopLocalTimer();
      this.gameState.setIsGameOver(true);
      this.gameState.setWinner(null);
      this.modalService.dismiss();
    } catch (e) {
      console.error('[LocalGame] Stop failed', e);
    }
  }

  /**
   * Handle turn timer timeout.
   * The current player loses their turn.
   * @private
   */
  private handleTurnTimeout(): void {
    try {
      const turn = this.gameState.currentTurn() || 'X';
      const winner = turn === 'X' ? 'O' : 'X'; // Opponent wins
      this.endGame(winner);
    } catch (e) {
      console.error('[LocalGame] Timeout handling failed', e);
    }
  }

  /**
   * End the game with the specified winner (or null for draw).
   * @private
   */
  private endGame(winner: string | null): void {
    try {
      this.gameState.setIsGameOver(true);
      this.gameState.setWinner(winner);
      this.turnTimer.stopLocalTimer();

      // Show result modal after brief delay
      this.scheduleResultModal();
    } catch (e) {
      console.error('[LocalGame] End game failed', e);
    }
  }

  /**
   * Schedule showing the game over modal after a brief delay.
   * @private
   */
  private scheduleResultModal(): void {
    this.gameOverModal.showLocalGameOverModal('local');
  }
}
