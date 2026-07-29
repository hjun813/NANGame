/**
 * 키보드 입력 상태 추적
 * 두 플레이어 독립 조작 (A: WASD, B: 방향키)
 */
export class InputManager {
  private keys = new Set<string>();
  private readonly handleKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.code);
    if (event.code.startsWith('Arrow')) event.preventDefault();
  };
  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };
  private readonly handleBlur = () => {
    this.keys.clear();
  };

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
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
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.keys.clear();
  }
}
