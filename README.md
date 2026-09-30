<p align="center">
  <img src="docs/brand/banner.svg" alt="PRAGMA: AI 기반 한·중 통번역 화용 학습 워크플로우" width="100%">
</p>

<p align="center">
  <a href="https://pragma.up.railway.app"><img src="https://img.shields.io/badge/웹앱_바로가기-pragma.up.railway.app-F2C744?style=flat-square&labelColor=131C2B" alt="웹앱 바로가기"></a>
  <a href="https://github.com/sylim-research/PRAGMA/actions/workflows/ci.yml"><img src="https://github.com/sylim-research/PRAGMA/actions/workflows/ci.yml/badge.svg?branch=main" alt="자동 검사"></a>
</p>

<h3 align="center">같은 뜻도, 관계와 상황에 따라 다르게 표현합니다.</h3>

<p align="center">
PRAGMA는 화용적 적절성을 중심으로 설계한 한·중 통번역 학습 플랫폼입니다.<br>
학습자는 원문의 의미와 화행 목적을 유지하며 관계·상황에 맞게 통번역합니다.
</p>

<br>

<table>
  <thead><tr><th width="319" align="left">작업 결과</th><th width="360" align="left">링크</th></tr></thead>
  <tbody>
    <tr><td>🖥️&nbsp;&nbsp;웹앱</td><td><b><a href="https://pragma.up.railway.app">pragma.up.railway.app</a></b></td></tr>
    <tr><td><img src="docs/brand/icons/structure.svg" width="18" height="18" align="absmiddle" alt="">&nbsp;&nbsp;PRAGMA 워크플로우 전체 구조</td><td><a href="https://pragma.up.railway.app/architecture">pragma.up.railway.app/architecture</a></td></tr>
    <tr><td><img src="docs/brand/icons/mission.svg" width="18" height="18" align="absmiddle" alt="">&nbsp;&nbsp;대표 학습 미션</td><td><a href="https://pragma.up.railway.app/demo/mission">pragma.up.railway.app/demo/mission</a></td></tr>
  </tbody>
</table>

> <small>PRAGMA의 설계 원리를 구현한 코드와 그 개발 과정을 공개합니다.</small>

<br>

## 1. PRAGMA 워크플로우

<p align="center"><img src="docs/figures/fig1-pragma-workflow.png" alt="Fig. 1 PRAGMA 워크플로우: 콘텐츠 제작 워크플로우, 수업 운영 지원, 통번역 학습 워크플로우" width="100%"></p>

> <small>AI 콘텐츠 제작에서 학습자의 최종 산출까지를 하나의 흐름으로 연결해 설계·구현했습니다.</small>

<br>

## 2. 콘텐츠 제작 워크플로우

<p align="center"><img src="docs/figures/fig2-content-workflow-authority.png" alt="Fig. 2 콘텐츠 제작 워크플로우" width="100%"></p>

> <small>AI가 생성·검토하고 교수자가 최종 승인하는, 인간-AI 협업형 콘텐츠 품질 관리 체계입니다.</small>

<br>

## 3. 통번역 학습 워크플로우

<p align="center"><img src="docs/figures/fig3-learning-mission.png" alt="Fig. 3 통번역 학습 워크플로우: MJT 5문항과 DCT형 통번역 과제로 구성된 학습 미션" width="100%"></p>

- **학습 미션**은 MJT 5문항과 DCT형 통번역 과제 1개로 구성됩니다.
- **MJT 문항**에서는 제시된 표현을 판단·선택·교정합니다.
- **통번역 과제**에서는 별도의 원문을 번역 또는 통역합니다.
- **AI 피드백**은 채점이 아니며, 최종 산출은 학습자가 결정합니다.

<br>

## 4. 학습 미션의 생성 조건

<table>
  <thead><tr><th width="160" align="left">조건</th><th width="530" align="left">구성</th></tr></thead>
  <tbody>
    <tr><td>목표 화행</td><td>요청&ensp;|&ensp;거절&ensp;|&ensp;사과&ensp;|&ensp;감사&ensp;|&ensp;불만&ensp;|&ensp;칭찬&ensp;|&ensp;초대&ensp;|&ensp;제안&ensp;|&ensp;반대</td></tr>
    <tr><td>관계·상황</td><td>상대적 권력(P) · 사회적 거리(D) · 행위 부담도(R) 기준</td></tr>
    <tr><td>언어 방향</td><td>한→중 · 중→한</td></tr>
    <tr><td>수행 방식</td><td>번역 · 통역</td></tr>
    <tr><td>학습 수준</td><td>입문 · 중급 · 고급</td></tr>
  </tbody>
</table>

> <small>9개 목표 화행과 관계·상황 조건을 달리해 학습 미션을 구성하며, P·D·R은 관계·상황을 구체화하는 기준입니다.</small>

<br>

## 5. 추적·감사 가능성

<table>
  <thead><tr><th width="330" align="left">콘텐츠 이력</th><th width="250" align="left">학습 수행 기록</th></tr></thead>
  <tbody>
    <tr><td>생성 조건 · AI 모델</td><td>MJT 응답과 선택 이유</td></tr>
    <tr><td>운영 프롬프트 지문 (SHA-256)</td><td>최초 산출</td></tr>
    <tr><td>자동 품질 점검 결과 · AI 검토 의견</td><td>제공된 AI 피드백</td></tr>
    <tr><td>교수자 최종 승인 이력 · 모델 호출 기록</td><td>최종 산출 · 이견</td></tr>
  </tbody>
</table>

> <small>콘텐츠의 생성·검토·승인 이력과 학습 수행의 주요 기록을 콘텐츠 버전과 연결해 확인할 수 있습니다.</small>

<br>

## 6. 학위논문과 구현의 대응

<table>
  <thead><tr><th width="110" align="left">논문</th><th width="210" align="left">내용</th><th width="430" align="left">구현 위치</th></tr></thead>
  <tbody>
    <tr><td>4.1.1~2</td><td>개발 도구·개발 프롬프트</td><td><a href="docs/research-trail/"><code>research-trail/</code></a> · <a href="docs/dev-log/"><code>dev-log/</code></a></td></tr>
    <tr><td>4.1.4</td><td>콘텐츠·기록 저장 구조</td><td><a href="supabase/migrations/"><code>migrations/</code></a> · <a href="src/lib/pragma/missionLineage.ts"><code>missionLineage.ts</code></a></td></tr>
    <tr><td>4.2.1 · 부록 A</td><td>제작 기준·운영 프롬프트</td><td><a href="src/lib/pragma/promptSnapshot.generated.ts"><code>promptSnapshot.generated.ts</code></a></td></tr>
    <tr><td>4.2.2~3</td><td>시나리오·학습 미션 생성</td><td><a href="src/pages/admin/AdminGenerator.tsx"><code>AdminGenerator.tsx</code></a> · <a href="supabase/functions/generate-scenario/"><code>generate-scenario/</code></a></td></tr>
    <tr><td>4.2.4 · 부록 C</td><td>자동 품질 점검</td><td><a href="src/lib/pragma/missionRules.ts"><code>missionRules.ts</code></a> · <a href="src/lib/pragma/qualityRuleCatalog.ts"><code>qualityRuleCatalog.ts</code></a></td></tr>
    <tr><td>4.2.5</td><td>AI 검토와 교차 점검</td><td><a href="supabase/functions/content-review/"><code>content-review/</code></a></td></tr>
    <tr><td>4.2.6</td><td>교수자 감수와 최종 승인</td><td><a href="src/pages/admin/AdminAssembly.tsx"><code>AdminAssembly.tsx</code></a> · <a href="src/components/admin/ContentReviewPanel.tsx"><code>ContentReviewPanel.tsx</code></a></td></tr>
    <tr><td>4.3.2~4</td><td>MJT·통번역 과제·AI 피드백</td><td><a href="src/pages/learner/CanonicalMissionRun.tsx"><code>CanonicalMissionRun.tsx</code></a> · <a href="src/lib/mission/missionFeedback.ts"><code>missionFeedback.ts</code></a></td></tr>
    <tr><td>4.3.5</td><td>학습 수행 기록 저장·조회</td><td><a href="src/pages/learner/LearnerRecords.tsx"><code>LearnerRecords.tsx</code></a></td></tr>
    <tr><td>4.4.1</td><td>교과목 편성·미션 배치</td><td><a href="src/pages/admin/AdminComposer.tsx"><code>AdminComposer.tsx</code></a></td></tr>
    <tr><td>4.4.2~3</td><td>학급 응답·수행 이력 조회</td><td><a href="src/pages/admin/AdminClassResponses.tsx"><code>AdminClassResponses.tsx</code></a> · <a href="src/pages/admin/AdminLearners.tsx"><code>AdminLearners.tsx</code></a></td></tr>
    <tr><td>4.5.1</td><td>기능 시험·배포 전 점검</td><td><a href=".github/workflows/"><code>workflows/</code></a> · <a href="tests/"><code>tests/</code></a></td></tr>
  </tbody>
</table>

> <small>학위논문 제4장의 구현 내용을 실제 코드와 장·절 단위로 대응시켰습니다.</small>

<br>

## 7. 주요 연구·개발 단계

<table>
  <thead><tr><th width="27%" align="left">단계</th><th width="60%" align="left">핵심 설계·개선</th><th width="13%" align="left">근거</th></tr></thead>
  <tbody>
    <tr><td>통번역 학습 워크플로우</td><td>학습 미션 수행 흐름 구현, 중→한 번역·통역까지 연결</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/4">#4</a> · <a href="https://github.com/sylim-research/PRAGMA/pull/62">#62</a></td></tr>
    <tr><td>콘텐츠 품질관리·최종 승인</td><td>규칙·AI·교차 검토 뒤 교수자가 최종 승인하는 단계별 검수</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/27">#27</a> · <a href="https://github.com/sylim-research/PRAGMA/pull/122">#122</a></td></tr>
    <tr><td>교과목·주차 편성</td><td>3개 교과목·15주 계획·주차 미션 연결</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/25">#25</a> · <a href="https://github.com/sylim-research/PRAGMA/pull/87">#87</a></td></tr>
    <tr><td>MJT → DCT형 통번역 과제</td><td>MJT 5문항과 DCT형 통번역 과제를 한 미션으로 승인·저장</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/155">#155</a></td></tr>
    <tr><td>9개 목표 화행 확장</td><td>요청 전용 미션 형식을 화행별 판단 기준으로 일반화</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/184">#184</a></td></tr>
    <tr><td>의미 충실성 우선 피드백</td><td>의미가 왜곡되면 문법·화용 판정을 보류하고 의미부터 안내</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/196">#196</a></td></tr>
    <tr><td>DCT 수정안 재확인</td><td>최초안 피드백만 보던 수정안 확정 전에 재확인 1회 추가</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/248">#248</a></td></tr>
  </tbody>
</table>

> <small>개발 이력 가운데 핵심 설계와 개선을 보여 주는 대표 변경입니다.</small>

<br>

## 8. 시스템 아키텍처

<p align="center"><img src="docs/figures/fig4-system-architecture.png" alt="Fig. 4 시스템 아키텍처: 클라이언트 층, 서버 함수 층, 데이터 층과 외부 서비스" width="100%"></p>

- **학습 미션 생성**에는 GPT-5.5, **시나리오 생성**에는 GPT-4.1 mini를 사용합니다.
- **AI 검토**에는 GPT-4.1, **교차 검토**에는 다른 제공사의 Claude Opus 5를 사용합니다.
- **AI 피드백**에는 GPT-4.1 mini, **음성**에는 GPT-4o Transcribe(인식)와 ElevenLabs(합성)를 사용합니다.
- **구현**은 React·TypeScript와 Supabase(Edge Functions·PostgreSQL)로 구성됩니다.

<br>

## 9. 주요 용어

<table>
  <thead><tr><th width="190" align="left">용어</th><th width="520" align="left">정의</th></tr></thead>
  <tbody>
    <tr><td>의미 충실성</td><td>원문의 핵심 의미와 화행 목적을 도착어에서 함부로 바꾸지 않는 것</td></tr>
    <tr><td>화용적 적절성</td><td>관계·상황·담화 목적에 비추어 도착어 표현이 적절한 것</td></tr>
    <tr><td>학습 미션</td><td>MJT 5문항과 DCT형 통번역 과제 1개를 연결한 상위 학습 단위</td></tr>
    <tr><td>MJT</td><td>제시된 표현의 적절성을 판단·선택·교정하는 과제</td></tr>
    <tr><td>DCT형 통번역 과제</td><td>DCT 형식을 참고해 별도 원문을 통번역하도록 재구성한 과제</td></tr>
    <tr><td>적절성 판단 범주</td><td>과소·적정·과잉으로 나누는 교육적 분류. 단일 점수 척도가 아님</td></tr>
    <tr><td>관계·상황 조건</td><td>참여자 관계와 행위 부담 등을 드러내는 구체적 장면 조건</td></tr>
    <tr><td>교수자 최종 승인</td><td>감수한 콘텐츠의 수업 사용·학습자 공개 자격을 결정하는 행위</td></tr>
    <tr><td>학습 수행 기록</td><td>판단 응답, 최초·최종 산출, 제공된 AI 피드백의 저장 기록</td></tr>
  </tbody>
</table>

<sub>* MJT: 메타화용적 판단 과제 (Metapragmatic Judgment Task)<br>* DCT: 담화완성과제 (Discourse Completion Task)</sub>

<br>
<br>

<p align="center"><b>박사학위논문 「AI 기반 한·중 통번역 학습 워크플로우 개발 연구」의 설계·개발 결과물입니다.</b><br><img src="docs/brand/rule.svg" width="100%" height="3" alt=""><br><sub>© 2026 Soyoung Lim · 한국외국어대학교</sub></p>
