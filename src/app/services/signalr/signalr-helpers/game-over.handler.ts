import { GameStateService } from '../../game-state.service';
import { GameOverModalService } from '../../game-over-modal.service';
import { clearStoredGameSession as clearStoredGameSessionUtil } from '../../../utils/storage.util';
import {
  normalizeBoard,
  checkWinner,
  isBoardFull,
  createEmptyBoard,
} from '../../../utils/board-normalization.util';
import { playerIdEquals } from '../../../utils/player-id.util';
import { ModalType } from '../../../types/modal.types';

type ClearTicksFn = () => void;

/**
 * Handle GameOver DTO in a focused helper so SignalR service stays smaller.
 */
export function handleGameOver(
  dto: any,
  gameState: GameStateService,
  clearTicks: ClearTicksFn,
  gameOverModalService?: GameOverModalService
) {
  try {
    if (!dto || typeof dto !== 'object') return;

    const fmt = (p: any) => {
      if (p == null) return 'Unknown player';
      if (typeof p === 'string') return p;
      if (typeof p === 'object') {
        return (
          (p.displayName as string) ||
          (p.name as string) ||
          (p.playerName as string) ||
          (p.id as string) ||
          JSON.stringify(p)
        );
      }
      return String(p);
    };

    // Clear reconnect/disconnected UI
    gameState.setDisconnectedPlayerId(null);
    gameState.setCountdownSeconds(null);

    // Prefer nested gameOver payload if present (newer server shape)
    const payload = (dto as any).gameOver ?? (dto as any);

    // Apply authoritative board and state if provided
    if (Array.isArray(payload.boardSnapshot)) {
      gameState.setBoard(payload.boardSnapshot ?? createEmptyBoard());
    }
    if (typeof payload.currentTurn !== 'undefined') {
      gameState.setCurrentTurn(payload.currentTurn ?? null);
    }

    // Force the local UI to treat this as a game-over event
    gameState.setIsGameOver(true);

    // Normalize and set a readable winner value in state for the UI
    const winnerLabelForState =
      (dto as any).winner ??
      (dto as any).winnerSymbol ??
      ((dto as any).winnerId ? fmt((dto as any).winnerId) : null);
    gameState.setWinner(winnerLabelForState ?? null);

    // Clear per-turn countdowns and tick timers
    try {
      gameState.clearTurnCountdowns();
    } catch (e) {
      /* ignore */
    }
    try {
      clearTicks();
    } catch (e) {
      /* ignore */
    }

    // Mark opponent absent
    gameState.setOpponentPresent(false);

    // Do NOT clear stored session here. Preserve the stored gameCode/playerId
    // so the rematch flow can reuse the existing session. Stored session will
    // be cleared when the rematch window expires or when the player leaves.

    // Build modal contents using the normalized payload
    const rawResult =
      payload.result ?? payload.Result ?? (dto as any).result ?? (dto as any).Result ?? null;
    // Normalize numeric/result codes to canonical tokens used below.
    // Accept common string synonyms from different server versions so the
    // UI consistently maps draws/wins/forfeits to the expected modal types.
    const normalizeResult = (r: any): string | null => {
      if (r == null) return null;
      if (typeof r === 'number') {
        // mapping based on server enum (0=Winner,1=Forfeit,2=Draw,3=Cancelled)
        switch (r) {
          case 0:
            return 'Winner';
          case 1:
            return 'Forfeit';
          case 2:
            return 'Draw';
          case 3:
            return 'Cancelled';
          default:
            return String(r);
        }
      }

      // Normalize common string variants
      const s = String(r).trim();
      if (!s) return null;
      const lower = s.toLowerCase();
      if (lower === 'winner' || lower === 'win' || lower === 'victory') return 'Winner';
      if (lower === 'forfeit' || lower === 'forfeited') return 'Forfeit';
      if (
        lower === 'draw' ||
        lower === 'tie' ||
        lower === 'tiegame' ||
        lower === 'drawn' ||
        lower === 'stalemate'
      )
        return 'Draw';
      if (lower === 'cancelled' || lower === 'cancel' || lower === 'canceled') return 'Cancelled';
      return s;
    };

    let result = normalizeResult(rawResult);

    // If server indicates a Winner but doesn't provide a winner symbol/id,
    // try to derive the winner from the authoritative board snapshot, if present.
    // Also detect full-board draws: if no winner is found on a full board,
    // treat the result as a Draw to avoid showing ambiguous fallback text.

    // Derive winner symbol from payload board if possible
    let derivedWinnerSymbol: string | null = payload.winnerSymbol ?? null;
    const boardSnapshot = payload.boardSnapshot ?? payload.BoardSnapshot ?? null;
    if (!derivedWinnerSymbol && boardSnapshot) {
      const normalizedBoard = normalizeBoard(boardSnapshot);
      const bw = checkWinner(normalizedBoard);
      if (bw) {
        derivedWinnerSymbol = bw;
      } else {
        // If board is full and no winner found, treat as draw
        if (isBoardFull(normalizedBoard) && result === 'Winner') {
          result = 'Draw';
        }
      }
    }
    const serverMessage =
      payload.message ?? payload.Message ?? (dto as any).message ?? (dto as any).Message ?? null;

    // Helper to detect obvious server-internal/debug messages that should not
    // be shown to end users. If a server message looks like an internal note
    // (for example: "Game won by move"), treat it as absent so we fall back
    // to friendly defaults.
    const isServerInternalMessage = (m: any): boolean => {
      if (!m || typeof m !== 'string') return false;
      const s = m.trim();
      if (s.length === 0) return false;
      // common internal phrases to filter
      const internalPhrases = [
        'game won by',
        'game won',
        'won by move',
        'won by',
        'move',
        'internal',
        'debug',
      ];
      const lower = s.toLowerCase();
      // If message is very short (<= 3 words) and contains one of the internal
      // tokens, consider it internal. Also filter if it starts with typical
      // server log prefixes.
      const words = lower.split(/\s+/).filter(Boolean);
      if (words.length <= 4) {
        for (const p of internalPhrases) if (lower.includes(p)) return true;
      }
      // Some servers send terse messages like "Game won by move" which are
      // better replaced by friendly UI text. Also ignore messages that look
      // like technical codes or JSON fragments.
      if (/^game\s+won\b/.test(lower)) return true;
      if (/won\s+by/.test(lower)) return true;
      if (/^{\s*"/.test(s)) return true;
      return false;
    };

    // We do not display raw server-provided GameOver messages to end users
    // (they may contain internal diagnostics). Always derive a friendly
    // title/message locally so the UI is consistent with local/AI games.
    const effectiveServerMessage = null;
    let modalType: ModalType = 'info';
    let title = 'Game ended';
    let message = effectiveServerMessage ?? '';

    // Derive modal type from the normalized result even when server provides
    // a custom message. This ensures the modal shows the correct icon/gradient
    // (win/loss/draw/forfeit) while still preferring any server-supplied text.
    if (result === 'Winner') {
      // Determine if this player won or lost. Prefer symbol comparison,
      // fall back to playerId comparison when available.
      const mySymbol = gameState.mySymbol();
      const winnerSymbol = payload.winnerSymbol as string | undefined | null;
      const winnerId = payload.winnerId as string | undefined | null;
      const myPlayerId = gameState.playerId();

      if (winnerSymbol && mySymbol) {
        modalType = mySymbol === winnerSymbol ? 'win' : 'loss';
      } else if (playerIdEquals(winnerId, myPlayerId)) {
        modalType = 'win';
      } else if (winnerId && myPlayerId) {
        modalType = 'loss';
      }
    } else if (result === 'Forfeit') {
      modalType = 'forfeit';
    } else if (result === 'Draw') {
      modalType = 'draw';
    } else if (result === 'Cancelled') {
      modalType = 'roomExpired';
    }

    // Only set default title/message when server did not provide one.
    if (!message) {
      if (result === 'Winner') {
        title = 'Game over';

        // If we can determine win/loss, show a friendly title/message.
        if (modalType === 'win') {
          title = 'You won!';
          message = 'Congratulations! You won the match.';
        } else if (modalType === 'loss') {
          title = 'You lost';
          message = 'Better luck next time!';
        } else {
          // Fallback if we can't determine a specific player winner.
          // Prefer any server-provided message, otherwise use a neutral
          // 'Match ended.' text instead of claiming there is a winner which
          // might be incorrect for ambiguous payloads.
          if ((dto as any).winnerId) message = `Winner: ${fmt((dto as any).winnerId)}`;
          else if (payload.winnerSymbol) message = `Winner: Player (${payload.winnerSymbol})`;
          else message = effectiveServerMessage ?? 'Match ended.';
        }
      } else if (result === 'Forfeit') {
        title = 'Player forfeited';
        if ((dto as any).forfeiterId) {
          message = `${fmt((dto as any).forfeiterId)} forfeited the match. Winner: ${
            (dto as any).winnerId
              ? fmt((dto as any).winnerId)
              : (dto as any).winnerSymbol
              ? `Player (${(dto as any).winnerSymbol})`
              : 'Unknown'
          }`;
        } else {
          message = `Match ended by forfeit. Winner: ${
            (dto as any).winnerId
              ? fmt((dto as any).winnerId)
              : (dto as any).winnerSymbol
              ? `Player (${(dto as any).winnerSymbol})`
              : 'Unknown'
          }`;
        }
      } else if (result === 'Draw') {
        title = 'Draw';
        message = 'Match ended in a draw.';
      } else if (result === 'Cancelled') {
        title = 'Match cancelled';
        message = 'Match cancelled or room expired.';
      } else {
        message = 'Match ended.';
      }
    }

    // Use the GameOverModalService to show the modal if provided
    if (gameOverModalService) {
      gameOverModalService.showOnlineGameOverModal({
        resultToken: result,
        winnerSymbol:
          typeof derivedWinnerSymbol !== 'undefined' && derivedWinnerSymbol !== null
            ? derivedWinnerSymbol
            : payload.winnerSymbol ?? null,
        winnerId: payload.winnerId ?? null,
        serverMessage: serverMessage ?? null,
        roomCode:
          payload.roomCode ?? payload.code ?? (dto as any).roomCode ?? (dto as any).code ?? null,
        boardSnapshot: payload.boardSnapshot ?? null,
      });
    }
  } catch (e) {
    console.warn('[SignalR.handlers] handleGameOver error', e);
  }
}
