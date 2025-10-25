import { Injectable } from '@angular/core';
import { GameStateService } from './game-state.service';
import { TURN_DURATION_SECONDS, TURN_TICK_TIMEOUT_MS } from '../constants/game.constants';

/**
 * Unified timer service for turn countdowns in local and online games.
 */
@Injectable({
  providedIn: 'root',
})
export class TurnTimerService {
  // Local timer state (for local/AI games)
  private localTimerId: number | null = null;
  private localTimeRemaining = 0;

  // Online timer state (for network games)
  private myTurnTickTimer: any = null;
  private oppTurnTickTimer: any = null;

  // Configuration
  private readonly TICK_TIMEOUT_MS = TURN_TICK_TIMEOUT_MS;
  private readonly MAX_TURN_SECONDS = TURN_DURATION_SECONDS;

  constructor(private gameState: GameStateService) {}

  /**
   * Start a local turn timer (for local/AI games).
   * Updates countdowns every second and handles timeout logic.
   *
   * @param seconds - Initial countdown value (default from constants)
   * @param onTimeout - Callback when timer reaches zero
   */
  startLocalTimer(seconds = TURN_DURATION_SECONDS, onTimeout?: () => void): void {
    try {
      // Clear any existing timer
      this.stopLocalTimer();

      this.localTimeRemaining = seconds;

      const setSignals = () => {
        const turn = this.gameState.currentTurn() || 'X';
        const mySym = this.gameState.mySymbol();

        if (mySym === 'X') {
          if (turn === 'X') {
            this.gameState.setMyTurnCountdown(this.localTimeRemaining);
            this.gameState.setOpponentTurnCountdown(null);
          } else {
            this.gameState.setMyTurnCountdown(null);
            this.gameState.setOpponentTurnCountdown(this.localTimeRemaining);
          }
        } else if (mySym === 'O') {
          if (turn === 'O') {
            this.gameState.setMyTurnCountdown(this.localTimeRemaining);
            this.gameState.setOpponentTurnCountdown(null);
          } else {
            this.gameState.setMyTurnCountdown(null);
            this.gameState.setOpponentTurnCountdown(this.localTimeRemaining);
          }
        } else {
          // If mySymbol is unset (two-player hotseat), treat X as 'my' for UI
          if (turn === 'X') {
            this.gameState.setMyTurnCountdown(this.localTimeRemaining);
            this.gameState.setOpponentTurnCountdown(null);
          } else {
            this.gameState.setMyTurnCountdown(null);
            this.gameState.setOpponentTurnCountdown(this.localTimeRemaining);
          }
        }

        // Defensive: ensure we never have both countdowns non-null simultaneously
        try {
          const myVal = this.gameState.myTurnCountdown();
          const oppVal = this.gameState.opponentTurnCountdown();
          if (myVal != null && oppVal != null) {
            // Clear the non-current player's countdown
            if (turn === 'X') this.gameState.setOpponentTurnCountdown(null);
            else this.gameState.setMyTurnCountdown(null);
          }
        } catch (e) {
          /* ignore */
        }
      };

      // Initialize signals
      setSignals();

      // Tick every second
      this.localTimerId = setInterval(() => {
        try {
          this.localTimeRemaining = Math.max(0, this.localTimeRemaining - 1);
          setSignals();

          if (this.localTimeRemaining <= 0) {
            // Time expired
            this.stopLocalTimer();
            if (onTimeout) {
              try {
                onTimeout();
              } catch (e) {
                /* ignore */
              }
            }
          }
        } catch (e) {
          /* ignore */
        }
      }, 1000) as unknown as number;
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Stop the local turn timer and clear countdowns.
   */
  stopLocalTimer(): void {
    try {
      if (this.localTimerId != null) {
        clearInterval(this.localTimerId as any);
        this.localTimerId = null;
      }
      this.localTimeRemaining = 0;
      this.gameState.setMyTurnCountdown(null);
      this.gameState.setOpponentTurnCountdown(null);
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Update my turn countdown (for online games).
   * Sets a timeout to clear the countdown if no update arrives.
   *
   * @param seconds - Remaining seconds for my turn
   */
  setMyTurnTick(seconds: number): void {
    try {
      this.gameState.setMyTurnCountdown(seconds);

      // Clear existing timer
      if (this.myTurnTickTimer) clearTimeout(this.myTurnTickTimer);

      // Set timeout to clear stale countdown
      this.myTurnTickTimer = setTimeout(() => {
        try {
          this.gameState.setMyTurnCountdown(null);
        } catch (e) {
          /* ignore */
        }
        this.myTurnTickTimer = null;
      }, this.TICK_TIMEOUT_MS);
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Update opponent turn countdown (for online games).
   * Sets a timeout to clear the countdown if no update arrives.
   *
   * @param seconds - Remaining seconds for opponent's turn
   */
  setOpponentTurnTick(seconds: number): void {
    try {
      this.gameState.setOpponentTurnCountdown(seconds);

      // Clear existing timer
      if (this.oppTurnTickTimer) clearTimeout(this.oppTurnTickTimer);

      // Set timeout to clear stale countdown
      this.oppTurnTickTimer = setTimeout(() => {
        try {
          this.gameState.setOpponentTurnCountdown(null);
        } catch (e) {
          /* ignore */
        }
        this.oppTurnTickTimer = null;
      }, this.TICK_TIMEOUT_MS);
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Pause a turn countdown (freeze it at current value).
   * Used when a player disconnects.
   *
   * @param isLocal - Whether this is my turn (true) or opponent's (false)
   * @param seconds - Current countdown value to freeze at
   */
  pauseTurnCountdown(isLocal: boolean, seconds: number): void {
    try {
      if (isLocal) {
        this.gameState.setMyTurnCountdown(seconds);
        if (this.myTurnTickTimer) {
          clearTimeout(this.myTurnTickTimer);
          this.myTurnTickTimer = null;
        }
      } else {
        this.gameState.setOpponentTurnCountdown(seconds);
        if (this.oppTurnTickTimer) {
          clearTimeout(this.oppTurnTickTimer);
          this.oppTurnTickTimer = null;
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Resume a turn countdown (restart with given value).
   * Used when a player reconnects.
   *
   * @param isLocal - Whether this is my turn (true) or opponent's (false)
   * @param seconds - Countdown value to resume with
   */
  resumeTurnCountdown(isLocal: boolean, seconds: number): void {
    try {
      const desiredSecs = Number.isFinite(seconds) && seconds > 0 ? seconds : this.MAX_TURN_SECONDS;
      if (isLocal) {
        this.setMyTurnTick(desiredSecs);
      } else {
        this.setOpponentTurnTick(desiredSecs);
      }
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Clear all tick timers (online mode).
   * Used when game ends or state resets.
   */
  clearOnlineTimers(): void {
    try {
      if (this.myTurnTickTimer) {
        clearTimeout(this.myTurnTickTimer);
        this.myTurnTickTimer = null;
      }
      if (this.oppTurnTickTimer) {
        clearTimeout(this.oppTurnTickTimer);
        this.oppTurnTickTimer = null;
      }
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Clear all timers (both local and online).
   */
  clearAllTimers(): void {
    this.stopLocalTimer();
    this.clearOnlineTimers();
  }

  /**
   * Get the configured maximum turn duration.
   */
  getMaxTurnSeconds(): number {
    return this.MAX_TURN_SECONDS;
  }

  /**
   * Get the tick timeout duration.
   */
  getTickTimeoutMs(): number {
    return this.TICK_TIMEOUT_MS;
  }
}
