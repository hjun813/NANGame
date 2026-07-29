import { FighterState, LinkState, GameState, Team, FighterSlot } from './enums';

// ─────────────────────────────────────────
// 클라이언트 → 서버 입력 메시지
// ─────────────────────────────────────────
export interface PlayerInput {
  sequence: number;     // 입력 순서 번호 (오래된 입력 폐기용)
  timestamp: number;    // 클라이언트 시각 (ms)
  moveX: number;        // 수평 이동 (-1 ~ 1)
  moveZ: number;        // 깊이 이동 (-1 ~ 1)
  attack: boolean;      // 공격 버튼
  guard: boolean;       // 방어 버튼
  handHold: boolean;    // 손잡기 버튼 (Space)
}

// ─────────────────────────────────────────
// 3D 벡터 (Three.js 미사용 구간에서도 공유)
// ─────────────────────────────────────────
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ─────────────────────────────────────────
// 파이터 스냅샷 (서버 → 클라이언트 브로드캐스트)
// ─────────────────────────────────────────
export interface FighterSnapshot {
  id: string;
  team: Team;
  slot: FighterSlot;
  position: Vec3;
  rotation: number;    // Y축 회전 (라디안)
  state: FighterState;
  hp: number;
  maxHp: number;
}

// ─────────────────────────────────────────
// 팀 링크 스냅샷
// ─────────────────────────────────────────
export interface LinkSnapshot {
  team: Team;
  linkState: LinkState;
  distance: number;
  maxDistance: number;
  holdTimer: number;   // 손잡기 남은 시간 (초)
  holdCooldown: number; // 쿨다운 남은 시간 (초)
}

// ─────────────────────────────────────────
// 경기 전체 상태 스냅샷
// ─────────────────────────────────────────
export interface GameSnapshot {
  tick: number;
  timestamp: number;
  gameState: GameState;
  fighters: FighterSnapshot[];
  links: LinkSnapshot[];
  timeRemaining: number; // 남은 경기 시간 (초)
}
