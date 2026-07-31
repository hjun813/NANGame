# Linked Fighters — 0단계 개발 문서 패키지

## 문서 목적

이 문서 묶음은 **온라인 2인 협동 복싱 게임 Linked Fighters(가칭)**의 개발을 시작하기 전에 필요한 기준을 정리한 0단계 산출물이다.

핵심 목표는 다음과 같다.

- 게임 규칙을 개발 가능한 수준으로 명확히 정의한다.
- 클라이언트와 서버가 동일한 상태 및 판정 기준을 사용하도록 한다.
- 핵심 재미 검증과 온라인 MVP 개발을 분리한다.
- 구현 완료 기준과 테스트 방법을 사전에 정의한다.
- 개발 과정에서 발생하는 변경 이유와 결과를 기록한다.

---

## 포함 문서

| 파일 | 내용 |
|---|---|
| `01_functional_requirements.md` | 기능 요구사항 및 비기능 요구사항 명세 |
| `02_state_transition_spec.md` | 경기, 캐릭터, 링크, 룸 상태 전이 정의 |
| `03_product_backlog.md` | 에픽, 사용자 스토리, 우선순위, 완료 조건 |
| `04_technical_validation_checklist.md` | 개발 시작 전 기술 검증 항목 |
| `05_playtest_plan.md` | 재미 검증을 위한 플레이테스트 계획 |
| `06_decision_log.md` | 주요 기술·게임 디자인 의사결정 기록 |
| `07_acceptance_test_cases.md` | MVP 인수 테스트 시나리오 |
| `08_risk_register.md` | 주요 개발 위험과 대응 전략 |
| `09_game_overview.md` | 게임 개요 |
| `10_game_development_plan.md` | 개발 계획서 |
| `11_game_rules.md` | 게임 전략 및 규칙 |
| `12_network_sync_troubleshooting.md` | 전투 룸 위치·상태·초기화 동기화 이슈와 해결 기록 |

---

## 문서 사용 순서

1. `01_functional_requirements.md`로 구현 범위를 확인한다.
2. `02_state_transition_spec.md`를 기준으로 상태 모델을 작성한다.
3. `04_technical_validation_checklist.md`의 기술 스파이크를 먼저 수행한다.
4. `03_product_backlog.md`의 P0 작업부터 개발한다.
5. 기능 단위 완료 시 `07_acceptance_test_cases.md`로 검증한다.
6. 플레이 가능한 빌드가 나오면 `05_playtest_plan.md`를 수행한다.
7. 규칙이나 기술 방향을 변경할 때 `06_decision_log.md`에 기록한다.
8. 매일 `08_risk_register.md`의 위험 상태를 갱신한다.

---

## 개발 원칙

> 온라인부터 만들지 않고, 연결된 두 캐릭터의 이동과 한쪽 팔 전투가 재미있는지 먼저 검증한다.

- 규칙 기반 이동 보정을 우선하고 완전한 관절 물리에 의존하지 않는다.
- 서버는 경기 상태, 위치, 공격, 데미지, 체력, 승패의 최종 권한을 가진다.
- 카메라와 시각 연출은 클라이언트에서 독립적으로 처리한다.
- 기능 완료는 “코드 작성”이 아니라 “테스트 조건 통과”를 의미한다.
- 밸런스 수치는 고정값이 아니라 플레이테스트를 통해 수정하는 실험값이다.

---

## 초기 기술 구성

| 영역 | 기술 |
|---|---|
| 언어 | TypeScript |
| 클라이언트 UI | React |
| 3D 렌더링 | Three.js |
| 물리 및 충돌 | Rapier.js |
| 게임 서버 | Node.js + Colyseus |
| 실시간 통신 | WebSocket |
| 빌드 도구 | Vite |
| 배포 | 정적 웹 호스팅 + Node.js 서버 |

---

## 문서 버전 관리

- 초기 버전: `v0.1`
- 플레이테스트 후 규칙 변경: `v0.2`
- 온라인 MVP 규칙 확정: `v0.9`
- 해커톤 제출 버전: `v1.0`

문서 변경 시 다음을 함께 기록한다.

- 변경 날짜
- 변경한 사람
- 변경 내용
- 변경 이유
- 영향받는 기능
