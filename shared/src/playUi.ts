import { FighterSlot, FighterState, GameState, MatchResult } from './enums';

export function clampHp(hp: number, maxHp: number): number {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 0;
  return Math.min(maxHp, Math.max(0, hp));
}

export function hpPercent(hp: number, maxHp: number): number {
  return maxHp > 0 ? (clampHp(hp, maxHp) / maxHp) * 100 : 0;
}

export function formatMatchTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function gameStateMessage(state: GameState | string, countdown = 0): string | null {
  switch (state) {
    case GameState.WAITING: return '다른 플레이어를 기다리는 중...';
    case GameState.COUNTDOWN: return countdown > 0 ? String(Math.ceil(countdown)) : 'FIGHT!';
    case GameState.PLAYING:
    case GameState.FINISHED: return null;
    case GameState.DISCONNECTED: return '서버 연결이 해제되었습니다.';
    default: return '경기 상태 확인 중...';
  }
}

export function resultCopy(result: MatchResult | string): { title: string; detail: string } {
  switch (result) {
    case MatchResult.PLAYER_WIN:
      return { title: '승리', detail: '상대 팀을 모두 쓰러뜨렸습니다.' };
    case MatchResult.PLAYER_LOSE:
      return { title: '패배', detail: '우리 팀이 모두 쓰러졌습니다.' };
    case MatchResult.DRAW:
      return { title: '무승부', detail: '양 팀이 동시에 전투 불능이 되었습니다.' };
    default:
      return { title: '경기 종료', detail: '경기 결과를 확인할 수 없습니다.' };
  }
}

export function isDown(state: FighterState | string): boolean {
  return state === FighterState.DOWN;
}

export function slotGuide(slot: FighterSlot | string | null): {
  label: string; movement: string; attack: string;
} {
  if (slot === FighterSlot.LEFT) return { label: '왼쪽 파이터', movement: 'WASD', attack: 'F' };
  if (slot === FighterSlot.RIGHT) return { label: '오른쪽 파이터', movement: '방향키', attack: 'L' };
  return { label: '캐릭터 배정 중', movement: '-', attack: '-' };
}

export function rematchUiState(selfReady: boolean, opponentReady: boolean): {
  message: string; buttonLabel: string; alreadyRequested: boolean;
} {
  if (selfReady) return {
    message: '상대방의 재경기 동의를 기다리는 중...',
    buttonLabel: '재경기 요청 완료',
    alreadyRequested: true,
  };
  if (opponentReady) return {
    message: '상대방이 재경기를 요청했습니다.',
    buttonLabel: '재경기 동의',
    alreadyRequested: false,
  };
  return { message: '두 플레이어가 모두 동의하면 다시 시작합니다.', buttonLabel: '재경기 요청', alreadyRequested: false };
}
