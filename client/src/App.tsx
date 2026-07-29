import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameScene } from './game/core/GameScene';
import { Arena } from './game/entities/Arena';
import { InputManager } from './game/input/InputManager';
import { DebugHUD } from './game/debug/DebugHUD';
import { NetworkSpike } from './game/network/NetworkSpike';

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
    const input     = new InputManager();
    const hud       = new DebugHUD();
    const network   = new NetworkSpike();
    let arena: Arena | null = null;
    let cancelled = false;

    // 카메라 부드러운 추적용 현재 목표 위치
    const camTarget = new THREE.Vector3(0, 0, 0);
    void network.connect();

    void Arena.create(gameScene.getScene())
      .then((createdArena) => {
        if (cancelled) {
          createdArena.dispose();
          return;
        }
        arena = createdArena;
        const activeArena = createdArena;
        gameScene.start(
      // ── fixed update (1/60s) ──────────────
      (dt) => {
        const a = input.getPlayerAInput();
        const b = input.getPlayerBInput();
        const attackA = input.consumePress('KeyF');
        const attackB = input.consumePress('KeyL');
        activeArena.fixedUpdate(a, b, attackA, attackB, dt);
      },
      // ── render frame ──────────────────────
      (alpha) => {
        activeArena.render(alpha);

        // 팀 중심 추적 카메라 (두 플레이어 파이터 중점)
        const ax = activeArena.fighterA.mesh.position.x;
        const az = activeArena.fighterA.mesh.position.z;
        const bx = activeArena.fighterB.mesh.position.x;
        const bz = activeArena.fighterB.mesh.position.z;
        const midX = (ax + bx) / 2;
        const midZ = (az + bz) / 2;

        // 부드러운 lerp 추적 (alpha 기반)
        camTarget.x = THREE.MathUtils.lerp(camTarget.x, midX, 0.08);
        camTarget.z = THREE.MathUtils.lerp(camTarget.z, midZ, 0.08);

        camera.position.set(camTarget.x, CAM_HEIGHT, camTarget.z + CAM_DEPTH);
        camera.lookAt(camTarget.x, 0, camTarget.z);

        hud.update(gameScene, activeArena, network);
      }
        );
      })
      .catch((error: unknown) => {
        console.error('Rapier 초기화 실패', error);
      });

    return () => {
      cancelled = true;
      gameScene.dispose();
      arena?.dispose();
      hud.dispose();
      input.dispose();
      network.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100vw', height: '100vh' }}
    />
  );
}
