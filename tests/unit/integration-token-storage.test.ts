import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { admin: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => holder.admin?.client ?? null),
}));

import { upsertIntegration } from "@/lib/db/github-integrations";
import { upsertProviderIntegration } from "@/lib/db/provider-integrations";

const USER_ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  holder.admin = null;
  vi.clearAllMocks();
});

// Clients have no write grant on the token tables (a forged row would earn the
// GitHub badge and squat someone's account id), so both writers must go
// through the service key — and fail closed without it.
describe("OAuth token storage", () => {
  it("stores a GitHub connection with the service key", async () => {
    holder.admin = createSupabaseMock({ resolve: () => ({}) });

    const ok = await upsertIntegration({
      userId: USER_ID,
      githubUserId: 42,
      githubLogin: "octocat",
      githubAvatarUrl: null,
      accessToken: "gho_token",
      tokenType: "bearer",
      scopes: ["repo"],
    });

    expect(ok).toBe(true);
    expect(holder.admin.calls).toHaveLength(1);
    expect(holder.admin.calls[0]).toMatchObject({
      table: "github_integrations",
      verb: "upsert",
      payload: { user_id: USER_ID, github_user_id: 42, access_token: "gho_token" },
    });
  });

  it("reports a failed GitHub write", async () => {
    holder.admin = createSupabaseMock({ resolve: () => ({ error: { message: "boom" } }) });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      upsertIntegration({
        userId: USER_ID,
        githubUserId: 42,
        githubLogin: "octocat",
        githubAvatarUrl: null,
        accessToken: "gho_token",
        tokenType: "bearer",
        scopes: [],
      }),
    ).resolves.toBe(false);
  });

  it("does not store a GitHub connection without the service key", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      upsertIntegration({
        userId: USER_ID,
        githubUserId: 42,
        githubLogin: "octocat",
        githubAvatarUrl: null,
        accessToken: "gho_token",
        tokenType: "bearer",
        scopes: [],
      }),
    ).resolves.toBe(false);
  });

  it("stores a provider connection with the service key", async () => {
    holder.admin = createSupabaseMock({ resolve: () => ({}) });

    const ok = await upsertProviderIntegration({
      userId: USER_ID,
      provider: "gitlab",
      externalUserId: "7",
      externalLogin: "tanuki",
      externalAvatarUrl: null,
      token: {
        accessToken: "glpat",
        refreshToken: "refresh",
        tokenType: "bearer",
        expiresAt: null,
        scopes: ["read_api"],
      },
    });

    expect(ok).toBe(true);
    expect(holder.admin.calls[0]).toMatchObject({
      table: "provider_integrations",
      verb: "upsert",
      payload: { user_id: USER_ID, provider: "gitlab", access_token: "glpat", refresh_token: "refresh" },
    });
  });

  it("does not store a provider connection without the service key", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      upsertProviderIntegration({
        userId: USER_ID,
        provider: "gitlab",
        externalUserId: "7",
        externalLogin: "tanuki",
        externalAvatarUrl: null,
        token: { accessToken: "glpat", refreshToken: null, tokenType: "bearer", expiresAt: null, scopes: [] },
      }),
    ).resolves.toBe(false);
  });
});
