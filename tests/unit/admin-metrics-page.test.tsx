import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductMetricsResult } from "@/lib/db/product-metrics";
import { buildProductMetrics } from "@/lib/product-metrics";

const { holder } = vi.hoisted(() => ({
  holder: { result: null as ProductMetricsResult | null },
}));

vi.mock("@/lib/db/product-metrics", () => ({
  getProductMetrics: vi.fn(async () => holder.result),
}));

import AdminMetricsPage from "@/app/[locale]/admin/metrics/page";

const NOW = new Date("2026-09-26T12:00:00Z");

async function render(locale: "uk" | "en") {
  const element = await AdminMetricsPage({ params: Promise.resolve({ locale }) });
  return renderToStaticMarkup(element);
}

afterEach(() => {
  holder.result = null;
});

describe("/admin/metrics", () => {
  it("explains what is missing when metrics are unavailable", async () => {
    holder.result = { status: "unavailable", reason: "not-migrated" };
    expect(await render("en")).toContain("2026-09-26-product-metrics.sql");

    holder.result = { status: "unavailable", reason: "no-service-key" };
    expect(await render("uk")).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("renders an empty platform without NaN or broken values", async () => {
    holder.result = {
      status: "ok",
      metrics: buildProductMetrics({ users: [], views: [], now: NOW }),
    };
    const html = await render("uk");

    expect(html).toContain("Метрики продукту");
    expect(html).toContain("Переглядів ззовні ще немає.");
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("renders tiles, cohorts and sources from real rows", async () => {
    holder.result = {
      status: "ok",
      metrics: buildProductMetrics({
        now: NOW,
        users: [
          {
            account_id: "a",
            signed_up_at: "2026-09-22T10:00:00Z",
            email_confirmed: true,
            last_active_at: "2026-09-23T10:00:00Z",
            first_project_at: "2026-09-22T13:00:00Z",
            first_external_view_at: "2026-09-24T09:00:00Z",
            signup_source_recorded: true,
            signup_referrer_host: "lnkd.in",
            signup_utm_source: null,
            is_admin: false,
          },
          {
            account_id: "admin",
            signed_up_at: "2026-04-01T10:00:00Z",
            email_confirmed: true,
            last_active_at: null,
            first_project_at: null,
            first_external_view_at: null,
            signup_source_recorded: false,
            signup_referrer_host: null,
            signup_utm_source: null,
            is_admin: true,
          },
        ],
        views: [
          {
            week_start: "2026-09-21",
            target_type: "profile",
            source: "external",
            referrer_host: "linkedin.com",
            owner_is_admin: false,
            views: 3,
          },
        ],
      }),
    };
    const html = await render("en");

    expect(html).toContain("Activated authors");
    expect(html).toContain("+1 this week");
    expect(html).toContain("1 of 1 accounts");
    expect(html).toContain("3 h");
    expect(html).toContain("LinkedIn");
    expect(html).toContain("Admin accounts left out: 1.");
    expect(html).toContain("Sep 21");
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });
});
