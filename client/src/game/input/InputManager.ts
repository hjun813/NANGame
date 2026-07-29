/**
 * 키보드 입력 상태 추적
 * 두 플레이어 독립 조작 (A: WASD, B: 방향키)
 */
export class InputManager {
  private keys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      e.preventDefault(); // 방향키 스크롤 방지
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  // 플레이어 A (WASD)
  getPlayerAInput() {
    return {
      x: (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
      z: (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0),
    };
  }

  // 플레이어 B (방향키)
  getPlayerBInput() {
    return {
      x: (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0),
      z: (this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('ArrowUp') ? 1 : 0),
    };
  }

  isPressed(code: string) {
    return this.keys.has(code);
  }

  dispose() {
    // 실제 앱에서는 이벤트 제거 필요 (단일 씬 구성이므로 생략)
  }
}
