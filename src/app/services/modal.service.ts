import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ExtendedModalType } from '../types/modal.types';

/**
 * Complete modal configuration with all possible fields
 */
export interface ModalConfig {
  type: ExtendedModalType;
  title: string;
  message: string;
  code?: string | null;
  isLocal?: boolean;
  // Rematch-specific fields
  offeredByOpponent?: boolean;
  rematchOfferedByMe?: boolean;
  rematchCancelled?: boolean;
  remainingSeconds?: number | null;
}

/**
 * Centralized modal service for managing system modals.
 *
 * Provides convenient methods for showing different modal types:
 * - Game outcomes (win/loss/draw)
 * - Info messages
 * - Error messages
 * - Forfeit/expired notifications
 * - Rematch flow management
 */
@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private readonly router = inject(Router);

  private readonly _currentModal = signal<ModalConfig | null>(null);
  public readonly currentModal = this._currentModal.asReadonly();

  /**
   * Show a modal with full configuration
   */
  show(config: ModalConfig): void {
    this._currentModal.set(config);
  }

  /**
   * Dismiss/hide the current modal
   */
  dismiss(): void {
    this._currentModal.set(null);
  }

  /**
   * Update the current modal (useful for merging rematch state into game-over modals)
   */
  update(partialConfig: Partial<ModalConfig>): void {
    const current = this._currentModal();
    if (current) {
      this._currentModal.set({ ...current, ...partialConfig });
    }
  }

  /**
   * Merge rematch-specific fields into the current modal without replacing it
   */
  updateRematchState(rematchData: {
    offeredByOpponent?: boolean;
    rematchOfferedByMe?: boolean;
    rematchCancelled?: boolean;
    remainingSeconds?: number | null;
  }): void {
    const current = this._currentModal();
    if (current && (current.type === 'win' || current.type === 'loss' || current.type === 'draw')) {
      this._currentModal.set({ ...current, ...rematchData });
    }
  }

  /**
   * Show a win modal (game over - you won)
   */
  showWin(title: string, message: string, code?: string, isLocal?: boolean): void {
    this.show({ type: 'win', title, message, code, isLocal });
  }

  /**
   * Show a loss modal (game over - you lost)
   */
  showLoss(title: string, message: string, code?: string, isLocal?: boolean): void {
    this.show({ type: 'loss', title, message, code, isLocal });
  }

  /**
   * Show a draw modal (game over - draw)
   */
  showDraw(title: string, message: string, code?: string, isLocal?: boolean): void {
    this.show({ type: 'draw', title, message, code, isLocal });
  }

  /**
   * Show a forfeit modal (opponent forfeited or you forfeited)
   */
  showForfeit(title: string, message: string, code?: string): void {
    this.show({ type: 'forfeit', title, message, code });
  }

  /**
   * Show an expired room modal (room was cancelled/expired)
   */
  showExpired(title: string, message: string, code?: string): void {
    this.show({ type: 'roomExpired', title, message, code });
  }

  /**
   * Show a rematch modal
   */
  showRematch(
    title: string,
    message: string,
    rematchData?: {
      offeredByOpponent?: boolean;
      rematchOfferedByMe?: boolean;
      remainingSeconds?: number | null;
    }
  ): void {
    this.show({ type: 'rematch', title, message, ...rematchData });
  }

  /**
   * Show an info modal (generic information)
   */
  showInfo(title: string, message: string): void {
    this.show({ type: 'info', title, message });
  }

  /**
   * Show an error/info modal (generic information or error message)
   */
  showError(title: string, message: string): void {
    this.show({ type: 'info', title, message });
  }

  /**
   * Show a game-over modal with full config (win/loss/draw with rematch controls)
   */
  showGameOver(config: ModalConfig): void {
    this.show(config);
  }

  /**
   * Check if a modal is currently shown
   */
  isShowing(): boolean {
    return this._currentModal() !== null;
  }

  /**
   * Check if the current modal is a game-over modal (win/loss/draw)
   */
  isGameOverModal(): boolean {
    const modal = this._currentModal();
    return (
      modal !== null && (modal.type === 'win' || modal.type === 'loss' || modal.type === 'draw')
    );
  }

  /**
   * Get the current modal (or null if none)
   */
  getCurrent(): ModalConfig | null {
    return this._currentModal();
  }

  /**
   * Navigate home and dismiss modal
   */
  async dismissAndGoHome(): Promise<void> {
    this.dismiss();
    await this.router.navigate(['/']);
  }
}
