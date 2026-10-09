// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { auth, client } = vi.hoisted(() => {
  const auth = {
    verifyOtp: vi.fn(),
    updateUser: vi.fn(),
    getSession: vi.fn(),
    setSession: vi.fn(),
    exchangeCodeForSession: vi.fn(),
  };
  return { auth, client: { auth } };
});

// The browser client is a singleton, so the page's effect runs once.
vi.mock("@/lib/supabase/client", () => ({ createClient: () => client }));
vi.mock("@/lib/i18n/client", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  const dictionary = getDictionary("en");
  return {
    useDictionary: () => dictionary,
    useLocalizedRouter: () => ({ locale: "en" }),
  };
});
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  ButtonLink: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import ResetPasswordPage from "@/app/(auth)/reset-password/page";

const NEW_PASSWORD = "NewPassw0rd";

function openPage(search: string) {
  window.history.replaceState(null, "", `/en/reset-password${search}`);
  render(<ResetPasswordPage />);
}

async function submitNewPassword() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Password"), NEW_PASSWORD);
  await user.type(screen.getByLabelText("Confirm password"), NEW_PASSWORD);
  await user.click(screen.getByRole("button", { name: "Save new password" }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("reset password page", () => {
  it("does not sign in on opening the email link, only on saving the password", async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    openPage("?token_hash=th");

    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.getSession).not.toHaveBeenCalled();

    await submitNewPassword();

    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "th" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: NEW_PASSWORD });
    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/api/auth/continue?locale=en",
    );
  });

  it("shows the expired screen when the token no longer works", async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { message: "expired" } });
    openPage("?token_hash=used");

    await submitNewPassword();

    expect(await screen.findByText(/has expired or is invalid/)).toBeInTheDocument();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("asks for a different password and retries without the used token", async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    auth.updateUser.mockResolvedValueOnce({
      data: {},
      error: { code: "same_password", message: "same" },
    });
    openPage("?token_hash=th");

    await submitNewPassword();
    expect(
      await screen.findByText("This is your current password. Choose a different one."),
    ).toBeInTheDocument();

    auth.updateUser.mockResolvedValueOnce({ data: {}, error: null });
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));

    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(auth.updateUser).toHaveBeenCalledTimes(2);
  });

  it("shows the expired screen straight away for a failed older link", async () => {
    openPage("?status=expired");

    expect(await screen.findByText(/has expired or is invalid/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("exchanges the code from an older link only when the password is saved", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    openPage("?recovery_code=abc");

    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();

    await submitNewPassword();

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(await screen.findByText("Password updated")).toBeInTheDocument();
  });

  it("does not let a signed-in visitor set a password without a link", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "u" } } } });
    openPage("");

    expect(await screen.findByText(/has expired or is invalid/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
