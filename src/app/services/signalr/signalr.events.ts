import * as signalR from '@microsoft/signalr';
import { GameStateService } from '../game-state.service';
import { GameOverModalService } from '../game-over-modal.service';
import { ModalService } from '../modal.service';
import { SignalRTimers } from './signalr-helpers/timer.adapter';
import { handleGameOver } from './signalr-helpers/game-over.handler';
import { GameState, GameStateResult, GameOverDto, RoomStateDto } from '../../types/game.types';
import { ErrorLoggingService } from '../error-handling/error-logging.service';
import { ErrorRecoveryService } from '../error-handling/error-recovery.service';
import { TURN_DURATION_SECONDS } from '../../constants/game.constants';
import {
  getStoredGameCode,
  getStoredPlayerId,
  setStoredGameCode,
  setStoredPlayerId,
  clearStoredGameSession,
} from '../../utils/storage.util';
import { normalizeBoard, createEmptyBoard } from '../../utils/board-normalization.util';
import { playerIdEquals } from '../../utils/player-id.util';
import { calculateRemainingSeconds, computeRemainingLegacy } from '../../utils/time-sync.util';

export type EventHelpers = {
  connection: signalR.HubConnection;
  gameState: GameStateService;
  modalService: ModalService;
  timers: SignalRTimers;
  errorLog: ErrorLoggingService;
  errorRecovery: ErrorRecoveryService;
  invoke: <T = any>(method: string, ...args: any[]) => Promise<T>;
  fetchGameState: (code: string, playerId?: string) => Promise<void>;
  attemptJoinGame: (code: string) => Promise<void>;
  registerEventHandlers?: () => void; // optional backref
  onSyncedStateArrived?: (state: GameState) => void;
  // optional hook to dedupe GameOver events (return true to ignore)
  shouldIgnoreGameOver?: (dto: GameOverDto) => boolean;
  // optional hook called after a GameOver has been applied by owner RPC handling
  onGameOverApplied?: (dto: GameOverDto) => void;
  // optional game over modal service for displaying modals
  gameOverModalService?: GameOverModalService;
};

export function registerSignalREvents(helpers: EventHelpers) {
  const { connection, gameState, modalService, timers, errorLog, errorRecovery } = helpers;
  // defensive: ensure off() is available
  try {
    connection.off('BoardUpdated');
    connection.off('GameCreated');
    connection.off('GameJoined');
    connection.off('GameStarted');
    connection.off('GameFull');
    connection.off('PlayerJoined');
    connection.off('PlayerLeft');
    connection.off('CountdownTick');
    connection.off('TurnCountdownTick');
    connection.off('TurnCountdownResumed');
    connection.off('TurnCountdownPaused');
    connection.off('PlayerReconnected');
    connection.off('GameOver');
    connection.off('SyncedState');
  } catch (e) {
    errorRecovery.recoverSilently(e, 'Deregistering event handlers');
  }

  connection.on(
    'BoardUpdated',
    (
      board: Array<string | null>,
      current: string | null,
      isOver: boolean,
      winnerName: string | null,
      // optional precise timer info (may be present depending on backend)
      turnExpiry?: string | null,
      serverTimestamp?: string | null,
      // optional fallback remaining seconds
      remainingSeconds?: number
    ) => {
      // capture previous turn symbol so we can detect a turn change
      const prevCurrent = gameState.currentTurn();

      const boardVal = board ?? createEmptyBoard();
      gameState.setBoard(boardVal);
      gameState.setCurrentTurn(current ?? null);
      gameState.setIsGameOver(Boolean(isOver));
      gameState.setWinner(winnerName ?? null);
      if (isOver) {
        try {
          gameState.clearTurnCountdowns();
        } catch (e) {
          errorRecovery.recoverSilently(e, 'BoardUpdated: clearTurnCountdowns');
        }
        try {
          timers.clearTickTimers();
        } catch (e) {
          errorRecovery.recoverSilently(e, 'BoardUpdated: clearTickTimers');
        }
        // Preserve session for rematch flows; cleared when rematch window expires
      }

      // When turn changes after a move, immediately reset and start the
      // appropriate per-turn timer for instant UI feedback.
      try {
        if (prevCurrent !== (current ?? null)) {
          gameState.clearTurnCountdowns();
          timers.clearTickTimers();

          // Calculate remaining seconds using server timestamp if available
          let startSecs: number | null = null;
          if (serverTimestamp && turnExpiry) {
            startSecs = calculateRemainingSeconds(
              turnExpiry,
              serverTimestamp,
              Number(remainingSeconds ?? 0)
            );
          }

          if ((startSecs == null || startSecs <= 0) && typeof remainingSeconds !== 'undefined') {
            startSecs = computeRemainingLegacy(remainingSeconds);
          }

          const DEFAULT_TURN_SECONDS = TURN_DURATION_SECONDS;
          if (startSecs == null || startSecs <= 0) startSecs = DEFAULT_TURN_SECONDS;

          const mySym = gameState.mySymbol();
          if (mySym && current && mySym === current) {
            timers.onMyTurnTick(startSecs);
          } else {
            timers.onOpponentTurnTick(startSecs);
          }
        }
      } catch (e) {
        errorLog.logWarning(e, {
          source: 'SignalR.events',
          operation: 'BoardUpdated timer reset',
          metadata: { turnChanged: prevCurrent !== (current ?? null) },
        });
      }
    }
  );

  connection.on('GameCreated', (code: string, board: Array<string | null>, playerId?: string) => {
    gameState.setGameCode(code);
    gameState.setBoard(board ?? createEmptyBoard());
    gameState.setMySymbol(null);
    gameState.setCurrentTurn(null);
    gameState.setIsGameOver(false);
    gameState.setWinner(null);
    gameState.setJoinError(null);
    gameState.setOpponentPresent(false);
    if (gameState.blockedGameCode() === code) {
      gameState.setBlockedGameCode(null);
    }
    if (code) setStoredGameCode(code);
    if (playerId) {
      gameState.setPlayerId(playerId);
      setStoredPlayerId(playerId);
    }
  });

  connection.on(
    'GameJoined',
    (
      code: string,
      board: Array<string | null>,
      symbol: string,
      current: string | null,
      playerId?: string
    ) => {
      gameState.setGameCode(code);
      gameState.setBoard(board ?? createEmptyBoard());
      gameState.setMySymbol(symbol);
      gameState.setCurrentTurn(current ?? null);
      gameState.setJoinError(null);
      gameState.setOpponentPresent(true);
      if (playerId) gameState.setPlayerId(playerId);
      if (gameState.blockedGameCode() === code) gameState.setBlockedGameCode(null);
      if (code) setStoredGameCode(code);
      if (playerId) setStoredPlayerId(playerId);
    }
  );

  connection.on(
    'GameStarted',
    async (board?: Array<string | null>, currentTurn?: string | null) => {
      try {
        // Initialize turn countdown to 30s BEFORE clearing
        // This ensures we never show 0s to the user
        try {
          // If currentTurn is provided in the event, use it to determine whose turn
          if (currentTurn) {
            const mySymbol = gameState.mySymbol();
            if (mySymbol) {
              const isMyTurn = currentTurn === mySymbol;
              if (isMyTurn) {
                gameState.setMyTurnCountdown(TURN_DURATION_SECONDS);
                gameState.setOpponentTurnCountdown(null);
              } else {
                gameState.setMyTurnCountdown(null);
                gameState.setOpponentTurnCountdown(TURN_DURATION_SECONDS);
              }
            } else {
              // Don't know mySymbol yet, default to showing 30s for whoever starts (usually X)
              if (currentTurn === 'X') {
                gameState.setMyTurnCountdown(TURN_DURATION_SECONDS);
              } else {
                gameState.setOpponentTurnCountdown(TURN_DURATION_SECONDS);
              }
            }
            console.debug('[SignalR.events] GameStarted - pre-initialized countdown to 30s');
          }
        } catch (e) {
          errorRecovery.recoverSilently(e, 'GameStarted: countdown pre-init');
        }

        // Clear tick timers (but we already set the countdown values above)
        try {
          timers.clearTickTimers();
        } catch (e) {
          errorRecovery.recoverSilently(e, 'GameStarted: clearTickTimers');
        }

        // Ensure opponent presence is set (host sees the second player joined)
        try {
          gameState.setOpponentPresent(true);
        } catch (e) {
          errorRecovery.recoverSilently(e, 'GameStarted: setOpponentPresent');
        }

        // If creator hasn't joined yet, join now that the game is starting
        const code = gameState.gameCode() ?? getStoredGameCode();
        let pid = gameState.playerId() ?? getStoredPlayerId();

        if (code && !pid && helpers.invoke) {
          try {
            console.debug('[SignalR.events] GameStarted - creator joining room', code);
            const joinRes = await helpers.invoke<any>('JoinGame', code, undefined);
            if (joinRes?.success && joinRes.payload?.playerId) {
              pid = joinRes.payload.playerId;
              gameState.setPlayerId(pid);
              if (pid) {
                try {
                  const { setStoredPlayerId } = await import('../../utils/storage.util');
                  setStoredPlayerId(pid);
                } catch (e) {
                  errorRecovery.recoverSilently(e, 'GameStarted: setStoredPlayerId');
                }
              }
              console.debug('[SignalR.events] Creator joined with playerId:', pid);
            }
          } catch (e) {
            errorLog.logWarning(e, {
              source: 'SignalR.events',
              operation: 'GameStarted: Creator failed to join',
              userMessage: 'Failed to join game after creation',
            });
          }
        }

        // Fetch authoritative state from server (symbols, current turn, fresh board, timers)
        if (code && helpers.fetchGameState) {
          await helpers.fetchGameState(code, pid ?? undefined);
        } else if (Array.isArray(board)) {
          // Fallback: apply minimal info if fetchGameState not available
          gameState.setBoard(board ?? createEmptyBoard());
          gameState.setCurrentTurn(currentTurn ?? null);
          gameState.setIsGameOver(false);
          gameState.setWinner(null);
        }
      } catch (e) {
        errorLog.logError(e, {
          source: 'SignalR.events',
          operation: 'GameStarted handler',
          userMessage: 'Failed to process game start',
        });
      }
    }
  );

  connection.on('GameFull', (code: string) => {
    gameState.setBlockedGameCode(code);
    if (gameState.codeValue() === code) {
      gameState.setJoinError(
        'Room is full — please ask creator for a new code or try a different code.'
      );
    }
  });

  connection.on('PlayerJoined', async () => {
    gameState.setOpponentPresent(true);
    const code = gameState.gameCode() ?? getStoredGameCode();
    const mySym = gameState.mySymbol();
    const current = gameState.currentTurn();
    if (code && (!mySym || !current)) {
      try {
        const pid = gameState.playerId() ?? getStoredPlayerId();
        await helpers.fetchGameState(code, pid ?? undefined);
      } catch (e) {
        /* ignore */
      }
    }
  });

  connection.on('PlayerLeft', (playerId: string) => {
    console.debug('[SignalR.events] PlayerLeft received:', playerId);
    gameState.setDisconnectedPlayerId(playerId);
    gameState.setCountdownSeconds(null);
    gameState.setOpponentPresent(false);

    // DON'T clear turn countdowns - let TurnCountdownPaused set the frozen value
    // Just stop the tick timers so they don't keep updating
    console.debug('[SignalR.events] PlayerLeft - clearing tick timers only (not countdown values)');
    try {
      timers.clearTickTimers();
    } catch (e) {
      /* ignore */
    }
  });

  connection.on('CountdownTick', (playerId: string, secondsLeft: number) => {
    if (gameState.disconnectedPlayerId() === playerId) {
      gameState.setCountdownSeconds(Number(secondsLeft ?? 0));
    }
  });

  connection.on(
    'TurnCountdownTick',
    (
      playerId: string,
      remainingSeconds: number,
      turnExpiry?: string | null,
      serverTimestamp?: string | null
    ) => {
      try {
        const localPid = gameState.playerId();

        // NEW: If opponent is disconnected, ignore tick events
        // The timer should stay frozen at the paused value
        const disconnectedPid = gameState.disconnectedPlayerId();
        if (disconnectedPid && !playerIdEquals(disconnectedPid, localPid)) {
          // Opponent is disconnected, timer should be frozen
          return;
        }

        // Use server timestamp if provided for precise time sync, otherwise fall back to legacy logic
        const secs =
          serverTimestamp && turnExpiry
            ? calculateRemainingSeconds(turnExpiry, serverTimestamp, remainingSeconds)
            : computeRemainingLegacy(remainingSeconds);

        if (secs <= 0) {
          // Immediately clear timers and show a provisional forfeit modal while
          // waiting for an authoritative GameOver from the server.
          try {
            timers.clearTickTimers();
          } catch (e) {
            errorRecovery.recoverSilently(e, 'TurnCountdownTick: clearTickTimers on expiry');
          }
          try {
            const isLocal = playerIdEquals(playerId, localPid);
            const title = 'Turn expired';
            const message = isLocal
              ? 'Your turn expired — the match may be forfeited. Waiting for the server to confirm.'
              : "Opponent's turn expired — the match may be forfeited. Waiting for the server to confirm.";
            modalService.showForfeit(title, message, gameState.gameCode() ?? undefined);
          } catch (e) {
            errorRecovery.recoverSilently(e, 'TurnCountdownTick: show forfeit modal');
          }
          return;
        }

        if (playerIdEquals(playerId, localPid)) {
          timers.onMyTurnTick(secs);
        } else {
          timers.onOpponentTurnTick(secs);
        }
      } catch (e) {
        errorLog.logWarning(e, {
          source: 'SignalR.events',
          operation: 'TurnCountdownTick handler',
          metadata: { playerId, remainingSeconds },
        });
      }
    }
  );

  connection.on(
    'TurnCountdownResumed',
    (
      playerId: string,
      remainingSeconds: number,
      turnExpiry?: string | null,
      serverTimestamp?: string | null
    ) => {
      try {
        const secs =
          serverTimestamp && turnExpiry
            ? calculateRemainingSeconds(turnExpiry, serverTimestamp, remainingSeconds)
            : computeRemainingLegacy(remainingSeconds);

        const localPid = gameState.playerId();

        if (secs <= 0) {
          try {
            timers.clearTickTimers();
          } catch (e) {
            errorRecovery.recoverSilently(e, 'TurnCountdownResumed: clearTickTimers on expiry');
          }
          try {
            const isLocal = playerIdEquals(playerId, localPid);
            const title = 'Turn expired';
            const message = isLocal
              ? 'Your turn expired — the match may be forfeited. Waiting for the server to confirm.'
              : "Opponent's turn expired — the match may be forfeited. Waiting for the server to confirm.";
            modalService.showForfeit(title, message, gameState.gameCode() ?? undefined);
          } catch (e) {
            errorRecovery.recoverSilently(e, 'TurnCountdownResumed: show forfeit modal');
          }
          return;
        }

        if (playerIdEquals(playerId, localPid)) timers.onTurnCountdownResumed(true, secs);
        else timers.onTurnCountdownResumed(false, secs);
      } catch (e) {
        errorLog.logWarning(e, {
          source: 'SignalR.events',
          operation: 'TurnCountdownResumed handler',
          metadata: { playerId, remainingSeconds },
        });
      }
    }
  );

  connection.on(
    'TurnCountdownPaused',
    (
      playerId: string,
      remainingSeconds: number,
      turnExpiry?: string | null,
      serverTimestamp?: string | null
    ) => {
      try {
        console.debug('[SignalR.events] TurnCountdownPaused received:', {
          playerId,
          remainingSeconds,
          turnExpiry,
          serverTimestamp,
        });

        // Use server timestamp if provided for precise time sync, otherwise fall back to remaining seconds
        const secs =
          serverTimestamp && turnExpiry
            ? calculateRemainingSeconds(turnExpiry, serverTimestamp, remainingSeconds)
            : Number(remainingSeconds ?? 0);

        console.debug('[SignalR.events] TurnCountdownPaused - freezing at:', secs, 'seconds');

        const localPid = gameState.playerId();
        if (playerIdEquals(playerId, localPid)) {
          console.debug('[SignalR.events] Pausing MY turn countdown at', secs);
          timers.onTurnCountdownPaused(true, secs);
        } else {
          console.debug('[SignalR.events] Pausing OPPONENT turn countdown at', secs);
          timers.onTurnCountdownPaused(false, secs);
        }
      } catch (e) {
        errorLog.logWarning(e, {
          source: 'SignalR.events',
          operation: 'TurnCountdownPaused handler',
          metadata: { playerId, remainingSeconds },
        });
      }
    }
  );

  connection.on('PlayerReconnected', (playerId: string) => {
    if (playerIdEquals(gameState.disconnectedPlayerId(), playerId)) {
      gameState.setDisconnectedPlayerId(null);
      gameState.setCountdownSeconds(null);
      gameState.setOpponentPresent(true);
      try {
        gameState.clearTurnCountdowns();
      } catch (e) {
        /* ignore */
      }
      try {
        timers.clearTickTimers();
      } catch (e) {
        /* ignore */
      }
    }
  });

  // Rematch flow events from server
  connection.on(
    'RematchWindowStarted',
    (expiry?: string | null, serverTimestamp?: string | null, remainingSeconds?: number) => {
      try {
        const secs =
          serverTimestamp && expiry
            ? calculateRemainingSeconds(expiry, serverTimestamp, Number(remainingSeconds ?? 0))
            : computeRemainingLegacy(remainingSeconds ?? 0);

        // Merge rematch countdown into existing game-over modal if present
        if (gameState.isGameOver() && modalService.isGameOverModal()) {
          modalService.updateRematchState({
            offeredByOpponent: false,
            remainingSeconds: secs,
          });
        }
      } catch (e) {
        /* ignore */
      }
    }
  );

  connection.on('RematchOffered', (offeredByPlayerId?: string) => {
    try {
      // Show rematch controls in game-over modal when game has ended
      if (gameState.isGameOver() && modalService.isGameOverModal()) {
        const localPid = gameState.playerId() ?? null;

        if (offeredByPlayerId) {
          if (playerIdEquals(offeredByPlayerId, localPid)) {
            modalService.updateRematchState({
              rematchOfferedByMe: true,
              offeredByOpponent: false,
            });
          } else {
            modalService.updateRematchState({
              offeredByOpponent: true,
              rematchOfferedByMe: false,
            });
          }
        } else {
          // Server didn't provide ID - determine sender based on existing state
          const cur = modalService.getCurrent();
          const alreadyOfferedByMe = Boolean(cur?.rematchOfferedByMe);
          if (alreadyOfferedByMe) {
            modalService.updateRematchState({
              rematchOfferedByMe: true,
              offeredByOpponent: false,
            });
          } else {
            modalService.updateRematchState({
              offeredByOpponent: true,
              rematchOfferedByMe: false,
            });
          }
        }
      }
    } catch (e) {
      /* ignore */
    }
  });

  connection.on('RematchStarted', async () => {
    try {
      // Server has started the rematch. Reset local rematch UI state and
      // prepare timers before fetching authoritative game state.
      try {
        modalService.dismiss();
      } catch (e) {
        /* ignore */
      }

      // Clear countdowns and timers for clean rematch start
      try {
        gameState.clearTurnCountdowns();
      } catch (e) {
        /* ignore */
      }
      try {
        timers.clearTickTimers();
      } catch (e) {
        /* ignore */
      }

      // Reset UI state while fetching authoritative game state
      try {
        gameState.setIsGameOver(false);
      } catch (e) {
        /* ignore */
      }
      try {
        gameState.setWinner(null);
      } catch (e) {
        /* ignore */
      }
      try {
        gameState.setBoard(createEmptyBoard());
      } catch (e) {
        /* ignore */
      }
      // Ensure opponent presence and clear any disconnected countdown UI so
      // the rematch UI does not show an 'opponent left' banner while the
      // authoritative state is being fetched.
      try {
        gameState.setOpponentPresent(true);
      } catch (e) {
        /* ignore */
      }
      try {
        gameState.setDisconnectedPlayerId(null);
      } catch (e) {
        /* ignore */
      }
      try {
        gameState.setCountdownSeconds(null);
      } catch (e) {
        /* ignore */
      }

      // Fetch authoritative room state (GetGameState) so we receive new symbols,
      // cleaned board and current turn. Pass playerId when available so server
      // can map reconnect/assignment if necessary.
      try {
        const code = gameState.gameCode() ?? null;
        const pid = gameState.playerId() ?? undefined;
        if (code && helpers.fetchGameState) await helpers.fetchGameState(code, pid);
        // After this call, SyncedState/TurnCountdownTick handlers will run and
        // the UI timers will be started based on the server-provided timer.
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      errorLog.logWarning(e, {
        source: 'SignalR.events',
        operation: 'RematchStarted handler',
      });
    }
  });

  connection.on('RematchWindowExpired', () => {
    try {
      // Clear rematch metadata from game-over modal if present
      if (gameState.isGameOver() && modalService.isGameOverModal()) {
        modalService.updateRematchState({
          offeredByOpponent: undefined,
          remainingSeconds: null,
          rematchOfferedByMe: false,
        });
      }

      // Clear timers and stored session data
      try {
        gameState.clearTurnCountdowns();
      } catch (e) {
        /* ignore */
      }
      try {
        timers.clearTickTimers();
      } catch (e) {
        /* ignore */
      }
      try {
        clearStoredGameSession();
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      errorLog.logWarning(e, {
        source: 'SignalR.events',
        operation: 'RematchWindowExpired handler',
      });
    }
  });

  connection.on('RematchCancelled', () => {
    try {
      if (gameState.isGameOver() && modalService.isGameOverModal()) {
        modalService.updateRematchState({
          rematchCancelled: true,
          rematchOfferedByMe: false,
          offeredByOpponent: false,
          remainingSeconds: null,
        });
      }

      // Clear timers and session data
      try {
        gameState.clearTurnCountdowns();
      } catch (e) {
        /* ignore */
      }
      try {
        timers.clearTickTimers();
      } catch (e) {
        /* ignore */
      }
      try {
        clearStoredGameSession();
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      console.warn('[SignalR.events] RematchCancelled handler error', e);
    }
  });

  connection.on('GameOver', (dto: GameOverDto) => {
    try {
      if (helpers.shouldIgnoreGameOver && helpers.shouldIgnoreGameOver(dto)) {
        // ignore duplicated GameOver that was already applied by caller RPC
        return;
      }
      handleGameOver(dto, gameState, timers.clearTickTimers, helpers.gameOverModalService);
      try {
        if (helpers.onGameOverApplied) helpers.onGameOverApplied(dto);
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      errorLog.logError(e, {
        source: 'SignalR.events',
        operation: 'GameOver handler',
        userMessage: 'Failed to process game over event',
      });
    }
  });

  connection.on('SyncedState', (state: RoomStateDto) => {
    try {
      if (!state) return;

      // Normalize board using centralized utility
      const incomingBoard = state.board;
      const board = Array.isArray(incomingBoard)
        ? normalizeBoard(incomingBoard)
        : createEmptyBoard();

      const mySymbol = state.mySymbol ?? state.mySymbol ?? null;
      const currentTurn = state.currentTurn ?? null;
      const isOver = typeof state.isOver !== 'undefined' ? Boolean(state.isOver) : false;
      const winner = state.winner ?? null;

      gameState.setBoard(board);
      gameState.setMySymbol(mySymbol);
      gameState.setCurrentTurn(currentTurn);
      gameState.setIsGameOver(isOver);
      gameState.setWinner(winner);

      const code = state.code ?? null;
      const playerId = state.playerId ?? null;
      if (code) {
        gameState.setGameCode(code);
        try {
          setStoredGameCode(code);
        } catch (e) {
          /* ignore */
        }
      }
      if (playerId) {
        gameState.setPlayerId(playerId);
        try {
          setStoredPlayerId(playerId);
        } catch (e) {
          /* ignore */
        }
      }

      // Preserve stored session here (do not clear on synced state game-over)

      gameState.setDisconnectedPlayerId(null);
      gameState.setCountdownSeconds(null);
      try {
        gameState.clearTurnCountdowns();
      } catch (e) {
        /* ignore */
      }
      try {
        timers.clearTickTimers();
      } catch (e) {
        /* ignore */
      }

      gameState.setOpponentPresent(true);

      // notify the outer SignalRService that a SyncedState arrived so it can
      // resolve any waiters and notify registered callbacks.
      try {
        if (helpers.onSyncedStateArrived) helpers.onSyncedStateArrived(state);
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      errorLog.logError(e, {
        source: 'SignalR.events',
        operation: 'SyncedState handler',
        userMessage: 'Failed to sync game state',
      });
    }
  });
}
