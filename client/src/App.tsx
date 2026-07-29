import React, { useEffect, useRef } from 'react';
import { GameScene } from './game/core/GameScene';
import { Arena } from './game/entities/Arena';
import { InputManager } from './game/input/InputManager';
import { DebugHUD } from './game/debug/DebugHUD';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gameScene = new GameScene({ canvas });
    const arena = new Arena(gameScene.getScene());
    const input = new InputManager();
    const hud = new DebugHUD();

    gameScene.start(
      // ── fixed update (1/60s) ──────────────
      (dt) => {
        const a = input.getPlayerAInput();
        const b = input.getPlayerBInput();
        arena.fixedUpdate(a, b, dt);
      },
      // ── render frame ──────────────────────
      (alpha) => {
        arena.render(alpha);
        hud.update(gameScene, arena);
      }
    );

    return () => {
      gameScene.dispose();
      hud.dispose();
      input.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100vw', height: '100vh' }}
    />
  );
}
