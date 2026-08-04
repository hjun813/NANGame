# MVP 임시 배포 가이드

## 1. 배포 구조

```text
브라우저 ── HTTPS ──> Vercel 정적 클라이언트
   └────── WSS ─────> Render Colyseus 서버 ──> combat_room
                                      └──────> GET /health
```

- 클라이언트: Vercel 정적 배포
- 서버: Render Docker Web Service
- DB, Redis, 영구 디스크는 사용하지 않는다.
- 이 구성은 외부 2인 MVP 검증용이며 최종 운영 구성이 아니다.

## 2. 로컬 실행

Node.js 20과 npm을 사용한다.

```bash
cd shared
npm install
npm run build

cd ../server
npm ci
npm run dev

cd ../client
npm ci
npm run dev
```

또는 저장소 루트에서 `docker compose up --build`를 실행한다. 로컬 클라이언트는
`http://localhost:5173`, health check는 `http://localhost:2567/health`다.

## 3. 환경 변수

| 변수 | 대상 | 필수 | 기본값 | 설명 |
|---|---|---:|---|---|
| `PORT` | 서버 | 배포 플랫폼 제공 | `2567` | HTTP와 WebSocket 공용 포트 |
| `HOST` | 서버 | 아니오 | `0.0.0.0` | 서버 바인딩 주소 |
| `NODE_ENV` | 서버 | 예 | `development` | Render에서는 `production` |
| `ALLOWED_ORIGINS` | 서버 | production 예 | 개발 localhost | 쉼표로 구분한 정확한 클라이언트 origin |
| `ENABLE_DEBUG_COMBAT_COMMANDS` | 서버 | 아니오 | `false` | 비운영 수동 피해 주입; production에서는 항상 차단 |
| `ENABLE_SPIKE_ROOM` | 서버 | 아니오 | `false` | 개발용 네트워크 검증 room; production에서는 항상 차단 |
| `VITE_COMBAT_SERVER_URL` | 클라이언트 | production 예 | 개발 `ws://localhost:2567` | Render 서버의 `wss://` URL |
| `VITE_ENABLE_DEBUG_COMBAT_COMMANDS` | 클라이언트 | 아니오 | `false` | 개발용 피해 패널 |
| `VITE_ENABLE_DEBUG_HUD` | 클라이언트 | 아니오 | production `false` | 개발 진단 HUD |
| `VITE_ENABLE_SPIKE_ROOM` | 클라이언트 | 아니오 | `false` | 개발 SpikeRoom 연결 |
| `VITE_ENABLE_LOCAL_FALLBACK` | 클라이언트 | 아니오 | production `false` | 서버 없이 로컬 양쪽 조작; production에서는 코드상 차단 |

실제 `.env` 파일은 커밋하지 않는다. 개발 예시는 `client/.env.development`, 운영 예시는
`client/.env.production.example`을 참고한다.

## 4. Render 서버 배포

1. 저장소를 GitHub/GitLab에 push한다.
2. Render에서 Blueprint를 생성하고 저장소 루트의 `render.yaml`을 선택한다.
3. Web Service 인스턴스는 외부 테스트 규모에 맞는 가장 작은 타입을 선택한다.
4. `ALLOWED_ORIGINS`는 아직 임시로 예상한 Vercel URL을 넣거나, 클라이언트 배포 후 실제 URL로 교체한다.
   - 예: `https://nan-game.vercel.app`
   - 여러 URL: `https://nan-game.vercel.app,https://preview.example.com`
   - origin에는 경로를 넣지 않는다.
5. 배포 후 `https://<service>.onrender.com/health`가 아래처럼 200을 반환하는지 확인한다.

```json
{"status":"ok","service":"nan-game-server"}
```

6. 서버 로그에서 `host=0.0.0.0`, 플랫폼이 제공한 port, `env=production`을 확인한다.

Render는 외부 HTTPS/WSS를 종료하고 컨테이너의 단일 `PORT`로 전달하므로 별도 인증서 파일은 필요하지 않다.

## 5. Vercel 클라이언트 배포

1. Vercel에서 동일 저장소를 Import한다. 프로젝트 Root Directory는 저장소 루트로 둔다.
2. 루트의 `vercel.json`이 shared 빌드 후 client를 빌드하고 `client/dist`를 배포한다.
3. Production 환경 변수에 다음 값을 등록한다.

```text
VITE_COMBAT_SERVER_URL=wss://<service>.onrender.com
VITE_ENABLE_DEBUG_COMBAT_COMMANDS=false
VITE_ENABLE_DEBUG_HUD=false
VITE_ENABLE_SPIKE_ROOM=false
VITE_ENABLE_LOCAL_FALLBACK=false
```

4. 배포한다. Vite 환경 변수는 빌드 시 포함되므로 값을 바꾼 뒤에는 반드시 재배포한다.
5. 최종 Vercel origin을 Render의 `ALLOWED_ORIGINS`에 반영하고 Render 서버를 재배포한다.

## 6. 로컬 production 검증

```bash
docker build -f server/Dockerfile -t nan-game-server:test .
docker run --rm -p 2567:2567 \
  -e PORT=2567 \
  -e ALLOWED_ORIGINS=http://localhost:4173 \
  nan-game-server:test

cd client
VITE_COMBAT_SERVER_URL=ws://localhost:2567 npm run build
npm run preview -- --host 0.0.0.0
```

Windows PowerShell에서는 환경 변수를 `$env:VITE_COMBAT_SERVER_URL='ws://localhost:2567'`로 설정한 뒤 빌드한다.
두 브라우저 또는 일반/시크릿 창에서 `http://localhost:4173`을 열어 한 경기를 완료한다.

## 7. 배포 후 두 PC 체크리스트

### 연결

- [ ] 서버 `/health`가 200이다.
- [ ] 두 PC에서 같은 Vercel URL을 연다.
- [ ] 개발자 도구 Network에서 WebSocket이 `wss://`로 연결된다.
- [ ] 첫 플레이어는 `WAITING`, 두 번째 입장 후 양쪽이 3초 `COUNTDOWN`이다.
- [ ] 두 화면이 동일한 `PLAYING` 상태가 된다.

### 경기

- [ ] 각 PC는 배정받은 한 캐릭터만 이동·공격한다.
- [ ] 플레이어와 AI 링크가 유지된다.
- [ ] 좌우 공격, AI 공격, HP, DOWN이 양쪽에서 동일하다.
- [ ] 승리·패배·DRAW 결과가 양쪽에서 동일하다.

### 재경기와 연결 예외

- [ ] 한쪽만 재경기를 누르면 대기하고, 양쪽 동의 후 초기화된다.
- [ ] HP, 위치, AI 상태가 초기화되고 `resetRevision`이 증가한다.
- [ ] 한 명이 브라우저를 닫으면 남은 플레이어가 `WAITING`으로 돌아간다.
- [ ] 새 플레이어가 들어오면 새 카운트다운이 시작된다.
- [ ] 서버 재시작 시 클라이언트가 연결 해제/오류를 표시하며 로컬 경기를 시작하지 않는다.
- [ ] 새로고침하면 새 세션으로 다시 참가한다.

서로 다른 네트워크, Chrome/Edge, 일반/시크릿 창 조합도 한 번씩 확인한다.

## 8. 알려진 한계

- 무료 서버는 유휴 후 절전될 수 있어 첫 접속이 늦거나 최초 WebSocket 연결이 실패할 수 있다.
- 자동 재접속과 세션 복구가 없다. 오류 시 새로고침해야 한다.
- 서버 재시작 시 인메모리 room과 경기 상태가 사라진다.
- 현재 플레이어 이동은 소유 클라이언트 Rapier 결과를 서버가 제한·중계하는 과도기 반권한 구조다.
- 한 서버 인스턴스만 전제로 한다. 여러 인스턴스로 수평 확장하면 같은 room 라우팅/공유 상태가 추가로 필요하다.
- production source map은 생성하지 않는다. Vite 단일 번들 크기 경고는 현재 MVP 배포 blocker가 아니다.
