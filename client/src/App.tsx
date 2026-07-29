import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameScene } from './game/core/GameScene';
import { Arena } from './game/entities/Arena';
import { InputManager } from './game/input/InputManager';
import { DebugHUD } from './game/debug/DebugHUD';

// 카메라 오프셋: 팀 중심에서 얼마나 위/뒤에 있을지
const CAM_HEIGHT = 10;
const CAM_DEPTH  = 10;

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gameScene = new GameScene({ canvas });
    const camera    = gameScene.getCamera();
    const arena     = new Arena(gameScene.getScene());
    const input     = new InputManager();
    const hud       = new DebugHUD();

    // 카메라 부드러운 추적용 현재 목표 위치
    const camTarget = new THREE.Vector3(0, 0, 0);

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

        // 팀 중심 추적 카메라 (두 플레이어 파이터 중점)
        const ax = arena.fighterA.mesh.position.x;
        const az = arena.fighterA.mesh.position.z;
        const bx = arena.fighterB.mesh.position.x;
        const bz = arena.fighterB.mesh.position.z;
        const midX = (ax + bx) / 2;
        const midZ = (az + bz) / 2;

        // 부드러운 lerp 추적 (alpha 기반)
        camTarget.x = THREE.MathUtils.lerp(camTarget.x, midX, 0.08);
        camTarget.z = THREE.MathUtils.lerp(camTarget.z, midZ, 0.08);

        camera.position.set(camTarget.x, CAM_HEIGHT, camTarget.z + CAM_DEPTH);
        camera.lookAt(camTarget.x, 0, camTarget.z);

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
