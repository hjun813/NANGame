# 상태 전이 명세서

## 1. 목적

경기, 룸, 캐릭터, 팀 링크의 상태와 전환 조건을 명확히 정의하여 클라이언트와 서버의 동작 불일치를 방지한다.

---

# 2. 룸 상태

## 2.1 상태 정의

| 상태 | 설명 |
|---|---|
| `CREATED` | 방이 생성되었지만 플레이어가 1명 이하 |
| `WAITING` | 두 플레이어가 입장했으나 준비가 완료되지 않음 |
| `READY` | 두 플레이어가 모두 준비 완료 |
| `STARTING` | 경기 생성 및 초기화 중 |
| `IN_GAME` | 경기가 진행 중 |
| `RESULT` | 경기 종료 결과를 표시 중 |
| `CLOSED` | 방 종료 및 정리 완료 |

## 2.2 상태 전이표

| 현재 상태 | 이벤트 | 조건 | 다음 상태 | 처리 |
|---|---|---|---|---|
| 없음 | 방 생성 | 서버 정상 | CREATED | 코드 발급, 생성자 입장 |
| CREATED | 두 번째 플레이어 입장 | 정원 여유 | WAITING | 슬롯 배정 |
| CREATED | 생성자 이탈 | 항상 | CLOSED | 방 삭제 |
| WAITING | 두 명 모두 준비 | 둘 다 ready=true | READY | 시작 가능 표시 |
| READY | 한 명 준비 해제 | 항상 | WAITING | 시작 취소 |
| READY | 게임 시작 | 서버 초기화 성공 | STARTING | 경기 상태 생성 |
| STARTING | 초기화 완료 | 모든 엔티티 생성 | IN_GAME | 카운트다운 시작 |
| STARTING | 초기화 실패 | 오류 발생 | WAITING | 오류 표시 |
| IN_GAME | 승패 결정 | 종료 조건 충족 | RESULT | 결과 저장 |
| IN_GAME | 플레이어 이탈 | MVP 규칙 | RESULT | 연결 종료 결과 |
| RESULT | 두 명 재경기 동의 | 둘 다 rematch=true | STARTING | 상태 초기화 |
| RESULT | 한 명 이탈 | 항상 | CLOSED | 방 정리 |
| RESULT | 로비 이동 | 모두 동의 | WAITING | 준비 상태 초기화 |

---

# 3. 경기 상태

## 3.1 상태 정의

| 상태 | 설명 |
|---|---|
| `WAITING` | 경기 인스턴스 생성 전 또는 입력 차단 상태 |
| `COUNTDOWN` | 시작 전 카운트다운 |
| `PLAYING` | 이동과 전투 가능 |
| `FINISHED` | 승패 결정 완료 |
| `DISCONNECTED` | 필수 플레이어 이탈로 종료 |

## 3.2 상태 전이표

| 현재 상태 | 이벤트 | 조건 | 다음 상태 | 처리 |
|---|---|---|---|---|
| WAITING | 초기화 완료 | 캐릭터 4명 생성 | COUNTDOWN | 타이머 3초 설정 |
| COUNTDOWN | 카운트다운 종료 | 플레이어 연결 정상 | PLAYING | 입력 활성화 |
| COUNTDOWN | 플레이어 이탈 | 항상 | DISCONNECTED | 경기 종료 |
| PLAYING | 한 팀 전원 다운 | 항상 | FINISHED | 승패 계산 |
| PLAYING | 시간 0 | 항상 | FINISHED | 시간 종료 판정 |
| PLAYING | 양 팀 동시 전원 다운 | 같은 서버 틱 | FINISHED | 무승부 |
| PLAYING | 플레이어 이탈 | MVP 규칙 | DISCONNECTED | 이탈 결과 |
| FINISHED | 재경기 초기화 | 두 명 동의 | WAITING | 모든 상태 초기화 |
| DISCONNECTED | 결과 확인 | 항상 | FINISHED | 종료 화면 표시 |

---

# 4. 캐릭터 상태

## 4.1 상태 정의

| 상태 | 이동 | 공격 | 방어 | 피격 | 설명 |
|---|---:|---:|---:|---:|---|
| `NORMAL` | 가능 | 가능 | 가능 | 가능 | 기본 상태 |
| `ATTACK_WINDUP` | 제한 | 불가 | 불가 | 가능 | 공격 준비 |
| `ATTACK_ACTIVE` | 제한 | 진행 | 불가 | 가능 | 히트박스 활성 |
| `ATTACK_RECOVERY` | 제한 | 불가 | 불가 | 가능 | 공격 후딜레이 |
| `GUARDING` | 감속 | 불가 | 진행 | 가능 | 전방 방어 |
| `HIT` | 불가 | 불가 | 불가 | 제한 | 피격 경직 |
| `DOWN` | 불가 | 불가 | 불가 | 선택 | 체력 0 |
| `DISCONNECTED` | 불가 | 불가 | 불가 | 불가 | 조작자 이탈 |

## 4.2 전이 우선순위

상태 충돌 시 다음 순서를 우선한다.

1. `DOWN`
2. `DISCONNECTED`
3. `HIT`
4. `ATTACK_ACTIVE`
5. `ATTACK_WINDUP`
6. `ATTACK_RECOVERY`
7. `GUARDING`
8. `NORMAL`

## 4.3 상태 전이표

| 현재 상태 | 이벤트 | 조건 | 다음 상태 | 처리 |
|---|---|---|---|---|
| NORMAL | 공격 입력 | 쿨다운 종료 | ATTACK_WINDUP | 공격 타이머 시작 |
| NORMAL | 방어 입력 유지 | 체력 > 0 | GUARDING | 이동 감속 |
| NORMAL | 적 공격 적중 | 체력 > 데미지 | HIT | 데미지·넉백 |
| NORMAL | 치명 공격 적중 | 체력 <= 데미지 | DOWN | 입력 차단 |
| ATTACK_WINDUP | 준비 시간 종료 | 체력 > 0 | ATTACK_ACTIVE | 히트박스 활성 |
| ATTACK_WINDUP | 공격 적중 받음 | 경직 적용 | HIT | 공격 취소 |
| ATTACK_WINDUP | 체력 0 | 항상 | DOWN | 공격 취소 |
| ATTACK_ACTIVE | 활성 시간 종료 | 항상 | ATTACK_RECOVERY | 히트박스 제거 |
| ATTACK_ACTIVE | 체력 0 | 항상 | DOWN | 히트박스 즉시 제거 |
| ATTACK_ACTIVE | 공격 적중 받음 | 슈퍼아머 없음 | HIT | 히트박스 제거 |
| ATTACK_RECOVERY | 후딜 종료 | 체력 > 0 | NORMAL | 공격 가능 |
| ATTACK_RECOVERY | 피격 | 체력 > 0 | HIT | 경직 |
| GUARDING | 방어 입력 해제 | 체력 > 0 | NORMAL | 감속 해제 |
| GUARDING | 전방 공격 적중 | 체력 > 감소 데미지 | HIT 또는 GUARDING | 방어 효과 적용 |
| GUARDING | 후방 공격 적중 | 체력 > 데미지 | HIT | 일반 피격 |
| GUARDING | 체력 0 | 항상 | DOWN | 방어 종료 |
| HIT | 경직 종료 | 체력 > 0 | NORMAL | 입력 복구 |
| HIT | 체력 0 | 항상 | DOWN | 입력 차단 |
| DOWN | 경기 재시작 | 상태 초기화 | NORMAL | 체력 복구 |
| 모든 상태 | 플레이어 이탈 | 항상 | DISCONNECTED | 조작 비활성 |
| DISCONNECTED | 재경기/재입장 | MVP 제외 | DISCONNECTED | 유지 |

---

# 5. 팀 링크 상태

## 5.1 상태 정의

| 상태 | 최대 거리 | 설명 |
|---|---:|---|
| `ARM_LOCK` | 1.8m | 기본 팔짱 상태 |
| `HAND_HOLD` | 4.0m | 제한 시간 확장 상태 |
| `DOWN_DRAG` | 조정값 | 한 명 다운 상태 |
| `BOTH_DOWN` | 0 또는 고정 | 두 명 모두 다운 |
| `INVALID` | 없음 | 팀 또는 엔티티 미완성 |

## 5.2 상태 전이표

| 현재 상태 | 이벤트 | 조건 | 다음 상태 | 처리 |
|---|---|---|---|---|
| INVALID | 두 파이터 생성 | 둘 다 정상 | ARM_LOCK | 링크 초기화 |
| ARM_LOCK | 손잡기 입력 | 쿨다운 종료, 둘 다 생존 | HAND_HOLD | 지속 시간 시작 |
| ARM_LOCK | 한 명 다운 | 정확히 한 명 DOWN | DOWN_DRAG | 드래그 설정 |
| ARM_LOCK | 두 명 다운 | 둘 다 DOWN | BOTH_DOWN | 패배 후보 |
| HAND_HOLD | 지속 시간 종료 | 항상 | ARM_LOCK | 쿨다운 시작 |
| HAND_HOLD | 한 명 다운 | 정확히 한 명 DOWN | DOWN_DRAG | 손잡기 종료 |
| HAND_HOLD | 두 명 다운 | 둘 다 DOWN | BOTH_DOWN | 경기 종료 후보 |
| DOWN_DRAG | 생존 파이터 다운 | 둘 다 DOWN | BOTH_DOWN | 팀 패배 |
| DOWN_DRAG | 경기 초기화 | 재경기 | ARM_LOCK | 체력·상태 복구 |
| BOTH_DOWN | 경기 초기화 | 재경기 | ARM_LOCK | 상태 복구 |

## 5.3 링크 거리 보정 상태

링크 상태와 별도로 현재 거리 비율을 계산한다.

| 거리 비율 | 상태 | 처리 |
|---:|---|---|
| 0~70% | `RELAXED` | 일반 이동 |
| 70~90% | `TENSION` | 장력 시각화, 약한 감속 |
| 90~100% | `LIMIT` | 바깥 방향 이동 강하게 제한 |
| 100% 초과 예상 | `CORRECTING` | 예상 이동량 보정 |

거리 비율:

```text
현재 파이터 간 거리 / 현재 링크 상태의 최대 허용 거리
```

---

# 6. AI 상태

## 6.1 상태 정의

| 상태 | 설명 |
|---|---|
| `IDLE` | 짧은 대기 |
| `APPROACH` | 목표에게 접근 |
| `REPOSITION` | 팀원, 벽, 공격 각도를 고려해 위치 조정 |
| `ATTACK` | 공격 수행 |
| `GUARD` | 방어 |
| `RETREAT` | 공격 후 후퇴 |
| `DRAG_ALLY` | 다운된 팀원과 이동 |
| `DOWN` | 전투 불능 |

## 6.2 상태 전이표

| 현재 상태 | 조건 | 다음 상태 |
|---|---|---|
| IDLE | 타깃 존재 | APPROACH |
| APPROACH | 공격 가능 거리 | ATTACK 또는 GUARD |
| APPROACH | 벽/팀원 겹침 위험 | REPOSITION |
| REPOSITION | 적절한 위치 확보 | APPROACH |
| ATTACK | 공격 종료 | RETREAT |
| GUARD | 방어 시간 종료 | APPROACH |
| RETREAT | 안전 거리 확보 | APPROACH |
| 모든 생존 상태 | 팀원 다운 | DRAG_ALLY |
| DRAG_ALLY | 공격 기회 | ATTACK |
| 모든 상태 | 체력 0 | DOWN |

---

# 7. 입력 처리 규칙

## 7.1 입력 가능 여부

| 경기 상태 | 이동 | 공격 | 방어 | 손잡기 | 카메라 |
|---|---:|---:|---:|---:|---:|
| WAITING | 불가 | 불가 | 불가 | 불가 | 가능 |
| COUNTDOWN | 불가 | 불가 | 불가 | 불가 | 가능 |
| PLAYING | 가능 | 가능 | 가능 | 가능 | 가능 |
| FINISHED | 불가 | 불가 | 불가 | 불가 | 가능 |
| DISCONNECTED | 불가 | 불가 | 불가 | 불가 | 가능 |

## 7.2 입력 검증

서버는 다음을 검증한다.

- 요청한 플레이어가 해당 캐릭터의 소유자인가?
- 경기 상태가 `PLAYING`인가?
- 캐릭터가 해당 행동이 가능한 상태인가?
- 공격 및 손잡기 쿨다운이 종료되었는가?
- 입력 시퀀스가 이전 입력보다 최신인가?

---

# 8. 상태 동기화 원칙

서버가 최종 권한을 가지는 상태:

- 룸 상태
- 경기 상태
- 캐릭터 상태
- 링크 상태
- 체력
- 위치
- 속도
- 공격 결과
- 승패

클라이언트 전용 상태:

- 카메라 각도
- 카메라 거리
- 화면 흔들림
- 이펙트 재생 상태
- 사운드 볼륨
- UI 펼침 여부

---

# 9. 상태 초기화 규칙

재경기 시 반드시 초기화한다.

- 플레이어·AI 위치
- 회전
- 속도
- 체력
- 캐릭터 상태
- 공격 쿨다운
- 손잡기 지속 시간
- 손잡기 쿨다운
- 경기 타이머
- 승패 결과
- 재경기 동의
- 누적 히트박스
- AI 타깃
