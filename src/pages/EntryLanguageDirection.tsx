import { Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useProfile } from "@/lib/auth/useProfile";
import { HomeBrand } from "@/components/HomeBrand";
import {
  getTaskMode,
  setLanguageDirection,
  type LanguageDirection,
} from "@/lib/entryGate";

const EntryLanguageDirection = () => {
  const navigate = useNavigate();
  const { loading, session, isDevStub } = useProfile();

  useEffect(() => {
    if (!getTaskMode()) {
      navigate("/entry/task-mode", { replace: true });
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        불러오는 중…
      </div>
    );
  }
  if (!session && !isDevStub) return <Navigate to="/student-login" replace />;

  const choose = (dir: LanguageDirection) => {
    setLanguageDirection(dir);
    const mode = getTaskMode();
    if (mode === "translation" && dir === "ko_to_zh") {
      navigate("/scenario");
    } else {
      navigate("/entry/unavailable?kind=extension");
    }
  };

  const options: { id: LanguageDirection; title: string; desc: string }[] = [
    { id: "ko_to_zh", title: "한국어 → 중국어", desc: "한국어 원문을 중국어로 옮깁니다." },
    { id: "zh_to_ko", title: "중국어 → 한국어", desc: "중국어 원문을 한국어로 옮깁니다." },
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
          언어방향을 선택해 주세요
        </h1>
        <p className="mt-3 text-[14px] text-muted-foreground">
          어느 방향으로 학습할지 골라 주세요.
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

        <div className="mt-8 flex gap-4">
          <button
            type="button"
            onClick={() => navigate("/entry/task-mode")}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← 학습 유형 다시 선택
          </button>
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            홈으로 돌아가기
          </button>
        </div>
      </main>
    </div>
  );
};

export default EntryLanguageDirection;