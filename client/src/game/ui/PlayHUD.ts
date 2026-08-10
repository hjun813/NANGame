import { GAME_CONFIG } from '@shared/constants';
import { FighterSlot, GameState, MatchResult } from '@shared/enums';
import type { CombatStateSnapshot, HealthFighterState } from '@shared/health';
import { formatMatchTime, gameStateMessage, hpPercent, isDown, rematchUiState, resultCopy, slotGuide } from '@shared/playUi';
import type { CombatConnectionStatus } from '../network/CombatNetwork';

type FighterView = { root: HTMLElement; hp: HTMLElement; fill: HTMLElement; badge: HTMLElement };

export class PlayHUD {
  private readonly root: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly centerMessage: HTMLElement;
  private readonly result: HTMLElement;
  private readonly resultTitle: HTMLElement;
  private readonly resultDetail: HTMLElement;
  private readonly guide: HTMLElement;
  private readonly connection: HTMLElement;
  private readonly rematchButton: HTMLButtonElement;
  private readonly rematchMessage: HTMLElement;
  private readonly fighterViews = new Map<string, FighterView>();
  private assignedSlot: FighterSlot | null = null;
  private connectionState: CombatConnectionStatus = 'CONNECTING';
  private rematchHandler: (() => void) | null = null;
  private readonly onRematchClick = () => this.rematchHandler?.();

  constructor() {
    document.getElementById('linked-fighters-play-hud')?.remove();
    this.root = document.createElement('div');
    this.root.id = 'linked-fighters-play-hud';
    this.root.innerHTML = `<style>
      #linked-fighters-play-hud{position:fixed;inset:0;z-index:900;pointer-events:none;color:#fff;font-family:Inter,system-ui,sans-serif;text-shadow:0 2px 4px #000}
      #linked-fighters-play-hud:after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 100px #0009;pointer-events:none}
      .lf-score{position:absolute;z-index:1;top:18px;left:50%;transform:translateX(-50%);width:min(1040px,94vw);display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start}
      .lf-team{padding:12px 18px 14px;background:linear-gradient(110deg,#081523eb,#0a1019d9);border-top:2px solid #55cfff;border-bottom:1px solid #ffffff20;clip-path:polygon(0 0,96% 0,100% 100%,3% 100%);box-shadow:0 8px 24px #0008}.lf-team.enemy{text-align:right;background:linear-gradient(250deg,#24100feb,#120c10d9);border-top-color:#ff654f;clip-path:polygon(4% 0,100% 0,97% 100%,0 100%)}.lf-team h2{font-size:10px;letter-spacing:3px;margin:0 0 9px;color:#7edcff}.lf-team.enemy h2{color:#ff8c7a}
      .lf-fighter{margin:7px 0}.lf-name{display:flex;justify-content:space-between;font-size:12px;font-weight:700}.enemy .lf-name{flex-direction:row-reverse}.lf-badge{color:#ffcc4d;min-width:42px}.lf-bar{height:10px;background:#ffffff1a;border-radius:10px;overflow:hidden;margin-top:3px}.lf-fill{height:100%;width:100%;background:linear-gradient(90deg,#29d17d,#8eee58);transition:width .12s linear}.enemy .lf-fill{background:linear-gradient(90deg,#ffb347,#f04f54)}.lf-fighter.down{opacity:.62}.lf-fighter.down .lf-fill{background:#68707a}.lf-fighter.down .lf-name{text-decoration:line-through}
      .lf-timer{position:relative;min-width:112px;text-align:center;font:900 30px/1 ui-monospace,monospace;padding:19px 14px 12px;background:linear-gradient(#111923f2,#05080df2);border:1px solid #ffffff42;clip-path:polygon(12% 0,88% 0,100% 25%,100% 100%,0 100%,0 25%);letter-spacing:2px}.lf-timer:before{content:"MATCH";position:absolute;top:5px;left:0;right:0;color:#94a3b8;font:800 7px/1 Inter,sans-serif;letter-spacing:3px}
      .lf-center{position:absolute;z-index:2;left:50%;top:43%;transform:translate(-50%,-50%);font-family:Impact,'Arial Black',sans-serif;font-size:clamp(42px,9vw,104px);font-weight:900;font-style:italic;letter-spacing:3px;text-align:center;white-space:nowrap;color:#fff;text-shadow:0 5px 0 #111,0 0 38px #ff543c99}.lf-center.waiting{font-family:Inter,system-ui,sans-serif;font-style:normal;letter-spacing:0;font-size:clamp(18px,2.6vw,30px);padding:17px 28px;background:#07111de8;border-top:2px solid #ff5339}
      .lf-result{position:absolute;inset:0;display:none;place-content:center;text-align:center;background:#03070ab8}.lf-result.show{display:grid}.lf-result h1{font-size:clamp(48px,9vw,96px);margin:0}.lf-result p{font-size:18px;margin:12px 0 0}.lf-result small{margin-top:20px;color:#b9c1c9}
      .lf-rematch{pointer-events:auto;justify-self:center;margin-top:20px;padding:11px 22px;border:1px solid #9bdcff;border-radius:8px;background:#1676a8;color:white;font-weight:800;cursor:pointer}.lf-rematch:disabled{cursor:not-allowed;opacity:.45}.lf-rematch-message{margin-top:12px;color:#d7e3ea;font-size:14px}
      .lf-guide{position:absolute;z-index:1;left:18px;bottom:18px;padding:10px 15px;background:linear-gradient(90deg,#07111de8,transparent);border-left:3px solid #55cfff;font-size:12px;line-height:1.7}.lf-guide strong{color:#fff;letter-spacing:.4px}.lf-connection{position:absolute;z-index:1;right:18px;bottom:18px;padding:8px 12px;border-radius:20px;background:#07111ddd;font-size:12px;border:1px solid #ffffff26}.lf-connection.connected{display:none}.lf-connection.error{color:#fca5a5}
      @media(max-width:650px){.lf-score{grid-template-columns:1fr 1fr;gap:8px}.lf-timer{position:absolute;left:50%;top:0;transform:translateX(-50%);font-size:18px}.lf-team{margin-top:46px;padding:9px}.lf-guide{font-size:11px;bottom:12px;left:12px}.lf-connection{right:12px;bottom:12px}}
    </style>
    <div class="lf-score"><section class="lf-team"><h2>LINKED FIGHTERS · ALLY</h2>${this.fighterMarkup('player-left','FIGHTER 1')}${this.fighterMarkup('player-right','FIGHTER 2')}</section><div class="lf-timer">03:00</div><section class="lf-team enemy"><h2>ENEMY DUO</h2>${this.fighterMarkup('enemy-left','ENEMY 1')}${this.fighterMarkup('enemy-right','ENEMY 2')}</section></div>
    <div class="lf-center waiting">경기 상태 확인 중...</div>
    <div class="lf-result"><h1></h1><p></p><button class="lf-rematch" type="button">재경기 요청</button><div class="lf-rematch-message"></div></div>
    <div class="lf-guide"></div><div class="lf-connection">서버 연결 중...</div>`;
    document.body.appendChild(this.root);
    this.timer = this.require('.lf-timer'); this.centerMessage = this.require('.lf-center');
    this.result = this.require('.lf-result'); this.resultTitle = this.require('.lf-result h1'); this.resultDetail = this.require('.lf-result p');
    this.guide = this.require('.lf-guide'); this.connection = this.require('.lf-connection');
    this.rematchButton = this.require<HTMLButtonElement>('.lf-rematch');
    this.rematchMessage = this.require('.lf-rematch-message');
    this.rematchButton.addEventListener('click', this.onRematchClick);
    for (const id of ['player-left','player-right','enemy-left','enemy-right']) {
      const root = this.require(`[data-fighter="${id}"]`);
      this.fighterViews.set(id, { root, hp: this.require('.lf-hp', root), fill: this.require('.lf-fill', root), badge: this.require('.lf-badge', root) });
    }
    this.setAssignedSlot(null);
  }

  updateCombatState(snapshot: CombatStateSnapshot): void {
    this.timer.textContent = formatMatchTime(snapshot.timeRemaining);
    for (const fighter of snapshot.fighters) this.updateFighter(fighter);
    const message = gameStateMessage(snapshot.gameState, snapshot.countdownRemaining);
    this.centerMessage.textContent = message ?? '';
    this.centerMessage.style.display = message ? 'block' : 'none';
    this.centerMessage.classList.toggle('waiting', snapshot.gameState !== GameState.COUNTDOWN);
    const finished = snapshot.gameState === GameState.FINISHED;
    this.result.classList.toggle('show', finished);
    if (finished) {
      const copy = resultCopy(snapshot.result);
      this.resultTitle.textContent = copy.title; this.resultDetail.textContent = copy.detail;
      const selfReady = this.assignedSlot ? snapshot.rematchReady?.[this.assignedSlot] ?? false : false;
      const opponentSlot = this.assignedSlot === FighterSlot.LEFT ? FighterSlot.RIGHT : FighterSlot.LEFT;
      const opponentReady = this.assignedSlot ? snapshot.rematchReady?.[opponentSlot] ?? false : false;
      const rematch = rematchUiState(selfReady, opponentReady);
      this.rematchButton.textContent = rematch.buttonLabel;
      this.rematchMessage.textContent = rematch.message;
      this.rematchButton.disabled = !this.assignedSlot || this.connectionState !== 'CONNECTED' || rematch.alreadyRequested;
    }
  }

  setAssignedSlot(slot: FighterSlot | null): void {
    this.assignedSlot = slot;
    const copy = slotGuide(slot);
    this.guide.innerHTML = `<strong>내 캐릭터: ${copy.label}</strong><br>이동: ${copy.movement} · 공격: ${copy.attack}`;
  }

  setConnectionState(state: CombatConnectionStatus): void {
    this.connectionState = state;
    const labels: Record<CombatConnectionStatus,string> = { CONNECTING:'서버 연결 중...', CONNECTED:'서버 연결됨', DISCONNECTED:'서버 연결 해제', ERROR:'서버 연결 오류' };
    this.connection.textContent = labels[state];
    this.connection.className = `lf-connection ${state === 'CONNECTED' ? 'connected' : state === 'CONNECTING' ? '' : 'error'}`;
  }

  setRematchRequestHandler(handler: (() => void) | null): void {
    this.rematchHandler = handler;
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none';
  }

  destroy(): void {
    this.rematchButton.removeEventListener('click', this.onRematchClick);
    this.rematchHandler = null;
    this.root.remove();
  }

  private updateFighter(fighter: HealthFighterState): void {
    const view = this.fighterViews.get(fighter.id); if (!view) return;
    const hp = Math.min(GAME_CONFIG.FIGHTER_MAX_HP, Math.max(0, fighter.hp));
    view.hp.textContent = `${Math.ceil(hp)} / ${GAME_CONFIG.FIGHTER_MAX_HP}`;
    view.fill.style.width = `${hpPercent(hp, GAME_CONFIG.FIGHTER_MAX_HP)}%`;
    const down = isDown(fighter.state); view.root.classList.toggle('down', down); view.badge.textContent = down ? 'DOWN' : '';
  }

  private fighterMarkup(id: string, label: string): string { return `<div class="lf-fighter" data-fighter="${id}"><div class="lf-name"><span>${label}</span><span class="lf-hp">100 / 100</span><span class="lf-badge"></span></div><div class="lf-bar"><div class="lf-fill"></div></div></div>`; }
  private require<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = this.root): T { const element = root.querySelector<T>(selector); if (!element) throw new Error(`PlayHUD element missing: ${selector}`); return element; }
}
