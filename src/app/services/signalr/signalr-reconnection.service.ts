import { Injectable } from '@angular/core';
import { GameStateService } from '../game-state.service';
import { SignalRConnectionService } from './signalr-connection.service';
import {
  createReconnectionHandlers,
  SignalRServiceLike,
} from './signalr-helpers/reconnection.logic';
import { getStoredGameCode, getStoredPlayerId } from '../../utils/storage.util';

/**
 * Service responsible for SignalR reconnection logic and session restoration.
 *
 * Handles:
 * - Automatic reconnection on connection loss
 * - Session restoration (Reconnect RPC, fallback to JoinGame)
 * - Auto-reconnect on initial startup
 * - Reconnection event registration
 *
 * This focused service eliminates the need for SignalRService to manage
 * reconnection concerns, improving separation of concerns.
 */
@Injectable({
  providedIn: 'root',
})
export class SignalRReconnectionService {
  private reconnectionHelpers: ReturnType<typeof createReconnectionHandlers> | null = null;

  constructor(
    private gameState: GameStateService,
    private connectionService: SignalRConnectionService
  ) {}

  /**
   * Initialize reconnection handlers.
   * Must be called after connection is initialized.
   *
   * @param fetchGameState - Callback to fetch game state from server
   * @param attemptJoinGame - Callback to attempt joining a game
   * @param registerEventHandlers - Callback to register event handlers
   * @param waitForSyncedState - Callback to wait for synced state
   * @param timers - Optional timers helper for managing tick timers
   */
  initializeReconnectionHandlers(
    fetchGameState: (code: string, playerId?: string) => Promise<void>,
    attemptJoinGame: (code: string) => Promise<void>,
    registerEventHandlers: () => void,
    waitForSyncedState: (timeoutMs?: number) => Promise<any>,
    timers?: any
  ): void {
    const connection = this.connectionService.getConnection();
    if (!connection) {
      console.warn('[SignalRReconnection] Cannot initialize - connection not available');
      return;
    }

    // Create the service-like adapter for reconnection handlers
    const serviceAdapter: SignalRServiceLike = {
      connection,
      handlersRegistered: false, // Will be updated by event service
      registerEventHandlers,
      gameState: this.gameState,
      invoke: this.connectionService.invoke.bind(this.connectionService),
      waitForSyncedState,
      fetchGameState,
      attemptJoinGame,
      timers,
    };

    this.reconnectionHelpers = createReconnectionHandlers(serviceAdapter);
    this.reconnectionHelpers.registerReconnectionHandlers();
    console.log('[SignalRReconnection] Reconnection handlers registered');
  }

  /**
   * Attempt to reconnect to a specific game session.
   *
   * @param code - The game code
   * @param playerId - The player ID
   */
  async attemptReconnect(code: string, playerId: string): Promise<void> {
    if (!this.reconnectionHelpers) {
      console.warn('[SignalRReconnection] Reconnection helpers not initialized');
      return;
    }

    await this.reconnectionHelpers.attemptReconnect(code, playerId);
  }

  /**
   * Attempt auto-reconnect on initial startup.
   * Checks localStorage for stored session and attempts to restore it.
   *
   * Skips auto-reconnect if:
   * - No stored game code
   * - User is on /room/:code share screen (creator hasn't joined yet)
   * - No stored player ID (creator on share screen)
   */
  async attemptAutoReconnect(): Promise<void> {
    if (this.reconnectionHelpers && this.reconnectionHelpers.attemptAutoReconnect) {
      await this.reconnectionHelpers.attemptAutoReconnect();
      return;
    }

    // Fallback logic if helpers not initialized yet
    const storedCode = getStoredGameCode();
    const storedPid = getStoredPlayerId();

    if (!storedCode) return;

    console.debug(
      '[SignalRReconnection] Auto-reconnect fallback - code:',
      storedCode,
      'playerId:',
      storedPid
    );

    // Simple fallback - full logic is in reconnectionHelpers.attemptAutoReconnect
    // This should rarely be hit since helpers are initialized before start()
  }

  /**
   * Check if reconnection helpers are initialized.
   */
  isInitialized(): boolean {
    return this.reconnectionHelpers !== null;
  }
}
