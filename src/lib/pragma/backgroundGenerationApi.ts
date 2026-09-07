import { supabase } from '@/integrations/supabase/client';

export interface GenerationJob {
  id: string; status: 'queued' | 'running' | 'completed' | 'failed'; model: string;
  scenario_id: string | null; label: string; completed_steps: number; error: string | null;
  created_at: string; updated_at: string; result?: Record<string, unknown>;
  can_resume?: boolean;
}
export async function generationJobRequest(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('generation-jobs', { body });
  if (error || data?.error) throw new Error(data?.error ?? '연결이 끊겼습니다. 저장된 생성 작업에서 상태를 확인해 주세요.');
  return data as { job?: GenerationJob; jobs?: GenerationJob[] };
}

/** A status lookup never submits another model generation. Start is deduplicated on the server. */
export async function invokeAstraMission(body: Record<string, unknown>, options: {
  onJob?: (job: GenerationJob) => void;
  resumeJobId?: string;
  request?: typeof generationJobRequest;
  wait?: (ms: number) => Promise<void>;
} = {}): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const request = options.request ?? generationJobRequest;
  const wait = options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  try {
    let { job } = await request(options.resumeJobId
      ? { action: 'resume', job_id: options.resumeJobId, generation_request: body }
      : { action: 'start', generation_request: body });
    for (let i = 0; i < 360; i++) {
      if (!job) throw new Error('작업 ID를 확인하지 못했습니다. 생성 작업 목록을 확인해 주세요.');
      options.onJob?.(job);
      if (job.status === 'failed') throw new Error(job.error ?? '생성이 중단됐습니다. 이전 결과는 보존됩니다.');
      if (job.status === 'completed') {
        if (!job.result) throw new Error('완료 결과를 확인할 수 없습니다.');
        return { data: job.result, error: null };
      }
      await wait(5000);
      ({ job } = await request({ action: 'status', job_id: job.id }));
    }
    throw new Error('서버에서 생성이 계속되고 있습니다. 생성 작업 목록에서 이어받아 주세요.');
  } catch (error) {
    return { data: null, error: { message: (error as Error).message } };
  }
}
