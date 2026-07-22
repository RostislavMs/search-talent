// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes";

// Build an <a> in the document so the capture-phase document click handler sees it.
function anchor(attrs: Record<string, string>): HTMLAnchorElement {
  const a = document.createElement("a");
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  a.textContent = "link";
  document.body.appendChild(a);
  return a;
}

beforeEach(() => {
  document.body.innerHTML = "";
  push.mockReset();
});
afterEach(() => {
  cleanup(); // unmount hooks so their document click listeners are removed
  document.body.innerHTML = "";
});

describe("useUnsavedChangesGuard", () => {
  it("ignores clicks when the form is not dirty", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(false));
    const a = anchor({ href: "/dashboard" });
    fireEvent.click(a);
    expect(result.current.isWarningOpen).toBe(false);
  });

  it("intercepts an internal navigation when dirty", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    const a = anchor({ href: "/dashboard" });
    fireEvent.click(a);
    expect(result.current.isWarningOpen).toBe(true);
  });

  it("does not intercept external links", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    const a = anchor({ href: "https://external.example.com/x" });
    fireEvent.click(a);
    expect(result.current.isWarningOpen).toBe(false);
  });

  it("does not intercept download links or new-tab targets", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    fireEvent.click(anchor({ href: "/file.pdf", download: "" }));
    expect(result.current.isWarningOpen).toBe(false);
    fireEvent.click(anchor({ href: "/other", target: "_blank" }));
    expect(result.current.isWarningOpen).toBe(false);
  });

  it("does not intercept modifier-key (open-in-new-tab) clicks", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    const a = anchor({ href: "/dashboard" });
    fireEvent.click(a, { ctrlKey: true });
    expect(result.current.isWarningOpen).toBe(false);
  });

  it("ignores same-page hash links", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    const a = anchor({ href: "#section" });
    fireEvent.click(a);
    expect(result.current.isWarningOpen).toBe(false);
  });

  it("navigates via router.push on confirm and closes the dialog", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    fireEvent.click(anchor({ href: "/dashboard?tab=1" }));
    expect(result.current.isWarningOpen).toBe(true);

    act(() => result.current.confirmLeave());
    expect(push).toHaveBeenCalledWith("/dashboard?tab=1");
    expect(result.current.isWarningOpen).toBe(false);
  });

  it("closes the dialog without navigating on cancel", () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    fireEvent.click(anchor({ href: "/dashboard" }));
    act(() => result.current.cancelLeave());
    expect(push).not.toHaveBeenCalled();
    expect(result.current.isWarningOpen).toBe(false);
  });
});
