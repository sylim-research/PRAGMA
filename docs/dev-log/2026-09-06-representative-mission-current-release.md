# 대표 미션 시연의 현행 콘텐츠 연결

- 사용자 오류 화면: `/demo/mission`에서 `실행할 수 없는 학습 콘텐츠 상태입니다(reviewed)` 표시.
- 원인: 기본 대표 미션 ID가 과거 release의 `e5d5e841-df2e-4f45-b938-68524f9562b1`로 남아 있었다. reviewed 상태만으로는 현재 release 실행 조건을 만족하지 않는다.
- 수정: 기본값 한 곳을 현재 공개·편성된 화용 교과목 2주차 요청 번역 `f8de3f59-cd86-4636-b516-a8ead78ac0ac`로 교체했다. 현재 release 공개 경계와 시연 수행 기록 저장 차단은 유지한다.
- 사전 근거: 직전 운영 조회에서 대체 미션의 현행 release·reviewed·MJT5+DCT1과 학습자 실행을 확인했다. 비공개 증거 `C:/PRAGMA_THESIS_LOCAL/05_증거/교과목콘텐츠/2026-09-06_앱반영/after.json`, `verification.json`, `ui-check.md`.
- 검증: 단순 ID 교체에 상수 복제 테스트는 추가하지 않는다. PR 필수 CI의 typecheck·전체 테스트·운영 빌드를 통과한 뒤 main 배포의 `/demo/mission` 진입을 확인한다. 실제 결과는 아래 후속 기록에 남긴다.
- 분류: 단독 진행 적합. 이미 확정된 연결의 설정 수정이며 학습설계·생성계약·평가 변경이 없어 별도 research-trail은 갱신하지 않는다.
