// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn(async () => ({ ok: true, data: { companies: [] } })) }));

import type { CompanyOption } from "@/components/company-picker";
import ProjectContextFields, {
  type ProjectContextValue,
} from "@/components/project-form/project-context-fields";
import { dictionaries } from "@/lib/i18n/dictionaries";

const uk = dictionaries.uk;
const ui = uk.projectContext;

function Harness({ initial }: { initial: Partial<ProjectContextValue> }) {
  const [value, setValue] = useState<ProjectContextValue>({
    origin: "",
    clientName: "",
    clientNda: false,
    budgetAmount: "",
    budgetCurrency: "usd",
    budgetType: "fixed",
    budgetPublic: false,
    ...initial,
  });
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  return (
    <ProjectContextFields
      dictionary={uk}
      value={value}
      onChange={(field, next) => setValue((current) => ({ ...current, [field]: next }))}
      companies={companies}
      onCompaniesChange={setCompanies}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe("<ProjectContextFields />", () => {
  it("shows only the company pages for personal work", () => {
    render(<Harness initial={{ origin: "personal" }} />);
    expect(screen.queryByLabelText(ui.clientLabel)).toBeNull();
    expect(screen.queryByText(ui.budget)).toBeNull();
    expect(screen.getByLabelText(ui.companies)).toBeInTheDocument();
  });

  it("asks for the client, the NDA and the budget for client work", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ origin: "client" }} />);

    expect(screen.getByLabelText(ui.clientLabel)).toBeInTheDocument();
    expect(screen.getByText(ui.nda)).toBeInTheDocument();
    const showBudget = screen.getByRole("checkbox", { name: ui.budgetPublic });
    expect(showBudget).toBeDisabled();

    await user.type(screen.getByLabelText(ui.budgetAmount), "8a0 00");
    expect(screen.getByLabelText(ui.budgetAmount)).toHaveValue(8000);
    expect(showBudget).toBeEnabled();
    expect(showBudget).not.toBeChecked();

    // Under an NDA the name is not asked for (it would not be saved).
    await user.click(screen.getByRole("checkbox", { name: new RegExp(ui.nda.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }));
    expect(screen.queryByLabelText(ui.clientLabel)).toBeNull();
  });

  it("names the company, not the client, for job work, without a budget", () => {
    render(<Harness initial={{ origin: "job" }} />);
    expect(screen.getByLabelText(ui.companyLabel)).toBeInTheDocument();
    expect(screen.queryByText(ui.budget)).toBeNull();
  });
});
