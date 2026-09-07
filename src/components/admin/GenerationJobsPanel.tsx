import { useEffect, useState } from 'react';
import { generationJobRequest, type GenerationJob } from '@/lib/pragma/backgroundGenerationApi';
import { Button } from '@/components/ui/button';

export function GenerationJobsPanel({ busy, onResume, savedIds }: {
  busy: boolean; onResume: (scenarioId: string, jobId: string) => void; savedIds: Set<string>;
}) {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const data = await generationJobRequest({ action: 'list' });
        if (active) { setJobs(data.jobs ?? []); setError(''); }
      } catch { if (active) setError('생성 작업 목록을 불러오지 못했습니다.'); }
    };
    void refresh();
    const timer = setInterval(refresh, 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const visible = jobs.filter(job => job.scenario_id && !savedIds.has(job.scenario_id));
  if (!visible.length && !error) return null;
  return <section className="my-4 rounded-xl border border-[#E2DED2] bg-white p-5" aria-label="서버 생성 작업">
    <h2 className="font-semibold">서버 생성 작업</h2>
    <p className="mt-1 text-sm text-muted-foreground">화면을 닫아도 생성 결과를 보존합니다. 완료 후 이어받으면 품질 점검과 초안 저장을 진행합니다.</p>
    {error && <p role="status" className="mt-2 text-sm">{error}</p>}
    {visible.map(job => <div key={job.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
      <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm">{job.label}</p>
        <p className="mt-1 text-xs text-muted-foreground">Astra · {job.status === 'completed' ? '생성 완료 · 품질 점검 대기' : job.status === 'failed' ? job.error : `생성 중 · ${job.completed_steps}단계 완료`}</p>
      </div>
      {(job.status !== 'failed' || job.can_resume) && <Button size="sm" variant="outline" disabled={busy} onClick={() => onResume(job.scenario_id!, job.id)}>{job.status === 'failed' ? '저장된 작업 재개' : '결과 이어받기'}</Button>}
    </div>)}
  </section>;
}
