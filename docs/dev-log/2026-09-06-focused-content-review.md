# 생성 품질점검 재사용과 교수자 승인 경량화

- 사용자 결정: 필수 다중 모델 전수 검토를 반복하지 않고 실제 문제만 수정한다.
- 변경: focused_v1 정책, 현재 생성 quality_check 재사용, 선택적 독립 검토, 중대·판단 필요 지적 중심 교수자 결정. 기존 승인 이력과 저장된 보류는 유지한다.
- 검증: 승인 경계 PGlite 10개 통과. UI·도메인 검증 및 운영 적용은 아래 최종 기록에 추가한다.
- 연구 기록: DEC-20260906-03, 생성계약·관리자구조 정본 갱신. 학습자 수행 구조는 변경하지 않는다.
- 운영/콘텐츠: 아직 이번 변경의 배포와 현재 후보 연결을 완료했다고 보지 않는다. 실제 교수자 승인·학습자 편성은 포함하지 않는다.

## 실제 적용 결과

- PR88 818db3c → main f420fade574a31d45c8896bbbb5f453e8e61b7bf. 필수 CI 34021273524: 763 passed/9 skipped, DB 경계 10개, typecheck·production build 성공.
- DB migration 20260906100000 적용, content-review Edge v15. Railway deployment 6290811320은 동일 main SHA로 success.
- Claude에 커밋 diff·SQL을 제공한 읽기 전용 검토에서 P0/P1 지적 없음. 도구를 비활성화했으므로 응답 내 도구 호출 표기는 실제 파일 재검토 증거로 사용하지 않는다. 원문은 비공개 증거 폴더 focused-review.json에 보존.
- 7개 미션의 판정·해설·원문 누락·역할 불일치를 AI 편집 출처로 저장했다. 기존 core·DCT source·학습 목표·버전 이력은 보존. 3개는 구조검사 보류 단계에서 PDR 조건을 고쳤고, 최종 7개는 기존 quality critic 각 1회 후 warning으로 저장. 교수자 수정·승인으로 기록하지 않음.
- 2026-09-06T08:28:43.741Z DB snapshot: 54개 모두 저장된 생성 quality_check를 무료 연결. 생성 fail 0, 기존 모델 지적의 교수자 우선 확인 11개, 교수자 승인 0. 기존 편성 23건은 초기 snapshot과 정확히 일치.
- 실제 연결 시 전체 inspection이 expectedVersion에 들어가 요청 크기 제한에 걸린 기존 클라이언트 문제를 발견했다. API 경계에서 두 hash만 추려 전송하도록 수정했고 회귀 테스트 1개와 실제 54개 연결로 확인.
- 교과목 검토본 v2는 ‘쟁점 우선 확인’과 ‘기본 점검 완료’로 표시한다. 36개 전수 다중 모델 재검토나 자동 교수자 승인 없음. 실제 수업 채택 여부는 교수자 판단으로 남는다.
- 비공개 증거: C:/PRAGMA_THESIS_LOCAL/05_증거/교과목콘텐츠/2026-09-06_경량검수/review-book.html, bundle-data.json, bundle.sha256, editorial-proposals.json, editorial-state.json, focused-state.json. 이전 초안 폴더는 보존.
