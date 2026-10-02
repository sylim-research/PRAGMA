import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SpectrumStrip, TONE } from "@/components/charts/responseCharts";
import { LEARNER_DEMO_NOTICE, learnerDemoClassPositions, learnerDemoLog, learnerDemoMission } from "@/lib/demo/learnerRecordsDemo";
import {
  buildChangeMap,
  classPositionsFromPattern,
  COMPARED_ITEMS,
  missionReference,
  myChoices,
  type ChangeMap,
  type ClassPosition,
} from "@/lib/learner/recordFlow";
import { getLearnerPeerResponses } from "@/lib/mission/classResponseRelease";
import { fetchMissionByScenario } from "@/lib/mission/missionDb";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { buildLearningRecordDetail, type RecordDetailRow } from "@/lib/admin/learningRecordDetail";
import { getSessions, type LearningSession } from "@/lib/learningSessions";
import { SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import { COURSE_PRESETS } from "@/lib/pragma/scenarioTopics";
import { supabase } from "@/integrations/supabase/client";

// 학습자 본인의 완료 기록을 다시 읽는 화면 — 재검토의 자료(원고 4.3.5·5.2.2).
// 같은 미션의 수행을 한 묶음으로 모아 원문은 한 번만 보이고, 수행마다 최초→최종 표현의 차이를 표시한다.
// 기록을 옮겨 보여 줄 뿐 점수·유형·강약점을 만들지 않는다. 고친 건수처럼 「고치는 것이 목표」로 읽히는 숫자도 두지 않는다.

type ReportRecord = {
  id: string;
  missionId: string | null;
  speechAct: SpeechActUI | null;
  taskType: "translation" | "interpreting" | "other";
  courseId: string | null;
  weekNo: number | null;
  sourceText: string;
  firstResponse: string;
  revisedResponse: string;
  completedAt: string;
  /** 저장된 AI 피드백 판정 줄 — 채점이 아니다. */
  feedback: string[];
  decision: "최초 산출 유지" | "수정" | null;
  dissent: { conditions: string[]; reason: string | null } | null;
  /** 저장된 AI 피드백의 화용 판정·다시 살펴볼 점·설명. */
  change: ChangeMap | null;
  /** 내 선택(문항 번호 → 척도 코드 또는 수정안 위치). 우리 반의 판단·판단 비교에 쓴다. */
  choices: Map<number, string>;
  /** 수행 당시 콘텐츠 지문 — 기준 판단·핵심 정리를 같은 판본에서만 읽는다. */
  contentHash: string | null;
  /** 데모 전용 — 공개된 것으로 보는 가상 학급 분포와 미션 본문. 실제 기록은 따로 읽는다. */
  demoPositions?: ClassPosition[];
  demoMission?: unknown;
};

type MissionLogRecord = RecordDetailRow & {
  id: string;
  mission_id: string | null;
  speech_act: string | null;
  course_id: string | null;
  week_no: number | null;
  created_at: string;
};

const ACTS: SpeechActUI[] = [
  "request",
  "apology",
  "thanks",
  "compliment",
  "agreement",
  "refusal",
  "complaint",
  "proposal",
  "opposition",
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isSpeechAct = (value: string | null): value is SpeechActUI =>
  value !== null && ACTS.includes(value as SpeechActUI);

/**
 * 목록에 올리는 기준(한 곳에서만 정의).
 * 완료(조회 조건) + 9화행 중 하나 + 실제 미션에 연결(미션 id가 시나리오 UUID).
 * 프로토타입 시기의 `sample:` 시험 기록처럼 미션·화행 연결을 확인할 수 없는 행은 원자료로 남기되
 * 화면에서는 뺀다. 과거 v5 미션의 정상 기록은 구버전이어도 포함한다.
 */
function isCountableLog(row: Pick<MissionLogRecord, "mission_id" | "speech_act">) {
  return isSpeechAct(row.speech_act) && typeof row.mission_id === "string" && UUID.test(row.mission_id);
}

const COURSE_LABEL = new Map(COURSE_PRESETS.map((preset) => [preset.outline_id, preset.label]));

function localRecord(session: LearningSession): ReportRecord {
  const key = session.selected_translation as keyof LearningSession["ai_translations"];
  const first = session.ai_translations[key] ?? session.selected_translation ?? "";
  return {
    id: session.session_id,
    missionId: null,
    speechAct: isSpeechAct(session.speech_act) ? session.speech_act : null,
    taskType: session.mode === "interpretation" ? "interpreting" : "translation",
    courseId: null,
    weekNo: null,
    sourceText: "",
    firstResponse: first,
    revisedResponse: session.final_translation,
    completedAt: session.timestamp,
    feedback: [],
    decision: null,
    dissent: null,
    change: null,
    choices: new Map(),
    contentHash: null,
  };
}

function missionLogRecord(row: MissionLogRecord): ReportRecord {
  // 관리자 기록 펼침과 같은 해석기를 쓴다 — 피드백 판정 줄·학습자 결정·이견을 같은 기준으로 읽는다.
  const detail = buildLearningRecordDetail(row, null, "", () => "");
  return {
    id: row.id,
    missionId: row.mission_id,
    speechAct: isSpeechAct(row.speech_act) ? row.speech_act : null,
    taskType:
      row.task_type === "interpreting"
        ? "interpreting"
        : row.task_type === "translation"
          ? "translation"
          : "other",
    courseId: row.course_id,
    weekNo: row.week_no,
    sourceText: row.source_text ?? "",
    firstResponse: row.first_response ?? "",
    revisedResponse: row.revised_response ?? row.first_response ?? "",
    completedAt: row.completed_at ?? row.created_at,
    feedback: detail.task.feedback,
    decision: detail.task.decision,
    dissent: detail.dissent,
    change: buildChangeMap(row.target_feature_observed, row.feature_id),
    choices: myChoices(row.context_judgment),
    contentHash: row.content_hash ?? null,
  };
}

function changed(record: ReportRecord) {
  if (record.decision) return record.decision === "수정";
  return Boolean(
    record.firstResponse.trim() &&
      record.revisedResponse.trim() &&
      record.firstResponse.trim() !== record.revisedResponse.trim(),
  );
}

type Segment = { text: string; changed: boolean };

/**
 * 최초·최종 표현의 글자 단위 차이. 판정이 아니라 「어디를 바꿨는가」의 표시다.
 * 한 글자짜리 우연한 일치(的·了 등)가 변경 사이에 끼면 읽기 어려우므로 변경으로 합친다.
 */
function diffSegments(before: string, after: string): { before: Segment[]; after: Segment[] } {
  const a = [...before];
  const b = [...after];
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: { kind: "same" | "del" | "add"; ch: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { ops.push({ kind: "same", ch: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) ops.push({ kind: "del", ch: a[i++] });
    else ops.push({ kind: "add", ch: b[j++] });
  }
  while (i < a.length) ops.push({ kind: "del", ch: a[i++] });
  while (j < b.length) ops.push({ kind: "add", ch: b[j++] });

  // 변경 사이에 낀 한 글자 일치는 변경으로 본다.
  for (let k = 1; k < ops.length - 1; k++) {
    if (ops[k].kind === "same" && ops[k - 1].kind !== "same" && ops[k + 1].kind !== "same") {
      const ch = ops[k].ch;
      ops.splice(k, 1, { kind: "del", ch }, { kind: "add", ch });
      k++;
    }
  }

  const push = (list: Segment[], text: string, isChanged: boolean) => {
    const last = list[list.length - 1];
    if (last && last.changed === isChanged) last.text += text;
    else list.push({ text, changed: isChanged });
  };
  const result = { before: [] as Segment[], after: [] as Segment[] };
  for (const op of ops) {
    if (op.kind !== "add") push(result.before, op.ch, op.kind === "del");
    if (op.kind !== "del") push(result.after, op.ch, op.kind === "add");
  }
  return result;
}

const TASK_LABEL: Record<ReportRecord["taskType"], string> = { translation: "번역", interpreting: "통역", other: "통번역" };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

type MissionGroup = { key: string; records: ReportRecord[] };

/** 같은 미션(미션 id + 원문)의 수행을 한 묶음으로. 묶음 순서는 가장 최근 수행 순. */
function groupByMission(records: ReportRecord[]): MissionGroup[] {
  const groups = new Map<string, ReportRecord[]>();
  for (const record of records) {
    const key = record.missionId ? `${record.missionId}::${record.sourceText}` : `single::${record.id}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].map(([key, list]) => ({ key, records: list }));
}

/** 묶음 머리 줄 — 수업·주차·화행·과업. */
function groupMeta(record: ReportRecord) {
  return [
    record.courseId ? COURSE_LABEL.get(record.courseId) ?? null : null,
    record.courseId && record.weekNo ? `${record.weekNo}주차` : null,
    record.speechAct ? SPEECH_ACT_UI[record.speechAct] : null,
    TASK_LABEL[record.taskType],
  ].filter(Boolean).join(" · ");
}

// 글자 체계: 한국어 본문 14~15px · 보조 12~13px · 중국어 표현 17px. 한 화면에서 이 값만 쓴다.
const zhLine = "font-zh text-[17px] leading-[1.8] text-[#15202B] [word-break:keep-all] break-words";
const lineLabel = "w-9 shrink-0 pt-[5px] text-[12px] font-semibold text-[#8C8471]";

function Expression({ segments, mode }: { segments: Segment[]; mode: "before" | "after" }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.changed ? (
          <span
            key={index}
            className={
              mode === "after"
                ? "underline decoration-[#D6A636] decoration-2 underline-offset-[5px]"
                : "text-[#8A949E] line-through decoration-[#8A949E]"
            }
          >
            {segment.text}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

const card = "rounded-xl border-[1.6px] border-[#E4DFD0] bg-white";
const cardLabel = "text-[12px] font-semibold text-[#8C8471]";

function ToneDot({ tone, size = "h-2.5 w-2.5" }: { tone: keyof typeof TONE; size?: string }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 rounded-full ${size}`} style={{ backgroundColor: TONE[tone] }} />;
}

/** 표현 변화 지도 — 최초 → AI 피드백 → 최종을 세 칸으로. 바뀐 구절은 최초에서 지우고 최종에서 밑줄. */
function ChangeFlow({ record }: { record: ReportRecord }) {
  const task = TASK_LABEL[record.taskType];
  const revised = changed(record);
  const diff = revised ? diffSegments(record.firstResponse, record.revisedResponse) : null;
  const change = record.change;
  const arrow = <div aria-hidden="true" className="flex items-center justify-center"><ArrowRight className="h-4 w-4 rotate-90 text-[#C9BFA3]" strokeWidth={2.5} /></div>;
  return (
    <div className="grid gap-1">
      <section className={`${card} px-4 py-3`} aria-label={`최초 ${task}`}>
        <p className={cardLabel}>최초 {task}</p>
        <p className={`mt-1.5 ${zhLine}`}>{record.firstResponse || "기록 없음"}</p>
      </section>
      {arrow}
      <section className={`${card} px-4 py-3`} aria-label="AI 피드백">
        <p className={cardLabel}>AI 피드백</p>
        {change || record.feedback.length > 0 ? (
          <div className="mt-1.5 space-y-1.5 text-[13.5px] leading-6 text-[#26323D]">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {change?.band && (
                <span className="inline-flex items-center gap-1.5 rounded-full border-[1.6px] px-2.5 py-[1px] text-[12.5px] font-bold" style={{ borderColor: TONE[change.band.tone], color: "#15202B" }}>
                  <ToneDot tone={change.band.tone} size="h-2 w-2" />{change.band.label}
                </span>
              )}
              {change?.scope && <span className="text-[12.5px]"><span className="text-[#8C8471]">다시 살펴볼 점 </span><span className="font-semibold">{change.scope}</span></span>}
            </p>
            {change?.feature && <p className="break-keep">{change.feature}</p>}
            {!change?.feature && record.feedback.length > 0 && <p>{record.feedback.join(" · ")}</p>}
          </div>
        ) : (
          <p className="mt-1.5 text-[13px] text-[#8C8471]">저장된 AI 피드백이 없습니다.</p>
        )}
        {record.dissent && (
          <div className="mt-3 border-t border-[#EFEBDF] pt-2.5">
            <p className="text-[12px] font-semibold text-[#8A5A14]">내 의견</p>
            {record.dissent.conditions.length > 0 && (
              <p className="mt-1 flex flex-wrap gap-1.5">
                {record.dissent.conditions.map((condition) => (
                  <span key={condition} className="rounded-md border-[1.6px] border-[#E4C44E] px-1.5 py-[1px] text-[12px] text-[#5F4A12]">{condition}</span>
                ))}
              </p>
            )}
            {record.dissent.reason && <p className="mt-1 break-keep text-[13.5px] leading-6 text-[#26323D]">“{record.dissent.reason}”</p>}
          </div>
        )}
      </section>
      {arrow}
      <section className={`rounded-xl border-[1.6px] border-[#1F3A5F] bg-white px-4 py-3`} aria-label={`최종 ${task}`}>
        <p className="text-[12px] font-semibold text-[#1F3A5F]">최종 {task}</p>
        <p className={`mt-1.5 ${zhLine} font-semibold`}>
          {diff ? <Expression segments={diff.after} mode="after" /> : record.revisedResponse || record.firstResponse || "기록 없음"}
        </p>
        {diff
          ? <p className="mt-1 text-[12.5px] text-[#5C6A7A]">밑줄: 처음 {task}에서 바뀐 부분</p>
          : <p className="mt-1 text-[12.5px] text-[#8A5A14]">최초 {task}을 그대로 유지했습니다.</p>}
      </section>
    </div>
  );
}

/** 수행 한 번 — 날짜와 표현 변화 지도(최초 → AI 피드백 → 최종). */
function Attempt({ record }: { record: ReportRecord }) {
  return (
    <div className="space-y-2.5 pb-5 pt-2">
      <p className="text-[13px] font-medium tabular-nums text-[#5C6A7A]">{shortDate(record.completedAt)}</p>
      <ChangeFlow record={record} />
    </div>
  );
}

const sectionTitle = "flex items-center gap-2 text-[14px] font-bold text-[#15202B]";
const titleBar = <span aria-hidden="true" className="inline-block h-4 w-1 rounded-sm bg-[#FAD338]" />;

/** 수정안 선택의 학급 분포 — 수정안별 가로 막대, 내 선택에 「나」. */
function ChoiceBars({ position }: { position: ClassPosition }) {
  return (
    <ul className="space-y-2 pb-3 pt-1" aria-label={`${position.activity} 학급 분포와 내 판단`}>
      {position.slices.map((slice) => {
        const share = position.total > 0 ? Math.round((slice.count / position.total) * 100) : 0;
        const mine = position.mine === slice.key;
        return (
          <li key={slice.key} className="grid grid-cols-[6rem_minmax(0,1fr)_5.5rem] items-center gap-3 text-[13px]">
            <span className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-[#15202B]">
              {slice.label}
              {mine && <span className="rounded-full bg-[#15202B] px-1.5 text-[11px] font-bold text-[#FAD338]">나</span>}
            </span>
            <span className="h-3 overflow-hidden rounded-sm bg-[#EEF0F2]" aria-hidden="true">
              <span className="block h-full rounded-r-sm" style={{ width: `${share}%`, backgroundColor: TONE[slice.tone] }} />
            </span>
            <span className="text-right tabular-nums text-[#5C6A7A]"><span className="font-bold text-[#15202B]">{share}%</span> · {slice.count}명</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 우리 반의 판단 → 판단 비교 → 핵심 정리. 학급 분포는 교수자가 공개한 미션에만 보인다.
 * 기준 판단·핵심 정리는 수행 당시와 같은 콘텐츠 판본일 때만 미션 본문에서 그대로 옮긴다(새 해석 없음).
 */
function ClassReview({ record }: { record: ReportRecord }) {
  const live = !record.demoPositions && Boolean(record.courseId && record.missionId);
  const peer = useQuery({
    queryKey: ["learner-records-peer", record.courseId, record.missionId],
    enabled: live,
    queryFn: () => getLearnerPeerResponses(record.courseId as string, record.missionId as string),
    staleTime: 60_000,
  });
  const mission = useQuery({
    queryKey: ["learner-records-mission", record.missionId],
    enabled: !record.demoMission && Boolean(record.missionId && record.contentHash),
    queryFn: async () => (await fetchMissionByScenario(record.missionId as string, { includeV6: true })).mission,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const positions = record.demoPositions
    ?? (peer.data?.state === "released" ? classPositionsFromPattern(peer.data.pattern, record.choices) : []);
  const reference = missionReference(record.demoMission ?? mission.data ?? null, record.contentHash);
  const shownItems = positions.length > 0 ? positions.map((position) => position.itemId) : COMPARED_ITEMS;
  const lessonPoints = (reference?.lessonPoints ?? []).filter((point) => shownItems.includes(point.itemId));
  const referenceLabel = (position: ClassPosition) => {
    const key = reference?.answers.get(position.itemId);
    return key === undefined ? null : position.slices.find((slice) => slice.key === key)?.label ?? null;
  };
  if (positions.length === 0 && lessonPoints.length === 0) return null;

  return (
    <>
      {positions.length > 0 && (
        <section className="border-t border-[#EFEBDF] px-6 py-4 sm:px-7" aria-label="우리 반의 판단">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className={sectionTitle}>{titleBar}우리 반의 판단</h3>
            <p className="text-[12px] text-[#8C8471]">많이 고른 쪽이 정답은 아닙니다</p>
          </div>
          <div className="mt-2 grid gap-2">
            {positions.map((position) => (
              <div key={position.itemId} className={`${card} px-3 pt-2.5`}>
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[12.5px]">
                  <span className="font-bold text-[#15202B]">{position.activity}</span>
                  <span className="flex items-baseline gap-3">
                    {referenceLabel(position) && (
                      <span className="rounded-full border-[1.6px] border-[#2F6B5E] px-2 py-[1px] text-[12px] font-semibold text-[#245449]">기준 판단: {referenceLabel(position)}</span>
                    )}
                    <span className="tabular-nums text-[#8C8471]">{position.total}명</span>
                  </span>
                </p>
                {position.kind === "scale"
                  ? <SpectrumStrip slices={position.slices} total={position.total} mine={position.mine} label={`${position.activity} 학급 분포와 내 판단`} />
                  : <ChoiceBars position={position} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {lessonPoints.length > 0 && (
        <section className="border-t border-[#EFEBDF] px-6 py-4 sm:px-7" aria-label="핵심 정리">
          <h3 className={sectionTitle}>{titleBar}핵심 정리</h3>
          <ul className="mt-2 space-y-1.5">
            {lessonPoints.map((point) => (
              <li key={point.itemId} className="flex gap-2 break-keep text-[13.5px] leading-6 text-[#26323D]">
                <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#B8860B]" />
                <p><span className="mr-1.5 font-bold text-[#15202B]">{point.label}</span>{point.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** 미션 한 묶음 — 머리 줄과 원문은 한 번, 그 아래 수행을 최신순으로. */
function MissionCard({ group }: { group: MissionGroup }) {
  const head = group.records[0];
  const [sourceOpen, setSourceOpen] = useState(false);
  const longSource = head.sourceText.length > 90;
  return (
    <article className="overflow-hidden rounded-2xl border border-[#E4DFD0] bg-white shadow-[0_1px_2px_rgba(21,32,43,0.03),0_8px_24px_rgba(21,32,43,0.035)]">
      <header className="border-b border-[#EFEBDF] px-6 pb-5 pt-5 sm:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[12.5px] font-semibold tracking-[0.01em] text-[#786022]">{groupMeta(head)}</p>
          <p className="text-[12.5px] text-[#8C8471]">수행 {group.records.length}회</p>
        </div>
        {head.sourceText && (
          <div className="mt-2.5">
            <p className={`break-keep text-[15px] leading-7 text-[#26323D] ${longSource && !sourceOpen ? "line-clamp-2" : ""}`}>
              {head.sourceText}
            </p>
            {longSource && (
              <button type="button" onClick={() => setSourceOpen((v) => !v)} className="mt-0.5 text-[12px] font-semibold text-[#344F63] hover:underline">
                {sourceOpen ? "원문 접기" : "원문 펼치기"}
              </button>
            )}
          </div>
        )}
      </header>
      <h3 className={`${sectionTitle} px-6 pt-4 sm:px-7`}>{titleBar}내 수행</h3>
      <ol className="divide-y divide-[#F0ECE2] px-6 sm:px-7" aria-label="수행 기록">
        {group.records.map((record) => (
          <li key={record.id}><Attempt record={record} /></li>
        ))}
      </ol>
      <ClassReview record={head} />
      <p className="border-t border-[#EFEBDF] px-6 py-3 text-[13px] text-[#5C6A7A] sm:px-7" aria-label="생각해 보기">
        <span className="mr-2 font-semibold text-[#8A5A14]">생각해 보기</span>
        최종 {TASK_LABEL[head.taskType]}에서도 원문의 의미와 화행 목적이 유지되었나요?
      </p>
    </article>
  );
}

const selectClass =
  "h-9 rounded-full border border-[#DDD6C4] bg-white pl-4 pr-8 text-[13px] font-semibold text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B]";

/**
 * 화행별 학습 기록 — 어떤 화행을 해 봤는지(수행 횟수)를 보여 주고, 누르면 아래 기록을 그 화행으로 거른다.
 * 수행한 화행은 남색 점·테두리, 아직 안 한 화행은 호박색 빈 점(회색 금지). 능력 판정이 아니라 수행 범위다.
 */
function ActMap({ counts, selected, onSelect }: { counts: Map<SpeechActUI, number>; selected: SpeechActUI | "all"; onSelect: (act: SpeechActUI | "all") => void }) {
  const done = ACTS.filter((act) => (counts.get(act) ?? 0) > 0).length;
  return (
    <section className="mt-6 rounded-2xl border border-[#E4DFD0] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(21,32,43,0.03),0_8px_24px_rgba(21,32,43,0.035)] sm:px-7" aria-label="화행별 학습 기록">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[16px] font-bold text-[#15202B]">화행별 학습 기록</h2>
        <p className="text-[12.5px] text-[#5C6A7A]">수행한 화행 {done}/9 · 화행을 선택하면 해당 기록만 볼 수 있습니다</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9" role="group" aria-label="화행 선택">
        {ACTS.map((act) => {
          const count = counts.get(act) ?? 0;
          const active = selected === act;
          return (
            <button
              key={act}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? "all" : act)}
              className={[
                "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition-colors",
                active
                  ? "border-[#15202B] bg-[#15202B] text-white"
                  : count > 0
                    ? "border-[#1F3A5F] bg-white text-[#15202B] hover:bg-[#F3F5F9]"
                    : "border-[#E4D9BD] bg-white text-[#15202B] hover:bg-[#FFFBEA]",
              ].join(" ")}
            >
              <span className="flex items-center gap-1.5 text-[14px] font-bold">
                <span
                  aria-hidden="true"
                  className={[
                    "inline-block h-2 w-2 rounded-full",
                    active ? "bg-[#FAD338]" : count > 0 ? "bg-[#1F3A5F]" : "border border-[#C99A2E] bg-transparent",
                  ].join(" ")}
                />
                {SPEECH_ACT_UI[act]}
              </span>
              <span className={`text-[11.5px] font-medium ${active ? "text-[#D8DEE4]" : count > 0 ? "text-[#1F3A5F]" : "text-[#8A5A14]"}`}>
                {count > 0 ? `${count}회` : "아직"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function demoRecords(): ReportRecord[] {
  return [{ ...missionLogRecord(learnerDemoLog() as unknown as MissionLogRecord), demoPositions: learnerDemoClassPositions(), demoMission: learnerDemoMission() }];
}

const LearnerRecords = ({ demo: demoProp = false }: { demo?: boolean }) => {
  const [searchParams] = useSearchParams();
  const demo = demoProp || searchParams.get("demo") === "1";
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const localRecords = useMemo(
    () => (isLocalHost ? getSessions().map(localRecord) : []),
    [isLocalHost],
  );
  const [remoteRecords, setRemoteRecords] = useState<ReportRecord[] | null>(null);
  const [recordsError, setRecordsError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [courseFilter, setCourseFilter] = useState("all");
  const [actFilter, setActFilter] = useState<SpeechActUI | "all">("all");

  useEffect(() => {
    let cancelled = false;
    if (demo) {
      // 데모는 운영 기록을 읽지 않는다.
      setRemoteRecords(demoRecords());
      setRecordsError(false);
      return;
    }
    setRemoteRecords(null);
    setRecordsError(false);
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getSession();
        if (authError) throw authError;
        const userId = auth.session?.user?.id;
        if (!userId) {
          if (!cancelled) setRemoteRecords([]);
          return;
        }
        const { data, error } = await supabase
          .from("learner_mission_logs")
          .select(
            "id,mission_id,speech_act,task_type,course_id,week_no,feature_id,source_lang,target_lang,source_text,first_response,revised_response,target_feature_observed,context_judgment,content_ver,content_hash,started_at,completed_at,created_at",
          )
          .eq("auth_user_id", userId)
          .eq("mission_completed", true)
          .order("completed_at", { ascending: false, nullsFirst: false });
        if (error) throw error;
        if (!cancelled) {
          const rows = (data ?? []) as MissionLogRecord[];
          setRemoteRecords(rows.filter(isCountableLog).map(missionLogRecord));
        }
      } catch {
        if (!cancelled) setRecordsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt, demo]);

  const usingLocalPreview = !demo && isLocalHost && !recordsError && remoteRecords !== null && remoteRecords.length === 0 && localRecords.length > 0;
  const records = usingLocalPreview ? localRecords : remoteRecords ?? [];
  const courseIds = [...new Set(records.flatMap((record) => (record.courseId && COURSE_LABEL.has(record.courseId) ? [record.courseId] : [])))];
  const inCourse = records.filter((record) => courseFilter === "all" || record.courseId === courseFilter);
  const actCounts = new Map<SpeechActUI, number>();
  for (const record of inCourse) {
    if (record.speechAct) actCounts.set(record.speechAct, (actCounts.get(record.speechAct) ?? 0) + 1);
  }
  const visible = inCourse.filter((record) => actFilter === "all" || record.speechAct === actFilter);
  const groups = groupByMission(visible);
  const missionCount = groupByMission(records).length;
  const filteredActLabel = actFilter === "all" ? null : SPEECH_ACT_UI[actFilter];

  const title = (
    <h1 className="border-l-4 border-[#FAD338] pl-3 text-[26px] font-bold leading-9 tracking-[-0.04em] text-[#15202B]">내 기록</h1>
  );

  if (recordsError || remoteRecords === null) {
    return (
      <LearnerJourneyShell nav>
        <div className="pb-24">
          {title}
          <div className="mt-6 rounded-2xl border border-[#E4DFD0] bg-white p-5" role={recordsError ? "alert" : "status"}>
            <p className="text-[13px] text-muted-foreground">
              {recordsError ? "학습 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." : "학습 기록을 불러오는 중…"}
            </p>
            {recordsError && (
              <button type="button" className="mt-3 text-[13px] font-semibold underline underline-offset-4" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                다시 불러오기
              </button>
            )}
          </div>
        </div>
      </LearnerJourneyShell>
    );
  }

  return (
    <LearnerJourneyShell nav>
      <div className="pb-24">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {title}
            {records.length > 0 && (
              <p className="mt-2 pl-4 text-[13.5px] text-[#5C6A7A]">
                학습 미션 {missionCount}개 · 수행 {records.length}회{courseIds.length > 0 ? ` · 교과목 ${courseIds.length}개` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="교과목 선택">
            {demo && (
              <span className="rounded-full bg-[#FAD338] px-3 py-1 text-[11.5px] font-bold text-[#15202B]">{LEARNER_DEMO_NOTICE}</span>
            )}
            {usingLocalPreview && (
              <span className="rounded-full bg-[#EFEBDD] px-3 py-1 text-[11px] font-semibold text-[#756D5E]">
                localhost 시연 데이터
              </span>
            )}
            {courseIds.length > 1 && (
              <select aria-label="교과목" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className={selectClass}>
                <option value="all">전체 교과목</option>
                {courseIds.map((id) => <option key={id} value={id}>{COURSE_LABEL.get(id)}</option>)}
              </select>
            )}
          </div>
        </header>

        {records.length === 0 ? (
          <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E4DFD0] bg-white p-6">
            <div>
              <h2 className="text-[16px] font-bold">아직 완료한 학습 미션이 없습니다.</h2>
              <p className="mt-1 text-[13.5px] text-[#5C6A7A]">학습 미션을 마치면 내 번역과 최종 결정이 여기에 기록됩니다.</p>
            </div>
            <Link to="/learner/course" className="rounded-lg bg-[#15202B] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#22303C]">
              이번 주 학습 미션으로 →
            </Link>
          </section>
        ) : (
          <>
            <ActMap counts={actCounts} selected={actFilter} onSelect={setActFilter} />
            {filteredActLabel && (
              <p className="mt-6 flex items-baseline gap-3 text-[13px] text-[#5C6A7A]">
                <span className="text-[15px] font-bold text-[#15202B]">{filteredActLabel}</span>
                수행 {visible.length}회
                <button type="button" onClick={() => setActFilter("all")} className="font-semibold text-[#344F63] hover:underline">전체 보기</button>
              </p>
            )}
            {groups.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-[#E4DFD0] bg-white p-6 text-[14px] text-[#5C6A7A]">{filteredActLabel} 기록이 아직 없습니다.</p>
            ) : (
              <ol className={`${filteredActLabel ? "mt-3" : "mt-5"} space-y-5`} aria-label="완료 기록">
                {groups.map((group) => (
                  <li key={group.key}><MissionCard group={group} /></li>
                ))}
              </ol>
            )}

          </>
        )}
      </div>
    </LearnerJourneyShell>
  );
};

export default LearnerRecords;
