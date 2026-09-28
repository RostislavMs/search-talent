// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/uk/u/olena",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

import CreatorCard from "@/components/creator-card";
import OpenToCard from "@/components/open-to-card";
import OpenToPicker from "@/components/open-to-picker";
import ProfileContactButton, {
  orderContactChannels,
  type ProfileContactInfo,
} from "@/components/profile-contact-button";
import { ToastProvider } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { OpenToOption } from "@/lib/open-to";

const uk = dictionaries.uk;
const mockedFetch = vi.mocked(apiFetch);

const contact: ProfileContactInfo = {
  profileId: "33333333-3333-4333-8333-333333333333",
  displayName: "Олена Коваль",
  telegram: "@olena_k",
  linkedin: "https://www.linkedin.com/in/olena",
  website: null,
  preferred: "email",
  hasEmail: true,
  hasPhone: true,
  openToLine: "Відкрито до: фрилансу",
  workFormatsLine: "Формат роботи: Віддалено",
};

beforeEach(() => {
  mockedFetch.mockResolvedValue({
    ok: true,
    data: { email: "olena@example.com", phone: "+380501112233" },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("orderContactChannels", () => {
  it("puts the preferred channel first", () => {
    expect(orderContactChannels(["email", "telegram", "linkedin"], "telegram")).toEqual([
      "telegram",
      "email",
      "linkedin",
    ]);
  });

  it("ignores a preference the author has no value for", () => {
    expect(orderContactChannels(["telegram", "email"], "phone")).toEqual(["email", "telegram"]);
  });
});

describe("<ProfileContactButton />", () => {
  it("a guest sees the public channels and a sign-in note instead of email and phone", async () => {
    render(<ProfileContactButton contact={contact} isAuthenticated={false} />);

    await userEvent.click(screen.getByRole("button", { name: uk.openTo.contact }));

    const dialog = screen.getByRole("dialog", { name: "Зв'язатися: Олена Коваль" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("@olena_k")).toBeInTheDocument();
    expect(screen.getByText(uk.openTo.privateSignIn)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: uk.openTo.signIn })).toHaveAttribute(
      "href",
      expect.stringContaining("/uk/login?next="),
    );
    expect(screen.getByText("Відкрито до: фрилансу")).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(screen.queryByText("olena@example.com")).toBeNull();
  });

  it("a signed-in visitor gets email and phone from the server once", async () => {
    render(<ProfileContactButton contact={contact} isAuthenticated />);

    const trigger = screen.getByRole("button", { name: uk.openTo.contact });
    await userEvent.click(trigger);

    expect(await screen.findByRole("link", { name: "olena@example.com" })).toHaveAttribute(
      "href",
      "mailto:olena@example.com",
    );
    expect(screen.getByRole("link", { name: "+380501112233" })).toHaveAttribute(
      "href",
      "tel:+380501112233",
    );
    expect(mockedFetch).toHaveBeenCalledWith("/api/profile-contacts", {
      method: "POST",
      body: { profileId: contact.profileId },
    });
    // The preferred channel is marked.
    expect(screen.getByText(uk.openTo.preferred)).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("asks the server even without email or phone, so the opening is counted", async () => {
    mockedFetch.mockResolvedValue({ ok: true, data: { email: null, phone: null } });
    render(
      <ProfileContactButton
        contact={{ ...contact, hasEmail: false, hasPhone: false }}
        isAuthenticated
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: uk.openTo.contact }));

    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(uk.openTo.privateSignIn)).toBeNull();
  });

  it("explains the cap when too many contacts were opened", async () => {
    mockedFetch.mockResolvedValue({ ok: false, error: "Too many", status: 429 });
    render(<ProfileContactButton contact={contact} isAuthenticated />);

    await userEvent.click(screen.getByRole("button", { name: uk.openTo.contact }));

    expect(await screen.findByText(uk.openTo.rateLimited)).toBeInTheDocument();
  });

  it("offers a retry when loading failed", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "Network", status: 0 });
    render(<ProfileContactButton contact={contact} isAuthenticated />);

    await userEvent.click(screen.getByRole("button", { name: uk.openTo.contact }));
    await userEvent.click(await screen.findByRole("button", { name: uk.openTo.retry }));

    expect(await screen.findByRole("link", { name: "olena@example.com" })).toBeInTheDocument();
  });
});

function ControlledPicker({ initial = [] as OpenToOption[], onChange = vi.fn() }) {
  const [value, setValue] = useState<OpenToOption[]>(initial);
  return (
    <OpenToPicker
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

describe("<OpenToPicker />", () => {
  it("turns on in two clicks: the switch, then an option", async () => {
    const onChange = vi.fn();
    render(<ControlledPicker onChange={onChange} />);

    const toggle = screen.getByRole("switch", { name: uk.openTo.toggle });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("button", { name: /Фриланс/ })).toBeNull();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(uk.openTo.pickOne)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Фриланс/ }));
    expect(onChange).toHaveBeenLastCalledWith(["freelance"]);
    expect(screen.getByRole("button", { name: /Фриланс/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the canonical order and switches off by clearing", async () => {
    const onChange = vi.fn();
    render(<ControlledPicker initial={["mentoring"]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /Фриланс/ }));
    expect(onChange).toHaveBeenLastCalledWith(["freelance", "mentoring"]);

    await userEvent.click(screen.getByRole("switch", { name: uk.openTo.toggle }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole("button", { name: /Фриланс/ })).toBeNull();
  });
});

describe("<OpenToCard />", () => {
  function renderCard(initialOpenTo: OpenToOption[], initialUpdatedAt: string | null) {
    return render(
      <ToastProvider>
        <OpenToCard initialOpenTo={initialOpenTo} initialUpdatedAt={initialUpdatedAt} />
      </ToastProvider>,
    );
  }

  it("saves each change right away", async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      data: { openTo: ["internship"], updatedAt: new Date().toISOString() },
    });
    renderCard([], null);

    await userEvent.click(screen.getByRole("switch", { name: uk.openTo.toggle }));
    await userEvent.click(screen.getByRole("button", { name: /Стажування/ }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith("/api/profile/open-to", {
        method: "PATCH",
        body: { open_to: ["internship"] },
      }),
    );
  });

  it("asks about a two-month-old status and confirms it", async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      data: { openTo: ["freelance"], updatedAt: new Date().toISOString() },
    });
    renderCard(["freelance"], "2026-01-01T00:00:00Z");

    expect(screen.getByText("Досі відкрито до фрилансу?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: uk.openTo.reminderConfirm }));

    expect(mockedFetch).toHaveBeenCalledWith("/api/profile/open-to", {
      method: "PATCH",
      body: { confirm: true },
    });
    await waitFor(() => expect(screen.queryByText("Досі відкрито до фрилансу?")).toBeNull());
  });

  it("does not nag about a fresh status", () => {
    renderCard(["freelance"], new Date().toISOString());
    expect(screen.queryByText(uk.openTo.reminderConfirm)).toBeNull();
  });

  it("rolls back and says so when saving fails", async () => {
    mockedFetch.mockResolvedValue({ ok: false, error: "Nope", status: 400 });
    renderCard(["freelance"], new Date().toISOString());

    await userEvent.click(screen.getByRole("button", { name: /Менторство/ }));

    expect(await screen.findByText(uk.openTo.saveFailed)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Менторство/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("<CreatorCard />", () => {
  it("shows the status line only when the person is open to something", () => {
    const { rerender } = render(
      <CreatorCard
        dictionary={uk}
        creator={{ username: "olena", name: "Олена", openTo: ["job", "freelance"] }}
      />,
    );
    expect(screen.getByText("Відкрито до: фрилансу, роботи")).toBeInTheDocument();

    rerender(<CreatorCard dictionary={uk} creator={{ username: "olena", name: "Олена" }} />);
    expect(screen.queryByText(/Відкрито до/)).toBeNull();
  });
});
