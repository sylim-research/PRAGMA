-- 신규 학습자의 프로필 저장이 「row-level security」 위반으로 실패하던 문제를 고친다 (2026-10-05).
--
-- 원인: 20260925160000의 BEFORE 트리거(profiles_zz_auto_approve_completed_learner)가
-- 프로필 완료 저장 때 approval_status를 pending_approval → approved로 바꾼다. 그런데
-- profiles_update_own의 WITH CHECK(20260629225947)는 「저장 뒤 approval_status = 저장 전 값」을
-- 요구하므로, 트리거가 바꾼 행을 정책이 거부했다. 기존 학습자는 이미 approved라 드러나지 않았고,
-- 처음 가입하는 학습자만 막혔다.
--
-- 수정: WITH CHECK에 그 한 가지 전이만 허용한다 — learner·프로필 완료·저장 전 pending_approval →
-- approved. 학습자가 approval_status를 직접 보내는 것은 여전히 profiles_prevent_privilege_escalation
-- 트리거가 먼저 거부하므로(원래 값과 다르면 예외), 이 전이는 서버 트리거를 통해서만 일어난다.

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
    AND (
      approval_status = (SELECT p.approval_status FROM public.profiles p WHERE p.user_id = auth.uid())
      OR (
        role = 'learner'::public.app_role
        AND approval_status = 'approved'::public.approval_status
        AND profile_completed = true
        AND (SELECT p.approval_status FROM public.profiles p WHERE p.user_id = auth.uid())
            = 'pending_approval'::public.approval_status
      )
    )
  );
