import { beforeEach, describe, expect, it } from "vitest";

import {
  GOOGLE_CLIENT_ID,
  buildGoogleSignInUrl,
  createLoginNonce,
  readGoogleCallback,
} from "@/lib/auth/googleIdentity";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

describe("googleIdentity", () => {
  beforeEach(() => sessionStorage.clear());

  it("gives Google the SHA-256 hex of the nonce that Supabase receives", async () => {
    const nonce = await createLoginNonce();
    expect(nonce.hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(nonce.hashed).toBe(await sha256Hex(nonce.raw));
  });

  it("builds an OpenID Connect ID-token request that returns to the login page", async () => {
    const url = new URL(await buildGoogleSignInUrl("https://pragma.up.railway.app", "/learner/course"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe(GOOGLE_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe("https://pragma.up.railway.app/student-login");
    expect(url.searchParams.get("response_type")).toBe("id_token");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("nonce")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  it("returns the token with the raw nonce and saved destination when state matches", async () => {
    const url = new URL(await buildGoogleSignInUrl("https://pragma.up.railway.app", "/learner/course"));
    const state = url.searchParams.get("state");
    const result = readGoogleCallback(`#id_token=abc.def.ghi&state=${state}`);
    expect(result.kind).toBe("token");
    if (result.kind !== "token") return;
    expect(result.idToken).toBe("abc.def.ghi");
    expect(await sha256Hex(result.nonce)).toBe(url.searchParams.get("nonce"));
    expect(result.next).toBe("/learner/course");
    expect(readGoogleCallback(`#id_token=abc.def.ghi&state=${state}`)).toEqual({ kind: "error", reason: "state" });
  });

  it("rejects a token whose state does not match", async () => {
    await buildGoogleSignInUrl("https://pragma.up.railway.app", "/home");
    expect(readGoogleCallback("#id_token=abc&state=forged")).toEqual({ kind: "error", reason: "state" });
  });

  it("reports a cancelled sign-in and ignores unrelated hashes", () => {
    expect(readGoogleCallback("#error=access_denied&state=x")).toEqual({ kind: "error", reason: "denied" });
    expect(readGoogleCallback("#section-2")).toEqual({ kind: "none" });
    expect(readGoogleCallback("")).toEqual({ kind: "none" });
  });
});
