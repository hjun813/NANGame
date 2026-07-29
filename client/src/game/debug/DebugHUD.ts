import type { GameScene } from '../core/GameScene';
import type { Arena } from '../entities/Arena';
import { GAME_CONFIG } from '@shared/constants';
import { LinkTensionState } from '@shared/enums';

/**
 * Sprint 0 디버그 HUD
 * - FPS
 * - 링크 거리 / 최대 거리
 * - 링크 상태
 * - Fixed step 횟수
 *
 * canvas 왜곡 없이 CSS overlay로 구현
 */
export class DebugHUD {
  private el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed',
      top: '12px',
      left: '12px',
      padding: '10px 14px',
      background: 'rgba(0,0,0,0.65)',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontSize: '13px',
      lineHeight: '1.8',
      borderRadius: '6px',
      pointerEvents: 'none',
      zIndex: '999',
      backdropFilter: 'blur(4px)',
    });
    document.body.appendChild(this.el);
  }

  update(scene: GameScene, arena: Arena) {
    const linkPct = Math.round((arena.linkDistance / GAME_CONFIG.LINK_NORMAL_MAX_DIST) * 100);
    const stateColor = arena.linkTensionState === LinkTensionState.RELAXED ? '#69f0ae' : '#ff5252';

    this.el.innerHTML = `
      <b style="color:#ffd54f">🎮 Sprint 0 Debug</b><br>
      FPS: <b>${scene.fps}</b><br>
      Fixed steps: ${scene.fixedStepCount}<br>
      Rapier collisions: ${arena.physicsCollisionCount}<br>
      ─────────────────<br>
      Link dist: <b>${arena.linkDistance.toFixed(3)}m</b> / ${GAME_CONFIG.LINK_NORMAL_MAX_DIST}m<br>
      Max observed: ${arena.maxObservedLinkDistance.toFixed(3)}m<br>
      Limit violations: <b>${arena.linkViolationFrames}</b> frames<br>
      Corrections: ${arena.linkCorrectionFrames} frames<br>
      Link %: ${linkPct}%<br>
      Link state: <b>${arena.linkState}</b><br>
      Tension: <span style="color:${stateColor}"><b>${arena.linkTensionState}</b></span><br>
      ─────────────────<br>
      <span style="color:#90caf9">A: WASD</span> &nbsp; <span style="color:#a5d6a7">B: Arrow</span>
    `.trim();
  }

  dispose() {
    this.el.remove();
  }
}
