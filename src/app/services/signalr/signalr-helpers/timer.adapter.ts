import { TurnTimerService } from '../../turn-timer.service';

export type ClearTicksFn = () => void;

export type SignalRTimers = {
  clearTickTimers: ClearTicksFn;
  onMyTurnTick: (secs: number) => void;
  onOpponentTurnTick: (secs: number) => void;
  onTurnCountdownPaused: (isLocal: boolean, secs: number) => void;
  onTurnCountdownResumed: (isLocal: boolean, secs: number) => void;
};

/**
 * Create SignalR timer helpers that delegate to TurnTimerService.
 * This maintains backward compatibility while using the unified timer service.
 */
export function createSignalRTimers(
  turnTimerService: TurnTimerService,
  opts?: { tickTimeoutMs?: number; maxTurnSeconds?: number }
): SignalRTimers {
  // Options are now ignored since TurnTimerService has its own config
  // This maintains the function signature for compatibility

  return {
    clearTickTimers: () => turnTimerService.clearOnlineTimers(),
    onMyTurnTick: (secs: number) => turnTimerService.setMyTurnTick(secs),
    onOpponentTurnTick: (secs: number) => turnTimerService.setOpponentTurnTick(secs),
    onTurnCountdownPaused: (isLocal: boolean, secs: number) =>
      turnTimerService.pauseTurnCountdown(isLocal, secs),
    onTurnCountdownResumed: (isLocal: boolean, secs: number) =>
      turnTimerService.resumeTurnCountdown(isLocal, secs),
  };
}
