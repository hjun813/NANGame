import { FighterSlot, GameState } from './enums';

export type RematchReady = Record<FighterSlot, boolean>;

export function createRematchReady(): RematchReady {
  return { [FighterSlot.LEFT]: false, [FighterSlot.RIGHT]: false };
}

export function registerRematchRequest(
  current: Readonly<RematchReady>,
  slot: FighterSlot | null,
  gameState: GameState,
): { ready: RematchReady; accepted: boolean; allReady: boolean } {
  const ready = { ...current };
  if (gameState !== GameState.FINISHED || slot === null || ready[slot]) {
    return { ready, accepted: false, allReady: false };
  }
  ready[slot] = true;
  return {
    ready,
    accepted: true,
    allReady: ready[FighterSlot.LEFT] && ready[FighterSlot.RIGHT],
  };
}
