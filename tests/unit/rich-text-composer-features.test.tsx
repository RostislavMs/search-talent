// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RichTextComposer from "@/components/rich-text-composer";

function renderEditor(
  features?: Partial<{ headings: boolean; divider: boolean }>,
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
});
