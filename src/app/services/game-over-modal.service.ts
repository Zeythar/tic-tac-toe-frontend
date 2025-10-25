import { Injectable } from '@angular/core';
import { GameStateService } from './game-state.service';
import { ModalService } from './modal.service';
import { buildGameOverModal } from '../utils/gameover-modal.util';
import { GAME_OVER_MODAL_DELAY_MS } from '../constants/game.constants';

/**
 * Handles game-over modal display for local and online games.
 */
@Injectable({
  providedIn: 'root',
})
export class GameOverModalService {
  constructor(private gameState: GameStateService, private modalService: ModalService) {}

  /**
   * Show game-over modal for local/AI games after a brief delay.
   */
  showLocalGameOverModal(
    playMode: 'local' | 'ai' | 'friend',
    delayMs = GAME_OVER_MODAL_DELAY_MS
  ): void {
    try {
      if (playMode !== 'local' && playMode !== 'ai') return;

      // Skip modal for two-player hotseat (no mySymbol assigned)
      if (playMode === 'local' && this.gameState.mySymbol() == null) return;

      if (this.modalService.isShowing()) return;

      const winner = this.gameState.winner();

      let modalType: 'win' | 'loss' | 'draw' = 'draw';
      if (winner === null) {
        modalType = 'draw';
      } else {
        const mySym = this.gameState.mySymbol();
        if (playMode === 'local' && mySym == null) {
          modalType = 'win';
        } else {
          if (mySym && winner === mySym) modalType = 'win';
          else modalType = 'loss';
        }
      }

      const modalPayload = buildGameOverModal({
        resultToken:
          modalType === 'win' || modalType === 'loss'
            ? 'Winner'
            : modalType === 'draw'
            ? 'Draw'
            : null,
        winnerSymbol: winner, // Use the actual winner symbol, not mySymbol
        winnerId: null, // Local games don't have player IDs
        mySymbol: this.gameState.mySymbol(),
        myPlayerId: null, // Local games don't have player IDs
        serverMessage: null,
        roomCode: null,
      });

      // Delay modal display so final board state is visible
      setTimeout(() => {
        try {
          if (!this.gameState.isGameOver()) return;
          if (this.modalService.isShowing()) return;
          this.modalService.show({ ...modalPayload, isLocal: true });
        } catch (e) {
          /* ignore */
        }
      }, delayMs);
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Show game-over modal for online games.
   */
  showOnlineGameOverModal(
    gameOverData: {
      resultToken: string | null;
      winnerSymbol?: string | null;
      winnerId?: string | null;
      serverMessage?: string | null;
      roomCode?: string | null;
      boardSnapshot?: Array<string | null>;
    },
    delayMs = GAME_OVER_MODAL_DELAY_MS
  ): void {
    try {
      const modalPayload = buildGameOverModal({
        resultToken: gameOverData.resultToken,
        winnerSymbol: gameOverData.winnerSymbol ?? null,
        winnerId: gameOverData.winnerId ?? null,
        mySymbol: this.gameState.mySymbol(),
        myPlayerId: this.gameState.playerId(),
        serverMessage: gameOverData.serverMessage ?? null,
        roomCode: gameOverData.roomCode ?? null,
      });

      // Preserve existing rematch metadata when showing game-over modal
      const curModal = this.modalService.getCurrent();
      let mergedModal = modalPayload;
      if (curModal) {
        const { offeredByOpponent, rematchOfferedByMe, remainingSeconds } = curModal;
        if (
          typeof offeredByOpponent !== 'undefined' ||
          typeof rematchOfferedByMe !== 'undefined' ||
          typeof remainingSeconds !== 'undefined'
        ) {
          mergedModal = {
            ...modalPayload,
            ...(typeof offeredByOpponent !== 'undefined' ? { offeredByOpponent } : {}),
            ...(typeof rematchOfferedByMe !== 'undefined' ? { rematchOfferedByMe } : {}),
            ...(typeof remainingSeconds !== 'undefined' ? { remainingSeconds } : {}),
          };
        }
      }

      setTimeout(() => {
        try {
          if (this.gameState.isGameOver()) {
            this.modalService.show(mergedModal);
          }
        } catch (e) {
          /* ignore */
        }
      }, delayMs);
    } catch (e) {
      try {
        const fallbackModal = buildGameOverModal({
          resultToken: gameOverData.resultToken,
          winnerSymbol: gameOverData.winnerSymbol ?? null,
          winnerId: gameOverData.winnerId ?? null,
          mySymbol: this.gameState.mySymbol(),
          myPlayerId: this.gameState.playerId(),
          serverMessage: gameOverData.serverMessage ?? null,
          roomCode: gameOverData.roomCode ?? null,
        });
        this.modalService.show(fallbackModal);
      } catch (err) {
        /* ignore */
      }
    }
  }
}
