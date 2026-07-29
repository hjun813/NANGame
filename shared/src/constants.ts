// ─────────────────────────────────────────
// 밸런스 수치 (플레이테스트로 수정하는 실험값)
// ─────────────────────────────────────────

export const GAME_CONFIG = {
  // 경기
  MATCH_DURATION: 180,          // 경기 시간 (초)
  COUNTDOWN_DURATION: 3,        // 시작 카운트다운 (초)

  // 파이터
  FIGHTER_MAX_HP: 100,
  FIGHTER_MOVE_SPEED: 5,        // m/s
  FIGHTER_RADIUS: 0.4,          // 캡슐 콜라이더 반지름 (m)

  // 링크 (팔짱)
  LINK_NORMAL_MAX_DIST: 1.8,    // 팔짱 최대 거리 (m)
  LINK_HOLD_MAX_DIST: 4.0,      // 손잡기 최대 거리 (m)
  LINK_HOLD_DURATION: 5,        // 손잡기 지속 시간 (초)
  LINK_HOLD_COOLDOWN: 15,       // 손잡기 쿨다운 (초)
  LINK_STRETCH_THRESHOLD: 0.85, // 최대 거리 몇 % 이상에서 STRETCHED 상태로 전환

  // 이동 보정
  SAME_DIR_BONUS: 1.3,          // 같은 방향 이동 보상 배율
  OPP_DIR_PENALTY: 0.6,         // 반대 방향 이동 패널티 배율

  // 전투
  ATTACK_DAMAGE: 15,
  ATTACK_WINDUP: 0.15,          // 선딜 (초)
  ATTACK_ACTIVE: 0.1,           // 히트박스 활성 시간 (초)
  ATTACK_RECOVERY: 0.35,        // 후딜 (초)
  ATTACK_RANGE: 1.2,            // 공격 사거리 (m)
  KNOCKBACK_FORCE: 4,           // 넉백 강도 (m/s)
  STUN_DURATION: 0.4,           // 피격 경직 (초)

  // 방어
  GUARD_DAMAGE_REDUCTION: 0.4,  // 전방 방어 시 데미지 감소율 (40%)
  GUARD_MOVE_PENALTY: 0.5,      // 방어 중 이동 속도 감소율

  // 다운
  DOWN_MOVE_PENALTY: 0.7,       // 팀원 다운 시 생존자 속도 감소율
  DOWN_DRAG_MAX_DIST: 2.5,      // 다운 파이터가 생존자에서 최대 뒤처질 거리 (m)

  // 서버 틱
  SERVER_TICK_RATE: 30,         // 서버 시뮬레이션 (tick/s)
  SNAPSHOT_RATE: 20,            // 상태 전송 (회/s)
} as const;

// 이벤트 이름 (클라이언트 ↔ 서버)
export const EVENTS = {
  PLAYER_INPUT: 'player_input',
  GAME_SNAPSHOT: 'game_snapshot',
  GAME_STATE_CHANGE: 'game_state_change',
  PLAYER_READY: 'player_ready',
  REMATCH_REQUEST: 'rematch_request',
} as const;
