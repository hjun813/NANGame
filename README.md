# Linked Fighters

두 명의 플레이어가 링크로 연결된 한 팀이 되어, 서로 연결된 AI 두 명과 싸우는 온라인 2인 협동 액션 게임입니다.

현재 버전은 브라우저에서 두 플레이어가 같은 전투 룸에 입장해 카운트다운부터 전투, 승패 판정, 재경기까지 확인할 수 있는 MVP입니다. 경기 상태, AI 행동, 공격 적중, 피해, 체력과 결과는 서버가 최종 권한을 가집니다.

## 공개 테스트 주소

| 구분 | 주소 |
|---|---|
| 게임 클라이언트 | [https://nan-game.vercel.app](https://nan-game.vercel.app) |
| 게임 서버 | [https://nan-game-server.onrender.com](https://nan-game-server.onrender.com) |
| 서버 상태 확인 | [https://nan-game-server.onrender.com/health](https://nan-game-server.onrender.com/health) |

Render의 저사양 인스턴스는 유휴 후 첫 요청이 느릴 수 있습니다. 게임 연결에 실패하면 서버 상태 확인 주소를 먼저 연 뒤 게임을 새로고침해 주세요.

## 현재 구현 상태

최종 갱신: 2026-08-10

| 영역 | 상태 | 구현 내용 |
|---|---:|---|
| 온라인 전투 룸 | 완료 | Colyseus `combat_room`, 최대 2명, 좌우 슬롯 자동 배정 |
| 경기 상태 머신 | 완료 | `WAITING → COUNTDOWN → PLAYING → FINISHED` |
| 경기 시간 | 완료 | 3초 카운트다운, 180초 제한 시간, 서버 동기화 |
| 플레이어 전투 | 완료 | 서버 허용 상태 검사, 공격 상태 머신, 적중·피해·DOWN 판정 |
| AI 이동 | 완료 | 생존 플레이어 타깃 선택, 접근, 경계 제한, 겹침 해소 |
| AI 전투 | 완료 | `WINDUP → ACTIVE → RECOVERY → RETREAT`, 서버 권한 피해 판정 |
| 팀 링크 | 완료 | 플레이어 및 AI 팀 거리 제한, 보정, 다운 동료 끌기 |
| 승패 판정 | 완료 | `PLAYER_WIN`, `PLAYER_LOSE`, `DRAW`, 같은 tick 결과 보존 |
| 재경기 | 완료 | 양쪽 플레이어 동의 후 상태 및 `resetRevision` 초기화 |
| 메뉴/UI | MVP 완료 | 시작 화면, 게임 설명, 조작 안내, 매칭 화면, 전투 HUD, 결과 화면 |
| 캐릭터 GLB | 시험 적용 완료 | 아군 2명과 적군 2명 모델 분리 적용 |
| 캐릭터 애니메이션 | 예정 | GLB 리깅은 존재하지만 실제 애니메이션 클립 적용 필요 |
| 최종 맵/연출 | 예정 | 경기장 에셋, 배경, 조명, 사운드, 타격 연출 고도화 필요 |
| 재접속/세션 복구 | 예정 | 새로고침 및 서버 재시작 후 세션 복원 미지원 |

## 게임 규칙

- 두 플레이어가 모두 접속하면 3초 카운트다운 후 경기가 시작됩니다.
- 플레이어 팀과 AI 팀은 각각 두 명으로 구성됩니다.
- 상대 팀 두 명을 모두 DOWN시키면 승리합니다.
- 우리 팀 두 명이 모두 DOWN되면 패배합니다.
- 양 팀이 같은 서버 tick에 모두 DOWN되면 무승부입니다.
- 한 명만 DOWN된 경우 경기는 계속됩니다.
- 제한 시간 종료 시 서버 규칙에 따라 결과를 판정합니다.
- 경기 중 한 플레이어가 나가면 진행 중인 경기를 중단하고 `WAITING`으로 돌아갑니다.

## 조작 방법

온라인 플레이에서는 서버가 배정한 캐릭터 하나만 조작합니다.

| 캐릭터 | 이동 | 공격 |
|---|---|---|
| 왼쪽 파이터 | `W`, `A`, `S`, `D` | `F` |
| 오른쪽 파이터 | 방향키 | `L` |

## 캐릭터 에셋 매핑

GLB 파일은 `client/public/assets/characters`에 있습니다.

| 파이터 ID | 모델 |
|---|---|
| `player-left` | `FighterExport1.glb` |
| `player-right` | `FighterExport2.glb` |
| `enemy-left` | `enemy1.glb` |
| `enemy-right` | `enemy2.glb` |

현재 모델에는 리깅과 `LeftHand`, `RightHand`, `Spine2` 본이 있습니다. 실제 애니메이션 클립은 포함되어 있지 않아 이동·공격·DOWN 동작은 임시 포즈로 표현됩니다. 에셋 교체 및 Unity 내보내기 절차는 [`docs/14_character_asset_pipeline.md`](docs/14_character_asset_pipeline.md)를 참고하세요.

## 기술 스택

| 영역 | 기술 |
|---|---|
| 언어 | TypeScript |
| 클라이언트 | React, Vite |
| 3D 렌더링 | Three.js |
| 클라이언트 물리 | Rapier.js |
| 게임 서버 | Node.js, Express, Colyseus |
| 실시간 통신 | WebSocket |
| 공용 규칙 | 별도 `shared` TypeScript 패키지 |
| 서버 배포 | Render Docker Web Service |
| 클라이언트 배포 | Vercel 정적 배포 |

## 아키텍처

```text
브라우저 A ─┐
            ├─ HTTPS ─> Vercel 정적 클라이언트
브라우저 B ─┘
     │
     └─ WSS ─> Render / Colyseus combat_room
                         │
                         ├─ 경기 상태와 타이머
                         ├─ 플레이어 위치·공격 검증
                         ├─ AI 타깃·이동·공격
                         ├─ HP·DOWN·승패 판정
                         └─ CombatStateSnapshot broadcast
```

- 클라이언트는 입력을 전송하고 서버 스냅샷을 화면에 반영합니다.
- 서버는 경기 진행, AI, 공격, 피해, 체력 및 결과의 최종 권한을 가집니다.
- `shared`에는 서버와 클라이언트가 함께 사용하는 타입, 상수, 상태 머신과 순수 함수가 있습니다.
- 서버에는 Rapier를 도입하지 않았으며 AI 이동과 적중은 XZ 평면 수학 계산으로 처리합니다.
- 현재 룸 상태는 메모리에만 존재하므로 서버 재시작 시 진행 중인 경기는 사라집니다.

## 주요 디렉터리

```text
NANGame/
├─ client/
│  ├─ public/assets/characters/  # GLB 캐릭터 에셋
│  └─ src/game/
│     ├─ characters/             # 모델 로딩, 본과 애니메이션 적용
│     ├─ core/                   # Three.js 게임 루프
│     ├─ entities/Arena.ts       # 경기장 및 서버 상태 반영
│     ├─ network/                # Colyseus 클라이언트
│     └─ ui/                     # 시작 메뉴와 플레이 HUD
├─ server/
│  └─ src/rooms/CombatRoom.ts    # 서버 경기·AI·피해·재경기 권한
├─ shared/
│  └─ src/                       # 공용 enum, 상수, 전투/AI/체력 규칙
├─ docs/                         # 요구사항, 규칙, 테스트 및 배포 문서
├─ render.yaml                   # Render 서버 배포 설정
└─ vercel.json                   # Vercel 클라이언트 배포 설정
```

## 로컬 실행

Node.js 20 이상과 npm을 사용합니다.

### 최초 설치

```bash
npm install

cd shared
npm install
npm run build

cd ../server
npm install

cd ../client
npm install
```

### 서버와 클라이언트 동시 실행

저장소 루트에서 실행합니다.

```bash
npm run dev:local
```

| 서비스 | 로컬 주소 |
|---|---|
| 클라이언트 | `http://localhost:5173` |
| Colyseus 서버 | `ws://localhost:2567` |
| Health check | `http://localhost:2567/health` |

두 명 테스트는 일반 브라우저 창과 시크릿 창에서 클라이언트 주소를 각각 열고 양쪽에서 `게임 시작`을 누르면 됩니다.

### Docker 실행

```bash
docker compose up --build
```

종료:

```bash
docker compose down
```

## 환경변수

### 로컬 클라이언트

`client/.env.development`의 핵심 설정:

```env
VITE_COMBAT_SERVER_URL=ws://localhost:2567
VITE_ENABLE_DEBUG_COMBAT_COMMANDS=false
VITE_ENABLE_DEBUG_HUD=false
VITE_ENABLE_SPIKE_ROOM=false
VITE_ENABLE_LOCAL_FALLBACK=true
VITE_ENABLE_CHARACTER_ASSET_TEST=true
```

디버그 수치 HUD가 필요할 때만 `VITE_ENABLE_DEBUG_HUD=true`로 변경합니다.

### 운영 클라이언트

Vercel 환경변수:

```env
VITE_COMBAT_SERVER_URL=wss://nan-game-server.onrender.com
VITE_ENABLE_DEBUG_COMBAT_COMMANDS=false
VITE_ENABLE_DEBUG_HUD=false
VITE_ENABLE_SPIKE_ROOM=false
VITE_ENABLE_LOCAL_FALLBACK=false
VITE_ENABLE_CHARACTER_ASSET_TEST=true
VITE_CHARACTER_MODEL_PLAYER_LEFT_URL=/assets/characters/FighterExport1.glb
VITE_CHARACTER_MODEL_PLAYER_RIGHT_URL=/assets/characters/FighterExport2.glb
VITE_CHARACTER_MODEL_ENEMY_LEFT_URL=/assets/characters/enemy1.glb
VITE_CHARACTER_MODEL_ENEMY_RIGHT_URL=/assets/characters/enemy2.glb
```

Vite 환경변수는 빌드 시 포함되므로 값을 바꾼 뒤 Vercel을 다시 배포해야 합니다.

### 운영 서버

Render 환경변수:

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://nan-game.vercel.app
ENABLE_DEBUG_COMBAT_COMMANDS=false
ENABLE_SPIKE_ROOM=false
```

`PORT`는 Render가 자동으로 제공합니다. Render 로그에 `Detected service running on port 10000`이 표시되는 것은 정상이며 외부 URL에 `:10000`을 붙이지 않습니다.

## 배포

### 1. Render 서버

1. GitHub 저장소를 Render Blueprint로 연결합니다.
2. 저장소 루트의 `render.yaml`을 사용합니다.
3. 위의 운영 서버 환경변수를 등록합니다.
4. 배포 후 `/health`가 200을 반환하는지 확인합니다.

### 2. Vercel 클라이언트

1. 같은 GitHub 저장소를 Vercel에 Import합니다.
2. Root Directory는 저장소 루트 `.`을 사용합니다.
3. 위의 운영 클라이언트 환경변수를 등록합니다.
4. 루트 `vercel.json` 설정으로 빌드하고 `client/dist`를 배포합니다.

### 3. Origin 최종 확인

Render의 `ALLOWED_ORIGINS`에는 브라우저에서 확인한 정확한 Vercel Origin이 들어가야 합니다.

```js
location.origin
```

현재 운영 값:

```env
ALLOWED_ORIGINS=https://nan-game.vercel.app
```

자세한 배포와 외부 2인 테스트 절차는 [`docs/13_deployment_guide.md`](docs/13_deployment_guide.md)를 참고하세요.

## 배포 문제 해결

### WebSocket `1006` 또는 `rejected websocket origin`

브라우저 콘솔:

```text
WebSocket connection failed
Room connection was closed unexpectedly (1006)
```

Render 로그:

```text
[server] rejected websocket origin=https://nan-game.vercel.app
```

위 로그는 게임 서버가 중단된 것이 아니라 실제 Vercel Origin이 서버 허용 목록에 없다는 뜻입니다.

해결 순서:

1. Render 서비스의 `Environment`로 이동합니다.
2. `ALLOWED_ORIGINS=https://nan-game.vercel.app`을 정확히 설정합니다.
3. 따옴표, 마지막 `/`, 경로를 넣지 않습니다.
4. `Manual Deploy → Deploy latest commit`으로 서버를 다시 배포합니다.
5. 시작 로그에서 `env=production`과 `origins=1`을 확인합니다.
6. 브라우저에서 `Ctrl + Shift + R`로 새로고침합니다.

여러 클라이언트 주소를 허용할 경우 쉼표로 구분합니다.

```env
ALLOWED_ORIGINS=https://nan-game.vercel.app,https://preview-example.vercel.app
```

정상 서버 로그:

```text
[server] listening host=0.0.0.0 port=10000 env=production
[server] health=http://0.0.0.0:10000/health origins=1
```

### 서버는 정상인데 첫 연결이 느린 경우

1. [서버 상태 확인 주소](https://nan-game-server.onrender.com/health)를 엽니다.
2. JSON 응답을 확인합니다.
3. 게임 페이지를 새로고침합니다.

### 환경변수 변경이 반영되지 않는 경우

- Render는 환경변수 저장 후 서버 재배포가 필요합니다.
- Vercel의 `VITE_*` 값은 클라이언트 재빌드 및 재배포가 필요합니다.
- Preview URL과 Production URL은 서로 다른 Origin이므로 필요한 주소를 모두 허용해야 합니다.

## 테스트 및 빌드

2026-08-10 기준 최신 검증 결과:

| 검증 | 결과 |
|---|---:|
| shared 단위 테스트 | 80/80 통과 |
| server 룸·설정 테스트 | 10/10 통과 |
| client TypeScript 검사 | 통과 |
| client Vite 프로덕션 빌드 | 통과 |
| `git diff --check` | 통과 |

```bash
# shared 순수 함수 및 상태 머신 테스트
cd shared
npm test

# 서버 룸 통합 테스트
cd ../server
npm test

# 클라이언트 TypeScript 및 Vite 프로덕션 빌드
cd ../client
npm run build

# 전체 빌드
cd ..
npm run build

# diff 공백 오류 확인
git diff --check
```

수동 검증 시 두 브라우저에서 다음을 확인합니다.

- 두 번째 플레이어 입장 후 양쪽이 같은 3초 카운트다운을 표시하는가
- 이동, 공격, AI 상태, HP와 결과가 양쪽에서 동일한가
- 공격 한 번에 피해가 한 번만 적용되는가
- 한 명 DOWN 후에도 경기가 계속되는가
- 두 명 DOWN 또는 제한 시간 종료 시 동일한 결과가 표시되는가
- 재경기 양쪽 동의 후 위치, HP, AI 상태가 초기화되는가
- 한 명이 나가면 남은 플레이어가 안전하게 대기 상태로 돌아가는가

## 남은 주요 작업

1. Unity에서 Idle, Walk, Punch, Hit, Down 애니메이션을 제작하거나 연결합니다.
2. 애니메이션이 포함된 GLB를 내보내고 `CharacterAnimationController`의 클립 이름과 맞춥니다.
3. 최종 경기장 모델, 배경, 조명과 카메라 연출을 적용합니다.
4. 타격 이펙트, 사운드, 피격 피드백을 고도화합니다.
5. 서버 재접속, 세션 복구와 배포 장애 안내를 추가합니다.
6. 운영 관측, 자동 배포, 다중 인스턴스 룸 공유 전략을 설계합니다.

## 문서

| 문서 | 내용 |
|---|---|
| [`docs/01_functional_requirements.md`](docs/01_functional_requirements.md) | 기능 및 비기능 요구사항 |
| [`docs/02_state_transition_spec.md`](docs/02_state_transition_spec.md) | 경기와 캐릭터 상태 전이 |
| [`docs/05_playtest_plan.md`](docs/05_playtest_plan.md) | 플레이테스트 계획 |
| [`docs/06_decision_log.md`](docs/06_decision_log.md) | 주요 의사결정 기록 |
| [`docs/07_acceptance_test_cases.md`](docs/07_acceptance_test_cases.md) | MVP 인수 테스트 |
| [`docs/11.game_rules.md`](docs/11.game_rules.md) | 게임 규칙 |
| [`docs/13_deployment_guide.md`](docs/13_deployment_guide.md) | Render/Vercel 배포 가이드 |
| [`docs/14_character_asset_pipeline.md`](docs/14_character_asset_pipeline.md) | 캐릭터 에셋과 애니메이션 파이프라인 |

## 현재 MVP 한계

- 자동 재접속과 세션 복구가 없습니다.
- 서버 상태는 인메모리이므로 서버 재시작 시 초기화됩니다.
- 한 서버 인스턴스를 전제로 하며 다중 인스턴스 룸 공유를 지원하지 않습니다.
- 플레이어 이동은 클라이언트 Rapier 결과를 서버가 검증·중계하는 과도기 구조입니다.
- AI 서버 이동은 물리 엔진이나 경로 탐색 없이 수학적 좌표 계산으로 처리합니다.
- 현재 캐릭터 GLB에는 실제 애니메이션 클립이 없습니다.
