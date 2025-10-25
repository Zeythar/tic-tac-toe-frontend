import { Injectable, Injector } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { GameStateService } from '../game-state.service';
import { GameActionsService } from '../game-actions.service';
import { GameOverModalService } from '../game-over-modal.service';
import { ModalService } from '../modal.service';
import { TurnTimerService } from '../turn-timer.service';
import { CorrelationIdTrackerService } from '../error-handling/correlation-id-tracker.service';
import { SignalRConnectionService } from './signalr-connection.service';
import { ErrorLoggingService } from '../error-handling/error-logging.service';
import { ErrorRecoveryService } from '../error-handling/error-recovery.service';
import { createSignalRTimers, SignalRTimers } from './signalr-helpers/timer.adapter';
import { registerSignalREvents } from './signalr.events';
import { handleGameOver } from './signalr-helpers/game-over.handler';
import { GameState, GameOverDto } from '../../types/game.types';
import { TURN_DURATION_SECONDS, TURN_TICK_TIMEOUT_MS } from '../../constants/game.constants';

/**
 * Service responsible for SignalR event registration and handler management.
 *
 * Handles:
 * - Event handler registration (delegates to signalr.events.ts)
 * - SyncedState callback management
 * - GameStarted callback management
 * - GameOver event deduplication
 * - Timer integration via signalr.timers.ts
 *
 * This focused service eliminates the need for SignalRService to manage
 * event registration concerns, improving separation of concerns.
 */
@Injectable({
  providedIn: 'root',
})
export class SignalREventService {
  // callbacks that consumers can register to be notified when a SyncedState arrives
  private syncedStateCallbacks: Array<(s: GameState) => void> = [];
  // resolver for an in-flight wait-for-synced-state caller
  private pendingSyncedResolver: ((s: GameState) => void) | null = null;
  private pendingSyncedTimer: any = null;
  // timestamp (ms) when last SyncedState was applied
  private lastSyncedAt: number | null = null;
  // callbacks for GameStarted UI-only notifications
  private gameStartedCallbacks: Array<() => void> = [];
  // whether the SyncedState handler has been registered
  private syncedStateHandlerRegistered = false;
  // whether we've registered event handlers (avoid double-registration)
  private handlersRegistered = false;
  // timers helper (manages per-turn tick timers)
  private timers: SignalRTimers | null = null;

  // Lazily resolved services to avoid circular dependencies
  private gameOverModalService: GameOverModalService | null = null;
  private modalService: ModalService | null = null;
  private turnTimerService: TurnTimerService | null = null;
  private correlationTracker: CorrelationIdTrackerService | null = null;

  constructor(
    private gameState: GameStateService,
    private connectionService: SignalRConnectionService,
    private errorLog: ErrorLoggingService,
    private errorRecovery: ErrorRecoveryService,
    private injector: Injector
  ) {}

  /**
   * Initialize event handlers and timer integration.
   * Must be called after connection is initialized.
   *
   * @param fetchGameState - Callback to fetch game state from server
   * @param attemptJoinGame - Callback to attempt joining a game
   */
  initializeEventHandlers(
    fetchGameState: (code: string, playerId?: string) => Promise<void>,
    attemptJoinGame: (code: string) => Promise<void>
  ): void {
    try {
      // Lazily resolve the turn timer service
      if (!this.turnTimerService) {
        try {
          this.turnTimerService = this.injector.get(TurnTimerService);
        } catch (e) {
          console.warn('[SignalREvent] Failed to resolve TurnTimerService', e);
        }
      }

      if (this.turnTimerService) {
        this.timers = createSignalRTimers(this.turnTimerService, {
          tickTimeoutMs: TURN_TICK_TIMEOUT_MS,
          maxTurnSeconds: TURN_DURATION_SECONDS,
        });
      }
    } catch (e) {
      this.timers = null;
    }

    // Register event handlers via the events module
    try {
      const connection = this.connectionService.getConnection();
      if (connection && this.timers) {
        // Lazily resolve the game over modal service
        if (!this.gameOverModalService) {
          try {
            this.gameOverModalService = this.injector.get(GameOverModalService);
          } catch (e) {
            console.warn('[SignalREvent] Failed to resolve GameOverModalService', e);
          }
        }

        // Lazily resolve ModalService
        if (!this.modalService) {
          try {
            this.modalService = this.injector.get(ModalService);
          } catch (e) {
            console.warn('[SignalREvent] Failed to resolve ModalService', e);
          }
        }

        registerSignalREvents({
          connection,
          gameState: this.gameState,
          modalService: this.modalService!,
          timers: this.timers,
          errorLog: this.errorLog,
          errorRecovery: this.errorRecovery,
          invoke: this.connectionService.invoke.bind(this.connectionService),
          fetchGameState,
          attemptJoinGame,
          registerEventHandlers: this.registerEventHandlers.bind(this),
          onSyncedStateArrived: this.onSyncedStateArrived.bind(this),
          gameOverModalService: this.gameOverModalService ?? undefined,
          // Dedupe GameOver events by comparing correlation IDs from RPC and hub
          shouldIgnoreGameOver: (dto: GameOverDto) => {
            try {
              // Lazily resolve GameActionsService to avoid circular constructor injection
              const ga = this.injector.get(GameActionsService);
              const rpcCorrelationId = ga.getLastSeenCorrelationId();
              if (!dto?.correlationId || !rpcCorrelationId) return false;
              const isDuplicate = dto.correlationId === rpcCorrelationId;
              if (isDuplicate) {
                console.debug(
                  '[SignalREvent] Ignoring duplicate GameOver (correlation match:',
                  dto.correlationId,
                  ')'
                );
              }
              return isDuplicate;
            } catch (e) {
              return false;
            }
          },
          onGameOverApplied: (dto: GameOverDto) => {
            try {
              if (dto && dto.correlationId) {
                if (!this.correlationTracker)
                  this.correlationTracker = this.injector.get(CorrelationIdTrackerService);
                this.correlationTracker.recordHubCorrelationId(
                  dto.correlationId,
                  'GameOver-EventService'
                );
              }
            } catch (e) {
              /* ignore */
            }
          },
        });

        this.handlersRegistered = true;
      } else {
        console.debug('[SignalREvent] Connection or timers not available, skipping registration');
      }
    } catch (e) {
      console.warn('[SignalREvent] Error initializing event handlers', e);
    }
  }

  /**
   * Register all SignalR event handlers (delegates to events module when available)
   */
  private registerEventHandlers(): void {
    const connection = this.connectionService.getConnection();
    if (!connection) return;
    if (this.handlersRegistered) return;

    console.warn('[SignalREvent] registerEventHandlers called but not fully implemented');
    // This method is kept for backward compatibility but shouldn't be called
    // directly anymore - use initializeEventHandlers instead
  }

  /**
   * Called by events module when a SyncedState arrives so the service can
   * resolve waiters and notify callbacks.
   */
  private onSyncedStateArrived(state: GameState): void {
    try {
      for (const cb of this.syncedStateCallbacks) {
        try {
          cb(state);
        } catch (e) {
          console.warn('[SignalREvent] SyncedState callback error', e);
        }
      }

      if (this.pendingSyncedResolver) {
        try {
          this.pendingSyncedResolver(state);
        } catch (e) {
          /* ignore */
        }
        this.pendingSyncedResolver = null;
      }
      if (this.pendingSyncedTimer) {
        clearTimeout(this.pendingSyncedTimer);
        this.pendingSyncedTimer = null;
      }

      this.lastSyncedAt = Date.now();
      this.syncedStateHandlerRegistered = true;
    } catch (e) {
      console.warn('[SignalREvent] onSyncedStateArrived error', e);
    }
  }

  /**
   * Register a callback to be invoked when a SyncedState arrives.
   * Returns an unregister function.
   */
  registerSyncedStateHandler(cb: (s: GameState) => void): () => void {
    this.syncedStateCallbacks.push(cb);
    return () => {
      const idx = this.syncedStateCallbacks.indexOf(cb);
      if (idx >= 0) this.syncedStateCallbacks.splice(idx, 1);
    };
  }

  /**
   * Register a GameStarted UI notification callback. Returns an unregister fn.
   */
  registerGameStartedHandler(cb: () => void): () => void {
    this.gameStartedCallbacks.push(cb);
    return () => {
      const idx = this.gameStartedCallbacks.indexOf(cb);
      if (idx >= 0) this.gameStartedCallbacks.splice(idx, 1);
    };
  }

  /**
   * Wait for a SyncedState event for up to `timeoutMs` milliseconds.
   * Resolves with the state if received, or null if timed out.
   */
  waitForSyncedState(timeoutMs = 1000): Promise<GameState | null> {
    const connection = this.connectionService.getConnection();
    if (!connection) return Promise.resolve(null);

    // If a previous waiter exists, clear it
    if (this.pendingSyncedResolver) {
      this.pendingSyncedResolver = null;
    }

    return new Promise<GameState | null>((resolve) => {
      this.pendingSyncedResolver = (s: GameState) => {
        resolve(s);
      };

      // set timer to resolve null if no SyncedState arrives
      this.pendingSyncedTimer = setTimeout(() => {
        this.pendingSyncedTimer = null;
        this.pendingSyncedResolver = null;
        resolve(null);
      }, timeoutMs);
    });
  }

  /**
   * Apply a GameOver payload that was returned synchronously from an RPC (caller-side).
   * This records the correlationId so subsequent hub GameOver pushes with the same
   * correlationId can be ignored by the events module.
   */
  applyGameOverFromRpc(dto: GameOverDto | null | undefined): void {
    try {
      if (!dto) return;
      // record correlation id first so event handler can dedupe
      if (dto.correlationId) {
        if (!this.correlationTracker)
          this.correlationTracker = this.injector.get(CorrelationIdTrackerService);
        this.correlationTracker.recordHubCorrelationId(dto.correlationId, 'GameOver-RPC');
      }

      // Lazily resolve the game over modal service
      if (!this.gameOverModalService) {
        try {
          this.gameOverModalService = this.injector.get(GameOverModalService);
        } catch (e) {
          console.warn('[SignalREvent] Failed to resolve GameOverModalService', e);
        }
      }

      // apply using the canonical handler so logic stays centralized
      try {
        handleGameOver(
          dto,
          this.gameState,
          this.timers ? this.timers.clearTickTimers : () => {},
          this.gameOverModalService ?? undefined
        );
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      console.warn('[SignalREvent] applyGameOverFromRpc error', e);
    }
  }

  /**
   * Get the timestamp when the last SyncedState was applied.
   */
  getLastSyncedAt(): number | null {
    return this.lastSyncedAt;
  }

  /**
   * Check if the SyncedState handler has been registered.
   */
  isSyncedStateHandlerRegistered(): boolean {
    return this.syncedStateHandlerRegistered;
  }
}
