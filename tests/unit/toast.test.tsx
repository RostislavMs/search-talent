// @vitest-environment jsdom
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ToastProvider, useToast } from "@/components/ui/toast";

// Mirrors the constants in the component: 5s on screen, 300ms slide-out.
const DURATION_MS = 5000;
const EXIT_MS = 300;

function ShowOnMount({ message }: { message: string }) {
  const toast = useToast();

  useEffect(() => {
    toast.show(message);
  }, [toast, message]);

  return null;
}

function renderToast(message = "Saved") {
  return render(
    <ToastProvider>
      <ShowOnMount message={message} />
    </ToastProvider>,
  );
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

// React derives onPointerEnter/onPointerLeave from pointerover/pointerout, so
// those are the events to fire — a raw "pointerenter" never reaches the
// handler. jsdom has no PointerEvent, so `pointerType` is stamped onto a plain
// event. userEvent is avoided here because its pointer sequence deadlocks
// against fake timers.
function firePointer(
  element: HTMLElement,
  type: "pointerover" | "pointerout",
  pointerType: "mouse" | "touch",
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(element, event);
}

function hover(element: HTMLElement) {
  firePointer(element, "pointerover", "mouse");
}

function unhover(element: HTMLElement) {
  firePointer(element, "pointerout", "mouse");
}

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("dismisses itself once the lifetime elapses", async () => {
    renderToast();
    expect(screen.getByText("Saved")).toBeInTheDocument();

    await advance(DURATION_MS + EXIT_MS);

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("keeps the toast on screen while the pointer rests on it", async () => {
    renderToast();

    await advance(3000);
    hover(screen.getByText("Saved"));

    // Well past the lifetime: hovering has to hold the toast in place.
    await advance(DURATION_MS * 2);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("resumes with the time that was left, not a fresh lifetime", async () => {
    renderToast();

    await advance(3000);
    const toast = screen.getByText("Saved");
    hover(toast);
    await advance(DURATION_MS);
    unhover(toast);

    // 2s were left when the pointer arrived — not gone a moment before that.
    await advance(1500);
    expect(screen.getByText("Saved")).toBeInTheDocument();

    await advance(500 + EXIT_MS);
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("does not pause on a touch, which never sends a matching leave", async () => {
    renderToast();

    await advance(3000);
    firePointer(screen.getByText("Saved"), "pointerover", "touch");

    await advance(2000 + EXIT_MS);
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });
});
