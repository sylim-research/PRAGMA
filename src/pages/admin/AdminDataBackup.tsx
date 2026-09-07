import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ShieldCheck, Upload } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { DIRECTION_LABEL, DOMAIN, INDUSTRY, LEVEL } from "@/lib/pragma/enums";
import type { Domain, IndustrySector, LanguageDirection, LearnerLevel } from "@/lib/pragma/enums";
import {
  COURSE_BACKUP_SCOPE,
  COURSE_BACKUP_SUMMARY,
  courseBackupFilename,
  courseBackupFilenamePreview,
  preRestoreBackupFilename,
  parseCourseBackup,
  summarizeCourseBackup,
  type CourseBackupFile,
} from "@/lib/backup/courseBackup";
import {
  downloadCourseBackup,
  fetchCourseBackup,
  fetchCourseBackupCounts,
  fetchCourseCompareBasis,
  listBackupCourses,
  restoreCourseBackup,
  type CourseBackupCounts,
  type CourseCompareBasis,
  type CourseSummary,
} from "@/lib/backup/courseBackupApi";

type Notice = { tone: "ok" | "error" | "info"; text: string };

const NOTICE_STYLE: Record<Notice["tone"], string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

const levelLabel = (value: string | null) => LEVEL[value as LearnerLevel] ?? value ?? null;
const directionLabel = (value: string | null) => DIRECTION_LABEL[value as LanguageDirection] ?? value ?? null;
const domainLabel = (value: string | null) => DOMAIN[value as Domain] ?? value ?? null;
const industryLabel = (value: string | null) => INDUSTRY[value as IndustrySector] ?? value ?? null;

/** 「고급 · 중→한 · 직무 · 15주」 형태의 한 줄 요약. */
const courseTraits = (course: CourseSummary) =>
  [
    levelLabel(course.level),
    directionLabel(course.language_direction),
    domainLabel(course.domain),
    industryLabel(course.industry),
    course.week_count ? `${course.week_count}주` : null,
  ].filter(Boolean) as string[];

const formatStamp = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hour = date.getHours();
  const meridiem = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${meridiem} ${hour12}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const ScopeDetails = () => (
  <details className="mt-4 border-t border-border pt-3 text-sm leading-6 text-muted-foreground">
    <summary className="cursor-pointer font-medium text-foreground">백업 범위 자세히 보기</summary>
    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <h4 className="mb-1.5 font-semibold text-foreground">파일에 담기는 것</h4>
        <ul className="list-disc space-y-1 pl-4">
          {COURSE_BACKUP_SCOPE.included.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="mb-1.5 font-semibold text-foreground">담기지 않는 것</h4>
        <ul className="list-disc space-y-1 pl-4">
          {COURSE_BACKUP_SCOPE.excluded.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  </details>
);

/**
 * 카드 제목 앞의 역할 라벨. 제목보다 강해 보이지 않게 작게 유지한다.
 * brand = PRAGMA 노란 accent(#FAD338)를 옅게 — 주 동작인 백업에만 쓴다(accent는 아껴 쓴다).
 * ink  = 같은 브랜드 잉크(짙은 남색) 톤 — 짝은 맞추고 위계만 낮춘다.
 */
const BADGE_TONE = {
  brand: "border-accent bg-accent/25 text-foreground",
  ink: "border-primary/20 bg-primary/5 text-primary/80",
} as const;

const RoleBadge = ({ children, tone }: { children: string; tone: keyof typeof BADGE_TONE }) => (
  <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${BADGE_TONE[tone]}`}>{children}</span>
);

/** 백업 전 「무엇이 담기는지」를 보여 주는 작은 수치 칸 — 오른쪽 미리보기와 같은 리듬. */
const StatTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-base font-semibold">{value}</p>
  </div>
);

const PreviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3 py-1">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="text-right font-medium">{value}</dd>
  </div>
);

const Page = () => {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupNotice, setBackupNotice] = useState<Notice | null>(null);
  const [restoreNotice, setRestoreNotice] = useState<Notice | null>(null);
  const [pendingFile, setPendingFile] = useState<CourseBackupFile | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [counts, setCounts] = useState<CourseBackupCounts | null>(null);
  const [lastBackup, setLastBackup] = useState<
    { title: string; weeks: number; assignments: number; scenarios: number; filename: string } | null
  >(null);
  const [compareBasis, setCompareBasis] = useState<CourseCompareBasis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedId) ?? null,
    [courses, selectedId],
  );

  const preview = useMemo(() => (pendingFile ? summarizeCourseBackup(pendingFile) : null), [pendingFile]);

  // 복원이 실제로 하는 일만 센다: 추가될 배정과 정리될 배정(둘 다 키 비교로 정확히 나온다).
  const impact = useMemo(() => {
    if (!pendingFile || !compareBasis) return null;
    const fileKeys = new Set(
      pendingFile.data.curriculum_week_scenarios.map((row) => `${String(row.week_no)}:${String(row.scenario_id)}`),
    );
    const currentKeys = new Set(compareBasis.assignmentKeys);
    return {
      exists: compareBasis.exists,
      currentWeeks: compareBasis.weeks,
      fileWeeks: pendingFile.data.curriculum_weeks.length,
      added: [...fileKeys].filter((key) => !currentKeys.has(key)).length,
      keptOnly: [...currentKeys].filter((key) => !fileKeys.has(key)).length,
    };
  }, [pendingFile, compareBasis]);

  useEffect(() => {
    let cancelled = false;
    listBackupCourses()
      .then((rows) => {
        if (cancelled) return;
        setCourses(rows);
        setSelectedId((current) => current || (rows[0]?.id ?? ""));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setBackupNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "교과목 목록을 불러오지 못했습니다.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingCourses(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 선택한 교과목에 무엇이 담길지 미리 센다(개수만 — 본문은 가져오지 않는다).
  useEffect(() => {
    if (!selectedId) {
      setCounts(null);
      return;
    }
    let cancelled = false;
    setCounts(null);
    fetchCourseBackupCounts(selectedId)
      .then((result) => {
        if (!cancelled) setCounts(result);
      })
      .catch(() => {
        // 개수는 보조 정보다 — 실패해도 백업 자체를 막지 않는다.
        if (!cancelled) setCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // 올린 파일의 교과목이 지금 어떤 상태인지 확인한다(개수·키만 읽는다).
  useEffect(() => {
    const outlineId = pendingFile?.data.curriculum_outlines[0]?.id;
    if (typeof outlineId !== "string") {
      setCompareBasis(null);
      return;
    }
    let cancelled = false;
    fetchCourseCompareBasis(outlineId)
      .then((basis) => {
        if (!cancelled) setCompareBasis(basis);
      })
      .catch(() => {
        // 비교는 보조 정보다 — 실패하면 아예 보여 주지 않는다(추정하지 않는다).
        if (!cancelled) setCompareBasis(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pendingFile]);

  const runBackup = async () => {
    if (!selectedId) return;
    setBackingUp(true);
    setBackupNotice(null);
    setLastBackup(null);
    try {
      const file = await fetchCourseBackup(selectedId, {
        projectRef: import.meta.env.VITE_SUPABASE_PROJECT_ID ?? null,
      });
      downloadCourseBackup(file);
      const summary = summarizeCourseBackup(file);
      setLastBackup({
        title: summary.title,
        weeks: summary.weekCount,
        assignments: summary.assignmentCount,
        scenarios: summary.scenarioCount,
        filename: courseBackupFilename(file),
      });
    } catch (error) {
      setBackupNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "백업에 실패했습니다.",
      });
    } finally {
      setBackingUp(false);
    }
  };

  // 파일 선택과 끌어다 놓기가 같은 경로를 탄다 — 검증·복원 로직은 그대로다.
  const acceptFile = async (file: File | undefined) => {
    setPendingFile(null);
    setPendingFileName(null);
    setCompareBasis(null);
    setRestoreNotice(null);
    if (!file) return;
    try {
      setPendingFile(parseCourseBackup(await file.text()));
      setPendingFileName(file.name);
    } catch (error) {
      setRestoreNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "백업 파일을 읽지 못했습니다.",
      });
    }
  };

  const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    void acceptFile(event.target.files?.[0]);
  };

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    void acceptFile(event.dataTransfer.files?.[0]);
  };

  const runRestore = async () => {
    if (!pendingFile) return;
    setRestoring(true);
    setRestoreNotice(null);
    try {
      const outcome = await restoreCourseBackup(pendingFile);
      if (outcome.safetyBackup) {
        // 복원 직전 상태를 먼저 파일로 남긴다(되돌릴 수 있게).
        downloadCourseBackup(outcome.safetyBackup, preRestoreBackupFilename(outcome.safetyBackup));
      }
      const scenarioNote = outcome.scenariosInserted > 0
        ? ` 없던 학습 미션 ${outcome.scenariosInserted}건을 새로 넣었습니다.`
        : " 학습 미션 본문은 그대로 두었습니다.";
      const cleanupNote = outcome.assignmentsRemoved > 0
        ? ` 백업 시점에 없던 배정 ${outcome.assignmentsRemoved}건을 정리했습니다.`
        : "";
      setRestoreNotice({
        tone: "ok",
        text: `복원했습니다 — 주차 ${outcome.weeksRestored}개 · 미션 배정 ${outcome.assignmentsRestored}건.${cleanupNote}${scenarioNote}${outcome.safetyBackup ? " 복원 직전 상태도 파일로 내려받았습니다." : ""}`,
      });
      setPendingFile(null);
      setPendingFileName(null);
      setCompareBasis(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      const rows = await listBackupCourses();
      setCourses(rows);
    } catch (error) {
      setRestoreNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "복원에 실패했습니다.",
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <AdminShell
      title="수업 데이터 백업·복원"
      description="현재 수업 구성을 백업 파일로 저장하고, 필요할 때 백업 시점의 구성으로 복원할 수 있습니다."
    >
      {/* 두 카드는 같은 크기·같은 형태로 둔다. 위계는 테두리 색과 배지로만 준다. */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        {/* 기본 흐름 = 교과목 선택 → 백업. 그래서 이쪽이 주(主)다. */}
        <section className="flex h-full flex-col overflow-hidden rounded-xl border border-primary/40 bg-card shadow-sm ring-1 ring-primary/5">
          <div className="h-1 bg-accent" />
          <div className="flex flex-1 flex-col p-6">
            <div className="flex items-center gap-2">
              <RoleBadge tone="brand">수업 백업</RoleBadge>
              <h2 className="text-lg font-semibold">데이터 백업</h2>
            </div>
            {/* 제외 항목은 「백업 범위 자세히 보기」에만 둔다 — 첫 화면에서 굳이 앞세우지 않는다. */}
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {COURSE_BACKUP_SUMMARY.included}
            </p>

            <label className="mb-1.5 mt-5 block text-sm font-medium" htmlFor="backup-course">
              백업할 교과목
            </label>
            <select
              id="backup-course"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={loadingCourses || courses.length === 0}
            >
              {loadingCourses && <option value="">불러오는 중…</option>}
              {!loadingCourses && courses.length === 0 && <option value="">편성된 교과목이 없습니다</option>}
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>

            {selectedCourse && (
              <div className="mt-3 border-l-[3px] border-accent bg-accent/10 px-4 py-3">
                <p className="text-[11px] font-medium text-muted-foreground">선택됨</p>
                <p className="mt-0.5 text-sm font-semibold">{selectedCourse.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{courseTraits(selectedCourse).join(" · ")}</p>
              </div>
            )}

            <Button className="mt-5 w-full sm:w-auto" size="lg" onClick={runBackup} disabled={!selectedId || backingUp}>
              {backingUp ? "백업하는 중…" : "백업하기"}
            </Button>

            {backupNotice && (
              <p className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${NOTICE_STYLE[backupNotice.tone]}`}>
                {backupNotice.text}
              </p>
            )}

            {lastBackup && (
              <div className="mt-4 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-900">백업 완료</p>
                  <p className="mt-0.5 text-sm text-emerald-900">{lastBackup.title}</p>
                  <p className="text-sm text-emerald-900/80">
                    {lastBackup.weeks}주 · 미션 배정 {lastBackup.assignments}건 · 학습 미션 {lastBackup.scenarios}건
                  </p>
                  <p className="mt-1 break-all text-xs text-emerald-900/70">{lastBackup.filename}</p>
                </div>
              </div>
            )}

            {counts && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium">이번 백업에 담길 내용</p>
                <div className="grid grid-cols-3 gap-2">
                  <StatTile label="주차 편성" value={`${counts.weeks}주`} />
                  <StatTile label="미션 배정" value={`${counts.assignments}건`} />
                  <StatTile label="학습 미션" value={`${counts.scenarios}건`} />
                </div>
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  저장될 파일 이름 · {courseBackupFilenamePreview(selectedCourse?.title ?? "교과목")}
                </p>
              </div>
            )}

            <div className="mt-auto">
              <ScopeDetails />
            </div>
          </div>
        </section>

        {/* 복원은 보조 동작이지만 배경을 죽이지 않는다 — 위계는 배지와 테두리로만 준다. */}
        <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="h-1 bg-primary/15" />
          <div className="flex flex-1 flex-col p-6">
            <div className="flex items-center gap-2">
              <RoleBadge tone="ink">수업 복원</RoleBadge>
              <h2 className="text-lg font-semibold">데이터 복원</h2>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              이전에 저장한 백업 파일을 불러와 해당 시점의 수업 구성으로 복원합니다.
            </p>

            <label
              htmlFor="restore-file"
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`mt-5 flex cursor-pointer flex-col items-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-input hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              <Upload className="mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">{pendingFileName ?? "백업 파일 올리기"}</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {pendingFileName ? "다른 파일을 올리려면 다시 선택하세요" : ".json 파일을 끌어다 놓아도 됩니다"}
              </span>
            </label>
            <input
              id="restore-file"
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={onFileSelected}
              className="sr-only"
            />

            {preview ? (
              <div className="mt-4 rounded-lg border border-border bg-background px-4 py-3">
                <p className="mb-2 text-sm font-semibold">이 파일의 내용</p>
                <dl className="divide-y divide-border text-sm">
                  <PreviewRow label="백업 시점" value={formatStamp(preview.exportedAt)} />
                  <PreviewRow label="교과목" value={preview.title} />
                  <PreviewRow
                    label="구성"
                    value={
                      [levelLabel(preview.level), directionLabel(preview.languageDirection), domainLabel(preview.domain)]
                        .filter(Boolean)
                        .join(" · ") || "정보 없음"
                    }
                  />
                  <PreviewRow label="주차 편성" value={`${preview.weekCount}주`} />
                  <PreviewRow label="미션 배정" value={`${preview.assignmentCount}건`} />
                  <PreviewRow label="학습 미션" value={`${preview.scenarioCount}건`} />
                </dl>
                {impact && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-sm font-medium">복원하면</p>
                    {impact.exists ? (
                      <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                        <li>
                          주차 편성{" "}
                          {impact.currentWeeks === impact.fileWeeks
                            ? `${impact.fileWeeks}주 유지`
                            : `${impact.currentWeeks}주 → ${impact.fileWeeks}주`}
                        </li>
                        <li>미션 배정 {impact.added > 0 ? `${impact.added}건 추가` : "추가 없음"}</li>
                        {impact.keptOnly > 0 && (
                          <li>백업 시점에 없던 배정 {impact.keptOnly}건이 정리됩니다</li>
                        )}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        이 교과목은 지금 없습니다 — 복원하면 새로 만들어집니다.
                      </p>
                    )}
                  </div>
                )}

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  다른 교과목과 학습자 수행기록은 변경하지 않습니다.
                </p>
              </div>
            ) : (
              // 파일을 고르기 전 무엇이 일어날지 먼저 알려 준다(빈 화면 방지).
              <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-3 text-sm leading-6 text-muted-foreground">
                파일을 올리면 교과목·주차 편성·미션 수를 먼저 확인한 뒤 복원합니다.
              </p>
            )}

            {/* 파일이 준비되기 전에는 테두리만 — 준비되면 solid로 승격해 상태를 무게로 알린다. */}
            <Button
              className="mt-4 w-full sm:w-auto"
              variant={pendingFile ? "default" : "outline"}
              onClick={runRestore}
              disabled={!pendingFile || restoring}
            >
              {restoring ? "복원하는 중…" : "복원하기"}
            </Button>

            {restoreNotice && (
              <p className={`mt-4 rounded-lg border px-4 py-3 text-sm leading-6 ${NOTICE_STYLE[restoreNotice.tone]}`}>
                {restoreNotice.text}
              </p>
            )}

            <div className="mt-auto pt-5">
              <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">복원 전 자동 백업</p>
                  <p className="mt-0.5 text-sm leading-6 text-emerald-900/80">
                    현재 수업 구성을 먼저 저장한 뒤 복원합니다. 필요하면 이 파일로 다시 이전 상태로 되돌릴 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
};

export default Page;
