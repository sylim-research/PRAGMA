# 2026-08-05 도달 불가·정적 잔여 화면 정리 (2차 훑기)

## 배경

같은 날 미구현 원자료 취득 경로를 제거한 뒤(`9a20e93`), 4장 캡처 전에 관리자·학습자 화면
전체를 훑었다. 목적은 **동작하지 않거나 실제와 어긋난 화면이 도판·시연에 찍히는 것을 막는 것**이다.

## 이미 정리돼 있던 것 — 손대지 않았다

훑은 결과 대부분은 이미 규율 있게 관리되고 있었다. 기록해 둔다.

- **관리자 메뉴**: `AdminShell.tsx:96`의 `items.filter((item) => !item.pending)`이 `pending: true`
  항목을 메뉴에서 제외한다. 수업 자료 생성·학습 분석·연구 데이터 관리·사용자·권한 4개가
  여기 해당하며 주소로만 접근된다. "눌러 봐야 비어 있는 화면을 보여 주지 않는다"는 의도다.
- **`/mission-legacy`·`/prototype/mission-v2`**: `import.meta.env.DEV` 게이트로 프로덕션에서
  리다이렉트된다. 고정 예시 피드백이 정본 AI 피드백과 혼동되는 것을 막기 위한 기존 조치다.
- **학습자 하단 탭**: 수업·기록·라운지 3개. 홈 탭은 2026-08-01에 제거됐고, 셀프 연습은
  기능이 생기기 전까지 자리표시자로도 노출하지 않는다는 원칙이 지켜져 있다.

## 변경

### 1. `/roadmap`·`/workflow-preview` — 개발 환경 전용으로 내림

- `Roadmap.tsx`(291줄)는 UI 네비게이션에서 링크가 **0개**인데 프로덕션에서 URL로 열렸다.
- 내용이 `getCurrentWeek(): number => 1` **고정값**이고 주석에 "정적 주차표. DB나 주차 배정
  로직과 무관하게 표시용"이라고 적혀 있다. 즉 **실제 편성과 어긋난 주차표**를 보여 준다.
  심사·시연 중에 열리면 곤란하다.
- `WorkflowPreview.tsx`(9줄)는 `/preview/workflow.html` 정적 목업을 iframe으로 띄우며,
  진입점이 Roadmap 안의 버튼 하나뿐이라 한 묶음으로 처리했다.
- 두 화면 모두 파일은 남긴다. 개발 중 참고 가치가 있고, `/mission-legacy`와 같은 방식이다.

### 2. `/admin/course-ops` 라우트 제거

메뉴에 없고 어디서도 링크되지 않는 고아 `AdminPlaceholder` 라우트였다. 교과목 운영은 9월
실증 사안으로 백로그에 있다(`AdminShell.tsx` 주석). `AdminPlaceholder` 컴포넌트 자체는
`/admin/package`·`/admin/users`가 계속 쓰므로 남긴다.

### 3. `src/pages/_deprecated/` 삭제 (6파일 2,496줄)

`Dashboard`·`Finalize`·`Pdr`·`Placeholder`·`ScenarioSelect`·`Translate`.
**어디서도 import되지 않아** 번들에는 들어가지 않았지만, 4장 집필 중 현행 화면과 혼동될
소지가 있었다. git 이력에 남아 복구 가능하다.

## 검증

- `npm run typecheck` 통과. 전체 Vitest **262 pass / 7 skip**(변경 전과 동일). `npm run build` 통과.
- **프로덕션 번들 실측** — `dist/assets/index-*.js`에서:
  - `"/roadmap"` → `element: Navigate to "/learner/course"`
  - `"/workflow-preview"` → `element: Navigate to "/learner/course"`
  - `"/admin/course-ops"` → **번들에 없음**
  - 대조로 기존 `"/mission-legacy"` → `Navigate to "/learner/practice"` (같은 형태)
- DEV(localhost 8096)에서 `/roadmap`이 여전히 렌더되는 것을 확인했다 — 개발 도구로는 유지된다.

## 남긴 것과 이유

| 남긴 것 | 이유 |
|---|---|
| `Roadmap.tsx`·`WorkflowPreview.tsx` 파일 | DEV 전용으로 접근. 15주 골격 참고용 |
| `public/preview/workflow.html`(48KB) | DEV 라우트가 iframe으로 쓴다. 링크 없이 URL로만 도달 |
| `AdminPlaceholder` 컴포넌트 | `/admin/package`·`/admin/users`가 사용 중 |
| `pending: true` 관리자 화면 4개 | 메뉴에서 이미 걸러진다. 목차 4.5.4가 다룰 **구현 범위**의 실물 근거 |
| 라운지(`LoungeHome`·`LoungeCorner`) | **판정 대기.** 아래 참조 |

## 🔴 훑기에서 드러난 사실 — 라운지는 이미 구현·노출 중

- `src/pages/learner/LoungeHome.tsx`(80줄) + `LoungeCorner.tsx`(479줄)가 main에 있고,
  `LearnerBottomNav.tsx:13`에서 **「☕ 라운지」 탭으로 학습자에게 노출**된다. 게이트가 없다.
- 코너 3개 모두 콘텐츠가 들어 있다 — 생생극장·밈 배틀·해독실.
- 2026-08-05 Claude가 "라운지 구현은 미병합 브랜치(`codex/lounge-mockup`)에 있다"고 보고한 것은
  **오류다.** 그 브랜치는 옛 목업이고 실제 라운지는 별도로 main에 들어갔다.
- 논문 영향: 목차 4.4에는 라운지 항이 없고(장면·MPJ·DCT·피드백·기록 5항), 5.5에서 확장 방향으로
  쓰면 사실과 다르다. 심사위원이 탭을 누를 수 있다.
- **삭제·숨김·서술 방식은 연구 서술과 직결되므로 이번 작업에서 손대지 않았다. Fable 검토 대상.**

## 논문 반영 필요

- 4.5.4(학습 분석·연구 데이터 관리의 구현 범위)에 `pending` 4화면을 근거로 쓸 수 있다.
  `[확인 필요]` — 집필 시 실화면과 대조.
- 라운지 처리 방향이 정해지면 4.4 또는 5.5 중 어디서 다룰지 확정한다.
