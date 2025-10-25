import { Injectable } from '@angular/core';

/**
 * Centralized service for tracking correlation IDs to prevent duplicate event handling.
 *
 * This service helps deduplicate events that are sent both via RPC responses and hub broadcasts.
 * For example, when a player makes a move, the server returns the updated state in the RPC response
 * AND broadcasts it to all clients. The correlation ID lets us identify and ignore the broadcast
 * that corresponds to an RPC we already processed.
 */
@Injectable({
  providedIn: 'root',
})
export class CorrelationIdTrackerService {
  // Tracks correlation IDs from RPC responses (caller-side)
  private rpcCorrelationIds: Map<string, number> = new Map();

  // Tracks correlation IDs from hub events that have been applied
  private appliedHubCorrelationIds: Map<string, number> = new Map();

  // Maximum number of IDs to track before cleanup (prevents memory leaks)
  private readonly MAX_TRACKED_IDS = 100;

  // How long to remember a correlation ID (milliseconds)
  private readonly RETENTION_MS = 60000; // 1 minute

  /**
   * Record a correlation ID from an RPC response.
   *
   * @param correlationId - The correlation ID from the RPC response
   * @param context - Optional context for debugging (e.g., 'CreateGame', 'MakeMove')
   */
  recordRpcCorrelationId(correlationId: string | null | undefined, context?: string): void {
    if (!correlationId) return;

    try {
      const timestamp = Date.now();
      this.rpcCorrelationIds.set(correlationId, timestamp);

      // Cleanup old entries if we've exceeded the limit
      if (this.rpcCorrelationIds.size > this.MAX_TRACKED_IDS) {
        this.cleanupOldEntries(this.rpcCorrelationIds);
      }

      if (context) {
        console.debug(`[CorrelationTracker] Recorded RPC ID: ${correlationId} (${context})`);
      }
    } catch (e) {
      console.warn('[CorrelationTracker] Failed to record RPC correlation ID', e);
    }
  }

  /**
   * Record a correlation ID from a hub event that has been applied.
   *
   * @param correlationId - The correlation ID from the hub event
   * @param context - Optional context for debugging (e.g., 'GameOver', 'BoardUpdated')
   */
  recordHubCorrelationId(correlationId: string | null | undefined, context?: string): void {
    if (!correlationId) return;

    try {
      const timestamp = Date.now();
      this.appliedHubCorrelationIds.set(correlationId, timestamp);

      // Cleanup old entries if we've exceeded the limit
      if (this.appliedHubCorrelationIds.size > this.MAX_TRACKED_IDS) {
        this.cleanupOldEntries(this.appliedHubCorrelationIds);
      }

      if (context) {
        console.debug(`[CorrelationTracker] Recorded Hub ID: ${correlationId} (${context})`);
      }
    } catch (e) {
      console.warn('[CorrelationTracker] Failed to record hub correlation ID', e);
    }
  }

  /**
   * Check if a hub event should be ignored because its correlation ID matches a recent RPC.
   *
   * @param correlationId - The correlation ID from the hub event
   * @returns True if the event should be ignored (already processed via RPC)
   */
  shouldIgnoreHubEvent(correlationId: string | null | undefined): boolean {
    if (!correlationId) return false;

    try {
      const hasRpc = this.rpcCorrelationIds.has(correlationId);

      if (hasRpc) {
        console.debug(`[CorrelationTracker] Ignoring duplicate hub event: ${correlationId}`);
      }

      return hasRpc;
    } catch (e) {
      console.warn('[CorrelationTracker] Error checking hub event', e);
      return false;
    }
  }

  /**
   * Check if a hub event has already been applied.
   *
   * @param correlationId - The correlation ID to check
   * @returns True if this correlation ID has been applied before
   */
  hasBeenApplied(correlationId: string | null | undefined): boolean {
    if (!correlationId) return false;

    try {
      return this.appliedHubCorrelationIds.has(correlationId);
    } catch (e) {
      return false;
    }
  }

  /**
   * Get the most recent RPC correlation ID (for backward compatibility).
   *
   * @returns The most recent RPC correlation ID or null
   */
  getLastRpcCorrelationId(): string | null {
    try {
      if (this.rpcCorrelationIds.size === 0) return null;

      // Find the most recent entry
      let mostRecent: string | null = null;
      let mostRecentTime = 0;

      for (const [id, timestamp] of this.rpcCorrelationIds.entries()) {
        if (timestamp > mostRecentTime) {
          mostRecentTime = timestamp;
          mostRecent = id;
        }
      }

      return mostRecent;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the most recent applied hub correlation ID (for backward compatibility).
   *
   * @returns The most recent hub correlation ID or null
   */
  getLastAppliedHubCorrelationId(): string | null {
    try {
      if (this.appliedHubCorrelationIds.size === 0) return null;

      // Find the most recent entry
      let mostRecent: string | null = null;
      let mostRecentTime = 0;

      for (const [id, timestamp] of this.appliedHubCorrelationIds.entries()) {
        if (timestamp > mostRecentTime) {
          mostRecentTime = timestamp;
          mostRecent = id;
        }
      }

      return mostRecent;
    } catch (e) {
      return null;
    }
  }

  /**
   * Clear all tracked correlation IDs.
   * Useful when resetting game state or starting a new session.
   */
  clearAll(): void {
    try {
      this.rpcCorrelationIds.clear();
      this.appliedHubCorrelationIds.clear();
      console.debug('[CorrelationTracker] Cleared all correlation IDs');
    } catch (e) {
      console.warn('[CorrelationTracker] Failed to clear correlation IDs', e);
    }
  }

  /**
   * Clean up old entries from a correlation ID map.
   * Removes entries older than RETENTION_MS.
   */
  private cleanupOldEntries(map: Map<string, number>): void {
    try {
      const now = Date.now();
      const cutoff = now - this.RETENTION_MS;

      const toDelete: string[] = [];

      for (const [id, timestamp] of map.entries()) {
        if (timestamp < cutoff) {
          toDelete.push(id);
        }
      }

      for (const id of toDelete) {
        map.delete(id);
      }

      if (toDelete.length > 0) {
        console.debug(`[CorrelationTracker] Cleaned up ${toDelete.length} old correlation IDs`);
      }
    } catch (e) {
      console.warn('[CorrelationTracker] Failed to cleanup old entries', e);
    }
  }
}
