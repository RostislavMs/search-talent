import { afterEach, describe, expect, it, vi } from "vitest";

type RpcCall = { name: string; args: unknown; from: number; to: number };

const { holder } = vi.hoisted(() => ({
  holder: {
    admin: null as null | { rpc: (name: string, args?: unknown) => { range: (from: number, to: number) => Promise<unknown> } },
    calls: [] as RpcCall[],
  },
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => holder.admin) }));

import { getHiringMetrics } from "@/lib/db/product-metrics";

const NOW = new Date("2026-10-03T12:00:00Z");

function admin(rows: (name: string, from: number) => { data?: unknown; error?: unknown }) {
  holder.calls = [];
  holder.admin = {
    rpc: (name, args) => ({
      range: (from, to) => {
        holder.calls.push({ name, args, from, to });
        const result = rows(name, from);
        return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
      },
    }),
  };
}

afterEach(() => {
  holder.admin = null;
  vi.clearAllMocks();
});

describe("getHiringMetrics", () => {
  it("is null without the service key", async () => {
    expect(await getHiringMetrics(NOW)).toBeNull();
  });

  it("reads every page of each function and builds the numbers", async () => {
    const vacancy = {
      vacancy_id: "v",
      company_id: "c1",
      status: "published",
      moderation_status: "approved",
      company_visible: true,
      published_at: "2026-09-30T10:00:00Z",
      expires_at: "2026-11-30T10:00:00Z",
      first_application_at: null,
      applications: 0,
    };
    admin((name, from) => {
      if (name === "admin_metrics_hiring_vacancies") {
        // A full first page, then the rest.
        return { data: from === 0 ? Array.from({ length: 1000 }, (_, index) => ({ ...vacancy, vacancy_id: `v${index}` })) : [vacancy] };
      }
      if (name === "admin_metrics_hiring_signals") {
        return { data: [{ alerts: "2" }] };
      }
      return { data: [] };
    });

    const metrics = await getHiringMetrics(NOW);

    expect(metrics?.openVacancies).toBe(1001);
    expect(metrics?.alerts.alerts).toBe(2);
    expect(holder.calls.filter((call) => call.name === "admin_metrics_hiring_vacancies").map((call) => [call.from, call.to])).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(holder.calls.find((call) => call.name === "admin_metrics_hiring_applications")?.args).toEqual({
      p_since: "2026-08-10T00:00:00Z",
    });
  });

  it("is null when the database does not have the functions yet", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    admin((name) => (name === "admin_metrics_hiring_signals" ? { error: { message: "function does not exist" } } : { data: [] }));

    expect(await getHiringMetrics(NOW)).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
