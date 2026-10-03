import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/vacancies", () => ({ expireVacancies: vi.fn(async () => 3) }));
vi.mock("@/lib/db/applications", () => ({ purgeOldApplications: vi.fn(async () => 2) }));
vi.mock("@/lib/db/job-alerts", () => ({
  runJobAlerts: vi.fn(async () => ({ vacancies: 4, alerts: 6, people: 2, emails: 1, failedEmails: 0 })),
}));

import { GET, POST, dynamic } from "@/app/api/cron/expire-vacancies/route";
import { purgeOldApplications } from "@/lib/db/applications";
import { runJobAlerts } from "@/lib/db/job-alerts";
import { expireVacancies } from "@/lib/db/vacancies";

function req(method: "GET" | "POST", authorization?: string) {
  return new Request("http://test/api/cron/expire-vacancies", {
    method,
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("/api/cron/expire-vacancies", () => {
  it("is never cached", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it.each([undefined, "Bearer wrong", "s3cret", "Basic s3cret"])("401 for the authorization %s", async (header) => {
    const res = await GET(req("GET", header));
    expect(res.status).toBe(401);
    expect(expireVacancies).not.toHaveBeenCalled();
    expect(purgeOldApplications).not.toHaveBeenCalled();
    expect(runJobAlerts).not.toHaveBeenCalled();
  });

  const ALERTS = { vacancies: 4, alerts: 6, people: 2, emails: 1, failedEmails: 0 };

  it("expires vacancies, deletes old applications and sends job alerts for Vercel Cron, saying how many", async () => {
    const res = await GET(req("GET", "Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, expired: 3, purgedApplications: 2, jobAlerts: ALERTS });
    expect(expireVacancies).toHaveBeenCalledOnce();
    expect(purgeOldApplications).toHaveBeenCalledOnce();
    expect(runJobAlerts).toHaveBeenCalledOnce();
  });

  it("still answers 200 when only the job alerts fail: the expiry is done", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(runJobAlerts).mockRejectedValueOnce(new Error("no column notify_email"));
    const res = await GET(req("GET", "Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      expired: 3,
      purgedApplications: 2,
      jobAlerts: { error: "no column notify_email" },
    });
    vi.mocked(runJobAlerts).mockRejectedValueOnce("weird");
    expect((await (await GET(req("GET", "Bearer s3cret"))).json()).jobAlerts).toEqual({ error: "failed" });
    spy.mockRestore();
  });

  it("accepts a manual POST with the same secret", async () => {
    expect((await POST(req("POST"))).status).toBe(401);
    const res = await POST(req("POST", "Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, expired: 3, purgedApplications: 2, jobAlerts: ALERTS });
  });

  it("is open without a secret (local development)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("GET"))).status).toBe(200);
  });

  it("500 with the reason when expiring fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(expireVacancies).mockRejectedValueOnce(new Error("db down"));
    const res = await GET(req("GET", "Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "db down" });

    vi.mocked(expireVacancies).mockRejectedValueOnce("weird");
    expect(await (await GET(req("GET", "Bearer s3cret"))).json()).toEqual({ ok: false, error: "failed" });

    vi.mocked(purgeOldApplications).mockRejectedValueOnce(new Error("purge failed"));
    const purge = await GET(req("GET", "Bearer s3cret"));
    expect(purge.status).toBe(500);
    expect(await purge.json()).toEqual({ ok: false, error: "purge failed" });
    spy.mockRestore();
  });
});
