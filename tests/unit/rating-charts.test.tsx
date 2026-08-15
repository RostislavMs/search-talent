// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import {
  DecayChart,
  RatingWeightsChart,
  SaturationChart,
  TrustChart,
} from "@/components/charts/rating-charts";
import {
  HALF_LIFE_DAYS,
  PROFILE_WEIGHTS,
  PROJECT_WEIGHTS,
  getWilsonScore,
} from "@/lib/leaderboards";

afterEach(cleanup);

describe("RatingWeightsChart", () => {
  it("renders every profile weight from the live weight table", () => {
    render(<RatingWeightsChart kind="profile" locale="en" />);

    const figure = screen.getByRole("figure");
    for (const [label, key] of [
      ["Portfolio quality", "portfolio"],
      ["Profile completeness", "completeness"],
      ["Community trust", "communityTrust"],
      ["Production output", "production"],
      ["Freshness", "freshness"],
    ] as const) {
      const row = within(figure).getByText(label).closest("li");
      expect(row).not.toBeNull();
      expect(row).toHaveTextContent(`${PROFILE_WEIGHTS.all[key]}%`);
      expect(row).toHaveTextContent(`${PROFILE_WEIGHTS.month[key]}%`);
    }
  });

  it("renders the project weights and labels both timeframes", () => {
    render(<RatingWeightsChart kind="project" locale="en" />);

    const row = screen.getByText("Community trust").closest("li");
    expect(row).toHaveTextContent(`${PROJECT_WEIGHTS.all.communityTrust}%`);
    expect(row).toHaveTextContent(`${PROJECT_WEIGHTS.month.communityTrust}%`);
    expect(screen.getByText("All-time")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
  });

  it("gives the zero-weight row a muted stub instead of a zero-width bar", () => {
    render(<RatingWeightsChart kind="profile" locale="en" />);

    // Freshness is 0 % all-time, so the bar would otherwise vanish entirely.
    expect(PROFILE_WEIGHTS.all.freshness).toBe(0);
    const row = screen.getByText("Freshness").closest("li");
    const stub = row?.querySelector<HTMLElement>('span[style*="3px"]');
    expect(stub).not.toBeNull();
    expect(stub?.style.background).toContain("--chart-grid");
  });

  it("keeps Ukrainian labels on the Ukrainian locale", () => {
    render(<RatingWeightsChart kind="profile" locale="uk" />);
    expect(screen.getByText("Якість портфоліо")).toBeInTheDocument();
    expect(screen.getByText("30 днів")).toBeInTheDocument();
  });
});

describe("TrustChart", () => {
  it("contrasts the raw ratio with the Wilson score for both scenarios", () => {
    render(<TrustChart locale="en" />);

    const pct = (value: number) => `${Math.round(value * 100)}%`;
    const few = screen.getByText("3 up / 0 down").closest("li");
    // A perfect 3-of-3 raw ratio, but the confidence-adjusted score is far lower.
    expect(few).toHaveTextContent("100%");
    expect(few).toHaveTextContent(pct(getWilsonScore(3, 0)));
    expect(pct(getWilsonScore(3, 0))).toBe("44%");

    const many = screen.getByText("100 up / 5 down").closest("li");
    expect(many).toHaveTextContent(pct(getWilsonScore(100, 5)));
    expect(pct(getWilsonScore(100, 5))).toBe("89%");
  });
});

describe("curve charts", () => {
  it("draws the saturation curve as a monotonically rising polyline", () => {
    const { container } = render(<SaturationChart locale="en" />);

    const points = container.querySelector("polyline")?.getAttribute("points");
    expect(points).toBeTruthy();
    // SVG y grows downward, so a rising curve means strictly decreasing y.
    const ys = points!.split(" ").map((pair) => Number(pair.split(",")[1]));
    expect(ys.length).toBeGreaterThan(10);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i]).toBeLessThan(ys[i - 1]);
    }
  });

  it("plots both half-lives as separate decay series", () => {
    const { container } = render(<DecayChart locale="en" />);

    expect(container.querySelectorAll("polyline")).toHaveLength(2);
    expect(screen.getByText(String(HALF_LIFE_DAYS.all))).toBeInTheDocument();
    expect(screen.getByText(String(HALF_LIFE_DAYS.month))).toBeInTheDocument();
  });

  it("labels each curve chart for assistive tech", () => {
    render(<SaturationChart locale="en" />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/saturation|50%/i);
  });
});
