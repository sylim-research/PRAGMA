<p align="center">
  <img src="docs/brand/banner.svg" alt="PRAGMA: AI 기반 한·중 통번역 학습 워크플로우" width="100%">
</p>

<p align="center">
  <a href="https://pragma.up.railway.app"><img src="https://img.shields.io/badge/웹앱_바로가기-pragma.up.railway.app-F2C744?style=flat-square&labelColor=131C2B" alt="웹앱 바로가기"></a>
  <a href="https://github.com/sylim-research/PRAGMA/actions/workflows/ci.yml"><img src="https://github.com/sylim-research/PRAGMA/actions/workflows/ci.yml/badge.svg?branch=main" alt="자동 검사"></a>
</p>

<h3 align="center">같은 뜻도, 상황과 관계에 따라 다르게 표현합니다.</h3>

<p align="center">
PRAGMA는 화용적 적절성을 중심으로 설계한 한·중 통번역 학습 시스템입니다.<br>
학습자는 주어진 원문의 의미와 화행목적, 그리고 상황·관계에 맞게 통번역합니다.
</p>

<br>

<table>
  <thead><tr><th width="319" align="left">작업 결과</th><th width="360" align="left">링크</th></tr></thead>
  <tbody>
    <tr><td>🖥️&nbsp;&nbsp;웹앱</td><td><b><a href="https://pragma.up.railway.app">pragma.up.railway.app</a></b></td></tr>
    <tr><td><img src="docs/brand/icons/structure.svg" width="18" height="18" align="absmiddle" alt="">&nbsp;&nbsp;PRAGMA 시스템 구조</td><td><a href="https://pragma.up.railway.app/architecture">pragma.up.railway.app/architecture</a></td></tr>
    <tr><td><img src="docs/brand/icons/mission.svg" width="18" height="18" align="absmiddle" alt="">&nbsp;&nbsp;대표 학습 미션</td><td><a href="https://pragma.up.railway.app/demo/mission">pragma.up.railway.app/demo/mission</a></td></tr>
  </tbody>
</table>

> <small>PRAGMA의 핵심 화면 세 곳으로 바로 이동할 수 있습니다.</small>

<br>

## 1. PRAGMA 시스템 구조

<p align="center"><img src="docs/figures/fig1-pragma-workflow.png" alt="PRAGMA 시스템 구조: 콘텐츠 제작 워크플로우, 수업 운영, 통번역 학습 워크플로우와 되먹임" width="100%"></p>

> <small>두 핵심 워크플로우(콘텐츠 제작·통번역 학습)를 수업 운영으로 잇고, 학습 수행 기록과 메타화용 토론의 결과를 다시 콘텐츠 검토로 되돌립니다.</small>

<br>

## 2. 학습 미션의 화용론적 설계

<table>
  <thead><tr><th width="165" align="left">조건</th><th width="595" align="left">구성</th></tr></thead>
  <tbody>
    <tr><td>목표화행</td><td>요청&ensp;|&ensp;거절&ensp;|&ensp;사과&ensp;|&ensp;감사&ensp;|&ensp;불만&ensp;|&ensp;칭찬&ensp;|&ensp;초대&ensp;|&ensp;제안&ensp;|&ensp;반대</td></tr>
    <tr><td>상황·관계 조건</td><td>상대적 권력(P)&ensp;|&ensp;사회적 거리(D)&ensp;|&ensp;행위 부담도(R)</td></tr>
    <tr><td>언어방향</td><td>한→중 · 중→한</td></tr>
    <tr><td>수행 방식</td><td>번역 · 통역</td></tr>
    <tr><td>학습자 수준</td><td>입문&ensp;|&ensp;중급&ensp;|&ensp;고급</td></tr>
  </tbody>
</table>

> <small>9개의 목표화행과 상황·관계 조건(Brown &amp; Levinson(1987)의 P·D·R을 해석 틀로 삼음)을 달리하여 미션을 구성합니다.</small>

<br>

## 3. 통번역 학습 워크플로우

<p align="center"><img src="docs/figures/fig3-learning-mission.png" alt="통번역 학습 워크플로우: 다섯 개의 MJT 판단 문항과 하나의 DCT형 통번역 과제로 구성된 학습 미션" width="100%"></p>

- **학습 미션**은 다섯 개의 MJT 판단 문항과 하나의 DCT형 통번역 과제로 구성됩니다.
- **MJT 판단 문항**에서는 제시된 표현의 화용적 적절성을 판단하고 선택하거나 수정합니다.
- **통번역 과제**에서는 초안에 1차 AI 피드백을 받고, 수정하면 수정안에 2차 AI 피드백을 한 번 더 받습니다. 초안을 유지할지 수정안을 택할지, 최종안은 학습자가 결정합니다.
- **번역과 통역** 미션은 같은 구성을 따르며, 통역 미션에서는 음성 인식(STT)과 음성 합성(TTS)을 사용합니다.

<br>

## 4. 콘텐츠 제작 워크플로우

<p align="center"><img src="docs/figures/fig2-content-workflow-authority.png" alt="콘텐츠 제작 워크플로우" width="100%"></p>

> <small>AI 생성 콘텐츠는 규칙 기반 자동 품질 점검과 AI 검토를 거쳐 교수자가 감수하고 최종 승인합니다.</small>

<br>

## 5. 수업 연계와 운영

<table>
  <thead><tr><th width="165" align="left">기능</th><th width="595" align="left">내용</th></tr></thead>
  <tbody>
    <tr><td>교과목 편성</td><td>번역·통역·통번역 교과목의 15주 계획에 승인된 학습 미션을 주차별로 배치</td></tr>
    <tr><td>학습자 관리</td><td>프로필 작성과 교수자의 가입 승인을 마친 학습자가 교과목에 참여</td></tr>
    <tr><td>메타화용 토론</td><td>학습자 응답 분포와 선택 이유를 바탕으로 판단의 차이와 근거를 수업에서 논의</td></tr>
    <tr><td>수행 현황</td><td>학습자별 미션 수행 상태와 기록을 확인</td></tr>
  </tbody>
</table>

> <small>교수자는 승인한 미션을 교과목에 편성하고, 학습자의 응답을 다시 수업으로 연결합니다.</small>

<br>

## 6. 콘텐츠·학습 기록의 추적

<table>
  <thead><tr><th width="380" align="left">콘텐츠 이력</th><th width="380" align="left">학습 수행 기록</th></tr></thead>
  <tbody>
    <tr><td>생성 조건 · AI 모델</td><td>MJT 응답과 선택 이유</td></tr>
    <tr><td>운영 프롬프트 지문 (SHA-256)</td><td>초안 · 수정안</td></tr>
    <tr><td>자동 점검 결과 · AI 검토 의견</td><td>제공된 AI 피드백</td></tr>
    <tr><td>교수자 최종 승인 이력 · 모델 호출 기록</td><td>최종안 · 학습자 의견</td></tr>
  </tbody>
</table>

> <small>생성·검토·승인 이력과 학습 기록을, 저장 구조가 허용하는 범위에서 버전과 연결해 추적합니다.</small>

<br>

## 7. 학위논문과 구현의 대응

<table>
  <thead><tr><th width="117" align="left">논문</th><th width="236" align="left">내용</th><th width="407" align="left">구현 위치</th></tr></thead>
  <tbody>
    <tr><td>4.1.1</td><td>개발 과정과 설계 결정 기록</td><td><a href="docs/research-trail/"><code>research-trail/</code></a> · <a href="docs/dev-log/"><code>dev-log/</code></a></td></tr>
    <tr><td>4.1.2</td><td>역할별 권한</td><td><a href="src/components/RequireAdmin.tsx"><code>RequireAdmin.tsx</code></a> · <a href="src/components/RequireApproved.tsx"><code>RequireApproved.tsx</code></a></td></tr>
    <tr><td>4.1.2</td><td>콘텐츠·기록 저장 구조</td><td><a href="supabase/migrations/"><code>migrations/</code></a> · <a href="src/lib/pragma/missionLineage.ts"><code>missionLineage.ts</code></a></td></tr>
    <tr><td>4.2.1&nbsp;·&nbsp;부록&nbsp;A</td><td>콘텐츠 생성과 운영 프롬프트</td><td><a href="src/lib/pragma/promptSnapshot.generated.ts"><code>promptSnapshot.generated.ts</code></a> · <a href="src/pages/admin/AdminGenerator.tsx"><code>AdminGenerator.tsx</code></a> · <a href="supabase/functions/generate-scenario/"><code>generate-scenario/</code></a></td></tr>
    <tr><td>4.2.2&nbsp;·&nbsp;부록&nbsp;C</td><td>자동 품질 점검과 AI 검토</td><td><a href="src/lib/pragma/missionRules.ts"><code>missionRules.ts</code></a> · <a href="src/lib/pragma/qualityRuleCatalog.ts"><code>qualityRuleCatalog.ts</code></a> · <a href="supabase/functions/content-review/"><code>content-review/</code></a></td></tr>
    <tr><td>4.2.3</td><td>교수자 감수와 최종 승인</td><td><a href="src/pages/admin/AdminAssembly.tsx"><code>AdminAssembly.tsx</code></a> · <a href="src/components/admin/ContentReviewPanel.tsx"><code>ContentReviewPanel.tsx</code></a></td></tr>
    <tr><td>4.3</td><td>교과목 선택·주차별 학습</td><td><a href="src/pages/learner/LearnerCourseList.tsx"><code>LearnerCourseList.tsx</code></a> · <a href="src/pages/learner/LearnerCourseWeek.tsx"><code>LearnerCourseWeek.tsx</code></a></td></tr>
    <tr><td>4.3.1</td><td>메타화용적 판단 과제</td><td><a href="src/pages/learner/CanonicalMissionRun.tsx"><code>CanonicalMissionRun.tsx</code></a></td></tr>
    <tr><td>4.3.2</td><td>통번역 과제</td><td><a href="src/pages/learner/CanonicalMissionRun.tsx"><code>CanonicalMissionRun.tsx</code></a> · <a href="src/lib/mission/missionFeedback.ts"><code>missionFeedback.ts</code></a></td></tr>
    <tr><td>4.3.3</td><td>수행 기록의 저장과 조회</td><td><a href="src/pages/learner/LearnerRecords.tsx"><code>LearnerRecords.tsx</code></a></td></tr>
    <tr><td>4.3.4</td><td>언어방향·수행 방식의 전환</td><td><a href="src/components/mission/InterpretingConsole.tsx"><code>InterpretingConsole.tsx</code></a> · <a href="src/lib/demo/representativeMissionCatalog.ts"><code>representativeMissionCatalog.ts</code></a></td></tr>
    <tr><td>4.4.1</td><td>교과목 편성과 미션 배치</td><td><a href="src/pages/admin/AdminComposer.tsx"><code>AdminComposer.tsx</code></a></td></tr>
    <tr><td>4.4.2</td><td>학습자 응답과 수행 현황</td><td><a href="src/components/admin/ClassResponsePanel.tsx"><code>ClassResponsePanel.tsx</code></a> · <a href="src/pages/admin/AdminLearners.tsx"><code>AdminLearners.tsx</code></a></td></tr>
    <tr><td>4.5.1</td><td>기능 시험과 배포 전 점검</td><td><a href=".github/workflows/"><code>workflows/</code></a> · <a href="tests/"><code>tests/</code></a></td></tr>
    <tr><td>4.5.2&nbsp;·&nbsp;부록&nbsp;B</td><td>반복적 개선의 세 사례 · 연구자 판정과 후속 점검</td><td><a href="docs/research-trail/03_iteration_log.md"><code>03_iteration_log.md</code></a> · <a href="docs/research-trail/04_evidence_index.md"><code>04_evidence_index.md</code></a></td></tr>
    <tr><td>4.5.3</td><td>배포·운영 상태와 확인 범위</td><td><a href="docs/DEPLOY.md"><code>DEPLOY.md</code></a> · <a href="railway.json"><code>railway.json</code></a></td></tr>
    <tr><td>부록&nbsp;F</td><td>주요 연구·개발 단계</td><td>아래 8절</td></tr>
  </tbody>
</table>

> <small>학위논문 제4장의 구현 내용을 실제 코드와 장·절 단위로 대응시켰습니다.</small>

<br>

## 8. 주요 연구·개발 단계 (부록 F)

<table>
  <thead><tr><th width="220" align="left">단계</th><th width="430" align="left">핵심 설계·개선</th><th width="110" align="left">근거</th></tr></thead>
  <tbody>
    <tr><td>통번역 학습 워크플로우</td><td>학습 미션 수행 흐름과 중→한 번역·통역 구현</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/4">#4</a> · <a href="https://github.com/sylim-research/PRAGMA/pull/62">#62</a></td></tr>
    <tr><td>콘텐츠 품질 관리·최종 승인</td><td>자동 품질 점검·AI 검토 뒤 교수자 최종 승인</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/27">#27</a> · <a href="https://github.com/sylim-research/PRAGMA/pull/122">#122</a></td></tr>
    <tr><td>교과목·주차 편성</td><td>3개 교과목의 15주 계획과 주차 미션 연결</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/25">#25</a> · <a href="https://github.com/sylim-research/PRAGMA/pull/87">#87</a></td></tr>
    <tr><td>MJT → 통번역 과제</td><td>MJT와 통번역 과제를 한 학습 미션으로 승인·저장</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/155">#155</a></td></tr>
    <tr><td>9개 목표화행 확장</td><td>요청 전용 미션 형식을 화행별 판단 기준으로 일반화</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/184">#184</a></td></tr>
    <tr><td>의미적 충실성 우선 피드백</td><td>의미가 왜곡되면 문법·화용보다 의미를 먼저 안내</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/196">#196</a></td></tr>
    <tr><td>수정안의 2차 AI 피드백</td><td>초안에만 주던 AI 피드백을 수정안에도 1회 추가</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/248">#248</a></td></tr>
  </tbody>
</table>

> <small>개발 과정의 핵심 설계와 개선을 보여 주는 주요 변경 내역입니다.</small>

<br>

## 9. 시스템 아키텍처

<p align="center"><img src="docs/figures/fig4-system-architecture.png" alt="시스템 아키텍처: 클라이언트 층, 서버 함수 층, 데이터 층과 외부 서비스" width="100%"></p>

<sub>(2026년 10월 기준)</sub>

- **학습 미션 생성**에는 GPT-5.5를 기본으로 사용하며, 교수자가 GPT-6 Astra를 선택할 수 있습니다.
- **시나리오 생성**에는 GPT-4.1 mini를 사용합니다.
- **AI 검토**에는 GPT-4.1, **교차 검토**에는 Claude Opus 5를 사용합니다.
- **AI 피드백**에는 GPT-4.1 mini를 사용합니다.
- **통역**의 음성 인식은 GPT-4o Transcribe, 음성 합성은 ElevenLabs로 처리합니다.
- **구현**은 React·TypeScript와 Supabase(Edge Functions·PostgreSQL)로 구성됩니다.
- **코드 관리와 배포**는 GitHub와 Railway를 사용합니다. GitHub Actions에서 타입 검사·테스트·빌드를 수행하며, 운영 웹앱은 GitHub main을 기준으로 Railway에 배포합니다.

<br>

## 10. 주요 용어

<table>
  <thead><tr><th width="165" align="left">용어</th><th width="595" align="left">정의</th></tr></thead>
  <tbody>
    <tr><td>MJT</td><td>메타화용적 판단 과제(Metapragmatic Judgment Task). 제시된 표현의 화용적 적절성을 판단하는 문항</td></tr>
    <tr><td>DCT형 통번역 과제</td><td>담화완성과제(DCT, Discourse Completion Task) 형식을 통번역에 적용한 산출 과제. 줄여서 통번역 과제</td></tr>
    <tr><td>STT·TTS</td><td>음성 인식·음성 합성(Speech-to-Text · Text-to-Speech). 통역 미션에 사용</td></tr>
    <tr><td>의미적 충실성</td><td>원문의 핵심 의미와 화행목적을 도착어에서 함부로 바꾸지 않는 것</td></tr>
    <tr><td>화용적 적절성</td><td>상황·관계와 담화 목적에 비추어 도착어 표현이 적절한 것</td></tr>
    <tr><td>적절성 판단 범주</td><td>표현을 과소·적정·과잉으로 나누는 교육적 분류. 단일 점수척도가 아님</td></tr>
    <tr><td>직접 수정</td><td>설계된 결함 표현을 판단해 고치는 MJT 활동</td></tr>
    <tr><td>AI 피드백</td><td>통번역 산출 뒤 AI가 주는 재검토 정보. 채점이나 정답 확정이 아님</td></tr>
    <tr><td>교수자 최종 승인</td><td>감수한 콘텐츠 버전의 수업 사용 여부 결정</td></tr>
  </tbody>
</table>

<br>
<br>

<p align="center"><b>박사학위논문 「AI 기반 한·중 통번역 학습 워크플로우 개발 연구」의 설계·개발 결과물입니다.</b><br><img src="docs/brand/rule.svg" width="100%" height="3" alt=""><br><sub>© 2026 Soyoung Lim · 한국외국어대학교</sub></p>
