// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/uk/my-space/vacancies",
  useRouter: () => router,
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

import VacancyCard from "@/components/vacancy-card";
import VacancyStatusActions from "@/components/vacancy-status-actions";
import { ToastProvider } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { VacancySummary } from "@/lib/vacancies";

const uk = dictionaries.uk;
const ui = uk.vacancies.actions;
const mockedFetch = vi.mocked(apiFetch);
const VACANCY_ID = "33333333-3333-4333-8333-333333333333";
const DAY = 24 * 60 * 60 * 1000;
const future = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const summary: VacancySummary = {
  id: VACANCY_ID,
  slug: "junior-designer-abc123",
  title: "Junior дизайнер",
  kind: "internship",
  hours: "part_time",
  workFormats: ["remote", "hybrid"],
  city: "Київ",
  countryName: null,
  experienceLevel: "junior",
  categoryName: null,
  pay: { min: 15, max: 25, currency: "usd", period: "hour" },
  locale: "uk",
  status: "published",
  state: "open",
  moderationStatus: "approved",
  publishedAt: "2026-09-30T12:00:00Z",
  expiresAt: "2026-11-29T12:00:00Z",
  company: { id: "c1", slug: "acme", name: "Acme", logoUrl: null, verified: true, moderationStatus: "approved" },
};

beforeEach(() => {
  mockedFetch.mockResolvedValue({ ok: true, data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<VacancyCard />", () => {
  it("links the whole card to the vacancy and shows its facts", () => {
    render(<VacancyCard vacancy={summary} dictionary={uk} locale="uk" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/uk/jobs/junior-designer-abc123");
    expect(link).toHaveTextContent("Junior дизайнер");
    expect(link).toHaveTextContent("Acme");
    expect(link).toHaveTextContent(uk.companies.verified);
    expect(screen.getByText("Стажування · Часткова зайнятість · Віддалено, гібрид · Київ")).toBeInTheDocument();
    expect(screen.getByText("15–25 USD за годину")).toBeInTheDocument();
    expect(
      screen.getByText(
        new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" }).format(
          new Date("2026-09-30T12:00:00Z"),
        ),
      ),
    ).toBeInTheDocument();
  });

  it("says the pay is not stated, and hides the company on its own page", () => {
    render(
      <VacancyCard
        vacancy={{ ...summary, pay: null, publishedAt: null, company: { ...summary.company, verified: false } }}
        dictionary={uk}
        locale="uk"
        showCompany={false}
      />,
    );
    expect(screen.getByText(uk.vacancies.card.payNotSet)).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    expect(screen.queryByText(uk.companies.verified)).not.toBeInTheDocument();
  });

  it("does not show the mark for an unverified company", () => {
    render(
      <VacancyCard vacancy={{ ...summary, company: { ...summary.company, verified: false } }} dictionary={uk} locale="uk" />,
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.queryByText(uk.companies.verified)).not.toBeInTheDocument();
  });
});

describe("<VacancyStatusActions />", () => {
  function renderActions(props: Partial<Parameters<typeof VacancyStatusActions>[0]> = {}) {
    return render(
      <ToastProvider>
        <VacancyStatusActions
          vacancyId={VACANCY_ID}
          title="Junior дизайнер"
          status="published"
          expiresAt={future(30)}
          canDelete={false}
          {...props}
        />
      </ToastProvider>,
    );
  }

  const button = (name: string) => screen.queryByRole("button", { name });

  it("offers publish for a draft, not close or extend", () => {
    renderActions({ status: "draft", expiresAt: null, canDelete: true });
    expect(screen.getByRole("link", { name: ui.edit })).toHaveAttribute("href", `/uk/jobs/edit/${VACANCY_ID}`);
    expect(button(ui.publish)).toBeInTheDocument();
    expect(button(ui.delete)).toBeInTheDocument();
    expect(button(ui.close)).not.toBeInTheDocument();
    expect(button(ui.extend)).not.toBeInTheDocument();
    expect(button(ui.reopen)).not.toBeInTheDocument();
  });

  it("hides publish in the editor and edit where asked", () => {
    renderActions({ status: "draft", expiresAt: null, showPublish: false, showEdit: false });
    expect(button(ui.publish)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: ui.edit })).not.toBeInTheDocument();
  });

  it("offers close for an open vacancy, and extend only in its last week", () => {
    renderActions();
    expect(button(ui.close)).toBeInTheDocument();
    expect(button(ui.extend)).not.toBeInTheDocument();
    expect(button(ui.delete)).not.toBeInTheDocument();
    cleanup();

    renderActions({ expiresAt: future(3) });
    expect(button(ui.extend)).toBeInTheDocument();
    expect(button(ui.close)).toBeInTheDocument();
  });

  it("offers reopening for a closed or expired vacancy", () => {
    renderActions({ status: "closed" });
    expect(button(ui.reopen)).toBeInTheDocument();
    expect(button(ui.close)).not.toBeInTheDocument();
    cleanup();

    renderActions({ status: "published", expiresAt: future(-1) });
    expect(button(ui.reopen)).toBeInTheDocument();
    expect(button(ui.extend)).not.toBeInTheDocument();
  });

  it("publishes a draft and refreshes the page", async () => {
    const user = userEvent.setup();
    renderActions({ status: "draft", expiresAt: null });
    await user.click(button(ui.publish)!);

    expect(mockedFetch).toHaveBeenCalledWith(`/api/vacancies/${VACANCY_ID}/status`, {
      method: "POST",
      body: { action: "publish" },
    });
    expect(await screen.findByText(ui.published)).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("says what a draft still needs", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "not ready", status: 400, code: "pay_required" });
    renderActions({ status: "draft", expiresAt: null });
    await user.click(button(ui.publish)!);

    expect(await screen.findByText(uk.vacancies.form.errors.pay_required)).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("falls back to a general error for other refusals", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "nope", status: 409, code: "invalid_status" });
    renderActions({ status: "closed" });
    await user.click(button(ui.reopen)!);
    expect(await screen.findByText(ui.error)).toBeInTheDocument();
  });

  it("warns when the text was held for a moderator", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { heldForReview: true } });
    renderActions({ status: "draft", expiresAt: null });
    await user.click(button(ui.publish)!);
    expect(await screen.findByText(uk.vacancies.form.heldForReview)).toBeInTheDocument();
  });

  it("asks before closing", async () => {
    const user = userEvent.setup();
    renderActions();
    await user.click(button(ui.close)!);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(ui.closeTitle.replace("{title}", "Junior дизайнер"));
    expect(mockedFetch).not.toHaveBeenCalled();

    const confirm = screen.getAllByRole("button", { name: ui.close }).at(-1)!;
    await user.click(confirm);
    expect(mockedFetch).toHaveBeenCalledWith(`/api/vacancies/${VACANCY_ID}/status`, {
      method: "POST",
      body: { action: "close" },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("extends from the button", async () => {
    const user = userEvent.setup();
    renderActions({ status: "expired", expiresAt: future(-3) });
    await user.click(button(ui.reopen)!);
    expect(mockedFetch).toHaveBeenCalledWith(`/api/vacancies/${VACANCY_ID}/status`, {
      method: "POST",
      body: { action: "extend" },
    });
    expect(await screen.findByText(ui.extended)).toBeInTheDocument();
  });

  it("deletes after confirming and goes back to the list", async () => {
    const user = userEvent.setup();
    renderActions({ canDelete: true, afterDeleteHref: "/my-space/vacancies" });
    await user.click(button(ui.delete)!);
    expect(screen.getByRole("dialog")).toHaveTextContent(ui.deleteTitle.replace("{title}", "Junior дизайнер"));

    await user.click(screen.getAllByRole("button", { name: ui.delete }).at(-1)!);
    expect(mockedFetch).toHaveBeenCalledWith(`/api/vacancies/${VACANCY_ID}`, { method: "DELETE" });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/uk/my-space/vacancies"));
    expect(await screen.findByText(ui.deleted)).toBeInTheDocument();
  });

  it("cancels without calling the server", async () => {
    const user = userEvent.setup();
    renderActions({ canDelete: true });
    await user.click(button(ui.delete)!);
    await user.click(screen.getByRole("button", { name: ui.cancel }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
