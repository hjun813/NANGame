// ─────────────────────────────────────────
// 경기 상태
// ─────────────────────────────────────────
export enum GameState {
  WAITING = 'WAITING',       // 방 대기 중
  COUNTDOWN = 'COUNTDOWN',   // 카운트다운
  PLAYING = 'PLAYING',       // 경기 진행 중
  FINISHED = 'FINISHED',     // 경기 종료
}

// ─────────────────────────────────────────
// 파이터(캐릭터) 상태
// ─────────────────────────────────────────
export enum FighterState {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  ATTACKING = 'ATTACKING',   // 공격 활성 (히트박스 ON)
  WINDUP = 'WINDUP',         // 공격 준비 (선딜)
  RECOVERY = 'RECOVERY',     // 공격 후딜
  GUARDING = 'GUARDING',     // 방어
  STUNNED = 'STUNNED',       // 피격 경직
  DOWN = 'DOWN',             // 다운 (체력 0)
}

// ─────────────────────────────────────────
// 팀 링크 상태
// ─────────────────────────────────────────
export enum LinkState {
  ARM_LOCK = 'ARM_LOCK',     // 팔짱 (기본, 최대 1.8m)
  HAND_HOLD = 'HAND_HOLD',   // 손잡기 (Space, 최대 4m, 5초간)
  STRETCHED = 'STRETCHED',   // 최대 거리 근접 상태 (시각 경고)
}

// ─────────────────────────────────────────
// 룸 상태
// ─────────────────────────────────────────
export enum RoomState {
  LOBBY = 'LOBBY',
  READY = 'READY',
  IN_GAME = 'IN_GAME',
  ENDED = 'ENDED',
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
