// ─────────────────────────────────────────
// 경기 상태
// ─────────────────────────────────────────
export enum GameState {
  WAITING = 'WAITING',       // 방 대기 중
  COUNTDOWN = 'COUNTDOWN',   // 카운트다운
  PLAYING = 'PLAYING',       // 경기 진행 중
  FINISHED = 'FINISHED',     // 경기 종료
  DISCONNECTED = 'DISCONNECTED', // 필수 플레이어 이탈로 종료
}

// ─────────────────────────────────────────
// 파이터(캐릭터) 상태
// ─────────────────────────────────────────
export enum FighterState {
  NORMAL = 'NORMAL',
  ATTACK_WINDUP = 'ATTACK_WINDUP',
  ATTACK_ACTIVE = 'ATTACK_ACTIVE',
  ATTACK_RECOVERY = 'ATTACK_RECOVERY',
  GUARDING = 'GUARDING',     // 방어
  HIT = 'HIT',               // 피격 경직
  DOWN = 'DOWN',             // 다운 (체력 0)
  DISCONNECTED = 'DISCONNECTED',
}

export enum MatchResult {
  PLAYING = 'PLAYING',
  PLAYER_WIN = 'PLAYER_WIN',
  PLAYER_LOSE = 'PLAYER_LOSE',
  DRAW = 'DRAW',
}

// ─────────────────────────────────────────
// 팀 링크 상태
// ─────────────────────────────────────────
export enum LinkState {
  INVALID = 'INVALID',
  ARM_LOCK = 'ARM_LOCK',     // 팔짱 (기본, 최대 1.8m)
  HAND_HOLD = 'HAND_HOLD',   // 손잡기 (Space, 최대 4m, 5초간)
  DOWN_DRAG = 'DOWN_DRAG',
  BOTH_DOWN = 'BOTH_DOWN',
}

// 링크 상태와 별도로 계산하는 현재 거리/장력 상태
export enum LinkTensionState {
  RELAXED = 'RELAXED',
  TENSION = 'TENSION',
  LIMIT = 'LIMIT',
  CORRECTING = 'CORRECTING',
}

// ─────────────────────────────────────────
// 룸 상태
// ─────────────────────────────────────────
export enum RoomState {
  CREATED = 'CREATED',
  WAITING = 'WAITING',
  READY = 'READY',
  STARTING = 'STARTING',
  IN_GAME = 'IN_GAME',
  RESULT = 'RESULT',
  CLOSED = 'CLOSED',
}

export enum AIState {
  IDLE = 'IDLE',
  APPROACH = 'APPROACH',
  ATTACK_READY = 'ATTACK_READY',
  REPOSITION = 'REPOSITION',
  ATTACK = 'ATTACK',
  GUARD = 'GUARD',
  RETREAT = 'RETREAT',
  DRAG_ALLY = 'DRAG_ALLY',
  DOWN = 'DOWN',
}

// ─────────────────────────────────────────
// 팀 구분
// ─────────────────────────────────────────
export enum Team {
  PLAYER = 'PLAYER',
  AI = 'AI',
}

// ─────────────────────────────────────────
// 파이터 슬롯 (어느 팔 담당인지)
// ─────────────────────────────────────────
export enum FighterSlot {
  LEFT = 'LEFT',   // 왼팔 공격 담당
  RIGHT = 'RIGHT', // 오른팔 공격 담당
}
