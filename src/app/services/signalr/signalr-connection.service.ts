import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { getSignalRHubUrl } from '../../config/environment';
import { logger } from '../../utils/logger.util';

/**
 * Service responsible for SignalR connection lifecycle management.
 *
 * Handles:
 * - Connection initialization and configuration
 * - Connection state management
 * - Hub method invocation
 * - Connection start/stop
 *
 * This focused service eliminates the need for SignalRService to manage
 * raw connection concerns, improving testability and separation of concerns.
 */
@Injectable({
  providedIn: 'root',
})
export class SignalRConnectionService {
  private connection: signalR.HubConnection | null = null;

  /**
   * Initialize the SignalR connection with automatic reconnection support.
   * Does not start the connection - call start() separately.
   */
  initialize(): void {
    if (this.connection) {
      console.warn('[SignalRConnection] Connection already initialized');
      return;
    }

    const hubUrl = getSignalRHubUrl();
    logger.debug('[SignalRConnection] Connecting to:', hubUrl);

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build();

    logger.debug('[SignalRConnection] Connection initialized');
  }

  /**
   * Start the SignalR connection.
   * Must be called after initialize().
   */
  async start(): Promise<void> {
    if (!this.connection) {
      throw new Error(
        '[SignalRConnection] Connection not initialized. Call initialize() first.'
      );
    }

    if (this.connection.state === signalR.HubConnectionState.Connected) {
      console.warn('[SignalRConnection] Connection already started');
      return;
    }

    try {
      await this.connection.start();
      logger.debug('[SignalRConnection] Connection started');
    } catch (err) {
      console.error('[SignalRConnection] Connection start error:', err);
      throw err;
    }
  }

  /**
   * Stop the SignalR connection.
   */
  async stop(): Promise<void> {
    if (!this.connection) {
      return;
    }

    try {
      await this.connection.stop();
      logger.debug('[SignalRConnection] Connection stopped');
    } catch (err) {
      console.error('[SignalRConnection] Connection stop error:', err);
      throw err;
    }
  }

  /**
   * Get the current connection state.
   */
  getState(): signalR.HubConnectionState | null {
    return this.connection?.state ?? null;
  }

  /**
   * Get the underlying HubConnection instance.
   * Use with caution - prefer using invoke() for method calls.
   */
  getConnection(): signalR.HubConnection | null {
    return this.connection;
  }

  /**
   * Invoke a hub method and return the result.
   *
   * @param methodName - The name of the hub method to invoke
   * @param args - Arguments to pass to the hub method
   * @returns Promise resolving to the method result
   *
   * @throws Error if connection is not initialized
   */
  async invoke<T = any>(methodName: string, ...args: any[]): Promise<T> {
    if (!this.connection) {
      throw new Error('[SignalRConnection] Connection not initialized');
    }

    return this.connection.invoke<T>(methodName, ...args);
  }

  /**
   * Check if the connection is currently connected.
   */
  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  /**
   * Register a handler for the onreconnected event.
   *
   * @param callback - Function to call when reconnected
   */
  onReconnected(
    callback: (connectionId?: string) => void | Promise<void>
  ): void {
    if (!this.connection) {
      console.warn(
        '[SignalRConnection] Cannot register onreconnected - connection not initialized'
      );
      return;
    }

    this.connection.onreconnected(callback);
  }

  /**
   * Register a handler for the onreconnecting event.
   *
   * @param callback - Function to call when reconnecting
   */
  onReconnecting(callback: (error?: Error) => void | Promise<void>): void {
    if (!this.connection) {
      console.warn(
        '[SignalRConnection] Cannot register onreconnecting - connection not initialized'
      );
      return;
    }

    this.connection.onreconnecting(callback);
  }

  /**
   * Register a handler for the onclose event.
   *
   * @param callback - Function to call when connection closes
   */
  onClose(callback: (error?: Error) => void | Promise<void>): void {
    if (!this.connection) {
      console.warn(
        '[SignalRConnection] Cannot register onclose - connection not initialized'
      );
      return;
    }

    this.connection.onclose(callback);
  }
}
