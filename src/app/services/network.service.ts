import { Injectable, signal } from '@angular/core';

/**
 * Service for tracking network connectivity status.
 *
 * Uses multiple methods to detect connectivity:
 * 1. navigator.onLine for basic network interface status
 * 2. online/offline events for browser-detected changes
 * 3. Periodic connectivity checks by attempting to reach the server
 *
 * Note: navigator.onLine alone is unreliable - it may report "online"
 * even when internet access is unavailable.
 */
@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private readonly _isOnline = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  private checkInterval: any = null;
  private readonly CHECK_INTERVAL_MS = 5000; // Check every 5 seconds

  public readonly isOnline = this._isOnline.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for online/offline events
      window.addEventListener('online', () => {
        console.log('[Network] Browser reports online');
        this.verifyConnectivity();
      });

      window.addEventListener('offline', () => {
        console.log('[Network] Browser reports offline');
        this._isOnline.set(false);
      });

      // Start periodic connectivity checks
      this.startPeriodicChecks();

      // Do an initial check
      this.verifyConnectivity();
    }
  }

  /**
   * Start periodic connectivity checks
   */
  private startPeriodicChecks(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.verifyConnectivity();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop periodic connectivity checks
   */
  private stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Verify actual internet connectivity by attempting to reach the server.
   * Tries to reach the backend server via the proxy.
   */
  private async verifyConnectivity(): Promise<void> {
    // Quick check: if browser says offline, trust it
    if (!navigator.onLine) {
      this._isOnline.set(false);
      return;
    }

    try {
      // Try to reach the SignalR negotiate endpoint with a short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('/gameHub/negotiate', {
        method: 'POST',
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);

      // Check if we got a valid response from the backend
      // 500 errors or network errors mean the backend is not reachable
      // 200-299, 400-499 (except 503) indicate the server is reachable
      const isServerReachable =
        response.ok || (response.status >= 400 && response.status < 500 && response.status !== 503);

      if (isServerReachable) {
        if (!this._isOnline()) {
          console.log('[Network] Connection verified - back online');
        }
        this._isOnline.set(true);
      } else {
        // 500, 503, or other server errors indicate backend is down
        if (this._isOnline()) {
          console.log('[Network] Server unreachable - marking offline');
        }
        this._isOnline.set(false);
      }
    } catch (error) {
      // Fetch failed - network error, timeout, or CORS issue
      if (this._isOnline()) {
        console.log('[Network] Connection check failed - offline');
      }
      this._isOnline.set(false);
    }
  }

  /**
   * Check if the browser reports being online.
   * Note: This doesn't guarantee internet access, just network connectivity.
   */
  checkOnline(): boolean {
    return this._isOnline();
  }

  /**
   * Manually trigger a connectivity check
   */
  async recheckConnectivity(): Promise<void> {
    await this.verifyConnectivity();
  }
}
