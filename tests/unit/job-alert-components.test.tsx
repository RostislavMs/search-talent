// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/uk/jobs",
  useRouter: () => router,
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

import { JobAlertControls, JobAlertProfileSwitch } from "@/components/job-alert-controls";
import JobAlertFollow from "@/components/job-alert-follow";
import JobAlertUnsubscribe from "@/components/job-alert-unsubscribe";
import OpenToCard from "@/components/open-to-card";
import ProfileContactButton, { type ProfileContactInfo } from "@/components/profile-contact-button";
import Switch from "@/components/ui/switch";
import { ToastProvider } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { withoutPage } from "@/lib/job-alerts";
import { EMPTY_VACANCY_FILTERS } from "@/lib/vacancies";

const uk = dictionaries.uk;
const mockedFetch = vi.mocked(apiFetch);
const ALERT_ID = "22222222-2222-4222-8222-222222222222";
const NONE = withoutPage(EMPTY_VACANCY_FILTERS);

function withToasts(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("<Switch />", () => {
  it("is a labelled switch that reports the next state", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Switch checked={false} onChange={onChange} label="Email" />);

    const toggle = screen.getByRole("switch", { name: "Email" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<Switch checked onChange={onChange} label="Email" size="sm" disabled />);
    expect(screen.getByRole("switch", { name: "Email" })).toBeDisabled();
  });
});

describe("<JobAlertFollow />", () => {
  const filters = { ...NONE, kind: "internship" as const, countryId: 12 };

  it("sends a guest to sign in and back", () => {
    render(<JobAlertFollow filters={filters} alertId={null} isAuthenticated={false} loginHref="/uk/login?next=%2Fuk%2Fjobs" />);

    expect(screen.getByRole("link", { name: uk.jobAlerts.follow.button })).toHaveAttribute(
      "href",
      "/uk/login?next=%2Fuk%2Fjobs",
    );
  });

  it("follows the filters on screen, then offers to stop", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { alert: { id: ALERT_ID } } });
    withToasts(<JobAlertFollow filters={filters} alertId={null} isAuthenticated loginHref="/uk/login" />);

    const button = screen.getByRole("button", { name: uk.jobAlerts.follow.button });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);

    expect(mockedFetch).toHaveBeenCalledWith("/api/job-alerts", {
      method: "POST",
      body: { filters: { kind: "internship", country: "12" }, locale: "uk" },
    });
    expect(await screen.findByText(uk.jobAlerts.follow.followed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: uk.jobAlerts.follow.following })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: uk.jobAlerts.follow.manage })).toHaveAttribute("href", "/uk/my-space/job-alerts");
  });

  it("stops following", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { deleted: true } });
    withToasts(<JobAlertFollow filters={filters} alertId={ALERT_ID} isAuthenticated loginHref="/uk/login" />);

    await userEvent.click(screen.getByRole("button", { name: uk.jobAlerts.follow.following }));

    expect(mockedFetch).toHaveBeenCalledWith(`/api/job-alerts/${ALERT_ID}`, { method: "DELETE" });
    expect(await screen.findByText(uk.jobAlerts.follow.unfollowed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: uk.jobAlerts.follow.button })).toBeInTheDocument();
  });

  it("refreshes when the search is already followed elsewhere", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "dup", status: 409, code: "duplicate" });
    withToasts(<JobAlertFollow filters={filters} alertId={null} isAuthenticated loginHref="/uk/login" />);

    await userEvent.click(screen.getByRole("button", { name: uk.jobAlerts.follow.button }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it.each([
    [{ ok: false, error: "x", status: 409, code: "limit" }, uk.jobAlerts.follow.limit.replace("{max}", "10")],
    [{ ok: false, error: "x", status: 429 }, uk.jobAlerts.follow.rateLimited],
    [{ ok: false, error: "x", status: 500 }, uk.jobAlerts.follow.error],
  ] as const)("explains a refusal", async (result, message) => {
    mockedFetch.mockResolvedValueOnce(result);
    withToasts(<JobAlertFollow filters={filters} alertId={null} isAuthenticated loginHref="/uk/login" />);

    await userEvent.click(screen.getByRole("button", { name: uk.jobAlerts.follow.button }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("says so when stopping fails", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 500 });
    withToasts(<JobAlertFollow filters={filters} alertId={ALERT_ID} isAuthenticated loginHref="/uk/login" />);

    await userEvent.click(screen.getByRole("button", { name: uk.jobAlerts.follow.following }));
    expect(await screen.findByText(uk.jobAlerts.follow.error)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: uk.jobAlerts.follow.following })).toBeInTheDocument();
  });
});

describe("<JobAlertControls />", () => {
  it("switches the email and rolls back when saving fails", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: {} }).mockResolvedValueOnce({ ok: false, error: "x", status: 500 });
    withToasts(<JobAlertControls alertId={ALERT_ID} name="Стажування" notifyEmail />);

    const toggle = screen.getByRole("switch", { name: uk.jobAlerts.page.email });
    await userEvent.click(toggle);
    expect(mockedFetch).toHaveBeenCalledWith(`/api/job-alerts/${ALERT_ID}`, {
      method: "PATCH",
      body: { notifyEmail: false },
    });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));

    await userEvent.click(toggle);
    expect(await screen.findByText(uk.jobAlerts.page.error)).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("removes after a confirmation", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { deleted: true } });
    withToasts(<JobAlertControls alertId={ALERT_ID} name="Стажування" notifyEmail={false} />);

    await userEvent.click(screen.getByRole("button", { name: uk.jobAlerts.page.remove }));
    expect(screen.getByText("Більше не стежити за «Стажування»?")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: uk.jobAlerts.page.remove });
    await userEvent.click(buttons[buttons.length - 1]);

    expect(mockedFetch).toHaveBeenCalledWith(`/api/job-alerts/${ALERT_ID}`, { method: "DELETE" });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(await screen.findByText(uk.jobAlerts.page.removed)).toBeInTheDocument();
  });

  it("says so when removing fails", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 500 });
    withToasts(<JobAlertControls alertId={ALERT_ID} name="Стажування" notifyEmail={false} />);

    await userEvent.click(screen.getByRole("button", { name: uk.jobAlerts.page.remove }));
    const buttons = screen.getAllByRole("button", { name: uk.jobAlerts.page.remove });
    await userEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText(uk.jobAlerts.page.error)).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("<JobAlertProfileSwitch />", () => {
  const props = { title: "Вакансії, що мені підходять", hint: "Підказка", notifyEmail: true };

  it("switches «fits me» on, then shows the email switch", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { alert: { id: ALERT_ID } } });
    withToasts(<JobAlertProfileSwitch {...props} alertId={null} showEmail />);

    expect(screen.queryByRole("switch", { name: uk.jobAlerts.page.email })).toBeNull();
    await userEvent.click(screen.getByRole("switch", { name: props.title }));

    expect(mockedFetch).toHaveBeenCalledWith("/api/job-alerts", {
      method: "POST",
      body: { match: "profile", locale: "uk" },
    });
    expect(await screen.findByRole("switch", { name: uk.jobAlerts.page.email })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: props.title })).toHaveAttribute("aria-checked", "true");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("switches it off", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: {} });
    withToasts(<JobAlertProfileSwitch {...props} alertId={ALERT_ID} />);

    await userEvent.click(screen.getByRole("switch", { name: props.title }));
    expect(mockedFetch).toHaveBeenCalledWith(`/api/job-alerts/${ALERT_ID}`, { method: "DELETE" });
    await waitFor(() => expect(screen.getByRole("switch", { name: props.title })).toHaveAttribute("aria-checked", "false"));
  });

  it.each([
    [{ ok: false, error: "x", status: 409, code: "limit" }, uk.jobAlerts.page.limit],
    [{ ok: false, error: "x", status: 500 }, uk.jobAlerts.page.error],
  ] as const)("explains a refusal", async (result, message) => {
    mockedFetch.mockResolvedValueOnce(result);
    withToasts(<JobAlertProfileSwitch {...props} alertId={null} />);

    await userEvent.click(screen.getByRole("switch", { name: props.title }));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("refreshes on a duplicate and when switching off fails it says so", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "dup", status: 409, code: "duplicate" });
    withToasts(<JobAlertProfileSwitch {...props} alertId={null} />);
    await userEvent.click(screen.getByRole("switch", { name: props.title }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    cleanup();

    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 500 });
    withToasts(<JobAlertProfileSwitch {...props} alertId={ALERT_ID} />);
    await userEvent.click(screen.getByRole("switch", { name: props.title }));
    expect(await screen.findByText(uk.jobAlerts.page.error)).toBeInTheDocument();
  });

  it("can be disabled", () => {
    render(<JobAlertProfileSwitch {...props} alertId={null} disabled />);
    expect(screen.getByRole("switch", { name: props.title })).toBeDisabled();
  });
});

describe("<OpenToCard /> with job alerts", () => {
  it("offers «fits me» once the status names something a vacancy can be", () => {
    withToasts(<OpenToCard initialOpenTo={["internship"]} initialUpdatedAt={new Date().toISOString()} jobAlert={{ alertId: null }} />);

    expect(screen.getByRole("switch", { name: uk.jobAlerts.mySpace.title })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("link", { name: uk.jobAlerts.mySpace.all })).toHaveAttribute("href", "/uk/my-space/job-alerts");
  });

  it("does not offer it for mentoring alone, nor without the prop", () => {
    withToasts(<OpenToCard initialOpenTo={["mentoring"]} initialUpdatedAt={new Date().toISOString()} jobAlert={{ alertId: null }} />);
    expect(screen.queryByRole("switch", { name: uk.jobAlerts.mySpace.title })).toBeNull();
    cleanup();

    withToasts(<OpenToCard initialOpenTo={["job"]} initialUpdatedAt={new Date().toISOString()} />);
    expect(screen.queryByRole("switch", { name: uk.jobAlerts.mySpace.title })).toBeNull();
  });

  it("keeps an alert that is on visible so it can be switched off", () => {
    withToasts(<OpenToCard initialOpenTo={[]} initialUpdatedAt={null} jobAlert={{ alertId: ALERT_ID }} />);
    expect(screen.getByRole("switch", { name: uk.jobAlerts.mySpace.title })).toHaveAttribute("aria-checked", "true");
  });
});

describe("<ProfileContactButton /> on behalf of a company", () => {
  const contact: ProfileContactInfo = {
    profileId: "33333333-3333-4333-8333-333333333333",
    displayName: "Олена Коваль",
    telegram: null,
    linkedin: null,
    website: null,
    preferred: null,
    hasEmail: true,
    hasPhone: false,
    openToLine: null,
    hourlyRateLine: null,
    workFormatsLine: null,
  };
  const ACME = "44444444-4444-4444-8444-444444444444";
  const companies = [{ id: ACME, name: "Acme" }];

  beforeEach(() => {
    mockedFetch.mockImplementation(async (_url, options) => {
      const body = (options?.body ?? {}) as { companyId?: string };
      return {
        ok: true,
        data: { email: "olena@example.com", phone: null, asCompanyId: body.companyId ?? null, companies },
      };
    });
  });

  it("offers the visitor's companies and switches to one", async () => {
    render(<ProfileContactButton contact={contact} isAuthenticated />);
    await userEvent.click(screen.getByRole("button", { name: uk.openTo.contact }));

    const self = await screen.findByRole("radio", { name: uk.openTo.contactAsYou });
    expect(self).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(uk.openTo.contactAsHint.replace("{name}", "Олена Коваль"))).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Acme" }));

    expect(mockedFetch).toHaveBeenLastCalledWith("/api/profile-contacts", {
      method: "POST",
      body: { profileId: contact.profileId, companyId: ACME },
    });
    await waitFor(() => expect(screen.getByRole("radio", { name: "Acme" })).toHaveAttribute("aria-checked", "true"));
    expect(screen.getByText("Олена Коваль побачить, що контакти відкрила компанія Acme.")).toBeInTheDocument();
    expect(window.localStorage.getItem("st:contact-as-company")).toBe(ACME);
  });

  it("opens as the remembered company next time, and back as oneself", async () => {
    window.localStorage.setItem("st:contact-as-company", ACME);
    render(<ProfileContactButton contact={contact} isAuthenticated />);
    await userEvent.click(screen.getByRole("button", { name: uk.openTo.contact }));

    expect(mockedFetch).toHaveBeenCalledWith("/api/profile-contacts", {
      method: "POST",
      body: { profileId: contact.profileId, companyId: ACME },
    });
    await userEvent.click(await screen.findByRole("radio", { name: uk.openTo.contactAsYou }));
    await waitFor(() => expect(window.localStorage.getItem("st:contact-as-company")).toBeNull());
    expect(mockedFetch).toHaveBeenLastCalledWith("/api/profile-contacts", {
      method: "POST",
      body: { profileId: contact.profileId },
    });
  });

  it("falls back to oneself when the company can no longer be used", async () => {
    window.localStorage.setItem("st:contact-as-company", ACME);
    mockedFetch
      .mockResolvedValueOnce({ ok: false, error: "no", status: 403, code: "company_not_allowed" })
      .mockResolvedValueOnce({ ok: true, data: { email: "olena@example.com", phone: null, asCompanyId: null, companies: [] } });
    render(<ProfileContactButton contact={contact} isAuthenticated />);
    await userEvent.click(screen.getByRole("button", { name: uk.openTo.contact }));

    expect(await screen.findByRole("link", { name: "olena@example.com" })).toBeInTheDocument();
    expect(window.localStorage.getItem("st:contact-as-company")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("says when the company has opened too many today", async () => {
    window.localStorage.setItem("st:contact-as-company", ACME);
    mockedFetch
      .mockResolvedValueOnce({ ok: false, error: "many", status: 429, code: "company_rate_limited" })
      .mockResolvedValueOnce({ ok: true, data: { email: "olena@example.com", phone: null, asCompanyId: null, companies } });
    render(<ProfileContactButton contact={contact} isAuthenticated />);
    await userEvent.click(screen.getByRole("button", { name: uk.openTo.contact }));

    expect(await screen.findByText(uk.openTo.companyRateLimited)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: uk.openTo.contactAsYou })).toHaveAttribute("aria-checked", "true");
    // The choice stays: tomorrow it works again.
    expect(window.localStorage.getItem("st:contact-as-company")).toBe(ACME);
  });

  it("shows no choice to someone outside any verified company", async () => {
    mockedFetch.mockResolvedValue({ ok: true, data: { email: "olena@example.com", phone: null, asCompanyId: null, companies: [] } });
    render(<ProfileContactButton contact={contact} isAuthenticated />);
    await userEvent.click(screen.getByRole("button", { name: uk.openTo.contact }));

    expect(await screen.findByRole("link", { name: "olena@example.com" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});

describe("<JobAlertUnsubscribe />", () => {
  it("turns the emails off on a press, not on the visit", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { ok: true } });
    render(<JobAlertUnsubscribe userId="u" token="t" />);

    expect(mockedFetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: uk.jobAlerts.unsubscribe.button }));

    expect(mockedFetch).toHaveBeenCalledWith("/api/job-alerts/unsubscribe", { method: "POST", body: { u: "u", t: "t" } });
    expect(await screen.findByRole("status")).toHaveTextContent(uk.jobAlerts.unsubscribe.done);
  });

  it("says when it did not work", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 503 });
    render(<JobAlertUnsubscribe userId="u" token="t" />);

    await userEvent.click(screen.getByRole("button", { name: uk.jobAlerts.unsubscribe.button }));
    expect(await screen.findByRole("alert")).toHaveTextContent(uk.jobAlerts.unsubscribe.error);
  });
});
