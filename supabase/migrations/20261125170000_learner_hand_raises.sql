-- 학습자 「손들기」(2026-11-25 연구자 승인 UI 브리프).
-- MJT 해설이나 실시간 AI 피드백을 본 뒤, 수업에서 같이 토론하고 싶은 점을 이유와 함께 남긴다.
-- - 이유는 10자 이상 필수(이유 없는 표시는 교수자도 해석할 수 없고 학습자도 기억하지 못한다).
-- - 제출 뒤 고치거나 지우지 않는다(처음 든 의문을 그대로 남긴다). 그래서 UPDATE·DELETE 정책을 두지 않는다.
-- - 교수자 화면에는 익명으로 보인다. 읽기 범위는 learner_mission_logs와 같다.
-- 기존 표·기록은 바꾸지 않는다.
BEGIN;

CREATE TABLE IF NOT EXISTS public.learner_hand_raises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id uuid,
  mission_id text NOT NULL,
  attempt_id text NOT NULL,
  -- mjt1~mjt5 = 판단 문항(학습자 제시 순서가 아니라 저장 번호), dct_feedback_1·2 = 실시간 AI 피드백 회차
  target text NOT NULL CHECK (target ~ '^(mjt[1-5]|dct_feedback_[12])$'),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, target)
);

CREATE INDEX IF NOT EXISTS learner_hand_raises_mission_idx ON public.learner_hand_raises (mission_id, course_id);

ALTER TABLE public.learner_hand_raises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learner_hand_raises_insert_own ON public.learner_hand_raises;
CREATE POLICY learner_hand_raises_insert_own ON public.learner_hand_raises
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS learner_hand_raises_read ON public.learner_hand_raises;
CREATE POLICY learner_hand_raises_read ON public.learner_hand_raises
  FOR SELECT TO authenticated
  USING (public.can_manage_learner_data() OR auth_user_id = auth.uid());

GRANT SELECT, INSERT ON public.learner_hand_raises TO authenticated;

COMMIT;
