// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RichTextComposer from "@/components/rich-text-composer";

function renderEditor(
  features?: Partial<{ headings: boolean; divider: boolean; lists: boolean }>,
) {
  return render(
    <RichTextComposer
      locale="uk"
      value=""
      onChange={vi.fn()}
      placeholder="Текст"
      features={features}
    />,
  );
}

/** The "+" toolbar button has no label of its own — it is the only "+" there. */
async function openBlockMenu() {
  const user = userEvent.setup();
  const trigger = screen
    .getAllByRole("button")
    .find((button) => button.textContent?.trim() === "+");

  expect(trigger).toBeDefined();
  await user.click(trigger!);
}

describe("RichTextComposer block menu features", () => {
  afterEach(cleanup);

  it("offers headings and a divider by default", async () => {
    renderEditor();
    await openBlockMenu();

    expect(screen.getByText("Заголовок 2")).toBeInTheDocument();
    expect(screen.getByText("Заголовок 3")).toBeInTheDocument();
    expect(screen.getByText("Заголовок 4")).toBeInTheDocument();
    expect(screen.getByText("Роздільник")).toBeInTheDocument();
  });

  it("drops headings and the divider without taking quotes or spoilers with them", async () => {
    renderEditor({ headings: false, divider: false });
    await openBlockMenu();

    expect(screen.queryByText("Заголовок 2")).toBeNull();
    expect(screen.queryByText("Заголовок 3")).toBeNull();
    expect(screen.queryByText("Заголовок 4")).toBeNull();
    expect(screen.queryByText("Роздільник")).toBeNull();

    // The rest of the "+" menu must survive — this is the reason the flags were
    // split out of the coarse `blocks` toggle in the first place.
    expect(screen.getByText("Параграф")).toBeInTheDocument();
    expect(screen.getByText("Цитата")).toBeInTheDocument();
    expect(screen.getByText("Спойлер")).toBeInTheDocument();
    expect(screen.getByText("Маркований список")).toBeInTheDocument();
  });

  it("offers both list kinds as toggles, with the typing shortcut spelled out", async () => {
    renderEditor();
    await openBlockMenu();

    const bulleted = screen.getByRole("button", { name: /Маркований список/ });
    const numbered = screen.getByRole("button", { name: /Нумерований список/ });

    // Nothing is focused yet, so neither list is the active one.
    expect(bulleted).toHaveAttribute("aria-pressed", "false");
    expect(numbered).toHaveAttribute("aria-pressed", "false");

    // Tab-to-nest and the "- " / "1. " shortcuts have no visible affordance of
    // their own, so the menu says them out loud.
    expect(
      screen.getByText(/Tab — вкладений рівень/),
    ).toBeInTheDocument();
  });

  it("drops the list entries when the surface disables lists", async () => {
    renderEditor({ lists: false });
    await openBlockMenu();

    expect(screen.queryByText("Маркований список")).toBeNull();
    expect(screen.queryByText("Нумерований список")).toBeNull();
    expect(screen.getByText("Параграф")).toBeInTheDocument();
  });
});
