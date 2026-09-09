# 실제 자료 활용 분석 — 별도 화면 + 보관함 (UI 영향 브리프)

작성 2026-09-09 · 작성자 Claude(opus) · 결정자 = 사용자

> **반영 완료 (2026-09-09).** Codex가 바빠 Claude가 직접 구현했다.
> 승인된 범위대로 **분석 화면 + 보관함**을 만들었고, 논의 중 확장됐던 **라운지 연결은
> 사용자 결정으로 뺐다** — 라운지 문항은 보기·정답까지 있는 퀴즈라 AI 분석이 채워 주는
> 것이 10칸 중 2칸뿐이고, 학습자 라운지는 디펜스에 나오는 확정 화면이라 값이 비쌌다.
> 「분석이 아깝다」는 보관함만으로 해소된다 — 라운지 표현 후보도 보관함에는 남는다.
> 보류분은 저장소 밖
> `l2-pragmatic-translator-archive\2026-09-09-lounge-authoring-parked\`에 패치로 보존.
> 아래 3절의 `lounge_items` 테이블과 4절 이후의 라운지 서술은 그 보류분 기준이다.

---

## 0. 결정된 사항 (2026-09-09, 사용자)

1. 「활용 가능성 분석」을 **별도 메뉴로 만든다.**
2. 「시나리오 개별 생성」 안의 `실제 자료에서 시작하기` 패널은 **새 화면으로 옮긴다 — 병존 없음.**
3. 라운지 표현 후보가 갈 곳이 없으므로 **DB를 만든다. 범위는 보관함까지** —
   학습자 라운지 화면·콘텐츠 소스(`src/lib/lounge/*Items.ts`)는 **건드리지 않는다.**

> 같은 날 오전 커밋 `72cb39bf`가 이 패널을 생성기 안으로 흡수했다. 이 브리프는 그 결정을
> 되돌린다. 되돌리는 이유는 UX 왕복이 아니라 **분석 산출물이 버려지는 것**이다 — 아래 1절.

---

## 1. 왜 되돌리는가 (실측)

`AuthenticImportPanel.tsx` 743줄을 읽고 확인한 현재 동작이다.

| 산출물 | 지금 어떻게 되나 |
|---|---|
| 활용 방향 분석 (담화 상황·표현 특징·추천 근거·적용 가능 화행) | **저장 안 됨.** 화면을 벗어나면 사라진다 |
| 시나리오 후보 | 「이 자료로 시나리오 만들기」를 누른 **1건만** 생성 폼으로 감 |
| 선행 발화 후보 | 같음 |
| 라운지 표현 후보 | **버튼 자체가 없다**(`APPLYABLE`에서 제외, `AuthenticImportPanel.tsx:67-71`). 표시만 되고 소멸 |
| 고르지 않은 나머지 후보 | 소멸 |

즉 분석 1회가 후보 3건을 만드는데 **1건만 건지고 2건은 버린다.** 출처(provenance)는
고른 1건에 한해 코어에 함께 저장된다(`AdminGenerator.tsx:556, 776`) — 그 경로는 유지한다.

라운지는 현재 **DB가 없다.** 콘텐츠가 `src/lib/lounge/cultureItems.ts` 등에 코드로 박혀
있다. 그래서 「라운지로 보내기」는 버튼 하나가 아니라 저장소부터 만드는 일이고, 이번에는
**보관함까지만** 만든다.

---

## 2. UI 영향 브리프

### 2-1. 영향받는 역할·라우트

- 역할: **관리자(교수자)만.** 학습자 화면 영향 없음.
- 새 라우트: **`/admin/authentic`** — 지금 `<Navigate to="/admin/generator">`인 자리
  (`App.tsx:273`)를 실제 화면으로 되돌린다. 옛 링크가 그대로 살아난다.
- 변경 라우트: `/admin/generator` — 패널이 빠지고, `?candidateId=` 진입구가 생긴다.

### 2-2. 현재 동작

`/admin/generator` 상단에 `<details>`로 접힌 `실제 자료에서 시작하기`.
펼쳐서 이미지/문구 입력 → 「활용 가능성 분석」 → 후보 카드 → 「이 자료로 시나리오 만들기」를
누르면 **같은 화면 아래** 생성 조건이 채워진다. 저장은 시나리오를 생성해야만 일어난다.

### 2-3. 제안하는 변경 (보이는 것)

**새 화면 `/admin/authentic` — 「실제 자료 활용 분석」**, 한 화면 두 절:

```
실제 자료 활용 분석
──────────────────────────────
[분석]   좌: 자료 입력(이미지·문구·출처·기본 언어방향)
         우: 활용 방향 분석 + 후보 카드 N개
         카드별 버튼 = 「보관함에 저장」 / 「이 자료로 시나리오 만들기」
──────────────────────────────
[보관함]  저장된 분석 목록 (최근순)
         행 = 원문 발췌 · 유형 배지 · 화행/수준/방향 · 상태 · 저장일
         행 열기 → 후보 카드 재현 → 시나리오로 보내기 / 보류 / 버림
```

- 보관함은 **별도 메뉴로 만들지 않는다.** 같은 화면 아래 절이다. 사이드바를 다시 불리지 않는다.
- 라운지 표현 후보에도 이제 **「보관함에 저장」이 붙는다.** 「시나리오 만들기」는 여전히 없다
  (억지 화행화 금지 — 기존 원칙 유지).

**사이드바** — `2. 학습 미션 재료` 맨 앞에 1개 추가. 그룹 4개가 된다.

```
2. 학습 미션 재료
   실제 자료 활용 분석   ← 신규
   시나리오 생성
   시나리오 배치 생성
   시나리오 라이브러리
```

**`/admin/generator`** — `실제 자료에서 시작하기` `<details>` 블록이 사라진다.
그 자리에 「실제 자료에서 시작하려면 → 실제 자료 활용 분석」 한 줄 링크만 남긴다.

### 2-4. 사용자 동작과 화면 순서

```
실제 자료 활용 분석 → 자료 입력 → 활용 가능성 분석 → 후보 확인
   ├─ 보관함에 저장 → (나중에) 보관함에서 열기 → 시나리오로 보내기
   └─ 이 자료로 시나리오 만들기
          → /admin/generator?candidateId=… 로 이동, 조건 자동 입력
          → 개요 확인 → 시나리오 생성 (기존 흐름 그대로)
```

### 2-5. 표시되는 정보 / 표시하지 않는 정보

표시: 원자료 원문·판독 신뢰도·담화 상황·표현 특징·추천 활용·추천 근거·적용 가능 화행,
후보별 유형·화행·수준·방향·P/D/R·원자료 활용·AI 변형 설명, 보관 상태·저장일·저장자.

표시하지 않음: 업로드 이미지(지금처럼 분석에만 쓰고 저장하지 않는다), 학습자에게는 아무것도.

### 2-6. 로딩·빈 상태·오류·권한

- 로딩: 분석 중 = 기존 버튼 스피너 그대로. 보관함 = 스켈레톤 행.
- 빈 상태: 보관함 0건 → 「분석한 자료가 아직 없습니다. 위에서 자료를 분석해 보세요.」
- 오류: 분석 실패 = 기존 오류 배너. 저장 실패 = 행 위 인라인 오류 + 재시도.
- 권한: `is_admin()` RLS. 비관리자는 라우트 진입 자체가 막힌다(`RequireAdmin`).

### 2-7. 재사용 / 신규

**재사용(수정 최소)**: `AuthenticImportPanel.tsx` 전체 — 오늘 흡수 때도 이 파일은 손대지
않았다. `generate-scenario` edge function의 분석 모드도 그대로. `applyAuthentic`,
`CoreProvenance` 저장 경로도 그대로.

**신규**: 화면 `AdminAuthentic.tsx`(패널 호스트 + 보관함 절), 보관함 목록 컴포넌트,
테이블 2개 + RLS, 후보 저장/조회 훅.

### 2-8. 명시적으로 바뀌지 않는 것

- 학습자 라운지 화면과 `src/lib/lounge/*Items.ts` 콘텐츠 — **손대지 않는다.**
- 시나리오 생성·저장 계약, `scenario_core_v1` 스키마, 생성 프롬프트 — 그대로.
- 사이드바 그룹 1·3·4·5 — 그대로.
- 라운지 표현 후보의 「독립 미션으로 억지 변환하지 않는다」 원칙 — 그대로.

---

## 3. DB 제안 (마이그레이션 push는 별도 승인 필요)

```sql
-- 분석 1회 = 1행
create table public.authentic_analyses (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  source_type text not null,              -- 'image' | 'text'
  source_ref text,                        -- 출처 메모(선택)
  source_original text not null,          -- 관리자가 확정한 원문
  extraction_confidence text,
  scene_ko text,
  linguistic_features_ko text,
  recommendation_reason_ko text,
  recommended_uses text[],
  connectable_speech_acts text[]
);

-- 분석 1회가 낳은 후보 N개
create table public.authentic_candidates (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.authentic_analyses(id) on delete cascade,
  usage_type text not null,               -- scenario_seed | preceding_turn | expression_resource | …
  label_ko text,
  source_text text,
  preceding_turn text,
  situation_seed_ko text,
  source_usage_note_ko text,
  ai_adaptation_note_ko text,
  conditions jsonb not null,              -- 정규화된 enum 묶음(화행·수준·방향·P/D/R·도메인…)
  expression jsonb,                       -- 라운지 표현 후보 전용(text·meaning_ko·example_zh·tags)
  status text not null default 'stored',  -- stored | used | held | discarded
  used_scenario_id text,                  -- 시나리오로 넘어갔을 때 연결
  created_at timestamptz not null default now()
);

-- RLS: 두 테이블 모두 is_admin() 전용 (select/insert/update/delete)
```

> `conditions`를 jsonb로 두는 이유: `AuthenticApply`의 enum 11개를 컬럼으로 펴면 ENUMS.md와
> 이중 관리가 된다. 판정·검색에 쓰이지 않는 보관용이므로 jsonb가 맞다.

---

## 4. 화면 간 인계 방식 — sessionStorage로 되돌아가지 않는다

오전 커밋이 없앤 것이 `sessionStorage` 왕복이다(`AUTHENTIC_HANDOFF_KEY`). 패널을 다시
분리하면 인계가 필요해지는데, **그 키를 되살리지 않는다.**

후보를 보관함에 저장한 뒤 **`/admin/generator?candidateId=<uuid>`** 로 넘긴다.
생성기는 마운트 시 그 id로 후보를 읽어 `applyAuthentic`에 넣는다.

- 새로고침해도 살아 있다(sessionStorage는 아니었다).
- 「아깝다」의 원인이 그대로 해결된다 — 넘긴 후보도 보관함에 남는다.
- 죽은 export `AUTHENTIC_HANDOFF_KEY`(`AuthenticImportPanel.tsx:220`)는 이때 삭제한다.

값싼 대안(보관 없이 `navigate(state)`로 넘기기)도 가능하지만, 그러면 저장되지 않는 경로가
다시 생긴다 — 이번 작업의 목적과 어긋나므로 권하지 않는다.

---

## 5. 깨지는 것 (구현 시 반드시 함께 고칠 것)

| 대상 | 무엇이 깨지나 |
|---|---|
| `src/pages/admin/AuthenticInGenerator.test.tsx` | **전부 반대 방향을 단언한다** — 패널이 생성기 안에 있을 것, 사이드바에 `/admin/authentic`이 없을 것, sessionStorage가 없을 것. 재작성 필요 |
| `src/lib/admin/adminNavigation.test.ts` | 그룹 2 항목 배열 단언(3개 → 4개) |
| `src/lib/admin/adminNavigation.ts` | 그룹 2에 항목 1개 추가 |
| `src/App.tsx:273` | `Navigate` → 실제 라우트 + lazy import |
| `src/pages/admin/AdminGenerator.tsx` | `<details>` 블록 제거, `?candidateId=` 진입구 추가. `applyAuthentic`·`authenticProv`는 유지 |
| `src/integrations/supabase/types.ts` | 새 테이블 2개 타입 재생성 |
| `adminMobileNavValue("/admin/authentic")` | 지금 `""`를 반환하도록 단언돼 있다 → 실제 경로로 바뀜 |

라우트·권한·기존 시나리오 데이터에는 영향 없다.

---

## 6. 승인이 필요한 지점

1. **이 브리프 전체** (새 메뉴·새 화면 = UI 게이트)
2. **마이그레이션 원격 push** (`supabase db push`) — 별도 승인. 로컬 파일 작성까지는 무방
3. 구현 담당이 Codex인지 확인

## 7. 일정 메모

2026-09-09는 학위논문 전체 초안 마감일이다. 이 작업은 초안 집필과 병렬이며 웹앱 쪽
보완이다. 사용자가 이 순서를 확인했다.
