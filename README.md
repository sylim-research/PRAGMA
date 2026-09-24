<p align="center">
  <img src="docs/brand/banner.svg" alt="PRAGMA — AI 기반 한·중 통번역 학습 워크플로우 개발 연구" width="100%">
</p>

[![Live](https://img.shields.io/badge/live-pragma.up.railway.app-2ea44f?style=flat-square)](https://pragma.up.railway.app)
[![CI](https://github.com/sylim-research/PRAGMA/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sylim-research/PRAGMA/actions/workflows/ci.yml)
![Status](https://img.shields.io/badge/status-research_in_progress-blue?style=flat-square)
![Stack](https://img.shields.io/badge/React_18-TypeScript-3178c6?style=flat-square)
![Backend](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=flat-square)

**같은 뜻이라도 상황과 관계에 따라 적절한 표현은 달라집니다.**

PRAGMA는 이 **화용적 적절성**을 한·중 통번역 학습의 중심 과제로 다루는 수업 연계형 연구 플랫폼입니다.
학습자는 표현 후보를 비교해 판단하고, 직접 번역·통역한 뒤, 피드백을 검토해 수정합니다.
그 과정 전체가 판단 근거·최초안·수정안과 함께 기록됩니다.

PRAGMA는 최적 번역을 자동으로 제시하는 번역기나 범용 LMS가 아닙니다.
화행과 상황 조건을 통제해 학습 콘텐츠를 만들고, 교수자가 승인한 미션만 수업에 배치하며,
학습자의 수행을 버전과 함께 관리합니다. 전체 순환은 **콘텐츠 생성 → 검수·승인 → 수업 배치 → 학습 수행 → 기록**입니다.

대외 과업명은 **MJT**(Metapragmatic Judgment Task)와
**DCT**(Discourse Completion Task)를 사용합니다. 코드·DB의 기존 `mpj_*` 이름은 내부 호환
식별자이며, 현행 학습 미션의 대외 표기는 **MJT5 + DCT1**입니다.

<p align="center">
  <img src="docs/screenshots/01-landing.png" alt="PRAGMA 메인 화면 — 학습자·교수자 진입" width="100%">
  <br>
  <sub><b>메인 화면</b> · 학습자·교수자 진입</sub>
</p>

<p align="center">
  <img src="docs/screenshots/02-architecture.png?v=20260905-minimal" alt="PRAGMA 통합 워크플로우 개요" width="100%">
  <br>
  <sub><b>통합 워크플로우</b> · 콘텐츠 생성 → 검수·승인 → 수업 배치 → 학습 수행 → 기록</sub>
</p>

<br>

## 연구 설계와 시스템 구현

| 설계 원칙 | 시스템 구현 |
|---|---|
| **판단 선행 설계** | 적절성 판단(MJT 5문항) → 번역·통역 산출 → 피드백 검토 → 표적 수정 |
| **생성·승인 권한 분리** | AI 생성·자동 검사는 후보 제안까지 — 수업 배치는 교수자 승인 콘텐츠만 |
| **수행 과정 기록** | 판단 · 선택 근거 · 최초안 · 수정안을 맥락·버전과 함께 저장 |
| **생성 조건 추적** | 프롬프트 스냅숏·해시 고정, 규칙 검사·스키마의 결정성 CI 검증(생성 결과의 재현을 보장하지 않음) |

학습 내용은 다음 조건의 조합으로 구성합니다.

| 학습 구인 | 구성 |
|---|---|
| 목표 화행 | 요청 · 거절 · 사과 · 감사와 대응 · 불만 제기 · 칭찬과 대응 · 초대와 권유 · 제안과 조언 · 반대와 이견 (9개) |
| 상황 변수 | 상대적 권력(P) · 사회적 거리(D) · 행위 부담도(R) 각 3수준 |
| 수행 방식 | 한→중 · 중→한 × 번역 · 통역 |
| 지원 수준 | 입문 · 중급 · 고급 |

<br>

## 핵심 워크플로우

### 콘텐츠 생성·검수

```text
화행·수준·수행 방식·언어 방향·P/D/R·주제 조건
→ 시나리오 코어 생성
→ 선택 코어를 Full Mission으로 조립
→ 규칙 기반 검사
→ 프롬프트 통제 기반 AI 검토
→ 교수자 검수·승인
→ 15주 강좌의 주차에 배치
```

- 시나리오 코어는 상황·관계·원문·선행 발화와 생성 조건을 담고, 판단 문항이나 참고안은 포함하지 않습니다.
- 선택한 코어만 완전한 학습 미션으로 조립합니다. 신규 미션은 생성 직후 검수 대기 상태이며, 교수자가 공개 가능하다고 판단한 뒤에만 승인 상태가 됩니다.
- 규칙 검사와 AI 검토에는 승인 권한이 없습니다. AI 모델 간 독립 검토 결과도 읽기 전용 결함 탐지 자료이며, 이견은 연구자 판단으로 넘깁니다.
- 프롬프트·스키마·콘텐츠의 세대가 바뀌면 판본을 분리해 구세대 콘텐츠와 섞지 않습니다.

### 학습자 수행

공식 학습 경로는 교강사가 게시한 15주 수업입니다.

```text
수업·주차 선택
→ 도입 장면과 Can-do·예습 자료
→ 표현 감각 익히기(MJT 5문항)
→ 직접 번역하기 또는 직접 통역하기(DCT 1회)
→ 의미적 충실성·언어적 정확성·화용적 적절성 피드백
→ 필요 시 한 번 다듬기
→ 최초안·수정안·판단 기록 확인
```

현행 학습 미션은 **MJT5 + DCT1**입니다. 피드백과 수정은 독립 미션이 아니라 DCT 뒤에 이어지는 단계입니다.

1. **첫인상 판단** — 표현을 4점 척도로 판단하고 적절/부적절 방향을 비교합니다.
2. **맥락 대비 판단** — 같은 화행을 조건이 다른 장면에 놓고 과소·적정·과잉을 판단합니다.
3. **판단하고 고쳐보기** — 부적절 여부를 판단한 뒤 수정안 3개 중 권장안 1개를 고릅니다.
4. **이유 찾기** — 해당 표현이 상황에 맞지 않는 가장 큰 이유 하나를 고릅니다.
5. **여러 초안 비교** — 여러 초안을 한 화면에서 비교해 BEST와 WORST를 하나씩 고릅니다.
6. **직접 산출(DCT)** — 같은 화용 초점의 새 사건을 직접 번역하거나 통역합니다.

AI 피드백은 의미적 충실성, 언어적 정확성, 화용적 적절성의 세 영역을 분리합니다. 수정이 권고되면 수정안을 확정하거나, 이의 제기에 근거를 남기고 최초안을 최종안으로 유지할 수 있습니다. AI 피드백과 다르다는 이유만으로 점수나 화용 능력 지표를 만들지 않으며, 학습자는 이견을 남길 수 있습니다.

※ 과제 명칭은 대외적으로 **MJT**(메타화용적 판단 과제)·**DCT**(담화완성과제)를 사용합니다. PRAGMA의 DCT는 자유 산출형 담화완성과제의 형식을 참고한 **DCT형 통번역 산출 과제**로, 출발텍스트의 핵심 의미와 화행 목적을 목표어로 재실현하는 통번역 과제이며 일반 DCT와 동일한 과제로 간주하지 않습니다. 코드·DB의 내부 식별자는 개발 이력 보존을 위해 당시 명칭 `mpj*`를 유지합니다.

### 교수자 운영

관리자 화면은 콘텐츠 CRUD가 아니라 생성부터 수업 배치까지의 게이트를 운영합니다.

- 실제자료 분석과 콘텐츠 후보 추출, 조건을 지정한 코어 생성과 승인된 배치 실행
- 셀·상태별 라이브러리 탐색과 코어→미션 조립
- 규칙 검사·AI 검토 근거를 포함한 교수자 검수와 `reviewed` 승인
- 강좌 설정, AI 자동 편성, 주차별 조정을 통합한 15주 교과목 설계
- 학습자 접근·참여 상태와 수행·의사결정 기록 조회, 프롬프트 지문·AI 독립 검토 결과의 읽기 전용 확인

<br>

## 연구 추적 구조

PRAGMA는 결과물뿐 아니라 결과가 만들어지고 검토된 조건을 연결해 남깁니다.

| 단계 | 남기는 핵심 기록 |
|---|---|
| 콘텐츠 생성 | generation run, 생성 조건, model/provider, schema·prompt version |
| 프롬프트 | Edge 실행 정본의 snapshot과 hash, 저장 콘텐츠와의 지문 일치 여부 |
| 자동 점검 | 결정론적 검사와 프롬프트 통제 기반 검토 |
| 검수·승인 | 생성 상태와 교수자 검수·승인 상태의 분리 |
| 학습 수행 | MJT 선택 기록, 최초 산출, 피드백 스냅숏, 수정 산출, 학습자 이견 |
| 설계 연구 | 설계 추적, 결정, 반복 개발, 증거 색인 |

> 학습 기록은 수업 운영을 위한 것이며, 별도 동의 없이 연구 자료로 사용하지 않습니다.

<br>

## 논문과 코드의 대응

학위논문 제4장(워크플로우 개발)과 부록이 서술하는 구현은 다음 경로에서 확인할 수 있습니다.

| 논문 | 내용 | 주요 경로 |
|---|---|---|
| 4.1 | 개발 환경, 프롬프트·코드·문서의 변경 추적 | [`docs/research-trail/`](docs/research-trail/) · [`docs/dev-log/`](docs/dev-log/) |
| 4.2 | 시스템 구성, 접근 권한, 데이터 구조 | [`supabase/migrations/`](supabase/migrations/) (RLS 포함) · [`src/App.tsx`](src/App.tsx) (화면 경로·권한) |
| 4.2.3 | 콘텐츠·프롬프트·버전 추적 | [`src/lib/pragma/promptSnapshot.generated.ts`](src/lib/pragma/promptSnapshot.generated.ts) · [`src/lib/pragma/missionLineage.ts`](src/lib/pragma/missionLineage.ts) |
| 4.3.1–4.3.2 | 근거 자료 관리, 시나리오·학습 미션 생성 | [`AdminGenerator.tsx`](src/pages/admin/AdminGenerator.tsx) · [`AdminAssembly.tsx`](src/pages/admin/AdminAssembly.tsx) · [`supabase/functions/generate-scenario/`](supabase/functions/generate-scenario/) |
| 4.3.3 | 자동 품질 점검과 AI 검토 | [`src/lib/pragma/missionRules.ts`](src/lib/pragma/missionRules.ts) · [`supabase/functions/content-review/`](supabase/functions/content-review/) |
| 4.3.4 | 콘텐츠 감수·승인과 공개 | [`AdminAssembly.tsx`](src/pages/admin/AdminAssembly.tsx) (검수 모드) · [`ContentReviewPanel.tsx`](src/components/admin/ContentReviewPanel.tsx) |
| 4.4 | 학습자 워크플로우 (판단 → 통번역 산출 → AI 피드백 → 유지/수정) | [`CanonicalMissionRun.tsx`](src/pages/learner/CanonicalMissionRun.tsx) · [`src/lib/mission/missionFeedback.ts`](src/lib/mission/missionFeedback.ts) |
| 4.4.5 | 개인별 학습 기록 조회 | [`LearnerRecords.tsx`](src/pages/learner/LearnerRecords.tsx) |
| 4.5 | 교과목 편성, 학급 응답 집계, 수행 기록 관리 | [`AdminComposer.tsx`](src/pages/admin/AdminComposer.tsx) · [`AdminClassResponses.tsx`](src/pages/admin/AdminClassResponses.tsx) · [`AdminLearners.tsx`](src/pages/admin/AdminLearners.tsx) |
| 4.6 | 회귀 시험과 릴리스 점검 | [`.github/workflows/`](.github/workflows/) · [`tests/`](tests/) · [`scripts/verify-production-source.mjs`](scripts/verify-production-source.mjs) |
| 부록 A | 운영 프롬프트 | [`src/lib/pragma/promptSnapshot.generated.ts`](src/lib/pragma/promptSnapshot.generated.ts) (Edge 실행 정본의 스냅숏) |
| 부록 C | 자동 품질 점검 규칙 | [`src/lib/pragma/missionRules.ts`](src/lib/pragma/missionRules.ts) (실행 정본) · [`src/lib/pragma/qualityRuleCatalog.ts`](src/lib/pragma/qualityRuleCatalog.ts) (설명) |

문서 폴더의 구성과 각 문서의 지위는 [`docs/README.md`](docs/README.md)에 정리했습니다.

<br>

## 기술 스택

<table>
  <thead>
    <tr><th width="170" align="left">영역</th><th align="left">현재 구성</th></tr>
  </thead>
  <tbody>
    <tr><td>프론트엔드</td><td>React 18.3, Vite 5.4, TypeScript 5.8, React Router 6.30</td></tr>
    <tr><td>UI</td><td>Tailwind CSS 3.4, Radix UI·shadcn/ui 계열 컴포넌트</td></tr>
    <tr><td>상태·데이터</td><td>TanStack Query 5, Zod 3</td></tr>
    <tr><td>백엔드</td><td>Supabase JS 2.106, Postgres, Auth, RLS, Edge Functions</td></tr>
    <tr><td>AI 콘텐츠</td><td>OpenAI Chat Completions: <code>gpt-4.1-mini</code>, <code>gpt-4o</code>, <code>gpt-4.1</code></td></tr>
    <tr><td>학습자 피드백</td><td><code>gpt-4.1-mini</code>, 가용성 대체 <code>gpt-4o-mini</code></td></tr>
    <tr>
      <td>AI 검토(콘텐츠)</td>
      <td>규칙 검사 → OpenAI <code>gpt-4.1</code> 검토<br>
        → Anthropic Claude 검토(<code>CLAUDE_AUDIT_MODEL</code>, claude-opus-5 계열)<br>
        → OpenAI <code>gpt-4.1</code> 지적별 재검토</td>
    </tr>
    <tr><td>음성</td><td>OpenAI <code>gpt-4o-transcribe</code>, ElevenLabs <code>eleven_multilingual_v2</code>, OpenAI TTS 대체 경로</td></tr>
    <tr><td>배포</td><td>Railway 정적 프론트엔드 + Supabase 백엔드</td></tr>
    <tr><td>검증</td><td>Vitest 3, Testing Library, Playwright, ESLint, TypeScript</td></tr>
  </tbody>
</table>

AI 검토는 생성 모델과 다른 계열의 모델이 교차 검토하며, 어느 단계도 승인 권한이 없습니다.

## 연구 정보

이 저장소는 박사학위논문 「AI 기반 한·중 통번역 학습 워크플로우 개발 연구」의 설계·개발 산출물입니다.

---

Copyright (c) 2026 Soyoung Lim
