// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/uk/onboarding",
  useRouter: () => router,
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

import MySpaceChecklist from "@/components/my-space-checklist";
import OnboardingFlow from "@/components/onboarding/onboarding-flow";
import OnboardingProfileStep from "@/components/onboarding/profile-step";
import { ToastProvider } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getOnboardingChecklist, type OnboardingChecklistInput } from "@/lib/onboarding";
import { getProfileCompletenessBreakdown } from "@/lib/profile-completeness";

const uk = dictionaries.uk;
const mockedFetch = vi.mocked(apiFetch);

const newcomer: OnboardingChecklistInput = {
  username: "user-ab12cd",
  email: "olena@example.com",
  name: null,
  categoryId: null,
  skillsCount: 0,
  publishedProjectsCount: 0,
  linkShared: false,
};

const meta = {
  categories: [{ id: 5, name: "UI/UX Design" }],
  skills: [
    { id: 1, name: "Figma" },
    { id: 2, name: "React" },
  ],
};

beforeEach(() => {
  mockedFetch.mockResolvedValue({ ok: true, data: {} });
  // jsdom does not implement scrolling; the flow scrolls to the top per step.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<MySpaceChecklist />", () => {
  it("links every unfinished item to its onboarding step", () => {
    render(
      <MySpaceChecklist
        checklist={getOnboardingChecklist({ ...newcomer, publishedProjectsCount: 1 })}
        usernameHint={uk.mySpace.usernameTemporary}
        dictionary={uk}
      />,
    );

    expect(screen.getByText("Зроблено 1 з 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Розкажіть, хто ви/ })).toHaveAttribute(
      "href",
      "/uk/onboarding?step=profile",
    );
    // The nick hint replaces the generic one on the profile item.
    expect(screen.getByText(uk.mySpace.usernameTemporary)).toBeInTheDocument();
    // A finished item is plain text, not a link.
    expect(screen.queryByRole("link", { name: /Опублікуйте перший проєкт/ })).toBeNull();
    expect(screen.getByText("Опублікуйте перший проєкт")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Поділіться портфоліо/ })).toHaveAttribute(
      "href",
      "/uk/onboarding?step=share",
    );
  });

  it("disappears once everything is done", () => {
    const { container } = render(
      <MySpaceChecklist
        checklist={getOnboardingChecklist({
          username: "olena.koval",
          email: "olena@example.com",
          name: "Olena",
          categoryId: 5,
          skillsCount: 3,
          publishedProjectsCount: 1,
          linkShared: true,
        })}
        usernameHint={null}
        dictionary={uk}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("<OnboardingProfileStep />", () => {
  const initial = {
    name: "",
    username: "user-ab12cd",
    usernameIsTemporary: true,
    categoryId: null,
    skillIds: [],
  };

  it("suggests a nick from the name while the nick is untouched", async () => {
    const user = userEvent.setup();
    render(<OnboardingProfileStep initial={initial} meta={meta} onDone={vi.fn()} onSkip={vi.fn()} />);

    await user.type(screen.getByLabelText("Ім'я"), "Олена Коваль");
    expect(screen.getByLabelText("Нік")).toHaveValue("olena.koval");

    await user.clear(screen.getByLabelText("Нік"));
    await user.type(screen.getByLabelText("Нік"), "olenka");
    await user.type(screen.getByLabelText("Ім'я"), "!");
    expect(screen.getByLabelText("Нік")).toHaveValue("olenka");
  });

  it("flags an invalid nick and blocks saving", async () => {
    const user = userEvent.setup();
    render(<OnboardingProfileStep initial={initial} meta={meta} onDone={vi.fn()} onSkip={vi.fn()} />);

    await user.type(screen.getByLabelText("Нік"), "a b");
    expect(screen.getByText(uk.onboarding.profile.usernameInvalid)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: uk.onboarding.saveAndNext })).toBeDisabled();
  });

  it("saves the step and moves on", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<OnboardingProfileStep initial={initial} meta={meta} onDone={onDone} onSkip={vi.fn()} />);

    await user.type(screen.getByLabelText("Ім'я"), "Olena Koval");
    await user.click(screen.getByRole("button", { name: uk.onboarding.saveAndNext }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const patch = mockedFetch.mock.calls.find(([url, options]) => url === "/api/onboarding" && options?.method === "PATCH");
    expect(patch?.[1]?.body).toEqual({
      name: "Olena Koval",
      username: "olena.koval",
      category_id: null,
      skill_ids: [],
    });
  });

  it("keeps the current nick when the field is left empty", async () => {
    const user = userEvent.setup();
    render(<OnboardingProfileStep initial={initial} meta={meta} onDone={vi.fn()} onSkip={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: uk.onboarding.saveAndNext }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        "/api/onboarding",
        expect.objectContaining({ body: expect.objectContaining({ username: "user-ab12cd" }) }),
      ),
    );
  });

  it("shows a taken nick when saving hits a conflict", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    mockedFetch.mockImplementation(async (url, options) =>
      url === "/api/onboarding" && options?.method === "PATCH"
        ? { ok: false, error: "taken", status: 409 }
        : { ok: true, data: { valid: true, available: true } },
    );
    render(
      <OnboardingProfileStep
        initial={{ ...initial, name: "Olena", username: "olena.dev", usernameIsTemporary: false }}
        meta={meta}
        onDone={onDone}
        onSkip={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText("Нік"));
    await user.type(screen.getByLabelText("Нік"), "olena");
    await user.click(screen.getByRole("button", { name: uk.onboarding.saveAndNext }));

    expect(await screen.findByText(uk.onboarding.profile.usernameTaken)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("skips without saving", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<OnboardingProfileStep initial={initial} meta={meta} onDone={vi.fn()} onSkip={onSkip} />);

    await user.click(screen.getByRole("button", { name: uk.onboarding.skip }));
    expect(onSkip).toHaveBeenCalled();
    expect(mockedFetch).not.toHaveBeenCalledWith("/api/onboarding", expect.anything());
  });
});

describe("<OnboardingFlow />", () => {
  const completeness = getProfileCompletenessBreakdown({
    username: "user-ab12cd",
    name: null,
    avatarUrl: null,
    headline: null,
    bio: null,
    countryId: null,
    city: null,
    website: null,
    github: null,
    twitter: null,
    linkedin: null,
    behance: null,
    dribbble: null,
    artstation: null,
    vimeo: null,
    youtube: null,
    instagram: null,
    hasPrivateContact: false,
    telegramUsername: null,
    preferredContactMethod: null,
    experienceLevel: null,
    experienceYears: null,
    openToCount: 0,
    additionalInfo: null,
    skillsCount: 0,
    languagesCount: 0,
    educationCount: 0,
    certificateCount: 0,
    qaCount: 0,
    workExperienceCount: 0,
  });

  function renderFlow(initialStep: "profile" | "project" | "share" = "profile") {
    return render(
      <ToastProvider>
        <OnboardingFlow
          initialStep={initialStep}
          checklist={getOnboardingChecklist(newcomer)}
          completeness={completeness}
          profile={{
            name: "",
            username: "user-ab12cd",
            usernameIsTemporary: true,
            categoryId: null,
            skillIds: [],
          }}
          meta={meta}
          profileUrl="https://searchtalent.dev/u/user-ab12cd"
          openTo={{ value: [], updatedAt: null }}
          codeImportAvailable
          hasPublishedProject={false}
        />
      </ToastProvider>,
    );
  }

  it("moves between steps and keeps the step in the URL", async () => {
    const user = userEvent.setup();
    renderFlow();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(uk.onboarding.profile.title);
    await user.click(screen.getByRole("button", { name: uk.onboarding.skip }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(uk.onboarding.project.title);
    expect(window.location.search).toBe("?step=project");
    expect(screen.getByText("Крок 2 з 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /GitHub або GitLab/ })).toHaveAttribute(
      "href",
      "/uk/projects/new?kind=code&from=onboarding&step=2",
    );

    await user.click(screen.getByRole("button", { name: uk.onboarding.steps.share }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(uk.onboarding.share.title);
    // A temporary nick and an empty portfolio both get a pointer back.
    expect(screen.getByText(uk.onboarding.share.temporaryNickNote)).toBeInTheDocument();
    expect(screen.getByText(uk.onboarding.share.emptyNote)).toBeInTheDocument();
  });

  it("records the first share only once", async () => {
    const user = userEvent.setup();
    renderFlow("share");

    await user.click(screen.getByRole("link", { name: /LinkedIn/ }));
    await user.click(screen.getByRole("link", { name: /Telegram/ }));

    const shared = mockedFetch.mock.calls.filter(
      ([url, options]) =>
        url === "/api/onboarding" &&
        (options?.body as { action?: string } | undefined)?.action === "link_shared",
    );
    expect(shared).toHaveLength(1);
  });

  it("finishing later marks the onboarding done and opens My Space", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: uk.onboarding.later }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/uk/my-space"));
    expect(mockedFetch).toHaveBeenCalledWith("/api/onboarding", {
      method: "POST",
      body: { action: "completed" },
    });
  });
});
