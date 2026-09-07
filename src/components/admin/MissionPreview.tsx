import { getTargetFeature, SCALE4_LABELS, type Scale4Code } from "@/lib/pragma/targetFeatures";
import type { MissionRuntime, MpjItemRuntime } from "@/lib/pragma/missionSchema";
import { DIRECTION_LABEL } from "@/lib/pragma/enums";

// 관리자 눈검사 뷰 — 생성된 mission_v1을 읽기 전용으로 전개한다.
// 학습자 러너와 달리 정답 대역·해설·교정 valid를 모두 펼쳐 보여준다(검토가 목적).
// 게이트1 눈검사(H1: 모든 후보가 불변항 통과 / H2: 부적절 근거가 초점 과소·적정·과잉)에 쓴다.

const box = "rounded-lg border border-[#EAE4D2] bg-white p-3";

function bandLabel(featureCode: string, code: string): string {
  return getTargetFeature(featureCode)?.band_schema.find((b) => b.code === code)?.label_ko ?? code;
}

const TYPE_LABEL: Record<string, string> = {
  scale4: "첫인상 판단",
  judge3: "맥락 대비 판단",
  fix_choice: "판단하고 고쳐보기",
  reason_conf: "판정+이유+확신(legacy)",
  reason: "왜 문제일까",
  multi_judge: "여러 초안 비교",
};

const QUALITY_LABEL: Record<string, string> = {
  pass: "통과",
  warning: "주의",
  fail: "결함",
};
const QUALITY_CODE_KO: Record<string, string> = {
  gate1_violation: "불변항 위반(의미·의도 변질)",
  implausible_distractor: "비현실적 오답",
  answer_cue: "정답 단서 노출",
  band_mismatch: "대역 불일치",
  focus_contamination: "초점 오염(다차원 동시 변화)",
  unnatural_language: "부자연스러운 문장",
  internal_inconsistency: "내부 불일치",
  implausible_scene: "장면 현실성·개연성",
  scene_underspecified: "장면 미명세(상상이 갈림)",
  primary_reason_ambiguity: "주원인 복수 해석",
  context_plan_mismatch: "앵커·대비 맥락 불일치",
  diagnostic_coverage_mismatch: "진단차원 근거 불일치",
  comparison_quality_mismatch: "여러 초안의 적정·조정 대비 불충분",
  feedback_quality_mismatch: "피드백의 상황·기능·관계효과 연결 불충분",
};

export function MissionPreview({
  mission,
  warnings,
}: {
  mission: MissionRuntime;
  warnings?: string[];
}) {
  const feat = mission.unit.target_feature;
  const p = mission.provenance;
  const q = mission.quality_check;
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[#D8D0BC] bg-[#FAF8F2] p-3.5 text-[13px]">
      {/* unit + provenance */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">내부 문항 초점 · {mission.unit.learner_label}</span>
        <span className="rounded bg-[#E7EFF5] px-1.5 py-0.5 text-[11px] font-semibold text-[#2B5B7A]">{DIRECTION_LABEL[mission.direction]}</span>
        <span className="text-muted-foreground">({feat} v{mission.unit.target_feature_version})</span>
        {p && (
          <span className="text-[11.5px] text-muted-foreground">
            provenance: {p.model} · {p.prompt_version} · 시도 {p.generation_attempt} · #{p.mission_content_hash.slice(0, 8)}
          </span>
        )}
      </div>
      <p className="text-[12.5px] text-muted-foreground">완료 원칙: {mission.unit.closing_ko}</p>

      {warnings && warnings.length > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          경고 {warnings.length}: {warnings.join(" · ")}
        </div>
      )}

      {/* 검증②(0-n·94) — 분리 모델의 품질 비평. 눈검사를 대신하지 않는 참고 자료다. */}
      {q && (
        <div
          className={[
            "rounded-md px-3 py-2 text-[12px]",
            q.verdict === "fail"
              ? "bg-red-50 text-red-900"
              : q.verdict === "warning"
                ? "bg-amber-50 text-amber-900"
                : "bg-emerald-50 text-emerald-900",
          ].join(" ")}
        >
          <div className="font-semibold">
            AI 품질점검: {QUALITY_LABEL[q.verdict]}
            {q.model && <span className="ml-1.5 font-normal opacity-70">({q.model})</span>}
          </div>
          {q.summary_ko && <p className="mt-0.5">{q.summary_ko}</p>}
          {q.findings.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {q.findings.map((f, i) => (
                <li key={i}>
                  <span className="font-medium">
                    [{f.severity === "fail" ? "결함" : "주의"}] {QUALITY_CODE_KO[f.code] ?? f.code}
                  </span>
                  {f.where && <span className="opacity-70"> · {f.where}</span>}
                  {f.note_ko && <span> — {f.note_ko}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-[11px] opacity-70">
            AI 보조 판정입니다 — 승인 여부는 아래 문항을 직접 확인하고 결정하세요.
          </p>
        </div>
      )}

      {/* 미션 버전에 따른 MPJ 문항 */}
      {mission.mpj_items.map((it) => (
        <MpjReview key={it.id} item={it} featureCode={feat} />
      ))}

      {/* DCT */}
      <div className={box}>
        <div className="text-[11.5px] font-semibold text-muted-foreground">
          산출 과제 (DCT · {mission.production_task.mode === "interpreting" ? "통역" : "번역"})
        </div>
        <p className="mt-1">{mission.production_task.situation_ko}</p>
        <p className="mt-1 text-muted-foreground">원문: {mission.production_task.source_text}</p>
        <div className="mt-1.5">
          {mission.production_task.reference_alternatives.map((r, i) => (
            <p key={i} className="text-[12.5px]">
              <span className="text-[#2E7D5B]">참고안{i + 1}</span> {r.text}{" "}
              <span className="text-muted-foreground">— {r.note_ko}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function MpjReview({ item, featureCode }: { item: MpjItemRuntime; featureCode: string }) {
  const accepted =
    item.type === "scale4"
      ? item.accepted_scale_codes.map((c) => SCALE4_LABELS[c as Scale4Code] ?? c)
      : item.type === "multi_judge"
        ? []
        : item.type === "reason"
          ? [bandLabel(featureCode, item.problem_band_code)]
          : item.accepted_band_codes.map((c) => bandLabel(featureCode, c));
  return (
    <div className={box}>
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold text-muted-foreground">{TYPE_LABEL[item.type] ?? item.type}</span>
        {accepted.length > 0 && (
          <span className="rounded bg-[#E7F5EE] px-1.5 py-0.5 text-[11px] font-semibold text-[#2E7D5B]">
            정답 대역: {accepted.join(" / ")}
          </span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">{item.situation_ko}</p>
      <p className="mt-0.5 text-[12.5px]">원문: {item.source}</p>

      {item.type !== "multi_judge" && (
        <p className="mt-1 font-medium">초안: {item.target}</p>
      )}
      {item.type === "scale4" && "reference_scale_code" in item && (
        <p className="mt-1 text-[11.5px] text-[#2E7D5B]">
          대표 정도: {SCALE4_LABELS[item.reference_scale_code as Scale4Code]}
          <span className="ml-1 text-muted-foreground">· 정오는 적절/부적절 방향만 판단</span>
        </p>
      )}

      {item.type === "fix_choice" && (
        <ul className="mt-1 space-y-0.5">
          {item.corrections.map((c, i) => (
            <li key={i} className={c.is_valid ? "text-[#2E7D5B]" : "text-muted-foreground"}>
              {c.is_valid ? "✓" : "✗"} {c.text} <span className="text-[11.5px]">— {c.note_ko}</span>
            </li>
          ))}
        </ul>
      )}
      {item.type === "reason_conf" && (
        <ul className="mt-1 space-y-0.5">
          {item.reasons.map((r) => (
            <li key={r.id} className={item.accepted_reason_ids.includes(r.id) ? "text-[#2E7D5B]" : "text-muted-foreground"}>
              {item.accepted_reason_ids.includes(r.id) ? "✓" : "·"} {r.text_ko}
            </li>
          ))}
        </ul>
      )}
      {item.type === "reason" && (
        <ul className="mt-1 space-y-0.5">
          {item.reasons.map((r) => (
            <li key={r.id} className={item.accepted_reason_id === r.id ? "text-[#2E7D5B]" : "text-muted-foreground"}>
              {item.accepted_reason_id === r.id ? "✓" : "·"} {r.text_ko}
              <span className="ml-1 text-[11px] opacity-70">({r.kind})</span>
            </li>
          ))}
        </ul>
      )}
      {item.type === "multi_judge" && (
        <ul className="mt-1 space-y-0.5">
          {item.candidates.map((c, i) => (
            <li key={i}>
              <span className="text-[#2E7D5B]">[{c.accepted_band_codes.map((b) => bandLabel(featureCode, b)).join("/")}]</span>{" "}
              {c.text} <span className="text-[11.5px] text-muted-foreground">— {c.note_ko}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1 text-[12px] text-muted-foreground">해설: {item.explanation_ko}</p>
      <p className="mt-0.5 text-[12px] text-[#2E7D5B]">적절안: {item.recommended_example}</p>
    </div>
  );
}

export default MissionPreview;
