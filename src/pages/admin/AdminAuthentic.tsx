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
import { authenticUsageLabel, canMakeScenarioFromAuthentic, splitAuthenticPhrases } from "@/lib/admin/authenticUsage";


// 상태는 글자색만 달리한다 — 바탕은 흰색으로 통일(색 절제).
const STATUS_LABEL: Record<StoredCandidate["status"], { text: string; tone: string }> = {
  stored: { text: "보관 중", tone: "text-[#6B645A]" },
  used: { text: "시나리오로 사용", tone: "text-[#1F3A5F]" },
  held: { text: "보류", tone: "text-[#8A6A0E]" },
  discarded: { text: "버림", tone: "text-[#9A938A] line-through" },
};

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="whitespace-nowrap rounded-md bg-[#F5F2EA] px-1.5 py-[1px] text-[11.5px] text-[#3F4E59]">{children}</span>
);

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
    // 최근 분석 1건은 펼친 채로 연다 — 접혀 있으면 이 화면이 무엇을 만들어 내는지 보이지 않는다.
    setOpenId((current) => current ?? res.rows[0]?.id ?? null);
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
    setSaveNote(`분석 기록에 저장했습니다 · 후보 ${a.candidates.length}건`);
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
    // 상황·응답 맥락 참고 자료는 생성기로 보내지 않는다(버튼이 없어도 한 번 더 막는다).
    if (!canMakeScenarioFromAuthentic(c.usage_type, c.source_text)) return;
    await setCandidateStatus(c.id, "used");
    navigate(`/admin/generator?candidateId=${c.id}`, {
      state: { authenticApply: storedCandidateToApply(c, analysis) },
    });
  };

  const mark = async (c: StoredCandidate, status: StoredCandidate["status"]) => {
    await setCandidateStatus(c.id, status);
    void refresh();
  };

  const archive = (
    <section className="rounded-xl border border-[#D9D2BF] bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-bold text-[#15202B]">분석 기록</h2>
        <span className="whitespace-nowrap text-[12px] text-muted-foreground">최근 30건</span>
      </div>

      {pending && (
        <p className="mt-3 rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#92400E]">
          {AUTHENTIC_STORE_PENDING} 지금은 분석과 생성기 전달만 됩니다.
        </p>
      )}
      {listError && (
        <p className="mt-3 rounded-md border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#991B1B]">
          분석 기록을 읽지 못했습니다 · {listError}
        </p>
      )}

      {loadingList ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : rows.length === 0 && !pending && !listError ? (
        <p className="mt-4 rounded-md border border-dashed border-border px-3 py-6 text-center text-[14.5px] text-muted-foreground">
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
                  <span className="shrink-0 whitespace-nowrap rounded-full border border-[#E2DED2] px-2 py-[1px] text-[11.5px] text-[#5B5446]">
                    {row.source_type === "image" ? "이미지" : "문구"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14.5px] text-foreground">
                    {excerpt(row.source_original)}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[12.5px] tabular-nums text-muted-foreground">
                    후보 {row.candidates.length}건 ·{" "}
                    {new Date(row.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </button>

                {open && (
                  <div className="border-t border-border px-3 py-3">
                    {(row.scene_ko || row.linguistic_features_ko) && (
                      <div className="mb-3 space-y-1.5 text-[13px] leading-relaxed">
                        {row.scene_ko && (
                          <div className="flex gap-3">
                            <span className="w-16 shrink-0 whitespace-nowrap text-[12px] font-semibold text-[#6B645A]">담화 상황</span>
                            <p className="min-w-0 flex-1 text-[#15202B]">{row.scene_ko}</p>
                          </div>
                        )}
                        {row.linguistic_features_ko && (
                          <div className="flex gap-3">
                            <span className="w-16 shrink-0 whitespace-nowrap text-[12px] font-semibold text-[#6B645A]">표현 특징</span>
                            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                              {splitAuthenticPhrases(row.linguistic_features_ko).map((phrase) => <Chip key={phrase}>{phrase}</Chip>)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2">
                      {row.candidates.map((c) => {
                        const status = STATUS_LABEL[c.status];
                        const cond = c.conditions;
                        return (
                          <div
                            key={c.id}
                            className="flex flex-col gap-1.5 rounded-md border border-border bg-background p-2.5"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="whitespace-nowrap rounded-full border border-[#E2DED2] bg-white px-2 py-[1px] text-[11.5px] font-semibold text-[#15202B]">
                                {authenticUsageLabel(c.usage_type)}
                              </span>
                              {cond?.speech_act_ui && <Chip>{SPEECH_ACT_UI[cond.speech_act_ui]}</Chip>}
                              {cond?.level && <Chip>{LEVEL[cond.level]}</Chip>}
                              {cond?.language_direction && <Chip>{DIRECTION_LABEL[cond.language_direction]}</Chip>}
                              <span
                                className={`ml-auto whitespace-nowrap text-[12px] font-semibold ${status.tone}`}
                              >
                                {status.text}
                              </span>
                            </div>

                            {c.label_ko && (
                              <p className="text-[14px] font-semibold text-[#15202B]">
                                {c.label_ko}
                              </p>
                            )}
                            {c.source_text && (
                              <p className="rounded-md bg-[#FBF8F0] px-2.5 py-1.5 text-[13.5px] leading-relaxed text-[#15202B]">
                                {c.source_text}
                              </p>
                            )}

                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {canMakeScenarioFromAuthentic(c.usage_type, c.source_text) && (
                                <Button
                                  onClick={() => void sendStoredToGenerator(c, row)}
                                  className="h-8 bg-[#15202B] px-2.5 text-[12.5px] text-white hover:bg-[#15202B]/90"
                                >
                                  시나리오 만들기
                                </Button>
                              )}
                              <button
                                type="button"
                                onClick={() => void mark(c, c.status === "held" ? "stored" : "held")}
                                className="rounded-md border border-border px-2.5 py-1 text-[12.5px] text-muted-foreground hover:bg-muted"
                              >
                                {c.status === "held" ? "보류 해제" : "보류"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void mark(c, "discarded")}
                                className="rounded-md border border-border px-2.5 py-1 text-[12.5px] text-muted-foreground hover:bg-muted"
                              >
                                버리기
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
  );

  return (
    <AdminShell
      title="실제 자료 활용 분석"
      description="실제 한·중 자료를 AI가 분석해 시나리오 재료 후보를 제안하고, 교수자가 사용 여부를 정합니다."
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

      <AuthenticImportPanel onApply={handleApply} onAnalyzed={handleAnalyzed} history={archive} />
    </AdminShell>
  );
};

export default AdminAuthentic;
