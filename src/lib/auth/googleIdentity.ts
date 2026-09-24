// 학습자 Google 로그인. 앱이 Google OpenID Connect 인증 화면으로 직접 이동하고
// (response_type=id_token), Google이 ID 토큰을 붙여 /student-login으로 돌려보내면
// supabase.auth.signInWithIdToken으로 세션을 만든다. Supabase 콜백 도메인을 거치지 않으므로
// Google 화면에 supabase.co 주소가 나오지 않는다.
// 필요 설정: Google 콘솔 웹 클라이언트의 「승인된 리디렉션 URI」에 `<앱 주소>/student-login`.

export const GOOGLE_CLIENT_ID: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "854690972640-h4k3mosev40pa0blorpmkkpb2h8am0gn.apps.googleusercontent.com";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const PENDING_KEY = "pragma.googleLogin";

export const GOOGLE_CALLBACK_PATH = "/student-login";

type PendingLogin = { state: string; nonce: string; next: string };

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Google에는 SHA-256 해시(hex)를, Supabase에는 원문 nonce를 넘긴다.
 * Supabase가 원문을 해시해 ID 토큰 안의 nonce와 대조한다.
 */
export async function createLoginNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = randomToken();
  return { raw, hashed: await sha256Hex(raw) };
}

/** Google 인증 화면 주소를 만들고, 복귀 때 대조할 state·nonce를 이 탭에 보관한다. */
export async function buildGoogleSignInUrl(origin: string, next: string): Promise<string> {
  const nonce = await createLoginNonce();
  const state = randomToken();
  const pending: PendingLogin = { state, nonce: nonce.raw, next };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: origin + GOOGLE_CALLBACK_PATH,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: nonce.hashed,
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleCallback =
  | { kind: "none" }
  | { kind: "error"; reason: "denied" | "state" | "failed" }
  | { kind: "token"; idToken: string; nonce: string; next: string };

/** URL 해시에서 Google 응답을 읽고 보관해 둔 state와 대조한다. 보관값은 한 번 쓰고 지운다. */
export function readGoogleCallback(hash: string): GoogleCallback {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const idToken = params.get("id_token");
  const error = params.get("error");
  if (!idToken && !error) return { kind: "none" };

  const stored = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  if (error) return { kind: "error", reason: error === "access_denied" ? "denied" : "failed" };

  let pending: PendingLogin | null = null;
  try {
    pending = stored ? (JSON.parse(stored) as PendingLogin) : null;
  } catch {
    pending = null;
  }
  if (!pending || !idToken || params.get("state") !== pending.state) {
    return { kind: "error", reason: "state" };
  }
  return { kind: "token", idToken, nonce: pending.nonce, next: pending.next };
}
