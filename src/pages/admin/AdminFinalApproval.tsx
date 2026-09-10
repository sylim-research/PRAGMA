import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { ResearchWorkflowGuide } from "@/components/research/ResearchWorkflowGuide";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type ApprovalCounts = {
  pending: number | null;
  approved: number | null;
  error: boolean;
};

const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string, options: { count: "exact"; head: true }) => {
      eq: (column: string, value: string) => {
        // 보관(archived_at) 미션은 승인 대기·완료 집계에서 제외한다.
        is: (column: string, value: null) => Promise<{
          count: number | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
};

const AdminFinalApproval = ({ preview: previewProp = false }: { preview?: boolean }) => {
  const { pathname } = useLocation();
  const preview = previewProp || pathname.startsWith("/prototype/");
  const [counts, setCounts] = useState<ApprovalCounts>({ pending: null, approved: null, error: false });

  useEffect(() => {
    if (preview) {
      setCounts({ pending: 0, approved: 0, error: false });
      return;
    }

    let active = true;
    void (async () => {
      const [pending, approved] = await Promise.all([
        db.from("scenarios").select("scenario_id", { count: "exact", head: true }).eq("mission_status", "generated").is("archived_at", null),
        db.from("scenarios").select("scenario_id", { count: "exact", head: true }).eq("mission_status", "reviewed").is("archived_at", null),
      ]);
      if (!active) return;
      setCounts({
        pending: pending.error ? null : pending.count ?? 0,
        approved: approved.error ? null : approved.count ?? 0,
        error: Boolean(pending.error || approved.error),
      });
    })();

    return () => { active = false; };
  }, [preview]);

  return (
    <AdminShell
      title="교수자 최종 승인"
      description="자동 품질 점검 결과와 학습 미션을 확인하고, 교수자가 수업 사용과 학습자 공개를 최종 결정합니다."
    >
      <ResearchWorkflowGuide current="release" />

      <section className="rounded-xl border border-[#D9D4C8] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#756F64]">교수자 감수 대기열</p>
            <h2 className="mt-1 text-lg font-semibold">자동 점검은 후보를 찾고, 최종 결정은 교수자가 합니다</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              감수 대기 미션을 열어 내용과 자동 점검 결과를 확인하세요. 교수자가 최종 승인한 미션만 주차별 수업 편성에서 사용할 수 있습니다.
            </p>
          </div>
          <Badge className="bg-[#15202B] text-white">교수자 최종 결정</Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-900">
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              <span className="text-sm font-semibold">감수 대기</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{counts.pending ?? "—"}건</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              <span className="text-sm font-semibold">교수자 검토 완료</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{counts.approved ?? "—"}건</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/admin/assembly" className="inline-flex items-center gap-2 rounded-md bg-[#15202B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#263747]">
            학습 미션 조립 열기 <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link to="/admin/composer" className="inline-flex items-center gap-2 rounded-md border border-[#D9D4C8] bg-white px-4 py-2 text-sm font-semibold transition hover:bg-[#F7F4EC]">
            주차별 수업 편성 <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {counts.error && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          운영 건수를 불러오지 못했습니다. 관리자 권한 또는 데이터 연결을 확인하세요.
        </p>
      )}
    </AdminShell>
  );
};

export default AdminFinalApproval;
