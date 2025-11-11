import { Injectable, inject, signal, effect } from '@angular/core';
import { GameStateService } from './game-state.service';
import { GameActionsService } from './game-actions.service';
import { GameSessionService } from './game-session.service';
import { ModalService } from './modal.service';
import { LocalGameService } from './game-modes/local-game.service';
import { AiGameService } from './game-modes/ai-game.service';
import { SignalRService } from './signalr/signalr.service';
import {
  getStoredGameCode,
  getStoredPlayerId,
  clearStoredGameSession,
} from '../utils/storage.util';

/**
 * Service for orchestrating game flow and mode transitions.
 *
 * Handles:
 * - Game mode selection (friend/local/AI)
 * - Stage transitions (welcome → connecting → share → in-game → ai-settings)
 * - Online game creation and joining
 * - Rematch coordination for all game modes
 * - Integration between different game services
 *
 * This service acts as a coordinator between online multiplayer (via GameSessionService
 * and GameActionsService), local hotseat (via LocalGameService), and AI games (via AiGameService).
 */
@Injectable({
  providedIn: 'root',
})
export class GameFlowService {
  private readonly gameState = inject(GameStateService);
  private readonly gameActions = inject(GameActionsService);
  private readonly gameSession = inject(GameSessionService);
  private readonly modalService = inject(ModalService);
  private readonly localGame = inject(LocalGameService);
  private readonly aiGame = inject(AiGameService);
  private readonly signalR = inject(SignalRService);

  /**
   * Current play mode: 'friend' | 'local' | 'ai'
   */
  readonly playMode = signal<'friend' | 'local' | 'ai'>('friend');

  /**
   * Current UI stage: 'welcome' | 'connecting' | 'share' | 'in-game' | 'ai-settings'
   */
  readonly stage = signal<
    'welcome' | 'connecting' | 'share' | 'in-game' | 'ai-settings'
  >('welcome');

  constructor() {
    this.setupStageSync();
    this.setupModeCleanup();
  }

  /**
   * Handle mode selection from home screen.
   *
   * @param mode - Selected game mode
   */
  async selectMode(mode: string): Promise<void> {
    const validMode =
      mode === 'local' || mode === 'ai' || mode === 'friend'
        ? (mode as 'friend' | 'local' | 'ai')
        : 'friend';

    // If AI mode requested but not yet configured, show settings first
    if (mode === 'ai' && this.playMode() !== 'ai') {
      this.stage.set('ai-settings');
      return;
    }

    this.playMode.set(validMode);

    if (validMode === 'friend') {
      // Online multiplayer - need to establish SignalR connection first
      this.stage.set('connecting');

      try {
        // Initialize SignalR if not already done
        if (!this.signalR.isInitialized()) {
          await this.signalR.initialize();
        }

        // Connection successful - now create the game
        await this.createOnlineGame();
      } catch (error) {
        console.error('[GameFlow] Failed to connect to server', error);

        // Show error and return to welcome
        this.modalService.showError(
          'Connection Failed',
          'Unable to connect to the game server. Please check your internet connection and try again.'
        );
        this.stage.set('welcome');
        this.playMode.set('friend');
      }

      return;
    } else if (validMode === 'local') {
      this.localGame.startGame();
      this.stage.set('in-game');
    } else if (validMode === 'ai') {
      // AI game starts after difficulty selection
      // (onAiStart will be called separately)
      this.stage.set('in-game');
    }
  }

  /**
   * Start AI game with selected difficulty.
   * Called from AI settings component.
   *
   * @param difficulty - AI difficulty level
   */
  startAiGame(difficulty: 'easy' | 'hard'): void {
    try {
      this.playMode.set('ai');
      this.aiGame.startGame(difficulty);
      this.stage.set('in-game');
    } catch (e) {
      console.error('[GameFlow] Failed to start AI game', e);
    }
  }

  /**
   * Create a new online multiplayer game.
   */
  async createOnlineGame(): Promise<void> {
    try {
      await this.gameSession.createGame();

      // Move to share stage if game was created
      const code = this.gameState.gameCode();
      if (code) {
        try {
          this.gameState.setCodeValue(code);
        } catch (e) {
          /* ignore */
        }

        // Update browser URL for sharing
        try {
          const newUrl = `/room/${encodeURIComponent(code)}`;
          window.history.replaceState({}, '', newUrl);
        } catch (e) {
          /* ignore */
        }

        this.stage.set('share');
      }

      // Dismiss any modals
      try {
        this.modalService.dismiss();
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      console.error('[GameFlow] Failed to create online game', e);
    }
  }

  /**
   * Join an existing online multiplayer game.
   *
   * @param code - Game room code
   * @returns Result indicating success or error
   */
  async joinOnlineGame(
    code: string
  ): Promise<{ success: boolean; errorCode?: string } | void> {
    try {
      const result = await this.gameSession.joinGame(code);

      // If room not found, reset and return to welcome
      if (result && result.errorCode === 'NotFound') {
        try {
          this.gameState.resetAllState();
          window.history.replaceState({}, '', '/');
          this.stage.set('welcome');
        } catch (e) {
          /* ignore */
        }
      }

      return result;
    } catch (e) {
      console.error('[GameFlow] Failed to join online game', e);
    }
  }

  /**
   * Handle rematch based on current game mode.
   */
  async handleRematch(): Promise<void> {
    const mode = this.playMode();

    try {
      if (mode === 'local') {
        this.localGame.rematch();
      } else if (mode === 'ai') {
        this.aiGame.rematch();
      } else {
        // Online rematch handled by game-actions.service
        // This is called from system modal which has separate handlers
        console.debug(
          '[GameFlow] Online rematch should be handled by app.ts modal handlers'
        );
      }
    } catch (e) {
      console.error('[GameFlow] Rematch failed', e);
    }
  }

  /**
   * Handle reset based on current game mode.
   */
  resetGame(): void {
    const mode = this.playMode();

    try {
      if (mode === 'local') {
        this.localGame.resetGame();
      } else if (mode === 'ai') {
        this.aiGame.resetGame();
      } else {
        // Online reset not supported - would need to implement
        console.debug('[GameFlow] Online reset not implemented');
      }
    } catch (e) {
      console.error('[GameFlow] Reset failed', e);
    }
  }

  /**
   * Return to welcome screen and clean up current game mode.
   *
   * @param clearSession - If true, clears localStorage session data and disconnects SignalR (use when user explicitly leaves)
   */
  goHome(clearSession = false): void {
    try {
      const mode = this.playMode();

      // Stop any active games
      if (mode === 'local') {
        this.localGame.stopGame();
      } else if (mode === 'ai') {
        this.aiGame.stopGame();
      }

      // Reset all state including game code
      // This ensures setupStageSync() effect won't override our stage
      this.gameState.resetAllState();

      // Clear localStorage and disconnect SignalR if explicitly leaving (from modal buttons)
      if (clearSession) {
        try {
          clearStoredGameSession();
        } catch (e) {
          console.warn('[GameFlow] Failed to clear session storage', e);
        }

        // Disconnect SignalR so server knows player has left
        if (this.signalR.isInitialized()) {
          this.signalR.stop().catch((err) => {
            console.warn('[GameFlow] Failed to stop SignalR connection', err);
          });
        }
      }

      // Dismiss any open modal
      this.modalService.dismiss();

      // Reset navigation
      window.history.replaceState({}, '', '/');
      this.stage.set('welcome');
      this.playMode.set('friend');
    } catch (e) {
      console.error('[GameFlow] Go home failed', e);
    }
  }

  /**
   * Auto-join game from share link URL.
   * Called during initialization when URL contains /room/:code
   *
   * @param code - Game room code from URL
   */
  async handleShareLinkJoin(code: string): Promise<void> {
    try {
      // Populate join input
      this.gameState.setCodeValue(code);

      // Check localStorage to determine if we're creator or joiner
      const storedCode = getStoredGameCode();
      const storedPlayerId = getStoredPlayerId();

      // If we're the creator on share screen, don't auto-join
      if (storedCode === code && !storedPlayerId) {
        console.debug(
          '[GameFlow] Skipping auto-join - creator on share screen'
        );
        this.gameState.setGameCode(code);
        this.stage.set('share');
        return;
      }

      // If we have a stored playerId for this room, attempt to reconnect
      if (storedCode === code && storedPlayerId) {
        console.debug('[GameFlow] Reconnecting to game via share link');
        const result = await this.joinOnlineGame(code);

        // If reconnect fails, clear storage and show error
        if (result && !result.success) {
          this.goHome();
        }
        return;
      }

      // New visitor joining via share link
      const result = await this.joinOnlineGame(code);

      // If not found, redirect home
      if (result && result.errorCode === 'NotFound') {
        this.goHome();
      }
    } catch (e) {
      console.error('[GameFlow] Share link join failed', e);
    }
  }

  /**
   * Keep UI stage in sync with game state.
   * Effect runs when game state changes (code, opponent, symbols).
   * @private
   */
  private setupStageSync(): void {
    try {
      effect(() => {
        // Local/AI modes keep in-game stage
        const mode = this.playMode();
        if (mode === 'local' || mode === 'ai') {
          this.stage.set('in-game');
          return;
        }

        // Online mode: sync with game state
        const code = this.gameState.gameCode();
        const opponent = this.gameState.opponentPresent();
        const mySymbol = this.gameState.mySymbol();
        const currentTurn = this.gameState.currentTurn();

        if (opponent) {
          this.stage.set('in-game');
        } else if (code && mySymbol && currentTurn) {
          // Game started but opponent disconnected
          this.stage.set('in-game');
        } else if (code) {
          // Code exists but game not started
          this.stage.set('share');
        } else {
          this.stage.set('welcome');
        }
      });
    } catch (e) {
      console.error('[GameFlow] Stage sync effect failed', e);
    }
  }

  /**
   * Clean up when leaving local/AI games.
   * Stops timers and resets mode when navigating away from in-game.
   * @private
   */
  private setupModeCleanup(): void {
    try {
      effect(() => {
        const currentStage = this.stage();

        // Only cleanup when leaving in-game stage
        if (currentStage !== 'in-game') {
          const mode = this.playMode();

          if (mode === 'local') {
            this.localGame.stopGame();
            this.playMode.set('friend');
          } else if (mode === 'ai') {
            this.aiGame.stopGame();
            this.playMode.set('friend');
          }
        }
      });
    } catch (e) {
      console.error('[GameFlow] Mode cleanup effect failed', e);
    }
  }
}
