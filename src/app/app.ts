import { Component, signal, OnDestroy, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';
import { HomeComponent } from './pages/home.component';
import { ConnectingComponent } from './pages/connecting.component';
import { ShareLinkComponent } from './pages/share-link.component';
import { GameBoardComponent } from './pages/game-board.component';
import { ModalComponent } from './ui/modal.component';
import { AiSettingsComponent } from './pages/ai-settings.component';
import { ToastComponent } from './ui/toast.component';
import { ToastService } from './services/toast.service';
import { ModalService } from './services/modal.service';
import { SignalRService } from './services/signalr/signalr.service';
import { GameStateService } from './services/game-state.service';
import { GameActionsService } from './services/game-actions.service';
import { GameSessionService } from './services/game-session.service';
import { GameFlowService } from './services/game-flow.service';
import { LocalGameService } from './services/game-modes/local-game.service';
import { AiGameService } from './services/game-modes/ai-game.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    NgIf,
    HomeComponent,
    ConnectingComponent,
    ShareLinkComponent,
    GameBoardComponent,
    ModalComponent,
    AiSettingsComponent,
    ToastComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  // Inject services
  private readonly signalR = inject(SignalRService);
  protected readonly gameState = inject(GameStateService);
  private readonly gameActions = inject(GameActionsService);
  private readonly gameSession = inject(GameSessionService);
  private readonly gameFlow = inject(GameFlowService);
  private readonly localGame = inject(LocalGameService);
  private readonly aiGame = inject(AiGameService);
  private readonly toastService = inject(ToastService);
  private readonly modalService = inject(ModalService);

  // UI title
  protected readonly title = signal('tic-tac-toe-frontend');

  // Expose game state signals for template access
  protected readonly board = this.gameState.board;
  protected readonly mySymbol = this.gameState.mySymbol;
  protected readonly currentTurn = this.gameState.currentTurn;
  protected readonly isGameOver = this.gameState.isGameOver;
  protected readonly winner = this.gameState.winner;
  protected readonly gameCode = this.gameState.gameCode;
  protected readonly opponentPresent = this.gameState.opponentPresent;
  protected readonly joinError = this.gameState.joinError;
  protected readonly playerId = this.gameState.playerId;
  protected readonly codeValue = this.gameState.codeValue;
  protected readonly blockedGameCode = this.gameState.blockedGameCode;
  protected readonly disconnectedPlayerId = this.gameState.disconnectedPlayerId;
  protected readonly countdownSeconds = this.gameState.countdownSeconds;
  protected readonly myTurnCountdown = this.gameState.myTurnCountdown;
  protected readonly opponentTurnCountdown = this.gameState.opponentTurnCountdown;
  protected readonly copied = this.gameState.copied;
  protected readonly moveError = this.gameState.moveError;

  // Expose game flow signals for template access
  protected readonly playMode = this.gameFlow.playMode;
  protected readonly stage = this.gameFlow.stage;

  constructor() {
    // Handle /room/:code URLs on app startup
    this.handleShareLinkOnStartup();

    // Register SyncedState handler
    try {
      const unregister = this.signalR.registerSyncedStateHandler(() => {
        // Handler for future extensions
      });
      (this as any).__unregisterSynced = unregister;
    } catch (e) {
      // ignore
    }

    // Show disconnect toast when opponent leaves during friend mode
    effect(() => {
      const mode = this.playMode();
      const stage = this.stage();
      const opponentPresent = this.opponentPresent();
      const isGameOver = this.isGameOver();
      const countdownSeconds = this.countdownSeconds();

      if (
        mode === 'friend' &&
        stage === 'in-game' &&
        !opponentPresent &&
        !isGameOver &&
        countdownSeconds != null
      ) {
        this.toastService.warning(
          `Opponent left - ${countdownSeconds}s until they forfeit.`,
          0 // persistent until dismissed or conditions change
        );
      } else {
        // Hide toast when conditions no longer apply
        const currentToast = this.toastService.currentToast();
        if (currentToast?.type === 'warning' && currentToast.message.includes('Opponent left')) {
          this.toastService.hide();
        }
      }
    });
  }

  protected async onOfferRematch(): Promise<void> {
    try {
      const res = await this.gameSession.offerRematch();
      if (!res.success) {
        if (this.modalService.isGameOverModal()) {
          this.modalService.updateRematchState({ rematchOfferedByMe: false });
        } else {
          this.modalService.showInfo('Rematch failed', res.error ?? 'Failed to offer rematch');
        }
      } else {
        if (this.modalService.isGameOverModal()) {
          this.modalService.updateRematchState({
            rematchOfferedByMe: true,
            ...(res.remainingSeconds != null ? { remainingSeconds: res.remainingSeconds } : {}),
          });
        } else {
          this.modalService.showInfo(
            'Rematch offered',
            'Waiting for opponent to accept the rematch...'
          );
          if (res.remainingSeconds != null) {
            this.modalService.update({ remainingSeconds: res.remainingSeconds });
          }
        }
      }
    } catch (e) {
      console.warn('[App] OfferRematch failed', e);
    }
  }

  protected async onAcceptRematch(): Promise<void> {
    try {
      const res = await this.gameSession.acceptRematch();
      if (!res.success) {
        if (this.modalService.isGameOverModal()) {
          this.modalService.updateRematchState({
            rematchOfferedByMe: false,
            offeredByOpponent: false,
          });
        } else {
          this.modalService.showInfo('Accept failed', res.error ?? 'Failed to accept rematch');
        }
      } else {
        if (res.started) {
          this.modalService.dismiss();
        } else {
          if (this.modalService.isGameOverModal()) {
            this.modalService.updateRematchState({
              rematchOfferedByMe: false,
              offeredByOpponent: false,
            });
          } else {
            this.modalService.showInfo('Accepted', 'Rematch accepted, waiting for opponent.');
          }
        }
      }
    } catch (e) {
      console.warn('[App] AcceptRematch failed', e);
    }
  }

  protected onDeclineRematch(): void {
    try {
      if (this.modalService.isGameOverModal()) {
        this.modalService.updateRematchState({
          rematchOfferedByMe: false,
          offeredByOpponent: false,
        });
      } else {
        this.modalService.dismiss();
      }
    } catch (e) {
      /* ignore */
    }
  }

  /** Handler for selecting play mode from home screen */
  protected onModeSelected(mode: string): void {
    this.gameFlow.selectMode(mode);
  }

  /** Start an AI match after difficulty selection */
  protected onAiStart(difficulty: 'easy' | 'hard'): void {
    this.gameFlow.startAiGame(difficulty);
  }

  /** Return to home screen */
  /** Return to home screen */
  protected goHome(): void {
    // Pass true to clear session when user explicitly navigates home via button
    this.gameFlow.goHome(true);
  }

  /** Dismiss any system modal */
  protected dismissSystemModal(): void {
    this.modalService.dismiss();
  }

  /** Return the full share link */
  protected shareLink(): string {
    const code = this.gameState.gameCode();
    if (!code) return '';
    try {
      return `${window.location.origin}/room/${encodeURIComponent(code)}`;
    } catch (e) {
      return `/room/${encodeURIComponent(code)}`;
    }
  }

  /**
   * Handle share link URLs on app startup.
   * If a /room/:code URL is detected, initialize SignalR and join the game.
   */
  private async handleShareLinkOnStartup() {
    try {
      const path = window.location.pathname || '';
      const match = path.match(/^\/room\/([^\/]+)\/?$/i);
      if (match && match[1]) {
        const code = decodeURIComponent(match[1]);

        // Need to initialize SignalR for share link joining
        this.gameFlow.stage.set('connecting');

        try {
          // Skip auto-reconnect when joining via share link - we know exactly which game to join
          await this.signalR.initialize(true);

          // Now attempt to join the game
          setTimeout(() => {
            this.gameFlow.handleShareLinkJoin(code);
          }, 0);
        } catch (error) {
          console.error('[App] Failed to initialize SignalR for share link', error);
          this.modalService.showError(
            'Connection Failed',
            'Unable to connect to the game server. Please check your internet connection and try again.'
          );
          this.gameFlow.stage.set('welcome');
        }
      }
    } catch (e) {
      console.warn('[App] Failed to parse room code from URL', e);
    }
  }

  /** Create a new online game */
  protected async createGame(): Promise<void> {
    await this.gameFlow.createOnlineGame();
  }

  /** Join an existing online game */
  protected async joinGame(code: string): Promise<{ success: boolean; errorCode?: string } | void> {
    return this.gameFlow.joinOnlineGame(code);
  }

  /** Make a move */
  protected async makeMove(index: number): Promise<void> {
    const mode = this.playMode();

    if (mode === 'local') {
      this.localGame.makeMove(index);
    } else if (mode === 'ai') {
      this.aiGame.makeHumanMove(index);
    } else {
      // Online move
      await this.gameActions.makeMove(index);
    }
  }

  /** Reset game */
  protected onReset(): void {
    this.gameFlow.resetGame();
  }

  /** Start rematch */
  protected onRematch(): void {
    this.gameFlow.handleRematch();
  }

  /**
   * Copy the room code to clipboard
   */
  protected async copyRoomCode(): Promise<void> {
    const code = this.gameState.gameCode();
    if (!code) return await this.gameActions.copyRoomCode();
    // If we're in a room, copy the current full URL (which was set on create)
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.gameState.setCopied(true);
      setTimeout(() => this.gameState.setCopied(false), 1500);
    } catch (e) {
      // Fallback to the existing helper if clipboard fails
      await this.gameActions.copyRoomCode();
    }
    // dismiss any modal after copying
    try {
      this.modalService.dismiss();
    } catch (e) {
      /* ignore */
    }
  }

  /** Copy the full share link (including origin) to clipboard */
  protected async copyShareLink(): Promise<void> {
    const code = this.gameState.gameCode();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      this.gameState.setCopied(true);
      setTimeout(() => this.gameState.setCopied(false), 1500);
    } catch (e) {
      // fallback
      const link = `${window.location.origin}/room/${encodeURIComponent(code)}`;
      try {
        await navigator.clipboard.writeText(link);
        this.gameState.setCopied(true);
        setTimeout(() => this.gameState.setCopied(false), 1500);
      } catch (err) {
        console.error('[App] Copy share link failed', err);
      }
    }
  }

  /**
   * Cleanup on component destroy
   */
  ngOnDestroy(): void {
    // unregister synced handler if present
    try {
      const u = (this as any).__unregisterSynced as (() => void) | undefined;
      if (u) u();
    } catch (e) {
      // ignore
    }
    this.signalR.stop().catch(() => undefined);
  }
}
