import type { GameScene } from '../core/GameScene';
import type { Arena } from '../entities/Arena';
import { GAME_CONFIG } from '@shared/constants';
import { LinkTensionState, MatchResult } from '@shared/enums';
import type { NetworkSpike } from '../network/NetworkSpike';
import type { CombatNetwork } from '../network/CombatNetwork';

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

  update(
    scene: GameScene,
    arena: Arena,
    network: NetworkSpike | null,
    combatNetwork: CombatNetwork,
  ) {
    const linkMax = arena.linkState === 'DOWN_DRAG'
      ? GAME_CONFIG.DOWN_DRAG_MAX_DIST
      : GAME_CONFIG.LINK_NORMAL_MAX_DIST;
    const linkPct = Math.round((arena.linkDistance / linkMax) * 100);
    const stateColor = arena.linkTensionState === LinkTensionState.RELAXED ? '#69f0ae' : '#ff5252';
    const aiDebug = arena.aiStates
      .map((ai) => `${ai.id}: ${ai.state} → ${ai.targetId ?? '-'}`)
      .join('<br>');

    this.el.innerHTML = `
      <b style="color:#ffd54f">🎮 Sprint 0 Debug</b><br>
      FPS: <b>${scene.fps}</b><br>
      Fixed steps: ${scene.fixedStepCount}<br>
      Rapier collisions: ${arena.physicsCollisionCount}<br>
      ─────────────────<br>
      Link dist: <b>${arena.linkDistance.toFixed(3)}m</b> / ${linkMax}m<br>
      Max observed: ${arena.maxObservedLinkDistance.toFixed(3)}m<br>
      Limit violations: <b>${arena.linkViolationFrames}</b> frames<br>
      Corrections: ${arena.linkCorrectionFrames} frames<br>
      Link %: ${linkPct}%<br>
      Link state: <b>${arena.linkState}</b><br>
      Tension: <span style="color:${stateColor}"><b>${arena.linkTensionState}</b></span><br>
      ─────────────────<br>
      Player: ${arena.fighterA.hp} [${arena.fighterA.state}] / ${arena.fighterB.hp} [${arena.fighterB.state}]<br>
      Enemy: ${arena.enemyA.hp} [${arena.enemyA.state}] / ${arena.enemyB.hp} [${arena.enemyB.state}]<br>
      ${aiDebug}<br>
      Enemy link: ${arena.enemyLinkState}<br>
      Result: <b style="color:${arena.matchResult === MatchResult.PLAYING ? '#69f0ae' : '#ff5252'}">${arena.matchResult}</b><br>
      ─────────────────<br>
      Network spike: <b>${network?.status ?? 'DISABLED'}</b><br>
      Combat authority: <b>${combatNetwork.status}</b><br>
      Assigned fighter: <b>${combatNetwork.assignment?.fighterId ?? 'LOCAL BOTH'}</b><br>
      Combat room: <b>${combatNetwork.roomId}</b><br>
      Lobby spike room: ${network?.roomId ?? '-'}<br>
      Players: ${network?.playerCount ?? 0}/2 &nbsp; Ready: ${network?.readyCount ?? 0}/2<br>
      Revision: ${network?.revision ?? 0}<br>
      ${network?.error ? `<span style="color:#ff5252">${network.error}</span><br>` : ''}
      Press N: toggle network ready<br>
      ─────────────────<br>
      <span style="color:#90caf9">A: WASD</span> &nbsp; <span style="color:#a5d6a7">B: Arrow</span>
    `.trim();
  }

  dispose() {
    this.el.remove();
  }
}
