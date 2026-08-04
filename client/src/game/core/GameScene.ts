import * as THREE from 'three';

export interface SceneConfig {
  canvas: HTMLCanvasElement;
}

/**
 * Three.js 최소 씬
 * - RAF 중복 방지 (dispose 명시)
 * - 리사이즈 대응
 * - 고정 타임스텝 accumulator 방식
 */
export class GameScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rafId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private fpsElapsed = 0;
  private fpsFrames = 0;

  // 고정 타임스텝 1/60
  private readonly FIXED_DT = 1 / 60;
  private readonly MAX_ACCUMULATOR = 0.1; // 프레임 드롭 시 최대 누적 제한

  // 디버그용 측정값
  public fps = 0;
  public fixedStepCount = 0; // 이번 렌더 프레임의 fixed step 횟수

  private resizeObserver: ResizeObserver;

  constructor({ canvas }: SceneConfig) {
    // ── 렌더러 ──────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // ── 씬 ──────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 20, 60);

    // ── 카메라 (쿼터뷰) ──────────────────────
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 10, 10);
    this.camera.lookAt(0, 0, 0);

    // ── 조명 ────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(dirLight);

    // ── 리사이즈 ────────────────────────────
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
    this.handleResize();
  }

  private handleResize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  getScene() { return this.scene; }
  getCamera() { return this.camera; }

  /**
   * 게임 루프 시작
   * @param onFixedUpdate  고정 타임스텝 로직 (물리, 링크 보정 등)
   * @param onRender       렌더 전 매 프레임 로직 (카메라, 보간 등)
   */
  start(
    onFixedUpdate: (dt: number) => void,
    onRender?: (alpha: number, deltaTime: number) => void
  ) {
    if (this.rafId !== null) return; // 중복 방지

    const loop = (time: number) => {
      // 현재 콜백은 이미 소비되었다. 다음 프레임은 업데이트 성공 후 예약한다.
      this.rafId = null;

      const delta = Math.min((time - this.lastTime) / 1000, 0.1); // 최대 100ms
      this.lastTime = time;
      this.fpsElapsed += delta;
      this.fpsFrames++;
      if (this.fpsElapsed >= 0.5) {
        this.fps = Math.round(this.fpsFrames / this.fpsElapsed);
        this.fpsElapsed = 0;
        this.fpsFrames = 0;
      }

      this.accumulator += delta;
      if (this.accumulator > this.MAX_ACCUMULATOR) {
        this.accumulator = this.MAX_ACCUMULATOR;
      }

      this.fixedStepCount = 0;
      while (this.accumulator >= this.FIXED_DT) {
        onFixedUpdate(this.FIXED_DT);
        this.accumulator -= this.FIXED_DT;
        this.fixedStepCount++;
      }

      const alpha = this.accumulator / this.FIXED_DT;
      onRender?.(alpha, delta);

      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(loop);
    };

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(loop);
  }

  /** 씬 정리 (메모리 누수 방지) */
  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.scene.clear();
  }
}
