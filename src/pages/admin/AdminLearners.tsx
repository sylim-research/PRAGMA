import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { courseDisplayTitle } from "@/lib/pragma/scenarioTopics";
import { APPROVAL_STATUS, type ApprovalStatus } from "@/lib/auth/constants";
import {
  PRIMARY_LANGUAGE_OPTIONS,
  exposureContextOptions,
  targetLanguageOf,
  TARGET_LANGUAGE_LABEL,
  languageTestOptions,
  languageTestLabel,
  TI_EXPERIENCE_OPTIONS,
  labelOf,
  labelsOf,
} from "@/lib/auth/profileOptions";

type LearnerRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  /** 마법사가 쓰는 컬럼. affiliation_or_status는 구 컬럼(둘 다 존재) */
  affiliation: string | null;
  affiliation_or_status: string | null;
  chinese_level: string | null;
  chinese_exposure_contexts: string[] | null;
  ti_experience_note: string | null;
  interpreting_experience: string | null;
  /** 동의도 마법사는 consent_* 에 쓴다. research_use_consent 등은 구 컬럼 */
  consent_data_use: boolean | null;
  consent_anonymous_analysis: boolean | null;
  consent_email_report: boolean | null;
  consent_class_record_sharing: boolean | null;
  academic_year_or_program: string | null;
  grade_or_program: string | null;
  profile_completed: boolean;
  approval_status: ApprovalStatus;
  anonymous_participant_id: string | null;
  updated_at: string | null;
  created_at: string | null;
  role: "learner" | "admin";
  language_background: string | null;
  chinese_proficiency_self_report: string | null;
  business_chinese_experience: string | null;
  ti_experience_level: string | null;
  ti_experience_modes: string[] | null;
  genai_use_frequency: string | null;
  ai_prompting_style_for_ti: string | null;
  perceived_ai_ti_difficulty: string | null;
  perceived_business_chinese_ti_risk: string | null;
  research_use_consent: boolean;
  anonymization_notice_confirmed: boolean;
  report_email_consent: boolean | null;
};

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending_approval: "승인 대기",
  approved: "승인 완료",
  rejected: "반려 처리",
  inactive: "비활성",
};

const STATUS_TONE: Record<ApprovalStatus, string> = {
  pending_approval: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-lg border border-border bg-card p-4">
    <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{children}</dl>
  </div>
);

/** 소속/신분·동의는 신·구 컬럼이 공존한다 — 마법사가 쓰는 쪽을 우선하고 없으면 구 값. */
/** 목록용 동의 요약 한 칸. 둘 다 동의면 초록, 미동의가 있으면 적색, 그 밖에는 호박색(회색 금지). */
function ConsentSummary({ research, sharing }: { research: boolean | null | undefined; sharing: boolean | null | undefined }) {
  const word = (value: boolean | null | undefined) => (value === true ? "✓" : value === false ? "✕" : "?");
  const tone = research === true && sharing === true
    ? "border-[#9CC7B0] bg-[#F4FAF6] text-[#245E44]"
    : research === false || sharing === false
      ? "border-[#E8B4AE] bg-[#FFF3F1] text-[#8B3531]"
      : "border-[#E3C77A] bg-[#FFFBEF] text-[#8A5A14]";
  const state = (value: boolean | null | undefined) => (value === true ? "동의" : value === false ? "미동의" : "미확인");
  return (
    <span
      title={`연구 활용 ${state(research)} · 학습 기록 공유 ${state(sharing)}`}
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${tone}`}
    >
      연구 {word(research)} · 공유 {word(sharing)}
    </span>
  );
}

/** 표 머리글과 칸이 같은 좌우 여백·정렬을 쓰도록 한곳에서 정한다. */
const TH = "h-11 px-3 text-left align-middle text-xs font-bold text-[#46515A]";
const TD = "px-3 py-2 align-middle text-sm text-[#343B42]";

type LearnerActivity = { courses: string[]; last: string | null };

const formatActivityDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear() % 100}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

const firstOf = <T,>(...vals: (T | null | undefined)[]) =>
  vals.find((v) => v !== null && v !== undefined) ?? null;

/**
 * 수행 기록 화면의 학습자 검색어. 그 화면은 이름·이메일·가명 참여자 ID를
 * 부분 일치로 찾으므로, 가장 특정적인 값부터 고른다. 셋 다 없으면 링크를 걸지 않는다.
 */
const traceQueryFor = (row: { email: string | null; anonymous_participant_id: string | null; full_name: string | null }) =>
  firstOf(row.email, row.anonymous_participant_id, row.full_name);

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm text-foreground break-words">
      {value === null || value === undefined || value === "" ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        value
      )}
    </dd>
  </div>
);

const Page = () => {
  const [rows, setRows] = useState<LearnerRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 수강 등록 데이터는 없으므로, 실제 미션 수행 기록에서 학습한 교과목과 최근 활동을 읽는다.
  const [activity, setActivity] = useState<Record<string, LearnerActivity>>({});

  const fetchRows = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "learner")
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "목록 로드 실패", description: error.message, variant: "destructive" });
      setRows([]);
      return;
    }
    const learners = (data ?? []) as LearnerRow[];
    setRows(learners);
    if (learners.length === 0) return;
    const [{ data: logs }, { data: courses }] = await Promise.all([
      supabase
        .from("learner_mission_logs")
        .select("profile_id, course_id, updated_at")
        .in("profile_id", learners.map((learner) => learner.id)),
      supabase.from("curriculum_outlines").select("id, title"),
    ]);
    const titleById = new Map((courses ?? []).map((course) => [course.id, courseDisplayTitle(course)]));
    const next: Record<string, LearnerActivity> = {};
    for (const log of logs ?? []) {
      const entry = (next[log.profile_id] ??= { courses: [], last: null });
      const title = log.course_id ? titleById.get(log.course_id) : undefined;
      if (title && !entry.courses.includes(title)) entry.courses.push(title);
      if (!entry.last || log.updated_at > entry.last) entry.last = log.updated_at;
    }
    setActivity(next);
  };

  useEffect(() => {
    void fetchRows();
  }, []);

  const selected = useMemo(
    () => (selectedId ? rows?.find((r) => r.id === selectedId) ?? null : null),
    [selectedId, rows],
  );

  const updateStatus = async (
    row: LearnerRow,
    next: ApprovalStatus,
  ) => {
    setBusy(true);
    const patch: {
      approval_status: ApprovalStatus;
      anonymous_participant_id?: string;
    } = { approval_status: next };
    if (next === APPROVAL_STATUS.APPROVED && !row.anonymous_participant_id) {
      patch.anonymous_participant_id = `anon_${crypto.randomUUID()}`;
    }
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", row.id);
    setBusy(false);
    if (error) {
      toast({ title: "변경 실패", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "변경됨", description: `${row.full_name ?? row.email ?? "학습자"} → ${STATUS_LABEL[next]}` });
    await fetchRows();
  };

  return (
    <AdminShell
      title="학습자 관리"
      description="학습자 기본 정보와 학습 배경을 확인하고 수행 기록으로 이동합니다."
    >
      <div className="mb-2 text-right text-sm text-muted-foreground">
        {rows === null ? "불러오는 중…" : `총 ${rows.length}명`}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_30px_rgba(21,32,43,0.05)]">
        <Table className="min-w-[1180px] table-fixed">
          <colgroup>
            <col style={{ width: "21%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
          </colgroup>
          <TableHeader className="bg-[#F7F5EE]">
            <TableRow>
              <TableHead className={`${TH} pl-5`}>학습자</TableHead>
              <TableHead className={TH}>소속 · 학년/과정</TableHead>
              <TableHead className={TH}>사용 언어</TableHead>
              <TableHead className={TH}>공인 급수</TableHead>
              <TableHead className={TH}>학습한 교과목</TableHead>
              <TableHead className={TH}>최근 활동</TableHead>
              <TableHead className={TH}>연구 동의</TableHead>
              <TableHead className={TH}>상태</TableHead>
              <TableHead className={`${TH} pr-5 text-right`}>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                  불러오는 중…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                  표시할 학습자가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const primaryLanguage = labelOf(PRIMARY_LANGUAGE_OPTIONS, r.language_background);
                const testLevel = labelOf(languageTestOptions(r.language_background), r.chinese_level);
                const affiliation = firstOf(r.affiliation, r.affiliation_or_status);
                const program = firstOf(r.grade_or_program, r.academic_year_or_program);
                const act = activity[r.id];
                return (
                <TableRow key={r.id} className="h-[52px] hover:bg-[#FBFAF5]">
                  <TableCell className={`${TD} pl-5`}>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <button
                        type="button"
                        aria-label={`${r.full_name ?? r.email ?? "학습자"} 프로필 보기`}
                        onClick={() => setSelectedId(r.id)}
                        className="shrink-0 whitespace-nowrap text-left font-semibold text-[#1F3A5F] underline decoration-[#9FB0C6] underline-offset-4 hover:decoration-[#1F3A5F] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {r.full_name ?? "—"}
                      </button>
                      <span className="min-w-0 truncate text-xs text-[#46515A]" title={r.email ?? undefined}>{r.email ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className={TD}>
                    <div className="truncate" title={[affiliation, program].filter(Boolean).join(" · ")}>
                      {affiliation ?? "—"}
                      {program && <span className="text-xs text-[#46515A]"> · {program}</span>}
                    </div>
                  </TableCell>
                  <TableCell className={TD}>
                    {primaryLanguage ?? <span className="text-xs text-amber-700">미입력</span>}
                  </TableCell>
                  <TableCell className={TD}>
                    {testLevel ?? <span className="text-xs text-amber-700">미입력</span>}
                  </TableCell>
                  <TableCell className={TD}>
                    {act && act.courses.length > 0 ? (
                      <div className="truncate" title={act.courses.join(", ")}>
                        {act.courses[0]}
                        {act.courses.length > 1 && <span className="text-xs font-semibold text-[#1F3A5F]"> 외 {act.courses.length - 1}</span>}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700">아직 없음</span>
                    )}
                  </TableCell>
                  <TableCell className={`${TD} tabular-nums`}>
                    {act?.last ? formatActivityDate(act.last) : <span className="text-xs text-amber-700">—</span>}
                  </TableCell>
                  <TableCell className={TD}>
                    <ConsentSummary research={firstOf(r.consent_data_use, r.research_use_consent)} sharing={r.consent_class_record_sharing} />
                  </TableCell>
                  <TableCell className={TD}>
                    <Badge
                      variant="outline"
                      className={`whitespace-nowrap ${STATUS_TONE[r.approval_status]}`}
                    >
                      {STATUS_LABEL[r.approval_status]}
                    </Badge>
                  </TableCell>
                  <TableCell className={`${TD} pr-5 text-right`}>
                    {traceQueryFor(r) && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="h-8 whitespace-nowrap border-[#1F3A5F] px-3 text-[#1F3A5F] hover:bg-[#EEF2F7]"
                      >
                        <Link to={`/admin/decision-traces?q=${encodeURIComponent(traceQueryFor(r)!)}`}>
                          수행 기록 →
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.full_name ?? selected.email ?? "학습자 상세"}
                </DialogTitle>
                <DialogDescription>
                  가입 정보와 수업 운영에 필요한 학습 배경을 확인합니다.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {!selected.profile_completed && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    학습 배경 입력이 완료되지 않은 프로필입니다.
                  </div>
                )}

                <Section title="기본 정보">
                  <Field label="이름" value={selected.full_name} />
                  <Field label="이메일" value={selected.email} />
                  <Field
                    label="소속/신분"
                    value={firstOf(selected.affiliation, selected.affiliation_or_status)}
                  />
                  <Field
                    label="학년/과정"
                    value={firstOf(selected.grade_or_program, selected.academic_year_or_program)}
                  />
                  <Field
                    label="승인 상태"
                    value={
                      <Badge variant="outline" className={STATUS_TONE[selected.approval_status]}>
                        {STATUS_LABEL[selected.approval_status]}
                      </Badge>
                    }
                  />
                </Section>

                <Section title="학습 배경">
                  <Field
                    label="주 사용 언어"
                    value={labelOf(PRIMARY_LANGUAGE_OPTIONS, selected.language_background)}
                  />
                  <Field
                    label={languageTestLabel(selected.language_background)}
                    value={labelOf(
                      languageTestOptions(selected.language_background),
                      selected.chinese_level,
                    )}
                  />
                  {/* 학습 대상 언어는 주 사용 언어에서 도출된다 — 중국어 모어
                      화자에게는 한국어 노출을 물었으므로 라벨도 그렇게 읽어야 한다. */}
                  <Field
                    label={`${
                      TARGET_LANGUAGE_LABEL[targetLanguageOf(selected.language_background)]
                    } 접촉·사용 상황`}
                    value={labelsOf(
                      exposureContextOptions(targetLanguageOf(selected.language_background)),
                      selected.chinese_exposure_contexts,
                    )}
                  />
                  <Field
                    label="한중 통번역 경험"
                    value={labelOf(TI_EXPERIENCE_OPTIONS, selected.ti_experience_level)}
                  />
                </Section>

                <details className="rounded-lg border border-border bg-card">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
                    연구·데이터 관리
                  </summary>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border px-4 py-4 sm:grid-cols-2">
                    <Field
                      label="학습 기록 공유 동의"
                      value={
                        selected.consent_class_record_sharing === null ||
                        selected.consent_class_record_sharing === undefined
                          ? "미확인"
                          : selected.consent_class_record_sharing
                            ? "동의"
                            : "미동의"
                      }
                    />
                    <Field
                      label="연구 활용 동의"
                      value={firstOf(selected.consent_data_use, selected.research_use_consent) ? "동의" : "미동의"}
                    />
                    <Field
                      label="익명화 안내 확인"
                      value={firstOf(selected.consent_anonymous_analysis, selected.anonymization_notice_confirmed) ? "확인" : "미확인"}
                    />
                    <Field
                      label="리포트 이메일 동의"
                      value={firstOf(selected.consent_email_report, selected.report_email_consent) ? "동의" : "미동의"}
                    />
                    <Field
                      label="익명 식별자"
                      value={
                        selected.anonymous_participant_id ? (
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {selected.anonymous_participant_id}
                          </code>
                        ) : null
                      }
                    />
                  </dl>
                </details>
              </div>

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || selected.approval_status === APPROVAL_STATUS.INACTIVE}
                    onClick={() => updateStatus(selected, APPROVAL_STATUS.INACTIVE)}
                  >
                    비활성화
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy || selected.approval_status === APPROVAL_STATUS.REJECTED}
                    onClick={() => updateStatus(selected, APPROVAL_STATUS.REJECTED)}
                  >
                    반려
                  </Button>
                  <Button
                    disabled={busy || selected.approval_status === APPROVAL_STATUS.APPROVED}
                    onClick={() => updateStatus(selected, APPROVAL_STATUS.APPROVED)}
                  >
                    승인
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default Page;
