# Character asset slot

시험 모델 파일을 다음 이름으로 배치한다.

```text
client/public/assets/characters/fighter-test.glb
```

가짜 또는 라이선스가 불명확한 파일은 저장소에 넣지 않는다. 모델을 추가하기 전에 WebGL 배포와
재배포을 허용하는 라이선스를 직접 확인하고 출처·저작자·라이선스를 이 문서에 기록한다.

## 권장 모델 규격

- GLB 권장(GLTF는 외부 texture/bin 경로를 함께 관리해야 함)
- Y-up, 미터 단위, 발바닥 원점
- 모델 정면은 +Z를 기준으로 설정 파일에서 Y 회전 보정
- humanoid A-pose 또는 T-pose
- root motion 없음 권장
- 손 bone: `LeftHand`, `RightHand`
- 연결 anchor 후보: `Spine2`
- animation clip: `Idle`, `Walk`, `Punch_Left`, `Punch_Right`, `Down`

권장 상한은 캐릭터당 약 20k~40k triangles, texture 1K(필요 시 2K), GLB 10MB 이하이며 네
캐릭터 동시 재생을 기준으로 확인한다.

## 시험 활성화

`client/.env.development.local`에 다음을 넣는다.

```text
VITE_ENABLE_CHARACTER_ASSET_TEST=true
VITE_CHARACTER_ASSET_TEST_FIGHTER=player-left
```

파일명, scale, Y offset, 기본 회전, clip/bone 이름은
`client/src/game/characters/characterConfig.ts`에서 수정한다. 로드 실패나 clip/bone 누락은 게임을
중단하지 않으며 캡슐 또는 anchor offset fallback을 사용한다.
