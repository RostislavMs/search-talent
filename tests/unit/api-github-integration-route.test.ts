import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/db/github-integrations", () => ({
  getIntegrationForUser: vi.fn(),
  deleteIntegration: vi.fn(),
  toIntegrationSummary: vi.fn((row: unknown) => ({ login: (row as { github_login: string }).github_login })),
}));

import { GET, DELETE } from "@/app/api/integrations/github/route";
import { getIntegrationForUser, deleteIntegration } from "@/lib/db/github-integrations";

const authUser: MockUser = { id: "11111111-1111-4111-8111-111111111111", email_confirmed_at: "2026-01-01T00:00:00Z" };

function setUser(user: MockUser) {
  holder.mock = createSupabaseMock({ user, resolve: () => ({}) });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("GET /api/integrations/github", () => {
  it("null for anonymous callers", async () => {
    setUser(null);
    expect((await (await GET()).json()).integration).toBeNull();
  });

  it("returns the integration summary when connected", async () => {
    setUser(authUser);
    vi.mocked(getIntegrationForUser).mockResolvedValue({ github_login: "octocat" } as never);
    expect((await (await GET()).json()).integration).toEqual({ login: "octocat" });
  });
});

describe("DELETE /api/integrations/github", () => {
  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await DELETE()).status).toBe(401);
  });

  it("400 when disconnect fails", async () => {
    setUser(authUser);
    vi.mocked(deleteIntegration).mockResolvedValue(false as never);
    expect((await DELETE()).status).toBe(400);
  });

  it("disconnects the integration", async () => {
    setUser(authUser);
    vi.mocked(deleteIntegration).mockResolvedValue(true as never);
    expect((await DELETE()).status).toBe(200);
  });
});
