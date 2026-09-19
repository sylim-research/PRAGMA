# 2026-09-19 — 가상 응답 토론 시연 화면 (논문 제5장 도판용)

논문 제5장 수업 활용 예시에 넣을 「가상 응답 분포로 교수자가 토론을 이끄는 장면」 도판을 만들기 위한
**개발 모드 전용 시연 화면**이다. 실제 학급 집계·저장 기능의 검증이 아니다.

## 만든 것

- 경로 `/dev/virtual-response-demo` — `import.meta.env.DEV`일 때만 lazy import와 route가 생긴다.
  운영 빌드에는 페이지 코드가 들어가지 않는다(아래 검증).
- fixture `src/lib/demo/virtualClassResponseFixture.ts` — 가상 건수·콘텐츠·출처를 한곳에 둔다.
- 화면 `src/pages/dev/VirtualResponseDiscussionDemo.tsx` — 운영 `ClassResponseDashboard`를 그대로 재사용한다.
  대시보드에는 선택 prop `figureOnly`(기본 false)만 더했다. 켜면 집계 요약 줄과 문항 선택 줄을 숨긴다.
  운영 학급 응답 화면은 이 prop을 쓰지 않으므로 달라지지 않는다.

## 사용한 콘텐츠와 판본

- `scenarios.scenario_id = 3cde65a4-173c-4bc2-b5af-85d806c1bacb`의 MJT1(`mpj_items[0]`, `scale4`)이다.
  `mission_v6`, 요청(request), 한→중, 번역이다.
  `mission_status = reviewed`(2026-09-16 16:32 UTC)이고, `content_hash = aac41d2fe6d69c8369e33b4d77ff5b8b20c601e3ce874f5e22ce643e52965fb2`이다.
  이 행을 대체한 새 판은 없다. 편성 위치는 「AI 한중 화용 통번역」 2주차 1번이다.
- 2026-09-19 운영 DB 읽기 전용 조회로 확인했다. 가져온 값은 상황·관계·원문·판단 대상 표현·문항 제목·척도 질문이다.
  모두 DB 값을 글자 그대로 옮겼다. 척도 라벨 네 개는 학습자 화면의 척도 라벨과 같다.
- DB 행의 내부 `title`(「[v6 E2E 1 최종] 이웃에게 택배…」)은 MJT 내용과 맞지 않는 옛 이름표다. 화면에는 쓰지 않는다.
- 정답 키(`reference_scale_code = very_appropriate`, 허용 = 매우·다소 적절)와 해설은 화면에 싣지 않았다.
  가상 분포의 최다 응답(다소 부적절 40%)이 콘텐츠의 참고 판단과 다르다는 점은 설명 목적의 가상 수치에서 생긴 결과다.

## 가상 데이터

- Codex가 설명 목적으로 정한 가상 분포다. 20건 = 매우 적절 3(15%) · 다소 적절 7(35%) · 다소 부적절 8(40%) · 매우 부적절 2(10%).
- 로컬 fixture일 뿐이다. 계정·수행 기록·DB 행은 만들지 않았다.
- 척도 순서대로 표시하고 많이 고른 순으로 재정렬하지 않는다. 정답·오답 표시는 없다. 막대 색은 중립색 한 가지(`#344F63`)다.
- 그림 안에 「연구자가 구성한 가상 응답 20건 · 실제 학습자 자료 아님」을 항상 표시한다.

## 검증 범위

- 표적 테스트 `VirtualResponseDiscussionDemo.test.tsx`에서 확인한 것:
  - 합계 20과 반올림 비율 15·35·40·10(합 100)
  - 그림 안의 가상 자료 문구·상황·원문·판단 대상 표현
  - 척도 순서의 「라벨·비율·건수」
  - 질문 세 개
  - 운영 요약·문항 선택 줄이 없음
- `npm run typecheck`와 전체 테스트(1032 통과 · 9 건너뜀)를 통과했다.
- `npm run build`(운영) 결과물 `dist/`에서 시연 경로·페이지 이름·가상 자료 문구를 검색해 0건을 확인했다.
  CSS 경고 1건(`-: T`)은 이 변경 전 브랜치에서도 나는 기존 경고다.
- 도판: Playwright(headless Chromium)로 그림 영역(`#virtual-response-figure`)만 캡처했다.
  viewport 1280×1400, deviceScaleFactor 2, 그림 폭 1000 CSS px → PNG 2002×1870 px(150 mm에 넣으면 약 339 DPI).
  저장 위치: `C:\PRAGMA_THESIS_LOCAL\03_그림표\그림\D-5.3-가상응답토론예시_2026-09-19.png`.
- 검증하지 않은 것: 실제 학급 응답 집계·최소 인원·마감 공개 조건·저장 경로. 이 시연은 그것을 대신하지 않는다.
