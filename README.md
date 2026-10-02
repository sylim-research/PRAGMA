<p align="center">
  <img src="docs/brand/banner.svg" alt="PRAGMA: AI 기반 한·중 통번역 학습 워크플로우" width="100%">
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

<p align="center"><img src="docs/figures/fig1-pragma-workflow.png" alt="Fig. 1 PRAGMA 워크플로우: 콘텐츠 제작 워크플로우, 수업 운영, 통번역 학습 워크플로우" width="100%"></p>

> <small>AI 생성 콘텐츠의 제작에서 학습자의 확정안까지를 하나의 흐름으로 연결해 설계·구현했습니다.</small>

<br>

## 2. 콘텐츠 제작 워크플로우

<p align="center"><img src="docs/figures/fig2-content-workflow-authority.png" alt="Fig. 2 콘텐츠 제작 워크플로우: 자동 품질 점검과 AI 검토를 거쳐 교수자가 감수하고 최종 승인" width="100%"></p>

> <small>AI가 생성한 콘텐츠를 자동 품질 점검과 AI 검토(필요 시 교차 검토)로 살피고, 교수자가 감수한 뒤 최종 승인하는 인간-AI 협업형 콘텐츠 품질관리 체계입니다.</small>

<br>

## 3. 통번역 학습 워크플로우

<p align="center"><img src="docs/figures/fig3-learning-mission.png" alt="Fig. 3 통번역 학습 워크플로우: 다섯 개의 MJT 판단 문항과 하나의 DCT형 통번역 과제로 구성된 학습 미션" width="100%"></p>

- **학습 미션**은 다섯 개의 MJT 판단 문항과 하나의 DCT형 통번역 과제로 구성됩니다.
- **MJT 판단 문항**에서는 제시된 표현을 판단하고 선택하거나 수정합니다.
- **통번역 과제**에서는 별도의 원문을 번역 또는 통역합니다.
- **AI 피드백**은 채점이 아닙니다. 학습자가 초안을 수정하면 수정안에 AI 피드백을 한 번 더 받고, 확정안은 학습자가 결정합니다.

<br>

## 4. 학습 미션의 생성 조건

<table>
  <thead><tr><th width="133" align="left">조건</th><th width="553" align="left">구성</th></tr></thead>
  <tbody>
    <tr><td>목표&nbsp;화행</td><td>요청&ensp;|&ensp;거절&ensp;|&ensp;사과&ensp;|&ensp;감사&ensp;|&ensp;불만&ensp;|&ensp;칭찬&ensp;|&ensp;초대&ensp;|&ensp;제안&ensp;|&ensp;반대</td></tr>
    <tr><td>관계·상황&nbsp;조건</td><td>상대적&nbsp;권력(P)&ensp;|&ensp;사회적&nbsp;거리(D)&ensp;|&ensp;행위&nbsp;부담도(R)</td></tr>
    <tr><td>언어&nbsp;방향</td><td>한→중&nbsp;·&nbsp;중→한</td></tr>
    <tr><td>수행&nbsp;방식</td><td>번역&nbsp;·&nbsp;통역</td></tr>
    <tr><td>학습자&nbsp;수준</td><td>입문&ensp;|&ensp;중급&ensp;|&ensp;고급</td></tr>
  </tbody>
</table>

> <small>9개 목표 화행과 관계·상황 조건을 달리해 학습 미션을 구성하며, P·D·R을 해석 틀로 삼아 관계·상황 조건을 구성합니다.</small>

<br>

## 5. 콘텐츠·학습 기록의 추적

<table>
  <thead><tr><th width="343" align="left">콘텐츠 이력</th><th width="343" align="left">학습 수행 기록</th></tr></thead>
  <tbody>
    <tr><td>생성&nbsp;조건&nbsp;·&nbsp;AI&nbsp;모델</td><td>MJT&nbsp;응답과&nbsp;선택&nbsp;이유</td></tr>
    <tr><td>운영&nbsp;프롬프트&nbsp;지문&nbsp;(SHA-256)</td><td>초안&nbsp;·&nbsp;수정안</td></tr>
    <tr><td>자동&nbsp;품질&nbsp;점검&nbsp;결과&nbsp;·&nbsp;AI&nbsp;검토&nbsp;의견</td><td>제공된&nbsp;AI&nbsp;피드백</td></tr>
    <tr><td>교수자&nbsp;최종&nbsp;승인&nbsp;이력&nbsp;·&nbsp;모델&nbsp;호출&nbsp;기록</td><td>확정안&nbsp;·&nbsp;학습자&nbsp;의견</td></tr>
  </tbody>
</table>

> <small>콘텐츠의 생성부터 검토와 승인까지의 이력과 학습 수행의 주요 기록을, 실제 저장 구조가 허용하는 범위에서 콘텐츠 버전과 연결해 추적할 수 있습니다.</small>

<br>

## 6. 학위논문과 구현의 대응

<table>
  <thead><tr><th width="108" align="left">논문</th><th width="213" align="left">내용</th><th width="338" align="left">구현 위치</th></tr></thead>
  <tbody>
    <tr><td>4.1.1~2&nbsp;·&nbsp;부록&nbsp;B</td><td>개발&nbsp;도구·개발&nbsp;프롬프트</td><td><a href="docs/research-trail/"><code>research-trail/</code></a> · <a href="docs/dev-log/"><code>dev-log/</code></a></td></tr>
    <tr><td>4.1.3</td><td>웹앱&nbsp;구성·역할별&nbsp;권한</td><td><a href="src/components/RequireAdmin.tsx"><code>RequireAdmin.tsx</code></a> · <a href="src/components/RequireApproved.tsx"><code>RequireApproved.tsx</code></a></td></tr>
    <tr><td>4.1.4</td><td>콘텐츠·기록&nbsp;저장&nbsp;구조</td><td><a href="supabase/migrations/"><code>migrations/</code></a> · <a href="src/lib/pragma/missionLineage.ts"><code>missionLineage.ts</code></a></td></tr>
    <tr><td>4.2.1&nbsp;·&nbsp;부록&nbsp;A</td><td>제작&nbsp;기준·운영&nbsp;프롬프트</td><td><a href="src/lib/pragma/promptSnapshot.generated.ts"><code>promptSnapshot.generated.ts</code></a></td></tr>
    <tr><td>4.2.2~3</td><td>시나리오·학습&nbsp;미션&nbsp;생성</td><td><a href="src/pages/admin/AdminGenerator.tsx"><code>AdminGenerator.tsx</code></a> · <a href="supabase/functions/generate-scenario/"><code>generate-scenario/</code></a></td></tr>
    <tr><td>4.2.4&nbsp;·&nbsp;부록&nbsp;C</td><td>자동&nbsp;품질&nbsp;점검</td><td><a href="src/lib/pragma/missionRules.ts"><code>missionRules.ts</code></a> · <a href="src/lib/pragma/qualityRuleCatalog.ts"><code>qualityRuleCatalog.ts</code></a></td></tr>
    <tr><td>4.2.5</td><td>AI&nbsp;검토·모델&nbsp;간&nbsp;교차&nbsp;검토</td><td><a href="supabase/functions/content-review/"><code>content-review/</code></a></td></tr>
    <tr><td>4.2.6</td><td>교수자&nbsp;감수와&nbsp;최종&nbsp;승인</td><td><a href="src/pages/admin/AdminAssembly.tsx"><code>AdminAssembly.tsx</code></a> · <a href="src/components/admin/ContentReviewPanel.tsx"><code>ContentReviewPanel.tsx</code></a></td></tr>
    <tr><td>4.3.1</td><td>교과목&nbsp;선택·주차별&nbsp;학습</td><td><a href="src/pages/learner/LearnerCourseList.tsx"><code>LearnerCourseList.tsx</code></a> · <a href="src/pages/learner/LearnerCourseWeek.tsx"><code>LearnerCourseWeek.tsx</code></a></td></tr>
    <tr><td>4.3.2~3</td><td>MJT·DCT형&nbsp;통번역&nbsp;과제</td><td><a href="src/pages/learner/CanonicalMissionRun.tsx"><code>CanonicalMissionRun.tsx</code></a></td></tr>
    <tr><td>4.3.4</td><td>AI&nbsp;피드백·학습자&nbsp;최종&nbsp;결정</td><td><a href="src/lib/mission/missionFeedback.ts"><code>missionFeedback.ts</code></a></td></tr>
    <tr><td>4.3.5</td><td>학습&nbsp;수행&nbsp;기록&nbsp;저장·조회</td><td><a href="src/pages/learner/LearnerRecords.tsx"><code>LearnerRecords.tsx</code></a></td></tr>
    <tr><td>4.4.1</td><td>교과목&nbsp;편성·미션&nbsp;배치</td><td><a href="src/pages/admin/AdminComposer.tsx"><code>AdminComposer.tsx</code></a></td></tr>
    <tr><td>4.4.2</td><td>학급&nbsp;응답&nbsp;집계와&nbsp;조회</td><td><a href="src/pages/admin/AdminClassResponses.tsx"><code>AdminClassResponses.tsx</code></a></td></tr>
    <tr><td>4.4.3</td><td>학습자별&nbsp;수행&nbsp;현황</td><td><a href="src/pages/admin/AdminLearners.tsx"><code>AdminLearners.tsx</code></a></td></tr>
    <tr><td>4.5.1</td><td>기능&nbsp;시험과&nbsp;배포&nbsp;전&nbsp;점검</td><td><a href=".github/workflows/"><code>workflows/</code></a> · <a href="tests/"><code>tests/</code></a></td></tr>
    <tr><td>4.5.2</td><td>주요&nbsp;문제의&nbsp;판정·개선·재점검</td><td><a href="docs/research-trail/03_iteration_log.md"><code>03_iteration_log.md</code></a> · <a href="docs/research-trail/04_evidence_index.md"><code>04_evidence_index.md</code></a></td></tr>
    <tr><td>4.5.3</td><td>배포·운영&nbsp;상태와&nbsp;확인&nbsp;범위</td><td><a href="docs/DEPLOY.md"><code>DEPLOY.md</code></a> · <a href="railway.json"><code>railway.json</code></a></td></tr>
  </tbody>
</table>

> <small>학위논문 제4장의 구현 내용을 실제 코드와 장·절 단위로 대응시켰습니다.</small>

<br>

## 7. 주요 연구·개발 단계

<table>
  <thead><tr><th width="183" align="left">단계</th><th width="398" align="left">핵심 설계·개선</th><th width="78" align="left">근거</th></tr></thead>
  <tbody>
    <tr><td>통번역&nbsp;학습&nbsp;워크플로우</td><td>학습&nbsp;미션&nbsp;수행&nbsp;흐름과&nbsp;중→한&nbsp;번역·통역&nbsp;구현</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/4">#4</a> · <a href="https://github.com/sylim-research/PRAGMA/pull/62">#62</a></td></tr>
    <tr><td>콘텐츠&nbsp;품질관리·최종&nbsp;승인</td><td>자동&nbsp;품질&nbsp;점검&nbsp;→&nbsp;AI&nbsp;검토&nbsp;→&nbsp;교수자&nbsp;최종&nbsp;승인</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/27">#27</a> · <a href="https://github.com/sylim-research/PRAGMA/pull/122">#122</a></td></tr>
    <tr><td>교과목·주차&nbsp;편성</td><td>3개&nbsp;교과목의&nbsp;15주&nbsp;계획과&nbsp;주차&nbsp;미션&nbsp;연결</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/25">#25</a> · <a href="https://github.com/sylim-research/PRAGMA/pull/87">#87</a></td></tr>
    <tr><td>MJT&nbsp;→&nbsp;DCT형&nbsp;통번역&nbsp;과제</td><td>MJT와&nbsp;통번역&nbsp;과제를&nbsp;한&nbsp;학습&nbsp;미션으로&nbsp;승인·저장</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/155">#155</a></td></tr>
    <tr><td>9개&nbsp;목표&nbsp;화행&nbsp;확장</td><td>요청&nbsp;전용&nbsp;미션&nbsp;형식을&nbsp;화행별&nbsp;판단&nbsp;기준으로&nbsp;일반화</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/184">#184</a></td></tr>
    <tr><td>의미&nbsp;충실성&nbsp;우선&nbsp;피드백</td><td>의미가&nbsp;왜곡되면&nbsp;문법·화용보다&nbsp;의미를&nbsp;먼저&nbsp;안내</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/196">#196</a></td></tr>
    <tr><td>수정안의&nbsp;2차&nbsp;AI&nbsp;피드백</td><td>초안에만&nbsp;주던&nbsp;AI&nbsp;피드백을&nbsp;수정안에도&nbsp;1회&nbsp;추가</td><td><a href="https://github.com/sylim-research/PRAGMA/pull/248">#248</a></td></tr>
  </tbody>
</table>

> <small>개발 이력 가운데 핵심 설계와 개선을 보여 주는 대표 변경입니다.</small>

<br>

## 8. 시스템 아키텍처

<p align="center"><img src="docs/figures/fig4-system-architecture.png" alt="Fig. 4 시스템 아키텍처: 클라이언트 층, 서버 함수 층, 데이터 층과 외부 서비스" width="100%"></p>

<sub>(2026년 10월 기준)</sub>

- **학습 미션 생성**에는 GPT-5.5, **시나리오 생성**에는 GPT-4.1 mini를 사용합니다.
- **AI 검토**에는 GPT-4.1, 필요할 때 하는 **교차 검토**에는 다른 제공사의 Claude Opus 5를 사용합니다.
- **AI 피드백**에는 GPT-4.1 mini(예비 GPT-4o mini), **음성**에는 GPT-4o Transcribe(인식)와 ElevenLabs(합성)를 사용합니다.
- **구현**은 React·TypeScript와 Supabase(Edge Functions·PostgreSQL)로 구성됩니다.

<br>

## 9. 주요 용어

<table>
  <thead><tr><th width="133" align="left">용어</th><th width="553" align="left">정의</th></tr></thead>
  <tbody>
    <tr><td>의미&nbsp;충실성</td><td>원문의&nbsp;핵심&nbsp;의미와&nbsp;화행&nbsp;목적을&nbsp;도착어에서&nbsp;함부로&nbsp;바꾸지&nbsp;않는&nbsp;것</td></tr>
    <tr><td>화용적&nbsp;적절성</td><td>관계·상황과&nbsp;담화&nbsp;목적에&nbsp;비추어&nbsp;도착어&nbsp;표현이&nbsp;적절한&nbsp;것</td></tr>
    <tr><td>학습&nbsp;미션</td><td>다섯&nbsp;개의&nbsp;MJT&nbsp;판단&nbsp;문항과&nbsp;하나의&nbsp;DCT형&nbsp;통번역&nbsp;과제를&nbsp;연결한&nbsp;학습&nbsp;단위</td></tr>
    <tr><td>MJT</td><td>제시된&nbsp;표현을&nbsp;판단하고&nbsp;선택하거나&nbsp;수정하는&nbsp;과제</td></tr>
    <tr><td>직접&nbsp;수정</td><td>형식은&nbsp;포스트에디팅(PE)과&nbsp;닮았지만,&nbsp;설계된&nbsp;결함&nbsp;표현을&nbsp;판단해&nbsp;고치는&nbsp;MJT&nbsp;활동</td></tr>
    <tr><td>DCT형&nbsp;통번역&nbsp;과제</td><td>별도&nbsp;원문의&nbsp;의미와&nbsp;화행&nbsp;목적을&nbsp;유지하며&nbsp;통번역하는&nbsp;과제</td></tr>
    <tr><td>AI&nbsp;피드백</td><td>통번역&nbsp;산출&nbsp;뒤&nbsp;AI가&nbsp;주는&nbsp;재검토&nbsp;정보.&nbsp;채점이나&nbsp;정답&nbsp;확정이&nbsp;아님</td></tr>
    <tr><td>교수자&nbsp;최종&nbsp;승인</td><td>감수한&nbsp;콘텐츠&nbsp;버전의&nbsp;수업&nbsp;사용&nbsp;여부&nbsp;결정.&nbsp;학습자&nbsp;공개는&nbsp;교과목&nbsp;편성&nbsp;이후</td></tr>
  </tbody>
</table>

<sub>* MJT: 메타화용적 판단 과제 (Metapragmatic Judgment Task)<br>* DCT: 담화완성과제 (Discourse Completion Task)<br>* PE: 포스트에디팅 (Post-Editing)</sub>

<br>
<br>

<p align="center"><b>박사학위논문 「AI 기반 한·중 통번역 학습 워크플로우 개발 연구」의 설계·개발 결과물입니다.</b><br><img src="docs/brand/rule.svg" width="100%" height="3" alt=""><br><sub>© 2026 Soyoung Lim · 한국외국어대학교</sub></p>
