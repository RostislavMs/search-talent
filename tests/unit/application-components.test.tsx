// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/uk/jobs/designer-abc",
  useRouter: () => router,
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

import ApplicationStatusPill from "@/components/application-status-pill";
import ApplicationTeamActions from "@/components/application-team-actions";
import ApplicationWithdrawButton from "@/components/application-withdraw-button";
import ApplicationsViewedBeacon from "@/components/applications-viewed-beacon";
import VacancyApplyPanel from "@/components/vacancy-apply-panel";
import { ToastProvider } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import type { ApplyState } from "@/lib/applications";
import { dictionaries } from "@/lib/i18n/dictionaries";

const uk = dictionaries.uk.applications;
const mockedFetch = vi.mocked(apiFetch);
const VACANCY_ID = "22222222-2222-4222-8222-222222222222";
const APPLICATION_ID = "33333333-3333-4333-8333-333333333333";

const projects = [
  { id: "p1", title: "Лендинг кав'ярні", slug: "landing", coverUrl: null, kind: "web" },
  { id: "p2", title: "Мобільний застосунок", slug: "app", coverUrl: null, kind: "mobile" },
  { id: "p3", title: "Брендбук", slug: "brand", coverUrl: null, kind: "design" },
  { id: "p4", title: "3D-сцена", slug: "scene", coverUrl: null, kind: "3d" },
];

function renderPanel(props: Partial<Parameters<typeof VacancyApplyPanel>[0]> = {}) {
  return render(
    <ToastProvider>
      <VacancyApplyPanel
        state="ready"
        locale="uk"
        vacancy={{ id: VACANCY_ID, title: "Junior дизайнер", companyName: "Acme" }}
        projects={projects}
        contacts={{ email: "carol@work.dev", phone: null }}
        application={null}
        loginHref="/uk/login?next=%2Fuk%2Fjobs%2Fdesigner-abc"
        teamHref={`/my-space/vacancies/${VACANCY_ID}`}
        applicationsCount={null}
        {...props}
      />
    </ToastProvider>,
  );
}

beforeEach(() => {
  mockedFetch.mockResolvedValue({ ok: true, data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<VacancyApplyPanel /> states", () => {
  const cases: Array<[ApplyState, string, string | null]> = [
    ["sign_in", uk.apply.signInText, "/uk/login?next=%2Fuk%2Fjobs%2Fdesigner-abc"],
    ["confirm_email", uk.apply.confirmEmailText, null],
    ["need_profile", uk.apply.needProfileText, "/uk/onboarding"],
    ["need_project", uk.apply.needProjectText, "/uk/projects/new"],
    ["closed", uk.apply.closedText, null],
  ];

  it.each(cases)("%s: one sentence and the next step", (state, text, href) => {
    renderPanel({ state });
    expect(screen.getByText(text)).toBeInTheDocument();
    if (href) {
      expect(screen.getByRole("link")).toHaveAttribute("href", href);
    } else {
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: uk.apply.button })).not.toBeInTheDocument();
  });

  it("shows the team how many applications came in", () => {
    renderPanel({ state: "team", applicationsCount: { total: 3, fresh: 1 } });
    expect(screen.getByText(/3 відгуки · 1 новий/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: uk.apply.teamCta })).toHaveAttribute(
      "href",
      `/uk/my-space/vacancies/${VACANCY_ID}`,
    );
  });

  it("shows the candidate where their application stands", () => {
    renderPanel({
      state: "applied",
      application: { status: "shortlisted", createdAt: "2026-10-01T10:00:00Z" },
    });
    expect(screen.getByText(uk.candidateStatuses.shortlisted)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(uk.candidateStatusHints.shortlisted))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: uk.apply.appliedCta })).toHaveAttribute("href", "/uk/my-space/applications");
  });
});

describe("<VacancyApplyPanel /> form", () => {
  async function openForm() {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: uk.apply.button }));
    return { user, dialog: screen.getByRole("dialog") };
  }

  it("shows the projects, the contacts the company gets and the consent", async () => {
    const { dialog } = await openForm();
    expect(within(dialog).getByText("Відгук на «Junior дизайнер»")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(projects.length + 1);
    expect(within(dialog).getByText("carol@work.dev")).toBeInTheDocument();
    expect(within(dialog).getByText(uk.apply.contactsNone)).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText(uk.apply.consent.replace("{company}", "Acme")),
    ).not.toBeChecked();
  });

  it("lets one pick at most three projects", async () => {
    const { user, dialog } = await openForm();
    for (const project of projects.slice(0, 3)) {
      await user.click(within(dialog).getByLabelText(project.title));
    }
    expect(within(dialog).getByLabelText(projects[3].title)).toBeDisabled();
    expect(within(dialog).getByText(uk.apply.projectsLimit.replace("{max}", "3"))).toBeInTheDocument();

    await user.click(within(dialog).getByLabelText(projects[0].title));
    expect(within(dialog).getByLabelText(projects[3].title)).toBeEnabled();
  });

  it("asks for a project, then for the consent, before sending", async () => {
    const { user, dialog } = await openForm();
    await user.click(within(dialog).getByRole("button", { name: uk.apply.submit }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(uk.apply.errors.projectsRequired);

    await user.click(within(dialog).getByLabelText(projects[0].title));
    await user.click(within(dialog).getByRole("button", { name: uk.apply.submit }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(uk.apply.errors.consent);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("sends the chosen projects in order with the message, then refreshes", async () => {
    const { user, dialog } = await openForm();
    await user.click(within(dialog).getByLabelText(projects[1].title));
    await user.click(within(dialog).getByLabelText(projects[0].title));
    await user.type(within(dialog).getByLabelText(uk.apply.messageLabel), "Привіт!");
    expect(within(dialog).getByText("7 / 1000")).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText(uk.apply.consent.replace("{company}", "Acme")));
    await user.click(within(dialog).getByRole("button", { name: uk.apply.submit }));

    expect(mockedFetch).toHaveBeenCalledWith(`/api/vacancies/${VACANCY_ID}/applications`, {
      method: "POST",
      body: { project_ids: ["p2", "p1"], message: "Привіт!", consent: true },
    });
    expect(await screen.findByText(uk.apply.sent)).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("says why the database refused, and refreshes when the page is out of date", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 429, code: "daily_limit" });
    const { user, dialog } = await openForm();
    await user.click(within(dialog).getByLabelText(projects[0].title));
    await user.click(within(dialog).getByLabelText(uk.apply.consent.replace("{company}", "Acme")));
    await user.click(within(dialog).getByRole("button", { name: uk.apply.submit }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      uk.apply.errors.daily_limit.replace("{max}", "20"),
    );
    expect(router.refresh).not.toHaveBeenCalled();

    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 409, code: "already_applied" });
    await user.click(within(dialog).getByRole("button", { name: uk.apply.submit }));
    expect(await within(dialog).findByText(uk.apply.errors.already_applied)).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();

    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 500, code: "failed" });
    await user.click(within(dialog).getByRole("button", { name: uk.apply.submit }));
    expect(await within(dialog).findByText(uk.apply.errors.generic)).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const { user } = await openForm();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("picks the only project by itself", async () => {
    const user = userEvent.setup();
    renderPanel({ projects: [projects[0]] });
    await user.click(screen.getByRole("button", { name: uk.apply.button }));
    expect(screen.getByLabelText(projects[0].title)).toBeChecked();
  });
});

describe("<ApplicationStatusPill />", () => {
  it("uses the words it is given", () => {
    render(<ApplicationStatusPill status="hired" labels={uk.teamStatuses} />);
    expect(screen.getByText(uk.teamStatuses.hired)).toBeInTheDocument();
  });
});

describe("<ApplicationTeamActions />", () => {
  const actions = uk.team.actions;
  const renderActions = (status: Parameters<typeof ApplicationTeamActions>[0]["status"]) =>
    render(
      <ToastProvider>
        <ApplicationTeamActions applicationId={APPLICATION_ID} status={status} />
      </ToastProvider>,
    );
  const names = () => screen.queryAllByRole("button").map((button) => button.textContent);

  it("offers the moves that make sense for each status", () => {
    renderActions("new");
    expect(names()).toEqual([actions.shortlist, actions.hire, actions.reject]);
    cleanup();

    renderActions("shortlisted");
    expect(names()).toEqual([actions.hire, actions.reject, actions.reconsider]);
    cleanup();

    renderActions("rejected");
    expect(names()).toEqual([actions.hire, actions.reconsider]);
    cleanup();

    renderActions("hired");
    expect(names()).toEqual([actions.reject, actions.reconsider]);
    cleanup();

    renderActions("withdrawn");
    expect(names()).toEqual([]);
  });

  it("shortlists at once", async () => {
    const user = userEvent.setup();
    renderActions("viewed");
    await user.click(screen.getByRole("button", { name: actions.shortlist }));
    expect(mockedFetch).toHaveBeenCalledWith(`/api/applications/${APPLICATION_ID}`, {
      method: "PATCH",
      body: { status: "shortlisted" },
    });
    expect(await screen.findByText(actions.saved.shortlisted)).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("asks before a rejection, which the candidate hears about", async () => {
    const user = userEvent.setup();
    renderActions("viewed");
    await user.click(screen.getByRole("button", { name: actions.reject }));
    expect(screen.getByText(actions.rejectText)).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalled();

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: actions.rejectConfirm }));
    expect(mockedFetch).toHaveBeenCalledWith(`/api/applications/${APPLICATION_ID}`, {
      method: "PATCH",
      body: { status: "rejected" },
    });
    expect(await screen.findByText(actions.saved.rejected)).toBeInTheDocument();
  });

  it("says when it failed", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 409, code: "withdrawn" });
    renderActions("shortlisted");
    await user.click(screen.getByRole("button", { name: actions.reconsider }));
    expect(await screen.findByText(actions.error)).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("<ApplicationWithdrawButton />", () => {
  it("asks first, then withdraws", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ApplicationWithdrawButton applicationId={APPLICATION_ID} vacancyTitle="Junior дизайнер" />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: uk.mine.withdraw }));
    expect(screen.getByText("Відкликати відгук на «Junior дизайнер»?")).toBeInTheDocument();
    expect(screen.getByText(uk.mine.withdrawText)).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: uk.mine.withdraw }));
    expect(mockedFetch).toHaveBeenCalledWith(`/api/applications/${APPLICATION_ID}/withdraw`, { method: "POST" });
    expect(await screen.findByText(uk.mine.withdrawn)).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });
});

describe("<ApplicationsViewedBeacon />", () => {
  it("reports the new applications on screen once", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);

    const { rerender } = render(<ApplicationsViewedBeacon ids={["a1", "a2"]} />);
    rerender(<ApplicationsViewedBeacon ids={["a1", "a2"]} />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/applications/viewed");
    expect(JSON.parse(String(init.body))).toEqual({ ids: ["a1", "a2"] });
    vi.unstubAllGlobals();
  });

  it("sends nothing without ids", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<ApplicationsViewedBeacon ids={[]} />);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
