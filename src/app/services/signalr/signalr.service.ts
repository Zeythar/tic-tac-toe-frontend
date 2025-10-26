import { Injectable, Injector, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { GameStateService } from '../game-state.service';
import { SignalRConnectionService } from './signalr-connection.service';
import { SignalREventService } from './signalr-event.service';
import { SignalRReconnectionService } from './signalr-reconnection.service';
import {
  GameState,
  GameStateResult,
  GameOverDto,
} from '../../types/game.types';
import {
  getStoredGameCode,
  getStoredPlayerId,
  setStoredGameCode,
  setStoredPlayerId,
} from '../../utils/storage.util';
import { logger } from '../../utils/logger.util';

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * Facade service for SignalR functionality.
 *
 * Delegates to focused services:
 * - SignalRConnectionService: Connection lifecycle management
 * - SignalREventService: Event registration and handling
 * - SignalRReconnectionService: Reconnection logic
 *
 * This maintains the public API for backward compatibility while improving
 * internal organization and testability. Consumers can still inject this
 * service, or inject the focused services directly for specific concerns.
 */
@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private readonly _connectionState = signal<ConnectionState>('disconnected');
  private readonly _connectionError = signal<string | null>(null);
  private _initialized = false;

  public readonly connectionState = this._connectionState.asReadonly();
  public readonly connectionError = this._connectionError.asReadonly();

  constructor(
    private gameState: GameStateService,
    private connectionService: SignalRConnectionService,
    private eventService: SignalREventService,
    private reconnectionService: SignalRReconnectionService
  ) {}

  /**
   * Initialize SignalR connection and set up event handlers.
   * Delegates to focused services for connection, events, and reconnection.
   *
   * @param skipAutoReconnect - If true, skips automatic reconnection attempt (useful when joining via share link)
   */
  async initialize(skipAutoReconnect = false): Promise<void> {
    // Prevent multiple initializations
    if (this._initialized) {
      logger.debug('[SignalR] Already initialized, skipping');
      return;
    }

    this._connectionState.set('connecting');
    this._connectionError.set(null);

    try {
      // Initialize connection
      this.connectionService.initialize();

      // Initialize event handlers (needs connection to be initialized)
      this.eventService.initializeEventHandlers(
        this.fetchGameState.bind(this),
        this.attemptJoinGame.bind(this)
      );

      // Initialize reconnection handlers
      this.reconnectionService.initializeReconnectionHandlers(
        this.fetchGameState.bind(this),
        this.attemptJoinGame.bind(this),
        () => {}, // registerEventHandlers - not needed anymore
        this.eventService.waitForSyncedState.bind(this.eventService)
      );

      // Start the connection
      await this.connectionService.start();
      logger.debug('[SignalR] Connection started');

      this._initialized = true;
      this._connectionState.set('connected');

      // Attempt auto-reconnect after initial start (unless explicitly skipped)
      if (!skipAutoReconnect) {
        await this.reconnectionService.attemptAutoReconnect();
      }
    } catch (err) {
      console.error('[SignalR] Connection error:', err);
      this._connectionState.set('error');
      this._connectionError.set(
        err instanceof Error ? err.message : 'Failed to connect to server'
      );
      throw err; // Re-throw so caller can handle
    }
  }

  /**
   * Check if SignalR has been initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Attempt to join a game.
   * @param code - The game code to join
   */
  private async attemptJoinGame(code: string): Promise<void> {
    try {
      console.debug('[SignalR] Attempting JoinGame(', code, ')');
      const res = await this.connectionService.invoke('JoinGame', code);
      console.debug('[SignalR] JoinGame result:', res);

      // Wait for a SyncedState push from server
      await this.eventService.waitForSyncedState(800);
    } catch (e) {
      console.warn('[SignalR] JoinGame failed', e);
    }
  }

  /**
   * Fetch current game state from server.
   * Used for syncing after reconnection or other operations.
   */
  private async fetchGameState(code: string, playerId?: string): Promise<void> {
    try {
      // Backend returns ApiResponse<GameState>, unwrap the payload
      const response = await this.connectionService.invoke<any>(
        'GetGameState',
        code,
        playerId
      );
      console.debug('[SignalR] GetGameState result:', response);

      // Unwrap the payload from ApiResponse wrapper
      const state = (response as any)?.payload ?? response;

      if (state) {
        this.gameState.updateGameState(state);
        // set code/playerId if returned by server
        const codeVal = (state as any).code ?? null;
        const pid = (state as any).playerId ?? null;
        if (codeVal) {
          this.gameState.setGameCode(codeVal);
          try {
            setStoredGameCode(codeVal);
          } catch (e) {
            // ignore
          }
        }
        if (pid) {
          this.gameState.setPlayerId(pid);
          try {
            setStoredPlayerId(pid);
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      console.debug('[SignalR] GetGameState failed', e);
    }
  }

  /**
   * Register a callback to be invoked when a SyncedState arrives.
   * Returns an unregister function.
   */
  registerSyncedStateHandler(cb: (s: GameState) => void): () => void {
    return this.eventService.registerSyncedStateHandler(cb);
  }

  /**
   * Register a GameStarted UI notification callback. Returns an unregister fn.
   */
  registerGameStartedHandler(cb: () => void): () => void {
    return this.eventService.registerGameStartedHandler(cb);
  }

  /**
   * Wait for a SyncedState event for up to `timeoutMs` milliseconds.
   * Resolves with the state if received, or null if timed out.
   */
  waitForSyncedState(timeoutMs = 1000): Promise<GameState | null> {
    return this.eventService.waitForSyncedState(timeoutMs);
  }

  /**
   * Invoke a hub method
   */
  async invoke<T = any>(methodName: string, ...args: any[]): Promise<T> {
    return this.connectionService.invoke<T>(methodName, ...args);
  }

  /**
   * Apply a GameOver payload that was returned synchronously from an RPC (caller-side).
   * This records the correlationId so subsequent hub GameOver pushes with the same
   * correlationId can be ignored by the events module.
   */
  applyGameOverFromRpc(dto: GameOverDto | null | undefined): void {
    this.eventService.applyGameOverFromRpc(dto);
  }

  /**
   * Get the current connection state
   */
  getConnectionState(): signalR.HubConnectionState | null {
    return this.connectionService.getState();
  }

  /**
   * Stop the SignalR connection
   */
  async stop(): Promise<void> {
    await this.connectionService.stop();
  }
}
