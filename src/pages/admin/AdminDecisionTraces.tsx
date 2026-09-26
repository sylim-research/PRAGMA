import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import { ClassResponsePanel } from "@/components/admin/ClassResponsePanel";
import { LearningRecordDetailView } from "@/components/admin/LearningRecordDetailView";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { MODE_LABEL, SPEECH_ACT_UI, type GenMode, type SpeechActUI } from "@/lib/pragma/enums";
import { missionMenuTitle } from "@/lib/curriculum/missionMenuTitle";
import { missionSituationSummary } from "@/lib/curriculum/weeklyMaterials";
import { buildLearningRecordDetail } from "@/lib/admin/learningRecordDetail";
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
  role: string | null;
};
type MissionLogRow = MissionLog & { profiles: ProfileSummary | null };
type CourseOption = { id: string; title: string };

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

// 표에는 사람이 읽는 이름만 둔다. 원래 코드값·ID는 행의 title과 「보기」 상세, 연구 데이터 내보내기에 그대로 남는다.
const speechActLabel = (act: string | null) => (act ? SPEECH_ACT_UI[act as SpeechActUI] ?? act : "—");
const taskLabel = (taskType: string | null) => (taskType ? MODE_LABEL[taskType as GenMode] ?? taskType : "—");
const missionLabel = (brief: string | undefined, missionId: string) => {
  const title = missionMenuTitle(brief);
  if (title) return title;
  const text = brief?.replace(/\s+/g, " ").trim().replace(/[.。]$/, "");
  if (text) return text.length > 26 ? `${text.slice(0, 26).trimEnd()}…` : text;
  if (missionId.startsWith("sample:")) return "예시 미션(개발용)";
  return `미션 ${missionId.slice(0, 8)}`;
};

// 시나리오 ID(uuid)만 조회한다. 「sample:…」 같은 개발용 ID가 섞이면 조회 전체가 실패해 모든 제목이 ID로 보였다.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const learnerLabel = (row: MissionLogRow) =>
  row.profiles?.full_name ?? row.profiles?.anonymous_participant_id ?? `${row.profile_id.slice(0, 8)}…`;

const DetailPanel = ({ row, mission, placement }: { row: MissionLogRow; mission: unknown; placement: string }) => (
  <LearningRecordDetailView detail={buildLearningRecordDetail(row, mission, placement, fmtKst)} />
);

const IndividualRecords = () => {
  const [rows, setRows] = useState<MissionLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 직접 펼치거나 접은 행만 기록한다. 나머지는 아래 defaultOpenId 규칙을 따른다.
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
          "*, profiles!learner_mission_logs_profile_id_fkey(full_name,email,anonymous_participant_id,role)",
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
  // 「보기」에서 MJT 제시 표현·선택지 문구를 풀어 쓰려고 미션 본문도 함께 읽는다.
  const [missionContents, setMissionContents] = useState<Map<string, unknown>>(new Map());
  const missionIds = useMemo(
    () => [...new Set((rows ?? []).map((row) => row.mission_id).filter((id) => UUID_PATTERN.test(id)))],
    [rows],
  );
  useEffect(() => {
    if (missionIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data, error: briefError } = await supabase
        .from("scenarios")
        .select("scenario_id,core_content,mission_content")
        .in("scenario_id", missionIds);
      if (cancelled || briefError) return;
      setMissionContents(new Map((data ?? []).map((item) => [item.scenario_id, item.mission_content] as [string, unknown])));
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

  // 관리자 계정의 시험 수행은 기본으로 빼고 본다(학급 응답 분포와 같은 기준: 학습자 계정만).
  const [includeTestRecords, setIncludeTestRecords] = useState(false);
  const testRecordCount = useMemo(() => (rows ?? []).filter((row) => row.profiles?.role === "admin").length, [rows]);
  const baseRows = useMemo(
    () => (rows ?? []).filter((row) => includeTestRecords || row.profiles?.role !== "admin"),
    [rows, includeTestRecords],
  );
  const visibleRows = useMemo(
    () => filterMissionLogs(baseRows, filters, courseIndex),
    [baseRows, filters, courseIndex],
  );
  // 화면에 들어오면 한 건은 펼쳐 둔다 — 현행(mission_v6) 수행 중 가장 최근 것, 없으면 맨 위 행.
  const defaultOpenId = useMemo(() => {
    const isCurrent = (row: MissionLogRow) =>
      (row.context_judgment as { mission_schema_version?: unknown } | null)?.mission_schema_version === "mission_v6";
    return (visibleRows.find(isCurrent) ?? visibleRows[0])?.id ?? null;
  }, [visibleRows]);
  const completedCount = useMemo(
    () => visibleRows.filter((row) => row.mission_completed).length,
    [visibleRows],
  );
  // 학습자 필터는 이름으로 고른다. 학습자 관리에서 이메일(?q=)로 넘어오면 그 사람의 이름으로 바꿔 선택해 둔다.
  const learnerNames = useMemo(() => {
    const names = [...new Set(baseRows.map(learnerLabel))].sort((a, b) => a.localeCompare(b, "ko"));
    return filters.query && !names.includes(filters.query) ? [filters.query, ...names] : names;
  }, [baseRows, filters.query]);
  useEffect(() => {
    const query = filters.query.trim().toLowerCase();
    if (!query || !rows) return;
    const match = rows.find((row) =>
      row.profiles?.email?.toLowerCase() === query || row.profiles?.anonymous_participant_id?.toLowerCase() === query);
    if (match) setFilters((current) => ({ ...current, query: learnerLabel(match) }));
  }, [rows, filters.query]);
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
        <div className="mb-3 flex flex-wrap items-end gap-2 xl:flex-nowrap">
          <label className="text-xs font-medium text-muted-foreground">
            학습자
            <select
              aria-label="학습자 필터"
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              className={`mt-1 block w-36 font-normal text-foreground ${selectClass}`}
            >
              <option value="">전체</option>
              {learnerNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            교과목
            <select
              aria-label="교과목 필터"
              value={filters.courseId}
              disabled={courses.length === 0}
              onChange={(event) => setFilters((current) => ({ ...current, courseId: event.target.value }))}
              className={`mt-1 block w-52 font-normal text-foreground ${selectClass}`}
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
              className={`mt-1 block w-24 font-normal text-foreground ${selectClass}`}
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
              className={`mt-1 block w-24 font-normal text-foreground ${selectClass}`}
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
              className={`mt-1 block w-28 font-normal text-foreground ${selectClass}`}
            >
              <option value="all">전체</option>
              <option value="completed">완료</option>
              <option value="in_progress">진행 중</option>
            </select>
          </label>
          <label className="flex h-9 items-center gap-2 whitespace-nowrap rounded-md border border-[#D8D4C8] bg-white px-3 text-sm font-medium text-[#1F3A5F]">
            <input
              type="checkbox"
              checked={includeTestRecords}
              onChange={(event) => setIncludeTestRecords(event.target.checked)}
              className="accent-[#1F3A5F]"
            />
            관리자 테스트 기록 포함 ({testRecordCount})
          </label>
          {filtered && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="h-9 whitespace-nowrap rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
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
                ? `${visibleRows.length}건 표시 · 전체 ${baseRows.length}건`
                : `총 ${baseRows.length}건`}
        </span>
        {!loading && !error && visibleRows.length > completedCount && (
          <span className="font-medium text-amber-800">진행 중 {visibleRows.length - completedCount}건</span>
        )}
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
          아직 학습 미션 수행 기록이 없습니다.
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
                <th className="px-3 py-2 font-medium">학습 미션</th>
                <th className="px-3 py-2 font-medium">교과목·주차</th>
                <th className="px-3 py-2 font-medium">수행 방식</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 text-right font-medium">내용</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const open = expanded[row.id] ?? row.id === defaultOpenId;
                const placement = row.course_id
                  ? `${courseTitle.get(row.course_id) ?? row.course_id.slice(0, 8)} · ${row.week_no ?? "—"}주차`
                  : "편성 외 수행";
                return (
                  <Fragment key={row.id}>
                    <tr className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 text-[13px] tabular-nums text-[#46515A]">{fmtKst(row.updated_at)}</td>
                      <td className="px-3 py-2" title={row.profiles?.email ?? undefined}>
                        {learnerLabel(row)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{speechActLabel(row.speech_act)}</td>
                      <td className="max-w-56 truncate px-3 py-2 font-semibold text-[#15202B]" title={row.mission_id}>
                        {missionLabel(missionBriefs.get(row.mission_id), row.mission_id)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">{placement}</td>
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
                          <DetailPanel row={row} mission={missionContents.get(row.mission_id)} placement={placement} />
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
      description="학습자가 수행한 학습 미션을 개별 수행 기록과 익명 학급 응답 분포로 확인합니다."
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
