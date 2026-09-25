import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, devStubCompleteProfile } from "@/lib/auth/useProfile";
import {
  PRIMARY_LANGUAGE_OPTIONS,
  profileExposureOptions,
  targetLanguageOf,
  TARGET_LANGUAGE_LABEL,
  languageTestOptions,
  languageTestLabel,
  TI_EXPERIENCE_OPTIONS,
  type CodedOption,
} from "@/lib/auth/profileOptions";
import { toast } from "sonner";

type Step = 1 | 2 | 3;

const AFFILIATION_OPTIONS = [
  "학부생",
  "대학원생(석사)",
  "대학원생(박사)",
  "교강사/연구자",
  "직장인",
  "기타",
];


// 선택지 정본은 lib/auth/profileOptions.ts — 관리자 조회 화면과 같은 목록을 본다.
// 화면에서 '접하기/사용하기'로 묶지 않는다(문항 제목이 이미 그 뜻). 분석 시 코드로 묶는다.

const inputCls =
  "mt-2 block w-full rounded-xl border border-[#D9D2BC] bg-white px-4 py-3 text-sm shadow-sm transition focus-visible:border-[#C8AB21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4D94E]/30";

const RadioGroup = ({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) => (
  <div className="mt-2 grid gap-2 sm:grid-cols-2">
    {options.map((opt) => (
      <label
        key={opt}
        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
          value === opt
            ? "border-[#C8AB21] bg-[#FFF9D9] shadow-[0_0_0_1px_rgba(200,171,33,0.15)]"
            : "border-[#DDD7C6] bg-white hover:border-[#BEB6A0] hover:bg-[#FFFEFA]"
        }`}
      >
        <input
          type="radio"
          name={name}
          value={opt}
          checked={value === opt}
          onChange={() => onChange(opt)}
          className="h-4 w-4 accent-[#15202B]"
        />
        <span>{opt}</span>
      </label>
    ))}
  </div>
);

const CodedRadioGroup = ({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (code: string) => void;
  options: CodedOption[];
}) => (
  <div className="mt-2 grid gap-2 sm:grid-cols-2">
    {options.map((opt) => (
      <label
        key={opt.code}
        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
          value === opt.code
            ? "border-[#C8AB21] bg-[#FFF9D9] shadow-[0_0_0_1px_rgba(200,171,33,0.15)]"
            : "border-[#DDD7C6] bg-white hover:border-[#BEB6A0] hover:bg-[#FFFEFA]"
        }`}
      >
        <input
          type="radio"
          name={name}
          value={opt.code}
          checked={value === opt.code}
          onChange={() => onChange(opt.code)}
          className="h-4 w-4 accent-[#15202B]"
        />
        <span>{opt.label}</span>
      </label>
    ))}
  </div>
);

const CheckboxGroup = ({
  value,
  onChange,
  options,
  exclusive,
}: {
  value: string[];
  onChange: (codes: string[]) => void;
  options: CodedOption[];
  /** 이 코드를 고르면 나머지가 해제되고, 나머지를 고르면 이것이 해제된다. */
  exclusive?: string;
}) => {
  const toggle = (code: string) => {
    if (exclusive && code === exclusive) {
      onChange(value.includes(code) ? [] : [code]);
      return;
    }
    const next = value.includes(code)
      ? value.filter((c) => c !== code)
      : [...value.filter((c) => c !== exclusive), code];
    onChange(next);
  };
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {options.map((opt) => (
        <label
          key={opt.code}
          className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
            value.includes(opt.code)
              ? "border-[#C8AB21] bg-[#FFF9D9] shadow-[0_0_0_1px_rgba(200,171,33,0.15)]"
              : "border-[#DDD7C6] bg-white hover:border-[#BEB6A0] hover:bg-[#FFFEFA]"
          }`}
        >
          <input
            type="checkbox"
            checked={value.includes(opt.code)}
            onChange={() => toggle(opt.code)}
            className="h-4 w-4 accent-[#15202B]"
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
};

const Field = ({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div>
    <label className="block text-sm font-semibold text-[#15202B]">
      {label}{" "}
      {required ? (
        <span className="text-destructive">*</span>
      ) : (
        <span className="text-xs text-muted-foreground">(선택)</span>
      )}
    </label>
    {children}
  </div>
);

const STEP_LABEL: Record<Step, string> = {
  1: "기본 정보",
  2: "언어·학습 경험",
  3: "학습 기록·연구 동의",
};

const StepIndicator = ({ step }: { step: Step }) => (
  <div className="mb-6" aria-label={`3단계 중 ${step}단계: ${STEP_LABEL[step]}`}>
    <div className="mb-2.5 flex items-center justify-between gap-4 text-xs">
      <span className="font-semibold text-[#1A2430]">{STEP_LABEL[step]}</span>
      <span className="font-medium tabular-nums text-[#6A7078]">{step} / 3</span>
    </div>
    <div className="h-1 overflow-hidden rounded-full bg-[#E3DDCD]">
      <div
        className="h-full rounded-full bg-[#D2B438] transition-[width] duration-200"
        style={{ width: `${(step / 3) * 100}%` }}
      />
    </div>
  </div>
);

type Props = {
  onCompleted?: () => void;
};

export const ProfileWizardForm = ({ onCompleted }: Props) => {
  const { profile, isDevStub, refresh } = useProfile();

  const [step, setStep] = useState<Step>(1);
  const stepTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stepTopRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, [step]);

  // Screen 1
  const [fullName, setFullName] = useState("");
  const [affiliation, setAffiliation] = useState("");

  // Screen 2 — coded values
  const [primaryLanguage, setPrimaryLanguage] = useState("");
  const [languageTestLevel, setLanguageTestLevel] = useState("");
  const [exposureContexts, setExposureContexts] = useState<string[]>([]);
  const [tiExperience, setTiExperience] = useState("");

  // Screen 3 — 수업 운영 동의와 자발적 연구 동의를 분리한다.
  const [classRecordConsent, setClassRecordConsent] = useState(false);
  const [researchConsent, setResearchConsent] = useState<"yes" | "no" | "">("");

  const [busy, setBusy] = useState(false);

  const trimmedName = fullName.trim();

  // 양방향 앱이라 학습 대상 언어가 학습자마다 다르다 — 중국어 모어 화자에게는
  // 한국어 노출을 묻는다(코드는 동일, 라벨만 바뀐다).
  const targetLang = targetLanguageOf(primaryLanguage);
  const targetLangLabel = TARGET_LANGUAGE_LABEL[targetLang];

  const step1Valid = trimmedName.length > 0 && affiliation !== "";
  const step2Valid =
    primaryLanguage !== "" &&
    languageTestLevel !== "" &&
    exposureContexts.length > 0 &&
    tiExperience !== "";
  const step3Valid = classRecordConsent && researchConsent !== "";
  const canSubmit = step1Valid && step2Valid && step3Valid && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (isDevStub) {
        devStubCompleteProfile(trimmedName);
      } else {
        // Resolve the user id even if the profile row hasn't loaded/been created yet.
        let userId = profile?.user_id ?? null;
        if (!userId) {
          const { data } = await supabase.auth.getUser();
          userId = data.user?.id ?? null;
        }
        if (!userId) throw new Error("no-auth-user");

        const payload = {
          user_id: userId,
          // New canonical columns
          name: trimmedName,
          affiliation: affiliation,
          grade_or_program: null,
          // 주 사용 언어 — 그동안 null로만 저장되던 기존 컬럼을 실제로 쓴다.
          language_background: primaryLanguage,
          // 기존 물리 컬럼을 공인시험 응답 저장소로 사용한다. hsk_/topik_ 코드로 구분한다.
          chinese_level: languageTestLevel,
          chinese_proficiency_self_report: null,
          chinese_exposure_contexts: exposureContexts,
          ti_experience_level: tiExperience,
          consent_class_record_sharing: classRecordConsent,
          consent_data_use: researchConsent === "yes",
          consent_anonymous_analysis: researchConsent === "yes",
          consent_email_report: false,
          // Keep full_name in sync (used by other screens)
          full_name: trimmedName,
          profile_completed: true,
        };
        const { error } = await supabase
          .from("profiles")
          .upsert(payload, { onConflict: "user_id" });
        if (error) throw error;
      }
      await refresh();
      // Notify every useProfile instance (e.g. the Home page) to reload.
      window.dispatchEvent(new Event("profile-changed"));
      onCompleted?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ProfileWizardForm] save failed:", e);
      toast.error(`프로필 저장에 실패했습니다: ${msg}`);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col">
      <div ref={stepTopRef}>
        <StepIndicator step={step} />
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <Field label="이름" required>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              className={inputCls}
              placeholder="실명을 입력해 주세요"
              autoFocus
            />
          </Field>

          <Field label="소속/신분" required>
            <RadioGroup
              name="affiliation"
              value={affiliation}
              onChange={setAffiliation}
              options={AFFILIATION_OPTIONS}
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Field label="모국어" required>
            <CodedRadioGroup
              name="primary_language"
              value={primaryLanguage}
              onChange={(v) => {
                setPrimaryLanguage(v);
                // 언어가 바뀌면 HSK/TOPIK 응답도 다시 받는다.
                setLanguageTestLevel("");
              }}
              options={PRIMARY_LANGUAGE_OPTIONS}
            />
          </Field>

          {primaryLanguage && (
          <Field label={languageTestLabel(primaryLanguage)} required>
            <CodedRadioGroup
              name="language_test_level"
              value={languageTestLevel}
              onChange={setLanguageTestLevel}
              options={languageTestOptions(primaryLanguage)}
            />
          </Field>
          )}

          <Field
            label={`${targetLangLabel} 실제 사용 경험 (복수 선택 가능)`}
            required
          >
            <CheckboxGroup
              value={exposureContexts}
              onChange={setExposureContexts}
              options={profileExposureOptions(targetLang)}
            />
          </Field>

          <Field label="한↔중 통번역 경험" required>
            <CodedRadioGroup
              name="ti_experience"
              value={tiExperience}
              onChange={setTiExperience}
              options={TI_EXPERIENCE_OPTIONS}
            />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-[#DDD7C6] border-l-4 border-l-[#D2B438] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold">학습 기록 공유 <span className="text-destructive">*</span></h3>
            <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                checked={classRecordConsent}
                onChange={(e) => setClassRecordConsent(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#15202B]"
              />
              <span>
                수업 운영을 위해 담당 교수자가 나의 학습 기록을 확인하는 데 동의합니다.
              </span>
            </label>
          </section>

          <section className="rounded-2xl border border-[#DDD7C6] border-l-4 border-l-[#D2B438] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold">연구 활용 여부 <span className="text-destructive">*</span></h3>
            <p className="mt-2 text-sm leading-6 text-foreground">
              나의 익명 학습 기록을 통번역 학습 개선을 위한 연구에 활용하는 데 동의합니다.
            </p>
            <CodedRadioGroup
              name="research_consent"
              value={researchConsent}
              onChange={(value) => setResearchConsent(value as "yes" | "no")}
              options={[
                { code: "yes", label: "동의합니다" },
                { code: "no", label: "동의하지 않습니다" },
              ]}
            />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              동의하지 않아도 수업 참여·성적·PRAGMA 이용에 불이익이 없으며, 언제든 철회할 수 있습니다.
            </p>
            <details className="mt-2 rounded-xl bg-[#F5F2E9] px-3 py-2 text-xs leading-5 text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">연구 활용 안내 보기</summary>
              <div className="mt-2 space-y-1">
                <p>활용 대상: 미션 응답, 수정 과정 및 학습 수행 기록</p>
                <p>활용 목적: 통번역 학습 활동과 피드백 방식 개선</p>
                <p>공개 방식: 개인을 알아볼 수 없는 집계 결과와 익명 사례</p>
              </div>
            </details>
          </section>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 mt-6 flex items-center justify-between gap-3 border-t border-[#E4DECD] bg-[#F8F6EE]/95 px-1 pb-0.5 pt-4 backdrop-blur">
        <button
          type="button"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1 || busy}
          className="rounded-xl border border-[#D4CEBD] bg-white px-5 py-2.5 text-sm font-semibold text-[#15202B] transition hover:bg-[#F7F4EA] disabled:cursor-not-allowed disabled:opacity-50"
        >
          이전
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as Step)}
            disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
            className="rounded-xl bg-[#15202B] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#22303E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-xl bg-[#15202B] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#22303E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "저장 중…" : "학습 시작하기"}
          </button>
        )}
      </div>
    </div>
  );
};

export default ProfileWizardForm;
