import { GAME_CONFIG } from '@shared/constants';
import type { Arena } from '../entities/Arena';

/**
 * HP/다운 인수 테스트를 화면에서 재현하는 그레이박스 전용 패널.
 * 모든 피해는 Arena.applyDamage를 거쳐 실제 전투와 같은 규칙을 사용한다.
 */
export class DebugControlPanel {
  private readonly el: HTMLDivElement;

  constructor(private readonly arena: Arena) {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed',
      top: '12px',
      right: '12px',
      width: '280px',
      padding: '12px',
      background: 'rgba(0,0,0,0.72)',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      fontSize: '12px',
      borderRadius: '6px',
      zIndex: '1000',
    });
    this.el.innerHTML = `
      <b style="color:#ffd54f">HP / DOWN Test</b>
      <div data-fighters></div>
      <hr style="border-color:#555">
      <button data-action="player-one-down">Player 한 명 DOWN</button>
      <button data-action="player-lose">Player 두 명 DOWN</button>
      <button data-action="enemy-win">Enemy 두 명 DOWN</button>
      <button data-action="draw">동시 DOWN (DRAW)</button>
      <button data-action="reset">경기 초기화</button>
    `;
    this.renderFighterButtons();
    this.styleButtons();
    this.el.addEventListener('click', this.handleClick);
    document.body.appendChild(this.el);
  }

  private renderFighterButtons() {
    const container = this.el.querySelector<HTMLDivElement>('[data-fighters]');
    if (!container) return;
    const fighters = [
      ['fighterA', 'Player A'],
      ['fighterB', 'Player B'],
      ['enemyA', 'Enemy A'],
      ['enemyB', 'Enemy B'],
    ];
    container.innerHTML = fighters.map(([id, label]) => `
      <div style="margin-top:8px">
        <span style="display:inline-block;width:72px">${label}</span>
        <button data-fighter="${id}" data-damage="${GAME_CONFIG.ATTACK_DAMAGE}">-${GAME_CONFIG.ATTACK_DAMAGE}</button>
        <button data-fighter="${id}" data-down="true">DOWN</button>
      </div>
    `).join('');
  }

  private styleButtons() {
    this.el.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      Object.assign(button.style, {
        margin: '3px',
        padding: '5px 7px',
        border: '1px solid #666',
        borderRadius: '4px',
        background: '#303040',
        color: '#fff',
        cursor: 'pointer',
      });
    });
  }

  private readonly handleClick = (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;

    const fighterKey = button.dataset.fighter as
      | 'fighterA' | 'fighterB' | 'enemyA' | 'enemyB' | undefined;
    if (fighterKey) {
      const fighter = this.arena[fighterKey];
      const damage = button.dataset.down
        ? GAME_CONFIG.FIGHTER_MAX_HP
        : Number(button.dataset.damage);
      this.arena.applyDamage(fighter, damage);
      return;
    }

    switch (button.dataset.action) {
      case 'player-one-down':
        this.arena.resetMatch();
        this.arena.applyDamage(this.arena.fighterA, GAME_CONFIG.FIGHTER_MAX_HP);
        break;
      case 'player-lose':
        this.arena.resetMatch();
        this.arena.applyDamage(this.arena.fighterA, GAME_CONFIG.FIGHTER_MAX_HP, true);
        this.arena.applyDamage(this.arena.fighterB, GAME_CONFIG.FIGHTER_MAX_HP, true);
        this.arena.evaluateMatchState();
        break;
      case 'enemy-win':
        this.arena.resetMatch();
        this.arena.applyDamage(this.arena.enemyA, GAME_CONFIG.FIGHTER_MAX_HP, true);
        this.arena.applyDamage(this.arena.enemyB, GAME_CONFIG.FIGHTER_MAX_HP, true);
        this.arena.evaluateMatchState();
        break;
      case 'draw':
        this.arena.resetMatch();
        [
          this.arena.fighterA,
          this.arena.fighterB,
          this.arena.enemyA,
          this.arena.enemyB,
        ].forEach((fighter) => {
          this.arena.applyDamage(fighter, GAME_CONFIG.FIGHTER_MAX_HP, true);
        });
        this.arena.evaluateMatchState();
        break;
      case 'reset':
        this.arena.resetMatch();
        break;
    }
  };

  dispose() {
    this.el.removeEventListener('click', this.handleClick);
    this.el.remove();
  }
}
