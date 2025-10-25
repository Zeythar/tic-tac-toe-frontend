import { playerIdEquals } from './player-id.util';
import { ModalType } from '../types/modal.types';

export function buildGameOverModal(opts: {
  resultToken: string | null;
  winnerSymbol?: string | null;
  winnerId?: string | null;
  mySymbol?: string | null;
  myPlayerId?: string | null;
  serverMessage?: string | null; // ignored for user-facing text
  roomCode?: string | null;
}): { type: ModalType; title: string; message: string; code?: string | null } {
  const { resultToken, winnerSymbol, winnerId, mySymbol, myPlayerId, roomCode } = opts;

  // Normalize token
  const token = typeof resultToken === 'string' ? resultToken : String(resultToken ?? '').trim();
  let modalType: ModalType = 'info';
  if (token === 'Winner') modalType = 'info'; // decide based on winner data below
  if (token === 'Forfeit') modalType = 'forfeit';
  if (token === 'Draw') modalType = 'draw';
  if (token === 'Cancelled') modalType = 'roomExpired';

  // If result is Winner, determine win/loss relative to local player
  if (token === 'Winner') {
    if (winnerSymbol && mySymbol) {
      modalType = mySymbol === winnerSymbol ? 'win' : 'loss';
    } else if (playerIdEquals(winnerId, myPlayerId)) {
      modalType = 'win';
    } else if (winnerId && myPlayerId) {
      modalType = 'loss';
    } else {
      // unknown which side won — default to info so title falls back to neutral
      modalType = 'info';
    }
  }

  // Build title/message using the same friendly defaults used elsewhere
  let title = 'Game ended';
  let message = '';
  if (modalType === 'win') {
    title = 'You won!';
    message = 'Congratulations! You won the match.';
  } else if (modalType === 'loss') {
    title = 'You lost';
    message = 'Better luck next time!';
  } else if (modalType === 'draw') {
    title = 'Draw';
    message = 'Match ended in a draw.';
  } else if (modalType === 'forfeit') {
    title = 'Player forfeited';
    message = 'Match ended by forfeit.';
  } else if (modalType === 'roomExpired') {
    title = 'Match cancelled';
    message = 'Match cancelled or room expired.';
  } else {
    title = 'Game ended';
    message = 'Match ended.';
  }

  return { type: modalType, title, message, code: roomCode ?? null };
}
