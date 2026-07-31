import { GAME_CONFIG } from './constants';
import {
  FighterSlot,
  FighterState,
  GameState,
  LinkState,
  MatchResult,
  Team,
} from './enums';
import type { Vec3 } from './types';
import type { AIStateSnapshot } from './ai';

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
  gameState: GameState;
  countdownRemaining: number;
  timeRemaining: number;
  /** 서버 경기 초기화 세대. 값이 바뀌면 클라이언트 물리 상태도 함께 초기화한다. */
  resetRevision?: number;
  fighters: Array<HealthFighterState & { position?: Vec3; attackId?: number }>;
  aiStates: AIStateSnapshot[];
}

export interface CombatAssignmentMessage {
  fighterId: string;
  slot: FighterSlot;
}

export interface CombatPositionMessage {
  sequence: number;
  position: Vec3;
}

/** 실제 공격 요청. 대상과 피해량은 서버가 결정한다. */
export interface CombatAttackMessage {
  sequence: number;
  attackerId: string;
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

/** 제한 시간 종료 시 생존 파이터 수, 팀 HP 합 순서로 결과를 판정한다. */
export function evaluateTimeLimitResult(
  fighters: readonly HealthFighterState[],
): MatchResult {
  const summarize = (team: Team) => {
    const members = fighters.filter((fighter) => fighter.team === team);
    return {
      survivors: members.filter((fighter) => fighter.state !== FighterState.DOWN).length,
      hp: members.reduce((sum, fighter) => sum + fighter.hp, 0),
    };
  };

  const player = summarize(Team.PLAYER);
  const enemy = summarize(Team.AI);
  if (player.survivors !== enemy.survivors) {
    return player.survivors > enemy.survivors
      ? MatchResult.PLAYER_WIN
      : MatchResult.PLAYER_LOSE;
  }
  if (player.hp !== enemy.hp) {
    return player.hp > enemy.hp
      ? MatchResult.PLAYER_WIN
      : MatchResult.PLAYER_LOSE;
  }
  return MatchResult.DRAW;
}
