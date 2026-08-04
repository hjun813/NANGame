# 캐릭터 에셋 시험 적용 가이드

## 구조

```text
서버 FighterState / attackId / position
  → Arena Fighter(Rapier body 유지)
    → CharacterView(FighterRoot와 anchor)
      → CharacterAnimationController(시각 상태만 관리)
      → GLTFLoader + SkeletonUtils.clone
      → Capsule fallback
```

모델, skeleton, animation은 서버 판정·Rapier collider·이동 좌표를 변경하지 않는다. AnimationMixer가
scene root position을 갱신하더라도 매 프레임 설정 offset으로 복원하여 시각 root motion이 FighterRoot로
전파되지 않게 한다.

## 상태 매핑

| 서버/이동 상태 | clip | clip 누락 시 |
|---|---|---|
| NORMAL + 정지 | `Idle` | 정지 pose |
| NORMAL + 이동 | `Walk` | 정지 pose |
| ATTACK_* + LEFT | `Punch_Left` | 왼쪽 시각 기울기와 왼쪽 anchor |
| ATTACK_* + RIGHT | `Punch_Right` | 오른쪽 시각 기울기와 오른쪽 anchor |
| DOWN | `Down` | 슬롯 방향으로 눕힘 |
| resetRevision | `Idle` | 정상 자세 복원 |

공격 clip은 `WINDUP + ACTIVE + RECOVERY = 0.7초`에 맞게 timeScale을 계산한다. 동일 attackId의
세 단계 전환은 clip을 다시 시작하지 않고, 증가한 attackId만 새 공격으로 재생한다. 반대쪽 공격 clip을
자동 대체하지 않는다.

## 모델 조정 순서

1. `fighter-test.glb`를 `client/public/assets/characters/`에 둔다.
2. 개발 전용 시험 플래그를 켜고 `player-left`만 적용한다.
3. `characterConfig.ts`에서 scale, `positionOffset.y`, `rotationOffsetY`를 맞춘다.
4. 실제 clip과 bone 이름을 GLB 목록에 맞춘다.
5. 발/캡슐 중심, LEFT 공격, 손 anchor, 가슴 link anchor를 확인한다.
6. DOWN 상태로 끌려갈 때 pose와 reset 후 원상 복귀를 확인한다.
7. 라이선스와 출처를 asset README에 기록한다.

## 네 캐릭터 확장 조건

- 같은 URL은 Promise cache로 한 번만 읽고 각 파이터는 `SkeletonUtils.clone`된 skeleton을 사용한다.
- 각 CharacterView는 별도 AnimationMixer와 clone material을 사용한다.
- cached 원본 geometry/texture는 파이터별 destroy에서 dispose하지 않는다.
- 파이터별 clone material, fallback geometry/material, mixer는 destroy에서 정리한다.
- 네 파이터 적용 전 저사양 PC에서 초기 로딩, 네 mixer CPU 비용, GPU memory를 측정한다.

모델의 skeleton/clip/bone 구성과 라이선스를 확인하기 전에는 production 플래그를 활성화하지 않는다.
