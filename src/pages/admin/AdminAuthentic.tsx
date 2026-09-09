// 실제 자료 활용 분석 — 분석 + 보관함.
//
// 위 절은 AuthenticImportPanel이 그대로 한다(분석·후보 제안). 이 화면이 더하는 것은
// 「버리지 않는 것」이다: 분석이 끝나면 후보 전부를 보관함에 남기고, 고르지 않은 후보도
// 나중에 열어 시나리오 재료나 참고 표현으로 확인할 수 있게 한다.
//
// 보관함 테이블이 아직 원격에 없으면(마이그레이션 미적용) 저장만 조용히 접히고 분석과
// 생성기 전달은 그대로 된다 — 그때는 라우터 state로 후보를 넘긴다.

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import AuthenticImportPanel, {
  type AuthenticApply,
  type AuthenticAnalyzed,
} from "./AuthenticImportPanel";
import {
  AUTHENTIC_STORE_PENDING,
  getAnalysisById,
  listAuthenticAnalyses,
  saveAuthenticAnalysis,
  setCandidateStatus,
  storedCandidateToApply,
  type StoredAnalysis,
  type StoredCandidate,
} from "@/lib/admin/authenticStore";
import { SPEECH_ACT_UI, LEVEL, DIRECTION_LABEL } from "@/lib/pragma/enums";

const USAGE_LABEL: Record<string, string> = {
  scenario_seed: "시나리오",
  preceding_turn: "선행 발화",
  translation_source: "번역 출발문",
  response_task: "응답 과제",
  expression_resource: "참고 표현 후보",
  unsuitable: "부적합",
};

const STATUS_LABEL: Record<StoredCandidate["status"], { text: string; tone: string }> = {
  stored: { text: "보관 중", tone: "bg-[#EDE9DD] text-[#5B5446]" },
  used: { text: "시나리오로 사용", tone: "bg-[#D1FAE5] text-[#065F46]" },
  held: { text: "보류", tone: "bg-[#FEF3C7] text-[#92400E]" },
  discarded: { text: "버림", tone: "bg-[#FEE2E2] text-[#991B1B]" },
};

const excerpt = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s);

const AdminAuthentic = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<StoredAnalysis[]>([]);
  const [pending, setPending] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  // 방금 분석한 결과가 보관된 행. onApply가 후보 id를 찾을 때 쓴다.
  const [justSaved, setJustSaved] = useState<StoredAnalysis | null>(null);

  const refresh = useCallback(async () => {
    setLoadingList(true);
    const res = await listAuthenticAnalyses();
    setRows(res.rows);
    setPending(res.pending);
    setListError(res.error);
    setLoadingList(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAnalyzed = async (a: AuthenticAnalyzed) => {
    setSaveNote(null);
    setJustSaved(null);
    const res = await saveAuthenticAnalysis(
      {
        source_type: a.source_type,
        source_ref: a.source_ref,
        source_original: a.source_original,
        extraction_confidence: a.extraction_confidence,
        scene_ko: a.scene_ko,
        linguistic_features_ko: a.linguistic_features_ko,
        recommendation_reason_ko: a.recommendation_reason_ko,
        recommended_uses: a.recommended_uses,
        connectable_speech_acts: a.connectable_speech_acts,
      },
      a.candidates,
    );
    if (!res.ok) {
      setSaveNote(res.reason);
      return;
    }
    setSaveNote(`보관함에 저장했습니다 · 후보 ${a.candidates.length}건`);
    const saved = await getAnalysisById(res.analysisId);
    setJustSaved(saved);
    void refresh();
  };

  // 생성기로 넘긴다. 보관된 후보면 id로, 아직 저장 전이면 라우터 state로.
  const handleApply = async (payload: AuthenticApply, index: number) => {
    const candidate = justSaved?.candidates.find((c) => c.ordinal === index);
    if (candidate) {
      await setCandidateStatus(candidate.id, "used");
      navigate(`/admin/generator?candidateId=${candidate.id}`);
      return;
    }
    navigate("/admin/generator", { state: { authenticApply: payload } });
  };

  const sendStoredToGenerator = async (c: StoredCandidate, analysis: StoredAnalysis) => {
    await setCandidateStatus(c.id, "used");
    navigate(`/admin/generator?candidateId=${c.id}`, {
      state: { authenticApply: storedCandidateToApply(c, analysis) },
    });
  };

  const mark = async (c: StoredCandidate, status: StoredCandidate["status"]) => {
    await setCandidateStatus(c.id, status);
    void refresh();
  };

  return (
    <AdminShell
      title="실제 자료 활용 분석"
      description="쇼츠 캡처·소설 구절·메신저 문구를 AI가 분석해 활용 후보를 제안합니다. 분석한 자료는 후보까지 보관함에 남아 나중에 다시 꺼내 쓸 수 있습니다."
    >
      {saveNote && (
        <p
          className={[
            "mb-4 rounded-md border px-3 py-2 text-[12.5px]",
            saveNote === AUTHENTIC_STORE_PENDING
              ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
              : "border-[#6EE7B7] bg-[#ECFDF5] text-[#065F46]",
          ].join(" ")}
        >
          {saveNote}
        </p>
      )}

      <AuthenticImportPanel onApply={handleApply} onAnalyzed={handleAnalyzed} />

      {/* ── 보관함 ─────────────────────────────────────────────────────── */}
      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-foreground">보관함</h2>
          <span className="text-[12px] text-muted-foreground">
            분석한 자료와 후보가 그대로 남습니다 · 최근 30건
          </span>
        </div>

        {pending && (
          <p className="mt-3 rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#92400E]">
            {AUTHENTIC_STORE_PENDING} 지금은 분석과 생성기 전달만 됩니다.
          </p>
        )}
        {listError && (
          <p className="mt-3 rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#991B1B]">
            보관함을 읽지 못했습니다 · {listError}
          </p>
        )}

        {loadingList ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 && !pending && !listError ? (
          <p className="mt-4 rounded-md border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted-foreground">
            분석한 자료가 아직 없습니다. 위에서 자료를 분석해 보세요.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {rows.map((row) => {
              const open = openId === row.id;
              return (
                <div key={row.id} className="rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : row.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60"
                  >
                    <span className="rounded-full bg-[#EDE9DD] px-2 py-[2px] text-[10.5px] text-[#5B5446]">
                      {row.source_type === "image" ? "이미지" : "문구"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {excerpt(row.source_original)}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">
                      후보 {row.candidates.length}건 ·{" "}
                      {new Date(row.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </button>

                  {open && (
                    <div className="border-t border-border px-3 py-3">
                      {(row.scene_ko || row.linguistic_features_ko) && (
                        <div className="mb-3 space-y-0.5 text-[12px] leading-relaxed text-muted-foreground">
                          {row.scene_ko && (
                            <p>
                              <b className="text-foreground">담화 상황 · </b>
                              {row.scene_ko}
                            </p>
                          )}
                          {row.linguistic_features_ko && (
                            <p>
                              <b className="text-foreground">표현 특징 · </b>
                              {row.linguistic_features_ko}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                        {row.candidates.map((c) => {
                          const status = STATUS_LABEL[c.status];
                          const cond = c.conditions;
                          return (
                            <div
                              key={c.id}
                              className="flex flex-col gap-1.5 rounded-md border border-border bg-background p-2.5"
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full border border-border px-1.5 py-[1px] text-[10.5px]">
                                  {USAGE_LABEL[c.usage_type] ?? c.usage_type}
                                </span>
                                {cond?.speech_act_ui && (
                                  <span className="rounded-full bg-[#F2F0E8] px-1.5 py-[1px] text-[10.5px]">
                                    {SPEECH_ACT_UI[cond.speech_act_ui]}
                                  </span>
                                )}
                                {cond?.level && (
                                  <span className="rounded-full bg-[#F2F0E8] px-1.5 py-[1px] text-[10.5px]">
                                    {LEVEL[cond.level]}
                                  </span>
                                )}
                                {cond?.language_direction && (
                                  <span className="rounded-full bg-[#F2F0E8] px-1.5 py-[1px] text-[10.5px]">
                                    {DIRECTION_LABEL[cond.language_direction]}
                                  </span>
                                )}
                                <span
                                  className={`ml-auto rounded-full px-1.5 py-[1px] text-[10.5px] ${status.tone}`}
                                >
                                  {status.text}
                                </span>
                              </div>

                              {c.label_ko && (
                                <p className="text-[12.5px] font-semibold text-foreground">
                                  {c.label_ko}
                                </p>
                              )}
                              {c.source_text && (
                                <p className="text-[12px] leading-relaxed text-muted-foreground">
                                  {c.source_text}
                                </p>
                              )}

                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {c.source_text && c.usage_type !== "expression_resource" && (
                                  <Button
                                    onClick={() => void sendStoredToGenerator(c, row)}
                                    className="h-7 bg-[#BA7517] px-2.5 text-[11.5px] text-white hover:bg-[#BA7517]/90"
                                  >
                                    → 시나리오 만들기
                                  </Button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void mark(c, c.status === "held" ? "stored" : "held")}
                                  className="rounded-md border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground hover:bg-muted"
                                >
                                  {c.status === "held" ? "보류 해제" : "보류"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void mark(c, "discarded")}
                                  className="rounded-md border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground hover:bg-muted"
                                >
                                  버림
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
};

export default AdminAuthentic;
