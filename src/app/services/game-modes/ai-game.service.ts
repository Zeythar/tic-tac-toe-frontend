import { Injectable, inject, signal } from '@angular/core';
import { GameStateService } from '../game-state.service';
import { GameOverModalService } from '../game-over-modal.service';
import { ModalService } from '../modal.service';
import { TurnTimerService } from '../turn-timer.service';
import { checkWinner, createEmptyBoard } from '../../utils/board-normalization.util';
import { TURN_DURATION_SECONDS } from '../../constants/game.constants';

/**
 * Service for managing AI opponent games.
 *
 * Handles:
 * - AI game initialization with difficulty selection
 * - AI move calculation (easy=random, hard=minimax)
 * - Turn management between human and AI
 * - Win/draw detection
 * - Turn timer management
 * - Game reset and rematch
 *
 * The AI opponent can play as either X or O, determined randomly at game start.
 */
@Injectable({
  providedIn: 'root',
})
export class AiGameService {
  private readonly gameState = inject(GameStateService);
  private readonly gameOverModal = inject(GameOverModalService);
  private readonly modalService = inject(ModalService);
  private readonly turnTimer = inject(TurnTimerService);

  /**
   * Current AI difficulty setting.
   * - 'easy': Random move selection
   * - 'hard': Minimax algorithm (perfect play)
   */
  readonly difficulty = signal<'easy' | 'hard'>('easy');

  /**
   * Start a new AI game with the specified difficulty.
   * Randomly determines who starts (50/50 chance).
   *
   * @param difficulty - AI difficulty level
   */
  startGame(difficulty: 'easy' | 'hard'): void {
    try {
      this.difficulty.set(difficulty);

      // Reset to clean state
      this.gameState.resetGameState();
      this.gameState.setBoard(createEmptyBoard());
      this.gameState.setIsGameOver(false);
      this.gameState.setWinner(null);

      // Randomly decide who starts (50/50)
      const aiStarts = Math.random() < 0.5;

      if (aiStarts) {
        // AI is X (starts), human is O
        this.gameState.setMySymbol('O');
        this.gameState.setCurrentTurn('X');

        // Start timer then make AI's first move after brief delay
        this.turnTimer.startLocalTimer(TURN_DURATION_SECONDS, () => this.handleTurnTimeout());

        setTimeout(() => {
          this.makeAiMove();
        }, 300);
      } else {
        // Human is X (starts), AI is O
        this.gameState.setMySymbol('X');
        this.gameState.setCurrentTurn('X');

        // Start timer for human's first move
        this.turnTimer.startLocalTimer(TURN_DURATION_SECONDS, () => this.handleTurnTimeout());
      }
    } catch (e) {
      console.error('[AiGame] Failed to start game', e);
    }
  }

  /**
   * Make a move for the human player.
   * After the move, triggers AI response if game continues.
   *
   * @param index - Board position (0-8)
   */
  makeHumanMove(index: number): void {
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
        this.endGame(null);
        return;
      }

      // Switch to AI turn
      const nextTurn = turn === 'X' ? 'O' : 'X';
      this.gameState.setCurrentTurn(nextTurn);

      // Restart timer and trigger AI move after delay
      this.turnTimer.startLocalTimer(TURN_DURATION_SECONDS, () => this.handleTurnTimeout());

      setTimeout(() => {
        this.makeAiMove();
      }, 250);
    } catch (e) {
      console.error('[AiGame] Human move failed', e);
    }
  }

  /**
   * Make AI move based on current difficulty setting.
   * @private
   */
  private makeAiMove(): void {
    try {
      // Safety checks
      if (this.gameState.isGameOver()) {
        return;
      }

      const board = this.gameState.board().slice();
      const aiSymbol = (this.gameState.currentTurn() || 'O') as 'X' | 'O';

      // Calculate AI move
      const moveIndex = this.calculateAiMove(board, aiSymbol);
      if (moveIndex == null) {
        return;
      }

      // Apply move
      board[moveIndex] = aiSymbol;
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
        this.endGame(null);
        return;
      }

      // Switch back to human
      const nextTurn = aiSymbol === 'X' ? 'O' : 'X';
      this.gameState.setCurrentTurn(nextTurn);

      // Restart timer for human turn
      this.turnTimer.startLocalTimer(TURN_DURATION_SECONDS, () => this.handleTurnTimeout());
    } catch (e) {
      console.error('[AiGame] AI move failed', e);
    }
  }

  /**
   * Calculate the best move for AI based on difficulty.
   * @private
   */
  private calculateAiMove(board: Array<string | null>, aiSymbol: 'X' | 'O'): number | null {
    const empty = board.map((v, i) => (v ? -1 : i)).filter((v) => v >= 0);

    if (empty.length === 0) {
      return null;
    }

    const diff = this.difficulty();

    if (diff === 'easy') {
      // Easy mode: random move
      return empty[Math.floor(Math.random() * empty.length)];
    }

    // Hard mode: minimax algorithm
    return this.calculateMinimaxMove(board, aiSymbol);
  }

  /**
   * Calculate optimal move using minimax algorithm.
   * @private
   */
  private calculateMinimaxMove(board: Array<string | null>, aiSymbol: 'X' | 'O'): number | null {
    console.debug('[AI] difficulty=hard: starting minimax');
    const t0 = performance.now();

    const humanSymbol = aiSymbol === 'X' ? 'O' : 'X';

    const evaluate = (b: Array<string | null>): number => {
      const win = checkWinner(b);
      if (win === aiSymbol) return 1;
      if (win === humanSymbol) return -1;
      return 0;
    };

    const minimax = (
      b: Array<string | null>,
      player: 'X' | 'O'
    ): { score: number; move: number | null } => {
      const winnerNow = checkWinner(b);
      if (winnerNow || b.every((c) => c !== null)) {
        return { score: evaluate(b), move: null };
      }

      const moves: { score: number; move: number }[] = [];
      const empties = b.map((v, i) => (v ? -1 : i)).filter((v) => v >= 0);

      for (const m of empties) {
        const newBoard = b.slice();
        newBoard[m] = player;
        const result = minimax(newBoard, player === 'X' ? 'O' : 'X');
        moves.push({ score: result.score, move: m });
      }

      if (player === aiSymbol) {
        // Maximize for AI
        let best = moves[0];
        for (const mv of moves) {
          if (mv.score > best.score) {
            best = mv;
          }
        }
        return { score: best.score, move: best.move };
      } else {
        // Minimize for human
        let best = moves[0];
        for (const mv of moves) {
          if (mv.score < best.score) {
            best = mv;
          }
        }
        return { score: best.score, move: best.move };
      }
    };

    const result = minimax(board.slice(), aiSymbol);
    const move = result.move;

    const t1 = performance.now();
    console.debug('[AI] minimax finished in', Math.round(t1 - t0), 'ms; chosen move=', move);

    // Fallback to random if minimax failed
    if (move == null) {
      const empty = board.map((v, i) => (v ? -1 : i)).filter((v) => v >= 0);
      return empty[Math.floor(Math.random() * empty.length)];
    }

    return move;
  }

  /**
   * Start a rematch with the same difficulty.
   * Randomly determines who starts again.
   */
  rematch(): void {
    try {
      // Clear any visible modal
      this.modalService.dismiss();

      // Restart with current difficulty
      this.startGame(this.difficulty());
    } catch (e) {
      console.error('[AiGame] Rematch failed', e);
    }
  }

  /**
   * Reset the game with current difficulty.
   */
  resetGame(): void {
    try {
      this.startGame(this.difficulty());
    } catch (e) {
      console.error('[AiGame] Reset failed', e);
    }
  }

  /**
   * Stop the game and clean up timers.
   */
  stopGame(): void {
    try {
      this.turnTimer.stopLocalTimer();
      this.gameState.setIsGameOver(true);
      this.gameState.setWinner(null);
      this.modalService.dismiss();
    } catch (e) {
      console.error('[AiGame] Stop failed', e);
    }
  }

  /**
   * Handle turn timer timeout.
   * @private
   */
  private handleTurnTimeout(): void {
    try {
      const turn = this.gameState.currentTurn() || 'X';
      const winner = turn === 'X' ? 'O' : 'X';
      this.endGame(winner);
    } catch (e) {
      console.error('[AiGame] Timeout handling failed', e);
    }
  }

  /**
   * End the game with the specified winner.
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
      console.error('[AiGame] End game failed', e);
    }
  }

  /**
   * Schedule showing the game over modal.
   * @private
   */
  private scheduleResultModal(): void {
    this.gameOverModal.showLocalGameOverModal('ai');
  }
}
