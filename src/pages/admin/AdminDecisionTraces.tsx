import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import { ClassResponsePanel } from "@/components/admin/ClassResponsePanel";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { MODE_LABEL, SPEECH_ACT_UI, type GenMode, type SpeechActUI } from "@/lib/pragma/enums";
import { missionMenuTitle } from "@/lib/curriculum/missionMenuTitle";
import { missionSituationSummary } from "@/lib/curriculum/weeklyMaterials";
import {
  buildMissionCourseIndex,
  EMPTY_FILTERS,
  filterMissionLogs,
  hasActiveFilter,
  type MissionCourseIndex,
  type MissionLogFilters,
} from "@/lib/mission/missionLogFilter";

type MissionLog = Database["public"]["Tables"]["learner_mission_logs"]["Row"];
type ProfileSummary = {
  full_name: string | null;
  email: string | null;
  anonymous_participant_id: string | null;
};
type MissionLogRow = MissionLog & { profiles: ProfileSummary | null };
type CourseOption = { id: string; title: string };

const DETAIL_FIELDS: Array<{ key: keyof MissionLog; label: string }> = [
  { key: "source_text", label: "출발어 원문·전사" },
  { key: "first_response", label: "최초 응답" },
  { key: "context_judgment", label: "화행 판단·피드백 기록" },
  { key: "revision_target_selected", label: "선택한 수정 지점" },
  { key: "revision_target_source", label: "수정 지점 출처" },
  { key: "revised_response", label: "수정 응답" },
  { key: "transfer_response", label: "전이 응답" },
  { key: "target_feature_observed", label: "목표 특징 관찰" },
  { key: "semantic_fidelity_status", label: "의미 충실도" },
  { key: "self_confidence_rating", label: "자신감" },
  { key: "content_ver", label: "콘텐츠 버전" },
  { key: "policy_ver", label: "정책 버전" },
  { key: "attempt_id", label: "수행 attempt ID" },
  { key: "assignment_id", label: "주차 배치 ID" },
  { key: "content_hash", label: "실행 콘텐츠 해시" },
];

const fmtKst = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
};

// 표에는 사람이 읽는 이름만 둔다. 원래 코드값·ID는 행의 title과 「보기」 상세, 연구 데이터 내보내기에 그대로 남는다.
const speechActLabel = (act: string | null) => (act ? SPEECH_ACT_UI[act as SpeechActUI] ?? act : "—");
const taskLabel = (taskType: string | null) => (taskType ? MODE_LABEL[taskType as GenMode] ?? taskType : "—");
const missionLabel = (brief: string | undefined, missionId: string) => {
  const title = missionMenuTitle(brief);
  if (title) return title;
  const text = brief?.replace(/\s+/g, " ").trim().replace(/[.。]$/, "");
  if (text) return text.length > 26 ? `${text.slice(0, 26).trimEnd()}…` : text;
  return `미션 ${missionId.slice(0, 8)}`;
};

const learnerLabel = (row: MissionLogRow) =>
  row.profiles?.full_name ?? row.profiles?.anonymous_participant_id ?? `${row.profile_id.slice(0, 8)}…`;

const DetailPanel = ({ row }: { row: MissionLogRow }) => {
  const fields = DETAIL_FIELDS.filter(({ key }) => {
    const value = row[key];
    return value !== null && value !== undefined && value !== "";
  });

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 md:grid-cols-2">
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">표시할 수행 내용이 없습니다.</p>
      ) : (
        fields.map(({ key, label }) => (
          <div key={key} className="min-w-0">
            <div className="text-xs font-semibold text-muted-foreground">{label}</div>
            <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-background p-2 text-[13px] leading-relaxed text-foreground">
              {renderValue(row[key])}
            </pre>
          </div>
        ))
      )}
    </div>
  );
};

const IndividualRecords = () => {
  const [rows, setRows] = useState<MissionLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // 학습자 승인·관리에서 「수행 기록」으로 넘어오면 ?q=… 로 검색어를 받는다.
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<MissionLogFilters>({
    ...EMPTY_FILTERS,
    query: params.get("q") ?? "",
  });
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseIndex, setCourseIndex] = useState<MissionCourseIndex>(new Map());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("learner_mission_logs")
        .select(
          "*, profiles!learner_mission_logs_profile_id_fkey(full_name,email,anonymous_participant_id)",
        )
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setRows([]);
        return;
      }
      setRows((data ?? []) as MissionLogRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const courseTitle = useMemo(
    () => new Map(courses.map((course) => [course.id, course.title])),
    [courses],
  );

  // 교과목은 로그에 없으므로 편성표에서 파생한다. 실패해도 목록 조회는 막지 않고
  // 교과목 필터만 비활성으로 남긴다.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [outlinesResult, assignmentsResult] = await Promise.all([
        supabase.from("curriculum_outlines").select("id,title").order("updated_at", { ascending: false }),
        supabase.from("curriculum_week_scenarios").select("outline_id,scenario_id"),
      ]);
      if (cancelled || outlinesResult.error || assignmentsResult.error) return;
      setCourses((outlinesResult.data ?? []) as Array<{ id: string; title: string }>);
      setCourseIndex(
        buildMissionCourseIndex(
          (assignmentsResult.data ?? []) as Array<{ outline_id: string; scenario_id: string }>,
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 미션 제목은 로그에 없으므로 시나리오의 짧은 설명에서 가져온다. 실패하면 짧은 ID로 둔다.
  const [missionBriefs, setMissionBriefs] = useState<Map<string, string>>(new Map());
  const missionIds = useMemo(() => [...new Set((rows ?? []).map((row) => row.mission_id))], [rows]);
  useEffect(() => {
    if (missionIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data, error: briefError } = await supabase
        .from("scenarios")
        .select("scenario_id,core_content")
        .in("scenario_id", missionIds);
      if (cancelled || briefError) return;
      setMissionBriefs(new Map((data ?? []).flatMap((item) => {
        // 짧은 설명(brief)이 없는 미션(v6 전환분 일부)은 상황 설명의 첫 문장으로 대신한다.
        const content = item.core_content as { brief_note_ko?: unknown; situation_ko?: unknown } | null;
        const brief = typeof content?.brief_note_ko === "string" && content.brief_note_ko.trim()
          ? content.brief_note_ko
          : typeof content?.situation_ko === "string" && content.situation_ko.trim()
            ? missionSituationSummary(content.situation_ko)
            : null;
        return brief ? [[item.scenario_id, brief] as [string, string]] : [];
      })));
    })();
    return () => {
      cancelled = true;
    };
  }, [missionIds]);

  const visibleRows = useMemo(
    () => (rows ? filterMissionLogs(rows, filters, courseIndex) : []),
    [rows, filters, courseIndex],
  );
  const completedCount = useMemo(
    () => visibleRows.filter((row) => row.mission_completed).length,
    [visibleRows],
  );
  const speechActs = useMemo(
    () => [...new Set((rows ?? []).map((row) => row.speech_act).filter((act): act is string => !!act))].sort(),
    [rows],
  );
  const loading = rows === null;
  const filtered = hasActiveFilter(filters);
  const selectClass = "h-9 rounded-md border border-border bg-white px-2 text-sm";

  return (
    <>
      {!loading && !error && rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            학습자 검색
            <input
              type="search"
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="이름·이메일·참여자 ID"
              aria-label="학습자 검색"
              className="mt-1 block h-9 w-56 rounded-md border border-border bg-white px-2.5 text-sm font-normal text-foreground"
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            교과목
            <select
              aria-label="교과목 필터"
              value={filters.courseId}
              disabled={courses.length === 0}
              onChange={(event) => setFilters((current) => ({ ...current, courseId: event.target.value }))}
              className={`mt-1 block w-56 font-normal text-foreground ${selectClass}`}
            >
              <option value="all">전체</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
              <option value="unknown">교과목 미상</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            주차
            <select
              aria-label="주차 필터"
              value={filters.weekNo}
              onChange={(event) => setFilters((current) => ({ ...current, weekNo: event.target.value }))}
              className={`mt-1 block w-28 font-normal text-foreground ${selectClass}`}
            >
              <option value="all">전체</option>
              {Array.from({ length: 15 }, (_, index) => index + 1).map((week) => (
                <option key={week} value={week}>{week}주차</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            화행
            <select
              aria-label="화행 필터"
              value={filters.speechAct}
              onChange={(event) => setFilters((current) => ({ ...current, speechAct: event.target.value }))}
              className={`mt-1 block w-40 font-normal text-foreground ${selectClass}`}
            >
              <option value="all">전체</option>
              {speechActs.map((act) => (
                <option key={act} value={act}>{SPEECH_ACT_UI[act as SpeechActUI] ?? act}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            완료 여부
            <select
              aria-label="완료 여부 필터"
              value={filters.completion}
              onChange={(event) =>
                setFilters((current) => ({ ...current, completion: event.target.value as MissionLogFilters["completion"] }))
              }
              className={`mt-1 block w-32 font-normal text-foreground ${selectClass}`}
            >
              <option value="all">전체</option>
              <option value="completed">완료</option>
              <option value="in_progress">진행 중</option>
            </select>
          </label>
          {filtered && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
            >
              필터 해제
            </button>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {loading
            ? "불러오는 중…"
            : error
              ? "조회 실패"
              : filtered
                ? `${visibleRows.length}건 표시 · 전체 ${rows.length}건`
                : `총 ${rows.length}건`}
        </span>
        {!loading && !error && <span>완료 {completedCount}건</span>}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          학습 수행 기록 조회 실패: {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          아직 학습미션 수행 기록이 없습니다.
        </div>
      ) : visibleRows.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          조건에 맞는 기록이 없습니다. 필터를 바꾸거나 해제해 주세요.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">최근 저장</th>
                <th className="px-3 py-2 font-medium">학습자</th>
                <th className="px-3 py-2 font-medium">화행</th>
                <th className="px-3 py-2 font-medium">미션</th>
                <th className="px-3 py-2 font-medium">교과목·주차</th>
                <th className="px-3 py-2 font-medium">과업</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 text-right font-medium">내용</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const open = !!expanded[row.id];
                return (
                  <Fragment key={row.id}>
                    <tr className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2">{fmtKst(row.updated_at)}</td>
                      <td className="px-3 py-2" title={row.profiles?.email ?? undefined}>
                        {learnerLabel(row)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{speechActLabel(row.speech_act)}</td>
                      <td className="max-w-56 truncate px-3 py-2" title={row.mission_id}>
                        {missionLabel(missionBriefs.get(row.mission_id), row.mission_id)}
                      </td>
                      <td className="max-w-52 px-3 py-2 text-xs">
                        {row.course_id
                          ? `${courseTitle.get(row.course_id) ?? row.course_id.slice(0, 8)} · ${row.week_no ?? "—"}주차`
                          : "편성 외 수행"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{taskLabel(row.task_type)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            row.mission_completed
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800",
                          ].join(" ")}
                        >
                          {row.mission_completed ? "완료" : "진행 중"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setExpanded((current) => ({ ...current, [row.id]: !open }))}
                          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                          aria-expanded={open}
                        >
                          {open ? "접기" : "보기"}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-t border-border bg-background">
                        <td colSpan={8} className="px-3 py-3">
                          <DetailPanel row={row} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

const TABS = [
  { key: "records", label: "개별 수행 기록" },
  { key: "class", label: "학급 응답 분포" },
] as const;

/** 같은 학습 기록을 개인 단위(개별 수행 기록)와 익명 집계 단위(학급 응답 분포)로 나눠 본다. */
const Page = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "class" ? "class" : "records";
  return (
    <AdminShell
      title="학습 수행 기록"
      description="학습 미션 수행 기록을 개별 학습자 단위와 익명 학급 집계 단위로 확인합니다."
    >
      <div role="tablist" aria-label="기록 보기 방식" className="mb-4 flex gap-1 border-b border-[#E2DED2]">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setParams(item.key === "class" ? { tab: "class" } : {})}
            className={[
              "-mb-px border-b-2 px-4 py-2 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]",
              tab === item.key ? "border-[#15202B] font-semibold text-[#15202B]" : "border-transparent text-[#6B7780] hover:text-[#15202B]",
            ].join(" ")}
          >{item.label}</button>
        ))}
      </div>
      {tab === "class" ? <ClassResponsePanel /> : <IndividualRecords />}
    </AdminShell>
  );
};

export default Page;
