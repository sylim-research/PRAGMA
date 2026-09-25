-- 학습자 참여를 「사전 승인」에서 「자동 승인 + 사후 반려」로 바꾼다 (2026-09-25).
--
-- 프로필 작성을 마친 learner는 저장 즉시 approved가 되어 곧바로 학습 미션을 쓸 수 있다.
-- 교수자는 학습자 관리 화면에서 언제든 반려(rejected)·비활성(inactive)으로 바꿀 수 있고,
-- 기존 접근 함수(has_completed_learner_profile 등)가 approved를 요구하므로 즉시 차단된다.
--
-- 학습자가 approval_status를 직접 바꾸는 것은 여전히 막는다(profiles_prevent_privilege_escalation).
-- 이 트리거는 이름 순서상 그 방어 트리거 뒤에 실행되므로, 방어 트리거는 원래 값(pending)을 보고
-- 통과시키고, 그다음 이 트리거가 서버 쪽에서만 승인 상태를 바꾼다.
--
-- 대상은 현재 pending_approval인 learner뿐이다. rejected·inactive는 프로필을 다시 저장해도
-- 자동으로 승인되지 않는다.

CREATE OR REPLACE FUNCTION public.auto_approve_completed_learner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'learner'::public.app_role
     AND NEW.approval_status = 'pending_approval'::public.approval_status
     AND COALESCE(NEW.profile_completed, false) THEN
    NEW.approval_status := 'approved'::public.approval_status;
    -- 수행 기록 저장 함수가 익명 참여 ID를 요구한다. 관리자 승인 버튼과 같은 형식으로 만든다.
    IF NEW.anonymous_participant_id IS NULL THEN
      NEW.anonymous_participant_id := 'anon_' || gen_random_uuid()::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_approve_completed_learner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_zz_auto_approve_completed_learner ON public.profiles;
CREATE TRIGGER profiles_zz_auto_approve_completed_learner
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_approve_completed_learner();

-- 이미 프로필을 마치고 승인 대기에 묶여 있는 학습자도 같은 규칙으로 승인한다.
-- 마이그레이션은 auth.uid()가 없는 상태로 실행되어 방어 트리거가 그대로 통과시킨다.
UPDATE public.profiles
SET approval_status = 'approved'::public.approval_status,
    anonymous_participant_id = COALESCE(anonymous_participant_id, 'anon_' || gen_random_uuid()::text)
WHERE role = 'learner'::public.app_role
  AND approval_status = 'pending_approval'::public.approval_status
  AND profile_completed = true;

COMMENT ON FUNCTION public.has_completed_learner_profile() IS
  '현재 사용자가 프로필 작성을 마친 approved learner인지 확인한다. 2026-09-25부터 프로필 완료 시 자동 승인되며, 교수자가 반려·비활성으로 바꾸면 false가 된다.';
