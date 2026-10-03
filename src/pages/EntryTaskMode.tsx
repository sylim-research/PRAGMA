import { Navigate, useNavigate } from "react-router-dom";
import { useProfile } from "@/lib/auth/useProfile";
import { HomeBrand } from "@/components/HomeBrand";
import { setTaskMode, type TaskMode } from "@/lib/entryGate";

const EntryTaskMode = () => {
  const navigate = useNavigate();
  const { loading, session, isDevStub } = useProfile();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        불러오는 중…
      </div>
    );
  }
  if (!session && !isDevStub) return <Navigate to="/student-login" replace />;

  const choose = (mode: TaskMode) => {
    setTaskMode(mode);
    if (mode === "translation") {
      navigate("/entry/language-direction");
    } else {
      navigate("/entry/unavailable?kind=interpreting");
    }
  };

  const options: { id: TaskMode; title: string; desc: string }[] = [
    { id: "translation", title: "번역 학습", desc: "텍스트를 다른 언어로 옮기며 표현을 비교·선택해 봅니다." },
    { id: "interpreting", title: "통역 학습", desc: "음성을 텍스트로 변환한 뒤 직접 수정하며 학습하는 방식입니다." },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
        <h1 className="text-[26px] font-bold tracking-tight sm:text-[30px]">
          학습 유형을 선택해 주세요
        </h1>
        <p className="mt-3 text-[14px] text-muted-foreground">
          어떤 방식으로 학습할지 먼저 골라 주세요. 다음 화면에서 언어방향을 선택합니다.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o.id)}
              className="rounded-lg border border-foreground bg-background p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <div className="text-xl font-bold text-[#15202B]">{o.title}</div>
              <div className="mt-2 text-sm text-foreground">{o.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← 홈으로 돌아가기
          </button>
        </div>
      </main>
    </div>
  );
};

export default EntryTaskMode;