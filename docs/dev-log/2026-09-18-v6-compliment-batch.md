# 2026-09-18 v6 칭찬 배치 6건 — 집필·조립·등록

- 대상: 4주차 칭찬 6슬롯(중한 실전 번역 `70aada0b`·통역 `0dc6829b` / 화용 번역 `68ec12d5`·통역 `aaaa6149` / 비즈 번역 `b04d4d34`·통역 `809c7ccb`). 판정 = 전면 재집필 5(C)·국소+장면 재집필 1(B, `0dc6829b`).
- 공통 결함(코어 아닌 v5 문항): MJT2 부적절 키의 근거가 공손 등급형이거나 정답이 원문에 없는 구체성을 발명 · MJT5가 2번 원문을 재사용하고 후보 내용이 서로 다름 · `aaaa6149`는 1·2·5·DCT가 한 원문(演讲态度 4회) · `809c7ccb`는 MJT5 「完美无瑕」가 within으로 표시되고 DCT 참고안이 한국어 원문 복사.
- 화행 패턴(배치 1회 확정): MJT2 = 내용 보존·강도만 이동(과잉 3·하향 3) · MJT3 결함 = 범위 확대(이번 작품→그 사람의 재능), 오답 = 근거 누락 + 강도 과잉 · MJT4 결함 = 확인하지 않은 개인 속성 보탬(재능·진로·창업) · MJT5 = 내용 동일, within2·under1·over1. 카탈로그(compliment_grounding_sensitivity)의 강도·범위·개인성 세 축을 문항별로 나눠 맡겼다.
- 코어 수정 1건: `809c7ccb` 코어 원문이 상대를 「B님」으로 부름 → 복제 행에서 「작가님」으로 교체. 이를 위해 `core_overrides.source_text`·`focal_segments`를 조립·등록 스크립트에 추가(원본 행 불변). 조립기는 v5 권장안이 목표문과 같아 `revision_examples`가 없는 자리에 override로 새 값을 넣을 수 있게 완화.
- 결과: 조립 6/6 규칙 pass(warning 0) → 등록 6/6 AI 품질 pass(지적 0) → 운영 규칙검사 pass 5·warning 1(`3515c807` R29 코어 원문 59자, v5 코어 그대로). 새 행 = `3515c807`·`9f1cefc7`·`dea0b68c`·`d37985e5`·`ad8af87d`·`10703387`(generated). 편성 교체는 승인 뒤.
- 산출: readback `Documents/pragma-v6-conversion/readback/2026-09-18_칭찬배치_readback.md` · DeepSeek 검토 docx 70문장 · 연구자 확인 3건(`68ec12d5` DCT 원문 감사 주도 / `b04d4d34` DCT 「당신이」 / `809c7ccb` 코어 교체).
