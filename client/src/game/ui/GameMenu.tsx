import React from 'react';
import type { CombatConnectionStatus } from '../network/CombatNetwork';
import './gameMenu.css';

export type GameMenuScreen = 'HOME' | 'RULES' | 'CONTROLS' | 'MATCHMAKING' | 'GAME';

interface GameMenuProps {
  screen: GameMenuScreen;
  connectionStatus: CombatConnectionStatus;
  assigned: boolean;
  onFindMatch: () => void;
  onCancelMatchmaking: () => void;
  onShowRules: () => void;
  onShowControls: () => void;
  onBack: () => void;
}

export function GameMenu({
  screen,
  connectionStatus,
  assigned,
  onFindMatch,
  onCancelMatchmaking,
  onShowRules,
  onShowControls,
  onBack,
}: GameMenuProps) {
  if (screen === 'GAME') return null;

  return (
    <div className="game-menu-shell">
      <div className="game-menu-noise" />
      <header className="game-menu-header">
        <div className="game-menu-logo-mark">LF</div>
        <div>
          <strong>Linked Fighters</strong>
          <span>ONLINE CO-OP ARENA</span>
        </div>
      </header>

      {screen === 'HOME' && (
        <main className="game-menu-home">
          <section className="game-menu-hero">
            <p className="game-menu-eyebrow">2 PLAYER CO-OP ARENA</p>
            <h1>Linked<br /><em>Fighters</em></h1>
            <p className="game-menu-tagline">함께 움직이고, 끝까지 버텨라.</p>
            <p className="game-menu-copy">
              서로 연결된 두 선수가 한 팀이 되어 적 듀오와 맞서는
              실시간 협동 액션 게임입니다.
            </p>
            <button className="game-menu-primary" type="button" onClick={onFindMatch}>
              <span>게임 시작</span>
              <small>온라인 방 찾기</small>
            </button>
          </section>

          <nav className="game-menu-nav" aria-label="게임 정보">
            <button type="button" onClick={onShowRules}>
              <span className="game-menu-nav-index">01</span>
              <strong>게임 설명</strong>
              <small>목표와 핵심 규칙</small>
            </button>
            <button type="button" onClick={onShowControls}>
              <span className="game-menu-nav-index">02</span>
              <strong>조작 방법</strong>
              <small>이동과 공격 키</small>
            </button>
          </nav>
        </main>
      )}

      {screen === 'RULES' && (
        <InfoPanel title="게임 설명" kicker="HOW TO PLAY" onBack={onBack}>
          <div className="game-menu-rule-grid">
            <article><b>01</b><h3>두 명이 한 팀</h3><p>두 플레이어는 링크로 연결됩니다. 거리가 벌어지면 이동이 제한되므로 함께 움직여야 합니다.</p></article>
            <article><b>02</b><h3>적 듀오 격파</h3><p>연결된 적 AI 두 명을 모두 DOWN 상태로 만들면 승리합니다.</p></article>
            <article><b>03</b><h3>팀원을 지켜라</h3><p>한 명이 쓰러져도 경기는 계속됩니다. 두 명 모두 쓰러지면 패배합니다.</p></article>
            <article><b>04</b><h3>제한 시간 3분</h3><p>시간 종료 시 생존 인원과 남은 체력을 순서대로 비교해 승패를 결정합니다.</p></article>
          </div>
        </InfoPanel>
      )}

      {screen === 'CONTROLS' && (
        <InfoPanel title="조작 방법" kicker="CONTROLS" onBack={onBack}>
          <div className="game-menu-control-grid">
            <article className="left-player">
              <span>LEFT PLAYER</span><h3>왼쪽 선수</h3>
              <KeyCluster keys={['W', 'A', 'S', 'D']} />
              <p><strong>이동</strong> WASD</p><p><strong>공격</strong> F</p>
            </article>
            <div className="game-menu-link-symbol">×</div>
            <article className="right-player">
              <span>RIGHT PLAYER</span><h3>오른쪽 선수</h3>
              <KeyCluster keys={['↑', '←', '↓', '→']} />
              <p><strong>이동</strong> 방향키</p><p><strong>공격</strong> L</p>
            </article>
          </div>
          <p className="game-menu-tip">TIP · 링크가 붉어지면 팀원과의 거리가 한계에 가까워진 상태입니다.</p>
        </InfoPanel>
      )}

      {screen === 'MATCHMAKING' && (
        <main className="game-menu-matchmaking">
          <div className={`game-menu-radar ${connectionStatus.toLowerCase()}`}><i /><i /><i /><span /></div>
          <p className="game-menu-eyebrow">MATCHMAKING</p>
          <h1>{matchmakingTitle(connectionStatus, assigned)}</h1>
          <p>{matchmakingDescription(connectionStatus, assigned)}</p>
          <div className="game-menu-status-row">
            <span className={`status-dot ${connectionStatus.toLowerCase()}`} />
            {connectionLabel(connectionStatus)}
          </div>
          <div className="game-menu-match-actions">
            {connectionStatus === 'ERROR' && (
              <button className="game-menu-primary compact" type="button" onClick={onFindMatch}>다시 찾기</button>
            )}
            <button className="game-menu-secondary" type="button" onClick={onCancelMatchmaking}>취소</button>
          </div>
        </main>
      )}

      <footer className="game-menu-footer"><span>ONLINE CO-OP</span><span>BUILD 0.1</span></footer>
    </div>
  );
}

function InfoPanel({ title, kicker, onBack, children }: React.PropsWithChildren<{
  title: string;
  kicker: string;
  onBack: () => void;
}>) {
  return <main className="game-menu-info">
    <button className="game-menu-back" type="button" onClick={onBack}>← 돌아가기</button>
    <p className="game-menu-eyebrow">{kicker}</p><h1>{title}</h1>{children}
  </main>;
}

function KeyCluster({ keys }: { keys: string[] }) {
  return <div className="game-menu-keys" aria-hidden="true">
    {keys.map((key) => <kbd key={key}>{key}</kbd>)}
  </div>;
}

function connectionLabel(status: CombatConnectionStatus) {
  if (status === 'CONNECTED') return '서버 연결 완료';
  if (status === 'ERROR') return '서버 연결 실패';
  if (status === 'DISCONNECTED') return '연결 종료';
  return '서버 연결 중';
}

function matchmakingTitle(status: CombatConnectionStatus, assigned: boolean) {
  if (status === 'ERROR') return '방을 찾지 못했습니다';
  if (status === 'DISCONNECTED') return '매칭이 취소되었습니다';
  if (assigned) return '상대 플레이어를 기다리는 중';
  return '참가할 방을 찾는 중';
}

function matchmakingDescription(status: CombatConnectionStatus, assigned: boolean) {
  if (status === 'ERROR') return '서버 상태를 확인한 뒤 다시 시도해 주세요.';
  if (assigned) return '두 번째 플레이어가 입장하면 3초 카운트다운이 시작됩니다.';
  return '가장 빠르게 참가할 수 있는 전투 방을 검색하고 있습니다.';
}
