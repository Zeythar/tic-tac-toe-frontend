import { GameStateService } from '../../game-state.service';
import {
  getStoredGameCode,
  getStoredPlayerId,
  setStoredGameCode,
  setStoredPlayerId,
} from '../../../utils/storage.util';
import { GameState, GameStateResult, RoomStateDto } from '../../../types/game.types';

export type SignalRServiceLike = {
  connection: any;
  handlersRegistered: boolean;
  registerEventHandlers: () => void;
  gameState: GameStateService;
  invoke: <T = any>(method: string, ...args: any[]) => Promise<T>;
  waitForSyncedState: (timeoutMs?: number) => Promise<GameState | null>;
  fetchGameState: (code: string, playerId?: string) => Promise<void>;
  attemptJoinGame: (code: string) => Promise<void>;
  pendingSyncedResolver?: ((s: GameState) => void) | null;
  pendingSyncedTimer?: any;
  lastSyncedAt?: number | null;
  // optional timers helper attached at runtime by SignalRService
  timers?: any;
};

export function createReconnectionHandlers(svc: SignalRServiceLike) {
  const registerReconnectionHandlers = () => {
    if (!svc.connection) return;

    svc.connection.onreconnected(async () => {
      console.log('[SignalR] Reconnected - attempting to restore session');

      let code = svc.gameState.gameCode();
      let pid = svc.gameState.playerId();

      const storedCode = getStoredGameCode();
      const storedPid = getStoredPlayerId();

      if (storedCode) code = storedCode;
      if (storedPid) pid = storedPid;

      console.debug('[SignalR] Reconnection - code:', code, 'playerId:', pid);

      if (code && pid) {
        await attemptReconnect(code, pid);
      } else if (code) {
        await svc.attemptJoinGame(code);
      }
    });
  };

  const attemptReconnect = async (code: string, playerId: string): Promise<void> => {
    try {
      if (!svc.handlersRegistered) {
        try {
          svc.registerEventHandlers();
        } catch (e) {
          // ignore
        }
      }

      console.debug('[SignalR] Attempting Reconnect(', code, ',', playerId, ')');
      const res = await svc.invoke<GameStateResult>('Reconnect', code, playerId);
      console.debug('[SignalR] Reconnect result:', res);

      const reconnectSucceeded =
        (typeof res === 'boolean' && res === true) ||
        (res && typeof res === 'object' && (res as any).success !== false);

      if (!reconnectSucceeded) {
        console.debug('[SignalR] Reconnect reported failure, falling back to JoinGame');
        await svc.attemptJoinGame(code);
        return;
      }

      try {
        if (code) {
          svc.gameState.setGameCode(code);
          try {
            setStoredGameCode(code);
          } catch (e) {
            /* ignore */
          }
        }
        if (playerId) {
          svc.gameState.setPlayerId(playerId);
          try {
            setStoredPlayerId(playerId);
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        /* ignore */
      }

      const asState = res as GameStateResult | null;
      const hasStatePayload =
        asState &&
        (Array.isArray(asState.board) ||
          typeof asState.symbol !== 'undefined' ||
          typeof asState.currentTurn !== 'undefined' ||
          typeof asState.isGameOver !== 'undefined' ||
          typeof asState.winner !== 'undefined');

      if (hasStatePayload) {
        try {
          const state: GameState = {
            board: asState.board as Array<string | null> | undefined,
            currentTurn: asState.currentTurn ?? undefined,
            isOver:
              typeof asState.isGameOver !== 'undefined' ? Boolean(asState.isGameOver) : undefined,
            winner: asState.winner ?? undefined,
            mySymbol: asState.symbol ?? undefined,
          };

          svc.gameState.updateGameState(state);

          const returnedCode = asState?.code ?? null;
          const returnedPid = asState?.playerId ?? null;
          if (returnedCode) {
            svc.gameState.setGameCode(returnedCode);
            try {
              setStoredGameCode(returnedCode);
            } catch (e) {
              /* ignore */
            }
          }
          if (returnedPid) {
            svc.gameState.setPlayerId(returnedPid);
            try {
              setStoredPlayerId(returnedPid);
            } catch (e) {
              /* ignore */
            }
          }

          svc.gameState.setDisconnectedPlayerId(null);
          svc.gameState.setCountdownSeconds(null);
          svc.gameState.setOpponentPresent(true);

          svc.lastSyncedAt = Date.now();

          if (svc.pendingSyncedResolver) {
            try {
              svc.pendingSyncedResolver(state as GameState);
            } catch (e) {
              /* ignore */
            }
            svc.pendingSyncedResolver = null;
          }
          if (svc.pendingSyncedTimer) {
            clearTimeout(svc.pendingSyncedTimer);
            svc.pendingSyncedTimer = null;
          }

          console.debug('[SignalR] Applied authoritative state from Reconnect RPC');
          return;
        } catch (e) {
          console.warn('[SignalR] Failed to apply Reconnect state payload, will fallback', e);
        }
      }

      const synced = await svc.waitForSyncedState(1200);
      if (synced) {
        console.debug('[SignalR] SyncedState received after Reconnect');
      } else {
        console.debug('[SignalR] SyncedState did not arrive, fetching state via GetRoomState');
        // Prefer GetRoomState for accurate reconnection countdown data
        try {
          const resp = await svc.invoke<any>('GetRoomState', code, playerId);
          console.debug('[SignalR] GetRoomState result:', resp);

          if (resp && typeof resp === 'object' && resp.success === true && resp.payload) {
            const room = resp.payload as RoomStateDto & any;

            // Apply basic game state if present
            try {
              if (svc.gameState && typeof svc.gameState.updateGameState === 'function') {
                const possibleState = (room as any).state ?? room;
                svc.gameState.updateGameState(possibleState as any);
              }
            } catch (e) {
              /* ignore */
            }

            // Store code/playerId if returned
            try {
              const returnedCode = (room as any)?.code ?? null;
              const returnedPid = (room as any)?.playerId ?? null;
              if (returnedCode) {
                svc.gameState.setGameCode(returnedCode);
                try {
                  setStoredGameCode(returnedCode);
                } catch (e) {
                  /* ignore */
                }
              }
              if (returnedPid) {
                svc.gameState.setPlayerId(returnedPid);
                try {
                  setStoredPlayerId(returnedPid);
                } catch (e) {
                  /* ignore */
                }
              }
            } catch (e) {
              /* ignore */
            }

            // Map convenience opponent flags
            try {
              if (typeof (room as any).opponentPresent !== 'undefined') {
                svc.gameState.setOpponentPresent(Boolean((room as any).opponentPresent));
              }
              if (typeof (room as any).opponentConnected !== 'undefined') {
                // Keep the presence flag in sync; UI can read opponentConnected from
                // the payload when needed. If you want a separate signal, add it to GameStateService.
                svc.gameState.setOpponentPresent(Boolean((room as any).opponentPresent));
              }
              if (typeof (room as any).disconnectedPlayerId !== 'undefined') {
                svc.gameState.setDisconnectedPlayerId((room as any).disconnectedPlayerId ?? null);
              }
            } catch (e) {
              /* ignore */
            }

            // If server provides disconnectedPlayers with remainingReconnectionSeconds,
            // map the value to the GameState countdown and timers.
            try {
              const disconnected = (room as any)?.disconnectedPlayers as Array<any> | undefined;
              if (Array.isArray(disconnected) && disconnected.length > 0) {
                const match = disconnected.find((d) => d?.playerId === playerId) ?? disconnected[0];
                const remaining = Number(match?.remainingReconnectionSeconds ?? null);
                if (!Number.isNaN(remaining) && remaining > 0) {
                  try {
                    svc.gameState.setCountdownSeconds(remaining);
                    // If timers helper exists, show countdown using opponent tick (or add a dedicated API)
                    if (svc.timers && typeof svc.timers.onOpponentTurnTick === 'function') {
                      try {
                        svc.timers.onOpponentTurnTick(remaining);
                      } catch (e) {
                        /* ignore */
                      }
                    }
                  } catch (e) {
                    /* ignore */
                  }
                }
              }
            } catch (e) {
              /* ignore */
            }

            // Mark that we applied a synced state
            svc.lastSyncedAt = Date.now();

            if (svc.pendingSyncedResolver) {
              try {
                svc.pendingSyncedResolver(room as any as GameState);
              } catch (e) {
                /* ignore */
              }
              svc.pendingSyncedResolver = null;
            }
            if (svc.pendingSyncedTimer) {
              clearTimeout(svc.pendingSyncedTimer);
              svc.pendingSyncedTimer = null;
            }

            console.debug('[SignalR] Applied authoritative state from GetRoomState');
            return;
          }
        } catch (e) {
          console.debug('[SignalR] GetRoomState failed, falling back to GetGameState', e);
          try {
            await svc.fetchGameState(code, playerId);
          } catch (ee) {
            /* ignore */
          }
        }
      }
    } catch (e) {
      console.warn('[SignalR] Reconnect failed, trying JoinGame fallback', e);
      await svc.attemptJoinGame(code);
    }
  };

  const attemptAutoReconnect = async () => {
    const storedCode = getStoredGameCode();
    const storedPid = getStoredPlayerId();

    if (!storedCode) return;

    // Skip auto-reconnect if on share screen (creator hasn't joined yet)
    try {
      const path = typeof window !== 'undefined' ? window.location?.pathname : null;
      if (path) {
        const m = path.match(/^\/room\/([^\/]+)\/?$/i);
        if (m && m[1]) {
          const urlCode = decodeURIComponent(m[1]);
          if (urlCode === storedCode) {
            console.debug(
              '[SignalR] Skipping auto-reconnect - on share screen for room',
              storedCode
            );
            return;
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }

    // Only reconnect if we have both code and playerId (previously joined player)
    if (!storedPid) {
      console.debug('[SignalR] Skipping auto-reconnect - no playerId (creator on share screen)');
      return;
    }

    console.debug('[SignalR] Auto-reconnect - code:', storedCode, 'playerId:', storedPid);

    if (storedCode && storedPid) {
      await attemptReconnect(storedCode, storedPid);
    } else if (storedCode) {
      await svc.attemptJoinGame(storedCode);
    }
  };

  return {
    registerReconnectionHandlers,
    attemptReconnect,
    attemptAutoReconnect,
  };
}
