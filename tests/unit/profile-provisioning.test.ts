import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall, type QueryResult } from "./helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { ensureProfileForUser } from "@/lib/db/profile";

const USER_ID = "55555555-5555-4555-8555-555555555555";

function client(resolve: (call: QueryCall) => QueryResult, rpc = vi.fn(() => ({}))) {
  const mock = createSupabaseMock({ resolve, rpc });
  return { mock, rpc, supabase: mock.client as never };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ensureProfileForUser", () => {
  it("creates a new profile with a temporary nick, not the email", async () => {
    const { mock, supabase } = client((call) => {
      if (call.verb === "insert") {
        return { data: { name: null, username: "user-ab12cd", avatar_url: null, email_verified: false } };
      }
      return { data: null };
    });

    const profile = await ensureProfileForUser(supabase, {
      id: USER_ID,
      email: "olena.koval@example.com",
    });

    const insert = mock.calls.find((call) => call.verb === "insert");
    const username = (insert?.payload as { username: string }).username;
    expect(username).toMatch(/^user-[a-z0-9]{6}$/);
    expect(username).not.toContain("olena");
    expect(profile?.username).toBe("user-ab12cd");
  });

  it("retries with a new nick when the random one collides", async () => {
    let inserts = 0;
    const { mock, supabase } = client((call) => {
      if (call.verb === "insert") {
        inserts += 1;
        return inserts === 1
          ? { error: { message: 'duplicate key value violates unique constraint "profiles_username_key"' } }
          : { data: { name: null, username: "user-zz99zz", avatar_url: null, email_verified: false } };
      }
      return { data: null };
    });

    const profile = await ensureProfileForUser(supabase, { id: USER_ID });
    expect(mock.calls.filter((call) => call.verb === "insert")).toHaveLength(2);
    expect(profile?.username).toBe("user-zz99zz");
  });

  it("reads the existing row when a parallel request created it first", async () => {
    let selects = 0;
    const { supabase } = client((call) => {
      if (call.verb === "insert") {
        return { error: { message: 'duplicate key value violates unique constraint "profiles_user_id_key"' } };
      }
      selects += 1;
      return selects === 1
        ? { data: null }
        : { data: { name: "Olena", username: "olena.koval", avatar_url: null, email_verified: true } };
    });

    const profile = await ensureProfileForUser(supabase, { id: USER_ID });
    expect(profile?.username).toBe("olena.koval");
  });

  it("turns on the verified mark once the auth email is confirmed", async () => {
    const { mock, rpc, supabase } = client((call) =>
      call.verb === "select"
        ? { data: { name: "Olena", username: "olena.koval", avatar_url: null, email_verified: false } }
        : {},
    );

    await ensureProfileForUser(supabase, {
      id: USER_ID,
      email_confirmed_at: "2026-09-27T10:00:00Z",
    });

    const update = mock.calls.find((call) => call.verb === "update");
    expect(update?.payload).toMatchObject({ email_verified: true });
    expect(rpc).toHaveBeenCalledWith("award_badges_for_user", { p_user_id: USER_ID });
  });

  it("leaves the mark alone when it is already on or the email is unconfirmed", async () => {
    const verified = client(() => ({
      data: { name: "Olena", username: "olena.koval", avatar_url: null, email_verified: true },
    }));
    await ensureProfileForUser(verified.supabase, {
      id: USER_ID,
      email_confirmed_at: "2026-09-27T10:00:00Z",
    });
    expect(verified.mock.calls.some((call) => call.verb === "update")).toBe(false);

    const unconfirmed = client(() => ({
      data: { name: "Olena", username: "olena.koval", avatar_url: null, email_verified: false },
    }));
    await ensureProfileForUser(unconfirmed.supabase, { id: USER_ID, email_confirmed_at: null });
    expect(unconfirmed.mock.calls.some((call) => call.verb === "update")).toBe(false);
  });
});
