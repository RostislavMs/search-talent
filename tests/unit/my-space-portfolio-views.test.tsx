// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { dictionaries } from "@/lib/i18n/dictionaries";

vi.mock("@/lib/i18n/client", async () => {
  const { dictionaries: all } = await import("@/lib/i18n/dictionaries");
  return { useCurrentLocale: () => "uk", useDictionary: () => all.uk };
});

import MySpacePortfolioViews from "@/components/my-space-portfolio-views";
import { normalizePortfolioViews } from "@/lib/portfolio-views";

const uk = dictionaries.uk;
const copy = uk.mySpace.portfolioViews;

afterEach(() => cleanup());

describe("<MySpacePortfolioViews />", () => {
  it("shows the week and the month, the chart, sources and top projects", () => {
    const views = normalizePortfolioViews({
      today: "2026-10-05",
      days: [
        { day: "2026-10-05", profile: 2, projects: 1 },
        { day: "2026-09-20", profile: 4, projects: 0 },
      ],
      sources: { external: 3, direct: 4, internal: 0 },
      referrers: [{ host: "linkedin.com", views: 3 }],
      projects: [{ id: "p1", title: "Нічне місто", slug: "night-city", views: 1, viewsWeek: 1 }],
    })!;

    render(<MySpacePortfolioViews dictionary={uk} locale="uk" views={views} />);

    const week = screen.getByText(copy.week).parentElement!;
    expect(within(week).getByText("3")).toBeInTheDocument();
    expect(within(week).getByText("профіль 2 · проєкти 1")).toBeInTheDocument();
    const month = screen.getByText(copy.month).parentElement!;
    expect(within(month).getByText("7")).toBeInTheDocument();

    expect(
      screen.getByRole("img", { name: /Перегляди за 30 днів: усього 7, найбільше 20 вер/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.sources.direct)).toBeInTheDocument();
    expect(screen.queryByText(copy.sources.internal)).toBeNull();
    expect(screen.getByText(copy.directHint)).toBeInTheDocument();
    expect(screen.getByText("linkedin.com")).toBeInTheDocument();

    const project = screen.getByRole("link", { name: "Нічне місто" });
    expect(project).toHaveAttribute("href", "/uk/projects/night-city");
    expect(screen.getByText("1 перегляд за 30 днів · 1 за 7")).toBeInTheDocument();
  });

  it("asks to share the portfolio while nobody has looked yet", () => {
    const views = normalizePortfolioViews({ today: "2026-10-05" })!;
    render(<MySpacePortfolioViews dictionary={uk} locale="uk" views={views} />);

    expect(screen.getByText(copy.empty)).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
