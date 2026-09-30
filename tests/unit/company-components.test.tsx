// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/uk/companies/new",
  useRouter: () => router,
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/storage/upload-with-progress", () => ({ uploadWithProgress: vi.fn(async () => undefined) }));

import CompanyForm from "@/components/company-form";
import CompanyInvitations from "@/components/company-invitations";
import CompanyProjectsManager from "@/components/company-projects-manager";
import CompanyTeamManager from "@/components/company-team-manager";
import CompanyVerificationCard from "@/components/company-verification-card";
import { ToastProvider } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import type { CompanyDetails, CompanyInvitation, CompanyMember } from "@/lib/companies";
import { dictionaries } from "@/lib/i18n/dictionaries";

const uk = dictionaries.uk.companies;
const mockedFetch = vi.mocked(apiFetch);
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";

function withToasts(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

const company: CompanyDetails = {
  id: COMPANY_ID,
  slug: "acme",
  name: "Acme",
  type: "company",
  logoUrl: null,
  verified: true,
  moderationStatus: "approved",
  description: "We build things",
  website: "https://acme.com",
  size: "11-50",
  countryId: null,
  countryName: null,
  city: "Kyiv",
  verifiedAt: "2026-09-30T00:00:00Z",
  verificationMethod: "email_domain",
  createdAt: "2026-09-30T00:00:00Z",
  updatedAt: "2026-09-30T00:00:00Z",
};

beforeEach(() => {
  mockedFetch.mockResolvedValue({ ok: true, data: { company: { id: COMPANY_ID, slug: "acme" } } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<CompanyForm /> creating a page", () => {
  it("fills the address from the name until it is edited by hand", async () => {
    const user = userEvent.setup();
    withToasts(<CompanyForm countries={[]} siteHost="searchtalent.test" />);

    await user.type(screen.getByLabelText(uk.form.name), "Студія Ромашка");
    const slug = screen.getByLabelText(uk.form.slug) as HTMLInputElement;
    expect(slug.value).toBe("studiya-romashka");

    await user.clear(slug);
    await user.type(slug, "romashka");
    await user.type(screen.getByLabelText(uk.form.name), " UA");
    expect(slug.value).toBe("romashka");
  });

  it("shows field errors instead of sending an invalid page", async () => {
    const user = userEvent.setup();
    withToasts(<CompanyForm countries={[]} siteHost="searchtalent.test" />);

    await user.type(screen.getByLabelText(uk.form.name), "A");
    await user.type(screen.getByLabelText(uk.form.website), "not a site");
    await user.click(screen.getByRole("button", { name: uk.form.create }));

    expect(screen.getByText(uk.form.errors.nameShort)).toBeInTheDocument();
    expect(screen.getByText(uk.form.errors.websiteInvalid)).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("creates the page and opens its editor", async () => {
    const user = userEvent.setup();
    withToasts(<CompanyForm countries={[]} siteHost="searchtalent.test" />);

    await user.type(screen.getByLabelText(uk.form.name), "Acme");
    await user.type(screen.getByLabelText(uk.form.website), "acme.com");
    await user.click(screen.getByRole("button", { name: uk.form.create }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/uk/companies/edit/${COMPANY_ID}`));
    expect(mockedFetch).toHaveBeenCalledWith("/api/companies", {
      method: "POST",
      body: expect.objectContaining({ name: "Acme", slug: "acme", website: "acme.com", type: "company" }),
    });
  });

  it("points at the address field when it is taken", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "dup", status: 409, code: "slug_taken" });
    withToasts(<CompanyForm countries={[]} siteHost="searchtalent.test" />);

    await user.type(screen.getByLabelText(uk.form.name), "Acme");
    await user.click(screen.getByRole("button", { name: uk.form.create }));

    expect(await screen.findAllByText(uk.form.errors.slugTaken)).not.toHaveLength(0);
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("<CompanyForm /> editing a page", () => {
  it("warns that a verified page loses the mark on a new name or site", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      data: { company: { id: COMPANY_ID, slug: "acme" }, verificationLost: true },
    });
    withToasts(<CompanyForm company={company} countries={[]} siteHost="searchtalent.test" verified />);

    expect(screen.getByText(uk.form.renameWarning)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(uk.form.name));
    await user.type(screen.getByLabelText(uk.form.name), "Acme Two");
    await user.click(screen.getByRole("button", { name: uk.form.save }));

    expect(await screen.findByText(uk.form.verificationLost)).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledWith(`/api/companies/${COMPANY_ID}`, {
      method: "PATCH",
      body: expect.objectContaining({ name: "Acme Two", slug: "acme" }),
    });
    expect(router.refresh).toHaveBeenCalled();
  });
});

const member = (patch: Partial<CompanyMember>): CompanyMember => ({
  memberId: "m1",
  userId: "u1",
  username: "olena",
  name: "Олена",
  avatarUrl: null,
  headline: null,
  role: "owner",
  status: "accepted",
  invitedAt: "2026-09-30",
  ...patch,
});

describe("<CompanyTeamManager />", () => {
  const team = [
    member({}),
    member({ memberId: "m2", userId: "u2", username: "ivan", name: "Іван", role: "recruiter" }),
    member({ memberId: "m3", userId: "u3", username: "petro", name: "Петро", role: "admin", status: "pending" }),
  ];

  it("gives the only owner role controls and invitations but no way to leave", () => {
    withToasts(
      <CompanyTeamManager companyId={COMPANY_ID} companyName="Acme" viewerUserId="u1" viewerRole="owner" members={team} />,
    );
    expect(screen.getByText(uk.team.invite)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: uk.team.cancelInvite })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: uk.team.remove })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: uk.team.leave })).not.toBeInTheDocument();
  });

  it("lets a recruiter only see the team and leave it", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { success: true } });
    withToasts(
      <CompanyTeamManager companyId={COMPANY_ID} companyName="Acme" viewerUserId="u2" viewerRole="recruiter" members={team} />,
    );
    expect(screen.queryByText(uk.team.invite)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: uk.team.remove })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: uk.team.leave }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(uk.team.leaveTitle.replace("{company}", "Acme"));
    await user.click(screen.getAllByRole("button", { name: uk.team.leave }).at(-1)!);

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(`/api/companies/${COMPANY_ID}/members/m2`, { method: "DELETE" }),
    );
    expect(router.push).toHaveBeenCalledWith("/uk/my-space/companies");
  });

  it("shows the refusal from the server in plain words", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 409, code: "last_owner" });
    withToasts(
      <CompanyTeamManager companyId={COMPANY_ID} companyName="Acme" viewerUserId="u1" viewerRole="owner" members={team} />,
    );
    await user.click(screen.getByRole("button", { name: uk.team.remove }));
    await user.click(screen.getAllByRole("button", { name: uk.team.remove }).at(-1)!);
    expect(await screen.findByText(uk.team.errors.last_owner)).toBeInTheDocument();
  });
});

describe("<CompanyVerificationCard />", () => {
  const props = {
    companyId: COMPANY_ID,
    verified: false,
    method: null,
    websiteHost: "acme.com",
  } as const;

  it("offers one click when the sign-in email is on the domain, and another address on request", async () => {
    const user = userEvent.setup();
    withToasts(<CompanyVerificationCard {...props} accountCheck={{ ok: true, domain: "acme.com" }} />);

    expect(
      screen.getByRole("button", { name: uk.verification.button.replace("{domain}", "acme.com") }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(uk.verification.workEmailLabel.replace("{host}", "acme.com"))).toBeNull();

    await user.click(screen.getByRole("button", { name: uk.verification.otherEmail }));
    expect(screen.getByLabelText(uk.verification.workEmailLabel.replace("{host}", "acme.com"))).toBeInTheDocument();
  });

  it("sends a code to a work address and confirms it", async () => {
    const user = userEvent.setup();
    mockedFetch
      .mockResolvedValueOnce({ ok: true, data: { sent: true, domain: "acme.com" } })
      .mockResolvedValueOnce({ ok: true, data: { verified: true } });
    withToasts(<CompanyVerificationCard {...props} accountCheck={{ ok: false, reason: "public_email" }} />);

    await user.type(screen.getByLabelText(uk.verification.workEmailLabel.replace("{host}", "acme.com")), "Jane@Acme.com");
    await user.click(screen.getByRole("button", { name: uk.verification.sendCode }));

    expect(mockedFetch).toHaveBeenCalledWith(`/api/companies/${COMPANY_ID}/verify/code`, {
      method: "POST",
      body: { email: "jane@acme.com" },
    });
    expect(await screen.findByText(uk.verification.codeSent.replace("{email}", "jane@acme.com"))).toBeInTheDocument();

    await user.type(screen.getByLabelText(uk.verification.codeLabel), "12a3456");
    await user.click(screen.getByRole("button", { name: uk.verification.confirm }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenLastCalledWith(`/api/companies/${COMPANY_ID}/verify`, {
        method: "POST",
        body: { code: "123456" },
      }),
    );
    expect(await screen.findByText(uk.verification.success)).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("explains a refused address with the address and the site", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 400, code: "mismatch" });
    withToasts(<CompanyVerificationCard {...props} accountCheck={{ ok: false, reason: "mismatch" }} />);

    await user.type(screen.getByLabelText(uk.verification.workEmailLabel.replace("{host}", "acme.com")), "jane@acme.io");
    await user.click(screen.getByRole("button", { name: uk.verification.sendCode }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      uk.verification.reasons.mismatch.replace("{email}", "jane@acme.io").replace("{host}", "acme.com"),
    );
  });

  it("sends schools to us instead of offering a form", () => {
    withToasts(<CompanyVerificationCard {...props} accountCheck={{ ok: false, reason: "school" }} />);
    expect(screen.queryByRole("button", { name: uk.verification.sendCode })).toBeNull();
    expect(screen.getByRole("link", { name: new RegExp(uk.verification.contact) })).toHaveAttribute(
      "href",
      "/uk/contacts",
    );
  });
});

describe("<CompanyProjectsManager />", () => {
  const projects = [
    { id: "p1", title: "Мій проєкт", slug: "my", ownerId: "u1", ownerName: "Олена", ownerUsername: "olena", status: "approved" as const, confirmed: false },
    { id: "p2", title: "Чужий проєкт", slug: "their", ownerId: "u2", ownerName: "Іван", ownerUsername: "ivan", status: "approved" as const, confirmed: true },
    { id: "p4", title: "Запит фрилансера", slug: "request", ownerId: "u5", ownerName: "Марта", ownerUsername: "marta", status: "pending" as const, confirmed: false },
  ];

  it("lets a recruiter take off only their own project and add another", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { success: true } });
    withToasts(
      <CompanyProjectsManager
        companyId={COMPANY_ID}
        viewerUserId="u1"
        canManage={false}
        isMember
        projects={projects}
        attachable={[{ id: "p3", title: "Новий" }]}
      />,
    );

    expect(screen.getAllByRole("button", { name: uk.projects.remove })).toHaveLength(1);
    // Recruiters neither confirm nor see requests.
    expect(screen.queryByRole("button", { name: uk.projects.confirm })).toBeNull();
    expect(screen.queryByText("Запит фрилансера")).toBeNull();
    await user.click(screen.getByRole("button", { name: uk.projects.pick }));
    await user.click(screen.getByRole("option", { name: "Новий" }));
    await user.click(screen.getByRole("button", { name: uk.projects.add }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(`/api/companies/${COMPANY_ID}/projects`, {
        method: "POST",
        body: { projectId: "p3" },
      }),
    );
  });

  it("lets owners and admins take off any project", () => {
    withToasts(
      <CompanyProjectsManager
        companyId={COMPANY_ID}
        viewerUserId="u9"
        canManage
        isMember
        projects={projects}
        attachable={[]}
      />,
    );
    expect(screen.getAllByRole("button", { name: uk.projects.remove })).toHaveLength(2);
    expect(screen.getByText(uk.projects.noneToAdd)).toBeInTheDocument();
  });

  it("lets a manager accept a request and confirm others' work, but not their own", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({ ok: true, data: { success: true } });
    withToasts(
      <CompanyProjectsManager
        companyId={COMPANY_ID}
        viewerUserId="u2"
        canManage
        isMember
        projects={[...projects, { ...projects[0], id: "p3", title: "Мій власний", ownerId: "u2", confirmed: false }]}
        attachable={[]}
      />,
    );

    expect(screen.getByText(uk.projects.requests)).toBeInTheDocument();
    expect(screen.getByText("Запит фрилансера")).toBeInTheDocument();
    // p1 is someone else's and unconfirmed; p2 is confirmed; p3 is the viewer's own.
    expect(screen.getAllByRole("button", { name: uk.projects.confirm })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: uk.projects.accept }));
    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(`/api/companies/${COMPANY_ID}/projects/p4`, { method: "POST" }),
    );

    await user.click(screen.getByRole("button", { name: uk.projects.decline }));
    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(`/api/companies/${COMPANY_ID}/projects/p4`, { method: "DELETE" }),
    );
  });
});

describe("<CompanyInvitations />", () => {
  const invitation: CompanyInvitation = {
    memberId: "m9",
    role: "recruiter",
    invitedAt: "2026-09-30",
    company: { id: COMPANY_ID, slug: "acme", name: "Acme", logoUrl: null, verified: false },
    inviter: { userId: "u1", username: "olena", name: "Олена", avatarUrl: null },
  };

  it("renders nothing without invitations", () => {
    const { container } = withToasts(<CompanyInvitations initialInvitations={[]} />);
    expect(container.querySelector("section")).toBeNull();
  });

  it("accepts an invitation and drops it from the list", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { status: "accepted" } });
    withToasts(<CompanyInvitations initialInvitations={[invitation]} />);

    expect(screen.getByText("Олена")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acme" })).toHaveAttribute("href", "/uk/companies/acme");
    await user.click(screen.getByRole("button", { name: uk.invitations.accept }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith("/api/company-invitations/m9", {
        method: "PATCH",
        body: { action: "accept" },
      }),
    );
    expect(await screen.findByText(uk.invitations.accepted)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: uk.invitations.accept })).not.toBeInTheDocument();
  });
});
