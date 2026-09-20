import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { LEGACY_TEACHING_MATERIALS } from "@/lib/admin/legacyFeatures";
import { classResponsesTabPath } from "@/lib/admin/classResponsesPath";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "./components/ScrollToTop";
import { seedIfEmpty } from "./lib/learningSessions";
import { IS_DEMO } from "./lib/auth/useProfile";

const RequireApproved = lazy(() => import("./components/RequireApproved"));
const RequireAdmin = lazy(() => import("./components/RequireAdmin"));
const Index = lazy(() => import("./pages/Index.tsx"));
const Architecture = lazy(() => import("./pages/Architecture.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AdminCorpus = lazy(() => import("./pages/admin/AdminCorpus.tsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.tsx"));
const AdminGenerator = lazy(() => import("./pages/admin/AdminGenerator.tsx"));
const AdminAuthentic = lazy(() => import("./pages/admin/AdminAuthentic.tsx"));
const AdminAssembly = lazy(() => import("./pages/admin/AdminAssembly.tsx"));
const AdminTeachingMaterials = lazy(() => import("./pages/admin/AdminTeachingMaterials.tsx"));
const AdminTeachingStudio = lazy(() => import("./pages/admin/AdminTeachingStudio.tsx"));
const AdminClassResponses = lazy(() => import("./pages/admin/AdminClassResponses.tsx"));
const AdminBatch = lazy(() => import("./pages/admin/AdminBatch.tsx"));
const AdminBrowser = lazy(() => import("./pages/admin/AdminBrowser.tsx"));
const AdminPromptHarness = lazy(() => import("./pages/admin/AdminPromptHarness.tsx"));
const AdminComposer = lazy(() => import("./pages/admin/AdminComposer.tsx"));
const AdminLearners = lazy(() => import("./pages/admin/AdminLearners.tsx"));
const AdminExport = lazy(() => import("./pages/admin/AdminExport.tsx"));
const AdminDecisionTraces = lazy(() => import("./pages/admin/AdminDecisionTraces.tsx"));
const AdminDataBackup = lazy(() => import("./pages/admin/AdminDataBackup.tsx"));
const AdminGoldCalibration = lazy(() => import("./pages/admin/AdminGoldCalibration.tsx"));
const AdminMissionRelease = lazy(() => import("./pages/admin/AdminFinalApproval.tsx"));
const AdminFinalCorpusReview = lazy(() => import("./pages/admin/AdminFinalCorpusReview.tsx"));
const AdminImprovementFlywheel = lazy(() => import("./pages/admin/AdminImprovementFlywheel.tsx"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.tsx"));
const StudentLogin = lazy(() => import("./pages/StudentLogin.tsx"));
const PendingApproval = lazy(() => import("./pages/PendingApproval.tsx"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup.tsx"));
const Home = lazy(() => import("./pages/Home.tsx"));
const Roadmap = lazy(() => import("./pages/Roadmap.tsx"));
const WorkflowPreview = lazy(() => import("./pages/WorkflowPreview.tsx"));
const MissionShell = lazy(() => import("./pages/MissionShell.tsx"));
// 논문 도판용 가상 응답 시연 — 개발 모드에서만 번들에 들어간다(운영 빌드는 import 자체가 빠진다).
const VirtualResponseDiscussionDemo = import.meta.env.DEV
  ? lazy(() => import("./pages/dev/VirtualResponseDiscussionDemo.tsx"))
  : null;
const CourseOverview = lazy(() => import("./pages/learner/CourseOverview.tsx"));
const WeekDetail = lazy(() => import("./pages/learner/WeekDetail.tsx"));
const IntroArc = lazy(() => import("./pages/learner/IntroArc.tsx"));
const WeeklyLearningNote = lazy(() => import("./pages/learner/WeeklyLearningNote.tsx"));
const LearnerRecords = lazy(() => import("./pages/learner/LearnerRecords.tsx"));
const StrategyMap = lazy(() => import("./pages/learner/StrategyMap.tsx"));
const PrototypeMissionV2 = lazy(() => import("./pages/learner/PrototypeMissionV2.tsx"));
const LegacyMissionRun = lazy(() => import("./pages/learner/LegacyMissionRun.tsx"));
const CanonicalMissionRun = lazy(() => import("./pages/learner/CanonicalMissionRun.tsx"));
const LearnerCourseList = lazy(() => import("./pages/learner/LearnerCourseList.tsx"));
const LearnerCourseLive = lazy(() => import("./pages/learner/LearnerCourseLive.tsx"));
const LearnerCourseWeek = lazy(() => import("./pages/learner/LearnerCourseWeek.tsx"));
const EntryTaskMode = lazy(() => import("./pages/EntryTaskMode.tsx"));
const EntryLanguageDirection = lazy(() => import("./pages/EntryLanguageDirection.tsx"));
const EntryUnavailable = lazy(() => import("./pages/EntryUnavailable.tsx"));

seedIfEmpty();

const queryClient = new QueryClient();

// 「주차별 수업 운영」은 메뉴에서 내리고 「학습 수행 기록 › 학급 응답 분포」 탭으로 합쳤다. 옛 링크는 교과목·주차를 이어서 넘긴다.
const PackageRoute = () => {
  const [params] = useSearchParams();
  if (LEGACY_TEACHING_MATERIALS) return <AdminTeachingMaterials />;
  return <Navigate to={classResponsesTabPath(params)} replace />;
};

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
    화면을 불러오는 중…
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/" element={<Index />} />
          {/* 심사 설명용 read-only 구조 화면 — 실데이터가 없어 로그인을 요구하지 않는다. */}
          <Route path="/architecture" element={<Architecture />} />
          {/* Google OAuth 동의 화면이 요구하는 공개 링크 — 비로그인 접근을 유지한다. */}
          <Route path="/privacy" element={<Privacy />} />
          {/* 디펜스용 단일 진입점 — 실제 승인 미션 실행기를 재사용하되 수행 로그는 저장하지 않는다. */}
          <Route
            path="/demo/mission"
            element={
              IS_DEMO
                ? <RequireApproved><CanonicalMissionRun demoMode /></RequireApproved>
                : <Navigate to="/" replace />
            }
          />
          <Route path="/student-login" element={<StudentLogin />} />
          {/* 폐기된 콘텐츠 전문가 검수 주소는 현행 품질관리 흐름으로 연결한다. */}
          <Route path="/expert-login" element={<Navigate to="/admin/research-qa/final-review" replace />} />
          <Route path="/expert/reviews" element={<Navigate to="/admin/research-qa/final-review" replace />} />
          <Route path="/expert/gold-reviews" element={<Navigate to="/admin/research-qa/final-review" replace />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/home" element={<Home />} />
          {/* 정적 주차표·정적 흐름 예시 — 개발 환경에서만 접근한다(2026-08-05).
              Roadmap은 현재 주차가 `getCurrentWeek() = 1` 고정값이고 주차 배정 로직과
              무관한 표시용 화면이라, 프로덕션에서 URL로 열리면 실제 편성과 어긋난 주차표를
              보여 준다. WorkflowPreview는 그 화면 안의 버튼에서만 들어가는 정적 목업이다.
              UI 네비게이션에 두 화면으로 가는 링크는 없다. */}
          <Route
            path="/roadmap"
            element={import.meta.env.DEV ? <RequireApproved><Roadmap /></RequireApproved> : <Navigate to="/learner/course" replace />}
          />
          <Route
            path="/workflow-preview"
            element={import.meta.env.DEV ? <WorkflowPreview /> : <Navigate to="/learner/course" replace />}
          />
          {VirtualResponseDiscussionDemo && (
            <Route path="/dev/virtual-response-demo" element={<VirtualResponseDiscussionDemo />} />
          )}
          {/* 홈은 폐지 — 학습자 착지 화면은 수업이다(2026-08-01). 옛 링크·북마크는 그대로 잇는다. */}
          <Route path="/learner/home" element={<Navigate to="/learner/course" replace />} />
          {/* 라운지는 논문 버전에서 제외하며 과거 북마크는 수업으로 연결한다. */}
          <Route path="/learner/lounge/*" element={<Navigate to="/learner/course" replace />} />
          {/* 게시 교과목 → 15주 학습계획 → 주차별 독립 학습 미션 2개. */}
          <Route path="/learner/course" element={<RequireApproved><LearnerCourseList /></RequireApproved>} />
          <Route path="/learner/course/:courseId" element={<RequireApproved><LearnerCourseLive /></RequireApproved>} />
          <Route path="/learner/course/:courseId/week/:weekNo" element={<RequireApproved><LearnerCourseWeek /></RequireApproved>} />
          <Route path="/learner/course/:courseId/week/:weekNo/note" element={<RequireApproved><WeeklyLearningNote /></RequireApproved>} />
          <Route path="/learner/course/:courseId/week/:weekNo/intro" element={<RequireApproved><IntroArc /></RequireApproved>} />
          <Route path="/learner/course-live" element={<Navigate to="/learner/course" replace />} />
          <Route path="/learner/course/week/:weekNo/note" element={<RequireApproved><WeeklyLearningNote /></RequireApproved>} />
          {/* 도입 아크 — 목표 특징을 처음 배우는 자리(Hook → 귀납 → 원리 → 수용).
              아크 콘텐츠가 있는 주차만 열리고, 없으면 IntroArc가 강좌로 돌려보낸다. */}
          <Route path="/learner/course/week/:weekNo/intro" element={<RequireApproved><IntroArc /></RequireApproved>} />
          {/* 구 2주차 목업 주소는 실제 강좌로 복귀시킨다. */}
          <Route path="/learner/course/week/2" element={<Navigate to="/learner/course" replace />} />
          {/* 고정 진행률·샘플 주차 흐름은 개발 환경에서만 명시적 demo 경로로 연다. */}
          <Route
            path="/learner/demo/course"
            element={
              import.meta.env.DEV
                ? <RequireApproved><CourseOverview /></RequireApproved>
                : <Navigate to="/learner/course" replace />
            }
          />
          <Route
            path="/learner/demo/course/week/2"
            element={
              import.meta.env.DEV
                ? <RequireApproved><WeekDetail /></RequireApproved>
                : <Navigate to="/learner/course" replace />
            }
          />
          <Route
            path="/learner/demo/course/week/2/intro"
            element={
              import.meta.env.DEV
                ? <RequireApproved><IntroArc /></RequireApproved>
                : <Navigate to="/learner/course" replace />
            }
          />
          <Route
            path="/learner/demo/course/week/2/note"
            element={
              import.meta.env.DEV
                ? <RequireApproved><WeeklyLearningNote allowSample /></RequireApproved>
                : <Navigate to="/learner/course" replace />
            }
          />
          <Route path="/learner/records" element={<RequireApproved><LearnerRecords /></RequireApproved>} />
          <Route path="/learner/strategy" element={<Navigate to="/learner/course" replace />} />
          <Route
            path="/learner/demo/strategy"
            element={
              import.meta.env.DEV
                ? <RequireApproved><StrategyMap /></RequireApproved>
                : <Navigate to="/learner/course" replace />
            }
          />
          {/* legacy 판단형 셸 — 연구/앵커 후보로 보관. 개발 환경에서만 접근 가능. */}
          <Route
            path="/mission-legacy"
            element={import.meta.env.DEV ? <MissionShell /> : <Navigate to="/learner/practice" replace />}
          />
          <Route path="/entry/task-mode" element={<RequireApproved><EntryTaskMode /></RequireApproved>} />
          <Route path="/entry/language-direction" element={<RequireApproved><EntryLanguageDirection /></RequireApproved>} />
          <Route path="/entry/unavailable" element={<RequireApproved><EntryUnavailable /></RequireApproved>} />
          {/* 현행 다섯 판단 활동 + DCT 학습 미션. */}
          <Route
            path="/learner/practice"
            element={<RequireApproved allowDevMissionPreview><CanonicalMissionRun /></RequireApproved>}
          />
          {/* 실제 CTA는 MPJ5 mission_v1/v2와 과도기 mission_v4/v5를 모두
              정본의 다섯 판단 활동 + DCT 흐름으로 연결한다. 미지원 스키마만 기존 실행기로 폴백한다. */}
          <Route path="/learner/practice/:scenarioId" element={<RequireApproved><CanonicalMissionRun /></RequireApproved>} />
          {/* 구 학습 미션 경로 — 새 정본으로 리다이렉트(구 PracticeMission 목업 은퇴) */}
          <Route path="/scenario" element={<Navigate to="/learner/practice" replace />} />
          {/* legacy 별칭(옛 북마크 호환) — UI 네비게이션은 전부 /learner/practice 사용 */}
          <Route path="/learner/mission-run" element={<Navigate to="/learner/practice" replace />} />
          <Route path="/learner/mission-run/:scenarioId" element={<RequireApproved><LegacyMissionRun /></RequireApproved>} />
          {/* 고정 예시 피드백을 쓰는 구 흐름 검증 화면은 개발 환경에서만 접근한다.
              프로덕션에서 직접 URL로 열려 정본 AI 피드백과 혼동되는 일을 막는다. */}
          <Route
            path="/prototype/mission-v2"
            element={
              import.meta.env.DEV
                ? <RequireApproved><PrototypeMissionV2 /></RequireApproved>
                : <Navigate to="/learner/practice" replace />
            }
          />
          <Route
            path="/prototype/mission-v4"
            element={
              import.meta.env.DEV
                ? <CanonicalMissionRun />
                : <Navigate to="/learner/practice" replace />
            }
          />
          {/* 폐기된 품질관리 현황 주소는 자동 품질 점검으로 연결한다. */}
          <Route
            path="/prototype/research-qa"
            element={
              import.meta.env.DEV
                ? <Navigate to="/prototype/final-review" replace />
                : <Navigate to="/admin/research-qa/final-review" replace />
            }
          />
          <Route
            path="/prototype/research-qa-calibration"
            element={
              import.meta.env.DEV
                ? <AdminGoldCalibration />
                : <Navigate to="/admin/research-qa/calibration" replace />
            }
          />
          <Route path="/prototype/expert-reviews" element={<Navigate to="/admin/research-qa/final-review" replace />} />
          <Route path="/prototype/expert-review-ops" element={<Navigate to="/admin/research-qa/final-review" replace />} />
          <Route path="/prototype/expert-gold-reviews" element={<Navigate to="/admin/research-qa/final-review" replace />} />
          <Route path="/prototype/gold-expert-ops" element={<Navigate to="/admin/research-qa/final-review" replace />} />
          <Route
            path="/prototype/mission-release"
            element={
              import.meta.env.DEV
                ? <AdminMissionRelease preview />
                : <Navigate to="/admin/research-qa/releases" replace />
            }
          />
          <Route
            path="/prototype/final-review"
            element={
              import.meta.env.DEV
                ? <AdminFinalCorpusReview preview />
                : <Navigate to="/admin/research-qa/final-review" replace />
            }
          />
          <Route
            path="/prototype/improvement-flywheel"
            element={
              import.meta.env.DEV
                ? <AdminImprovementFlywheel preview />
                : <Navigate to="/admin/research-qa/improvements" replace />
            }
          />
          <Route path="/admin" element={<RequireAdmin><Navigate to="/admin/dashboard" replace /></RequireAdmin>} />
          <Route path="/admin/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/corpus" element={<RequireAdmin><AdminCorpus /></RequireAdmin>} />
          {/* 레거시 폐기(2026-07-30): /admin/youtube-sources — 유튜브 자막 기반 생성은
              개별 생성(/admin/generator)의 실제자료 가져오기에 통합돼 있어 중복 화면 삭제. */}
          <Route path="/admin/youtube-sources" element={<Navigate to="/admin/generator" replace />} />
          <Route path="/admin/generator" element={<RequireAdmin><AdminGenerator /></RequireAdmin>} />
          {/* 실제 자료 활용 분석 — 분석 결과를 보관함에 남긴다(2026-09-09). 오전에 생성기
              안으로 흡수했다가, 보관되지 않고 사라지는 문제가 화면 위치와 무관해 되돌렸다. */}
          <Route path="/admin/authentic" element={<RequireAdmin><AdminAuthentic /></RequireAdmin>} />
          <Route path="/admin/batch" element={<RequireAdmin><AdminBatch /></RequireAdmin>} />
          <Route path="/admin/library" element={<RequireAdmin><AdminBrowser /></RequireAdmin>} />
          {/* 학습 미션 조립(2026-07-30 신설) — 코어→미션 변환의 정식 작업대 */}
          <Route path="/admin/assembly" element={<RequireAdmin><AdminAssembly /></RequireAdmin>} />
          {/* 구 URL 호환 — 북마크·문서의 /admin/browser를 라이브러리로 보낸다. */}
          <Route path="/admin/browser" element={<Navigate to="/admin/library" replace />} />
          {/* 15주 구조와 미션 편성을 한 화면으로 통합한다. 옛 북마크는 보존. */}
          <Route path="/admin/curriculum" element={<Navigate to="/admin/composer" replace />} />
          <Route path="/admin/composer" element={<RequireAdmin><AdminComposer /></RequireAdmin>} />
          <Route path="/admin/prompt-harness" element={<RequireAdmin><AdminPromptHarness /></RequireAdmin>} />
          {/* 같은 미션 목록을 목적별로 나눠 본다. AI 화면에는 승인 기능이 없다. */}
          <Route path="/admin/ai-review" element={<RequireAdmin><AdminAssembly key="ai-review" reviewMode aiReview /></RequireAdmin>} />
          <Route path="/admin/review" element={<RequireAdmin><AdminAssembly key="review" reviewMode /></RequireAdmin>} />
          <Route path="/admin/cross-vendor" element={<RequireAdmin><Navigate to="/admin/review" replace /></RequireAdmin>} />
          <Route path="/admin/learners" element={<RequireAdmin><AdminLearners /></RequireAdmin>} />
          <Route path="/admin/decision-traces" element={<RequireAdmin><AdminDecisionTraces /></RequireAdmin>} />
          {/* 레거시 폐기(2026-07-30): /admin/reports — 미사용 화면 삭제(사용자 결정). */}
          <Route path="/admin/export" element={<RequireAdmin><AdminExport /></RequireAdmin>} />
          <Route path="/admin/data-backup" element={<RequireAdmin><AdminDataBackup /></RequireAdmin>} />
          <Route path="/admin/research-qa" element={<RequireAdmin><Navigate to="/admin/review" replace /></RequireAdmin>} />
          <Route path="/admin/research-qa/calibration" element={<RequireAdmin><Navigate to="/admin/review" replace /></RequireAdmin>} />
          <Route path="/admin/research-qa/expert-reviews" element={<Navigate to="/admin/research-qa/final-review" replace />} />
          <Route path="/admin/research-qa/gold-experts" element={<Navigate to="/admin/research-qa/final-review" replace />} />
          <Route path="/admin/research-qa/final-review" element={<RequireAdmin><AdminFinalCorpusReview /></RequireAdmin>} />
          <Route path="/admin/research-qa/releases" element={<RequireAdmin><Navigate to="/admin/review" replace /></RequireAdmin>} />
          <Route path="/admin/research-qa/improvements" element={<RequireAdmin><Navigate to="/admin/review" replace /></RequireAdmin>} />
          <Route path="/admin/package" element={<RequireAdmin><PackageRoute /></RequireAdmin>} />
          <Route path="/admin/teaching-generator" element={<RequireAdmin><AdminTeachingStudio /></RequireAdmin>} />
          <Route path="/admin/class-responses" element={<RequireAdmin><AdminClassResponses /></RequireAdmin>} />
          {/* /admin/course-ops 제거(2026-08-05) — 메뉴에 없고 어디서도 링크되지 않는 고아
              라우트였다. 교과목 운영은 9월 실증 사안으로 백로그에 있다(AdminShell 주석 참조). */}
          <Route path="/admin-login" element={<AdminLogin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
