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
    setRows((data ?? []) as LearnerRow[]);
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
        <Table className="min-w-[820px] table-fixed">
          <colgroup>
            <col style={{ width: "23%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "16%" }} />
          </colgroup>
          <TableHeader className="bg-[#F7F5EE]">
            <TableRow>
              <TableHead className="h-12 px-5 text-xs font-bold text-[#5F625F]">학습자</TableHead>
              <TableHead className="h-12 px-3 text-xs font-bold text-[#5F625F]">소속/신분</TableHead>
              <TableHead className="h-12 px-3 text-xs font-bold text-[#5F625F]">주 언어·공인 급수</TableHead>
              <TableHead className="h-12 px-3 text-xs font-bold text-[#5F625F]">통번역 경험</TableHead>
              <TableHead className="h-12 px-3 text-xs font-bold text-[#5F625F]">상태</TableHead>
              <TableHead className="h-12 px-5 text-right text-xs font-bold text-[#5F625F]">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  불러오는 중…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  표시할 학습자가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const primaryLanguage = labelOf(PRIMARY_LANGUAGE_OPTIONS, r.language_background);
                const testLevel = labelOf(languageTestOptions(r.language_background), r.chinese_level);
                return (
                <TableRow key={r.id} className="h-[72px] hover:bg-[#FBFAF5]">
                  <TableCell className="px-5 py-4">
                    <div className="min-w-0">
                      <button
                        type="button"
                        aria-label={`${r.full_name ?? r.email ?? "학습자"} 프로필 보기`}
                        onClick={() => setSelectedId(r.id)}
                        className="block max-w-full truncate text-left font-semibold leading-5 text-foreground underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {r.full_name ?? "—"}
                      </button>
                      <div className="mt-0.5 truncate text-xs leading-5 text-muted-foreground" title={r.email ?? undefined}>{r.email ?? "—"}</div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-4 text-sm leading-5 text-[#343B42]">
                    {firstOf(r.affiliation, r.affiliation_or_status) ?? "—"}
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    {primaryLanguage || testLevel ? (
                      <div className="leading-5">
                        <div className="font-medium text-[#343B42]">{primaryLanguage || testLevel}</div>
                        {primaryLanguage && testLevel && (
                          <div className="text-xs text-muted-foreground">{testLevel}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700">학습 배경 미입력</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-4 text-sm text-[#343B42]">
                    {labelOf(TI_EXPERIENCE_OPTIONS, r.ti_experience_level) ?? "—"}
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <Badge
                      variant="outline"
                      className={`min-w-[76px] justify-center whitespace-nowrap ${STATUS_TONE[r.approval_status]}`}
                    >
                      {STATUS_LABEL[r.approval_status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-right">
                    {traceQueryFor(r) && (
                      <Button
                        size="sm"
                        asChild
                        className="whitespace-nowrap bg-[#15202B] text-white hover:bg-[#243447]"
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
