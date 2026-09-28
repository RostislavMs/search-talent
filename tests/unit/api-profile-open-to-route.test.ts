import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));

import { PATCH } from "@/app/api/profile/open-to/route";

const USER: MockUser = { id: "44444444-4444-4444-8444-444444444444" };

function setMock(user: MockUser, resolve: () => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve });
  return holder.mock;
}

function req(body: unknown) {
  return new Request("http://test/api/profile/open-to", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("PATCH /api/profile/open-to", () => {
  it("401 when signed out", async () => {
    setMock(null, () => ({}));
    expect((await PATCH(req({ open_to: ["freelance"] }))).status).toBe(401);
  });

  it("400 on an empty body, so nothing is switched off by accident", async () => {
    const mock = setMock(USER, () => ({}));
    expect((await PATCH(req({}))).status).toBe(400);
    expect((await PATCH(req({ open_to: ["vacancy"] }))).status).toBe(400);
    expect((await PATCH(req({ open_to: ["job"], confirm: true }))).status).toBe(400);
    expect(mock.calls).toHaveLength(0);
  });

  it("saves the status in canonical order and returns the stamped date", async () => {
    const mock = setMock(USER, () => ({
      data: { open_to: ["freelance", "mentoring"], open_to_updated_at: "2026-09-28T10:00:00Z" },
    }));
    const res = await PATCH(req({ open_to: ["mentoring", "freelance"] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      openTo: ["freelance", "mentoring"],
      updatedAt: "2026-09-28T10:00:00Z",
    });
    const update = mock.calls.find((call) => call.verb === "update");
    expect(update?.table).toBe("profiles");
    expect(update?.payload).toEqual({ open_to: ["freelance", "mentoring"] });
    expect(update?.filters).toContainEqual({ method: "eq", args: ["user_id", USER!.id] });
  });

  it("turns the status off with an empty list", async () => {
    const mock = setMock(USER, () => ({ data: { open_to: [], open_to_updated_at: null } }));
    const res = await PATCH(req({ open_to: [] }));

    expect(await res.json()).toEqual({ openTo: [], updatedAt: null });
    expect(mock.calls[0].payload).toEqual({ open_to: [] });
  });

  it("confirm only writes the date (the database replaces it with its own clock)", async () => {
    const mock = setMock(USER, () => ({
      data: { open_to: ["job"], open_to_updated_at: "2026-09-28T10:00:00Z" },
    }));
    await PATCH(req({ confirm: true }));

    const payload = mock.calls[0].payload as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(["open_to_updated_at"]);
  });

  it("404 when the profile row is missing", async () => {
    setMock(USER, () => ({ data: null }));
    expect((await PATCH(req({ open_to: ["job"] }))).status).toBe(404);
  });

  it("400 when the database refuses the write", async () => {
    setMock(USER, () => ({ error: { message: "violates check constraint" } }));
    expect((await PATCH(req({ open_to: ["job"] }))).status).toBe(400);
  });
});
