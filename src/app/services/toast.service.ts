import { Injectable, signal } from '@angular/core';

/**
 * Toast notification types for visual distinction
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Toast message configuration
 */
export interface ToastMessage {
  message: string;
  type: ToastType;
  duration?: number; // ms, defaults to 3000
}

/**
 * Centralized toast/banner service for showing temporary messages.
 * Replaces duplicate implementations like disconnect-banner and copied-message.
 *
 * Usage:
 * ```
 * toastService.show('Connection lost', 'warning');
 * toastService.show('Copied to clipboard!', 'success', 1500);
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly _currentToast = signal<ToastMessage | null>(null);
  public readonly currentToast = this._currentToast.asReadonly();

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Show a toast message
   * @param message The message text to display
   * @param type Visual type (info, success, warning, error)
   * @param duration How long to show the toast (ms), defaults to 3000
   */
  show(message: string, type: ToastType = 'info', duration: number = 3000): void {
    // Clear any existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Set the new toast
    this._currentToast.set({ message, type, duration });

    // Auto-hide after duration
    if (duration > 0) {
      this.timeoutId = setTimeout(() => {
        this.hide();
      }, duration);
    }
  }

  /**
   * Manually hide the current toast
   */
  hide(): void {
    this._currentToast.set(null);
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Show a success toast (green)
   */
  success(message: string, duration: number = 3000): void {
    this.show(message, 'success', duration);
  }

  /**
   * Show an info toast (blue)
   */
  info(message: string, duration: number = 3000): void {
    this.show(message, 'info', duration);
  }

  /**
   * Show a warning toast (yellow/orange)
   */
  warning(message: string, duration: number = 3000): void {
    this.show(message, 'warning', duration);
  }

  /**
   * Show an error toast (red)
   */
  error(message: string, duration: number = 3000): void {
    this.show(message, 'error', duration);
  }
}
