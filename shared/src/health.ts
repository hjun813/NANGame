import { GAME_CONFIG } from './constants';
import { FighterSlot, FighterState, LinkState, MatchResult, Team } from './enums';

export interface HealthFighterState {
  id: string;
  team: Team;
  slot: FighterSlot;
  hp: number;
  state: FighterState;
}

export interface TeamHealthEvaluation {
  playerLinkState: LinkState;
  enemyLinkState: LinkState;
  result: MatchResult;
}

export interface DamageResult {
  applied: boolean;
  becameDown: boolean;
  fighter: HealthFighterState;
}

export interface CombatDamageMessage {
  hits: Array<{ fighterId: string; damage: number }>;
}

export interface CombatStateSnapshot extends TeamHealthEvaluation {
  revision: number;
  fighters: HealthFighterState[];
}

export function createHealthFighter(
  id: string,
  team: Team,
  slot: FighterSlot,
): HealthFighterState {
  return {
    id,
    team,
    slot,
    hp: GAME_CONFIG.FIGHTER_MAX_HP,
    state: FighterState.NORMAL,
  };
}

/** 서버와 클라이언트가 공유하는 순수 피해/다운 판정. */
export function applyHealthDamage(
  fighter: HealthFighterState,
  damage: number,
): DamageResult {
  if (
    fighter.state === FighterState.DOWN ||
    !Number.isFinite(damage) ||
    damage <= 0
  ) {
    return { applied: false, becameDown: false, fighter: { ...fighter } };
  }

  const hp = Math.max(0, fighter.hp - damage);
  const becameDown = hp === 0;
  return {
    applied: true,
    becameDown,
    fighter: {
      ...fighter,
      hp,
      state: becameDown ? FighterState.DOWN : fighter.state,
    },
  };
}

export function evaluateTeamHealth(
  fighters: readonly HealthFighterState[],
): TeamHealthEvaluation {
  const teamState = (team: Team) => {
    const members = fighters.filter((fighter) => fighter.team === team);
    const downCount = members.filter(
      (fighter) => fighter.state === FighterState.DOWN,
    ).length;
    return {
      bothDown: members.length === 2 && downCount === 2,
      linkState: downCount === 2
        ? LinkState.BOTH_DOWN
        : downCount === 1 ? LinkState.DOWN_DRAG : LinkState.ARM_LOCK,
    };
  };

  const player = teamState(Team.PLAYER);
  const enemy = teamState(Team.AI);
  const result = player.bothDown && enemy.bothDown
    ? MatchResult.DRAW
    : player.bothDown
      ? MatchResult.PLAYER_LOSE
      : enemy.bothDown ? MatchResult.PLAYER_WIN : MatchResult.PLAYING;

  return {
    playerLinkState: player.linkState,
    enemyLinkState: enemy.linkState,
    result,
  };
}
