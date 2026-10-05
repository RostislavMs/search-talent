import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryCall,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));

import { PATCH, POST } from "@/app/api/onboarding/route";
import type { ProfileSettings } from "@/lib/profile-presentation";
import { getActiveProfileThemeId } from "@/lib/profile-themes";
import { getActiveProfileTemplateId } from "@/lib/profile-templates";
import { GET as checkUsername } from "@/app/api/onboarding/username/route";

// Each test uses its own user id so the in-memory rate limiter never carries
// over between tests.
let userCounter = 0;
function nextUser(): NonNullable<MockUser> {
  userCounter += 1;
  return { id: `44444444-4444-4444-8444-${String(userCounter).padStart(12, "0")}` };
}

const rpc = vi.fn<(fn: string, args?: unknown) => QueryResult>(() => ({ data: { profileId: "p1" } }));

function setMock(user: MockUser, resolve: (call: QueryCall) => QueryResult = () => ({})) {
  holder.mock = createSupabaseMock({ user, resolve, rpc });
  return holder.mock;
}

/** What the step sent to save_my_profile. */
function sent() {
  expect(rpc.mock.calls[0]?.[0]).toBe("save_my_profile");
  return (rpc.mock.calls[0]?.[1] as { p: { profile: Record<string, unknown>; skills: number[] } }).p;
}

function jsonRequest(method: string, body: unknown) {
  return new Request("http://test/api/onboarding", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validProfile = {
  name: " Olena Koval ",
  username: "Olena.Koval",
  category_id: 5,
  skill_ids: [3, 7, 7],
};

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("PATCH /api/onboarding", () => {
  it("401 when signed out", async () => {
    setMock(null);
    expect((await PATCH(jsonRequest("PATCH", validProfile))).status).toBe(401);
  });

  it("400 on an invalid nick", async () => {
    setMock(nextUser());
    const response = await PATCH(jsonRequest("PATCH", { ...validProfile, username: "a b" }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_username");
  });

  it("400 on too many skills", async () => {
    setMock(nextUser());
    const response = await PATCH(
      jsonRequest("PATCH", {
        ...validProfile,
        skill_ids: Array.from({ length: 31 }, (_, index) => index + 1),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("409 when the nick is taken", async () => {
    setMock(nextUser(), (call) =>
      call.table === "profiles" && call.verb === "select" ? { data: { id: "p1" } } : {},
    );
    rpc.mockReturnValueOnce({ error: { code: "23505", message: "username_taken" } });
    const response = await PATCH(jsonRequest("PATCH", validProfile));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("username_taken");
  });

  it("saves only the step's fields and the skills in one call", async () => {
    setMock(nextUser(), (call) =>
      call.table === "profiles" && call.verb === "select" ? { data: { id: "p1" } } : {},
    );
    const response = await PATCH(jsonRequest("PATCH", validProfile));
    expect(response.status).toBe(200);
    expect((await response.json()).username).toBe("olena.koval");

    expect(sent()).toEqual({
      profile: { name: "Olena Koval", username: "olena.koval", category_id: 5 },
      skills: [3, 7],
    });
  });

  it("clears the skills when none are picked", async () => {
    setMock(nextUser(), (call) =>
      call.table === "profiles" && call.verb === "select" ? { data: { id: "p1" } } : {},
    );
    const response = await PATCH(jsonRequest("PATCH", { ...validProfile, skill_ids: [] }));
    expect(response.status).toBe(200);
    expect(sent().skills).toEqual([]);
  });

  it("400 when the save fails for another reason", async () => {
    setMock(nextUser(), (call) =>
      call.table === "profiles" && call.verb === "select" ? { data: { id: "p1" } } : {},
    );
    rpc.mockReturnValueOnce({ error: { code: "23503", message: "skill missing" } });
    const response = await PATCH(jsonRequest("PATCH", validProfile));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("save_failed");
  });

  it("puts a picked template on the profile, with its theme on the site look", async () => {
    setMock(nextUser(), (call) =>
      call.table === "profiles" && call.verb === "select"
        ? { data: { id: "p1", profile_visibility: { about: false, presentation: { textScale: "lg" } } } }
        : {},
    );
    const response = await PATCH(jsonRequest("PATCH", { ...validProfile, template: "gallery" }));
    expect(response.status).toBe(200);

    const settings = sent().profile.profile_visibility as ProfileSettings;
    expect(getActiveProfileTemplateId(settings.presentation)).toBe("gallery");
    expect(getActiveProfileThemeId(settings.presentation)).toBe("mono");
    // The rest of the settings stay as they were.
    expect(settings.about).toBe(false);
    expect(settings.presentation.textScale).toBe("lg");
  });

  it("keeps the author's own colours when applying a template", async () => {
    setMock(nextUser(), (call) =>
      call.table === "profiles" && call.verb === "select"
        ? { data: { id: "p1", profile_visibility: { presentation: { accentColor: "#123456" } } } }
        : {},
    );
    await PATCH(jsonRequest("PATCH", { ...validProfile, template: "resume" }));

    const presentation = (sent().profile.profile_visibility as ProfileSettings).presentation;
    expect(getActiveProfileTemplateId(presentation)).toBe("resume");
    expect(presentation.accentColor).toBe("#123456");
  });

  it("400 on an unknown template", async () => {
    setMock(nextUser());
    const response = await PATCH(jsonRequest("PATCH", { ...validProfile, template: "bento" }));
    expect(response.status).toBe(400);
  });

  it("404 when the profile row is missing", async () => {
    setMock(nextUser(), () => ({ data: null }));
    expect((await PATCH(jsonRequest("PATCH", validProfile))).status).toBe(404);
  });
});

describe("POST /api/onboarding", () => {
  it("401 when signed out", async () => {
    setMock(null);
    expect((await POST(jsonRequest("POST", { action: "completed" }))).status).toBe(401);
  });

  it("400 on an unknown action", async () => {
    setMock(nextUser());
    expect((await POST(jsonRequest("POST", { action: "hack" }))).status).toBe(400);
  });

  it("records a milestone once: ensures the row, then fills an empty column", async () => {
    const mock = setMock(nextUser());
    const response = await POST(jsonRequest("POST", { action: "link_shared" }));
    expect(response.status).toBe(200);
    expect((await response.json()).saved).toBe(true);

    const calls = mock.calls.filter((call) => call.table === "user_onboarding");
    expect(calls.map((call) => call.verb)).toEqual(["upsert", "update"]);
    expect(Object.keys(calls[1].payload as object)).toEqual(["link_shared_at"]);
    expect(calls[1].filters).toContainEqual({ method: "is", args: ["link_shared_at", null] });
  });

  it("reports saved: false when the table is not there yet", async () => {
    setMock(nextUser(), (call) =>
      call.table === "user_onboarding" ? { error: { message: "relation does not exist" } } : {},
    );
    const response = await POST(jsonRequest("POST", { action: "completed" }));
    expect(response.status).toBe(200);
    expect((await response.json()).saved).toBe(false);
  });
});

describe("GET /api/onboarding/username", () => {
  function check(value: string) {
    return checkUsername(
      new Request(`http://test/api/onboarding/username?value=${encodeURIComponent(value)}`),
    );
  }

  it("401 when signed out", async () => {
    setMock(null);
    expect((await check("olena")).status).toBe(401);
  });

  it("reports an invalid nick without querying", async () => {
    const mock = setMock(nextUser());
    expect(await (await check("a")).json()).toEqual({ valid: false, available: false });
    expect(mock.calls).toHaveLength(0);
  });

  it("reports a free nick", async () => {
    setMock(nextUser(), () => ({ data: null }));
    expect(await (await check("Olena")).json()).toEqual({ valid: true, available: true });
  });

  it("reports someone else's nick as taken and your own as free", async () => {
    const me = nextUser();
    setMock(me, () => ({ data: { user_id: "someone-else" } }));
    expect(await (await check("olena")).json()).toEqual({ valid: true, available: false });

    setMock(me, () => ({ data: { user_id: me.id } }));
    expect(await (await check("olena")).json()).toEqual({ valid: true, available: true });
  });
});
