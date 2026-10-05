// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

import TrashItemActions from "@/components/admin/trash-item-actions";
import { apiFetch } from "@/lib/api-client";
import { dictionaries } from "@/lib/i18n/dictionaries";

const copy = dictionaries.uk.admin.trash;
const labels = {
  restore: copy.restore,
  restoring: copy.restoring,
  erase: copy.erase,
  erasing: copy.erasing,
  restoreTitle: copy.restoreTitle,
  restoreMessage: copy.restoreMessage,
  restoreAccountMessage: copy.restoreAccountMessage,
  eraseTitle: copy.eraseTitle,
  eraseMessage: copy.eraseMessage,
  eraseAccountMessage: copy.eraseAccountMessage,
  cancel: copy.cancel,
  errors: copy.errors,
};
const GROUP = "22222222-2222-4222-8222-222222222222";
const mockedFetch = vi.mocked(apiFetch);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TrashItemActions", () => {
  it("asks before restoring, then restores and refreshes the list", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: {} });
    render(<TrashItemActions groupId={GROUP} isAccount={false} labels={labels} />);

    await userEvent.click(screen.getByRole("button", { name: copy.restore }));
    expect(screen.getByText(copy.restoreMessage)).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalled();

    const buttons = screen.getAllByRole("button", { name: copy.restore });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(mockedFetch).toHaveBeenCalledWith(`/api/admin/trash/${GROUP}`, { method: "POST" });
  });

  it("warns that erasing an account is final", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: {} });
    render(<TrashItemActions groupId={GROUP} isAccount labels={labels} />);

    await userEvent.click(screen.getByRole("button", { name: copy.erase }));
    expect(screen.getByText(copy.eraseAccountMessage)).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: copy.erase });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith(`/api/admin/trash/${GROUP}`, { method: "DELETE" }));
  });

  it("explains a failed restore in plain words and keeps the dialog open", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "conflict", status: 409, code: "conflict" });
    render(<TrashItemActions groupId={GROUP} isAccount={false} labels={labels} />);

    await userEvent.click(screen.getByRole("button", { name: copy.restore }));
    const buttons = screen.getAllByRole("button", { name: copy.restore });
    await userEvent.click(buttons[buttons.length - 1]);
    expect(await screen.findByText(copy.errors.conflict)).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("falls back to a generic message and can be cancelled", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "boom", status: 500 });
    render(<TrashItemActions groupId={GROUP} isAccount labels={labels} />);

    await userEvent.click(screen.getByRole("button", { name: copy.restore }));
    expect(screen.getByText(copy.restoreAccountMessage)).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: copy.restore });
    await userEvent.click(buttons[buttons.length - 1]);
    expect(await screen.findByText(copy.errors.failed)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: copy.cancel }));
    expect(screen.queryByText(copy.errors.failed)).not.toBeInTheDocument();
  });
});
