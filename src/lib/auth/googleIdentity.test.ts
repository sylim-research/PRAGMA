import { describe, expect, it } from "vitest";

import { GOOGLE_CLIENT_ID, createLoginNonce } from "@/lib/auth/googleIdentity";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

describe("googleIdentity", () => {
  it("gives Google the SHA-256 hex of the nonce that Supabase receives", async () => {
    const nonce = await createLoginNonce();
    expect(nonce.raw.length).toBeGreaterThan(20);
    expect(nonce.hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(nonce.hashed).toBe(await sha256Hex(nonce.raw));
  });

  it("creates a different nonce each time", async () => {
    const [a, b] = await Promise.all([createLoginNonce(), createLoginNonce()]);
    expect(a.raw).not.toBe(b.raw);
  });

  it("uses the web OAuth client registered for PRAGMA", () => {
    expect(GOOGLE_CLIENT_ID).toMatch(/^854690972640-.+\.apps\.googleusercontent\.com$/);
  });
});
