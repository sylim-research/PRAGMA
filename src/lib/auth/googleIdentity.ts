// Google Identity Services(GIS) 로그인. Google이 이 페이지 안에서 계정 선택 창을 열고
// ID 토큰을 돌려주면 supabase.auth.signInWithIdToken으로 세션을 만든다. Supabase
// 콜백 도메인을 거치지 않으므로 Google 계정 선택 화면에 supabase.co 주소가 나오지 않는다.
// 클라이언트 ID는 공개값이다. Google 콘솔의 「승인된 JavaScript 원본」에 앱 주소가 있어야 한다.

export const GOOGLE_CLIENT_ID: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "854690972640-h4k3mosev40pa0blorpmkkpb2h8am0gn.apps.googleusercontent.com";

const GIS_SRC = "https://accounts.google.com/gsi/client";

export type GoogleCredentialResponse = { credential?: string };

type GoogleButtonOptions = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce?: string;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
    itp_support?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
  cancel: () => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

let loading: Promise<GoogleAccountsId> | null = null;

/** GIS 스크립트를 한 번만 불러온다. 차단·네트워크 오류·시간 초과면 거부된다. */
export function loadGoogleIdentity(timeoutMs = 8000): Promise<GoogleAccountsId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  if (loading) return loading;

  loading = new Promise<GoogleAccountsId>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("gis-timeout")), timeoutMs);
    const done = () => {
      window.clearTimeout(timer);
      const api = window.google?.accounts?.id;
      if (api) resolve(api);
      else reject(new Error("gis-missing"));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", done, { once: true });
    script.addEventListener(
      "error",
      () => {
        window.clearTimeout(timer);
        reject(new Error("gis-error"));
      },
      { once: true },
    );
    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Google에는 SHA-256 해시(hex)를, Supabase에는 원문 nonce를 넘긴다.
 * Supabase가 원문을 해시해 ID 토큰 안의 nonce와 대조한다.
 */
export async function createLoginNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const hashed = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  return { raw, hashed };
}
