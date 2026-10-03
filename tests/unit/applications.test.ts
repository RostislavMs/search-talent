import { describe, expect, it } from "vitest";
import {
  APPLICATION_LIMITS,
  APPLICATION_STATUSES,
  APPLICATION_TEAM_FILTERS,
  APPLY_REFUSALS,
  APPLY_REFUSAL_HTTP_STATUS,
  MY_APPLICATIONS_PATH,
  TEAM_APPLICATION_STATUSES,
  applicantNoticeFor,
  applicationMatchesTeamFilter,
  buildTeamApplicationsPath,
  countApplicationsByFilter,
  isApplicantNoticeEmailed,
  isApplicationDecided,
  normalizeApplicationStatus,
  parseApplicationTeamFilter,
  resolveApplyState,
  toApplyRefusal,
  type ApplicationStatus,
} from "@/lib/applications";

describe("application statuses", () => {
  it("knows the six statuses and lets the team set four", () => {
    expect(APPLICATION_STATUSES).toEqual(["new", "viewed", "shortlisted", "rejected", "hired", "withdrawn"]);
    expect(TEAM_APPLICATION_STATUSES).toEqual(["viewed", "shortlisted", "rejected", "hired"]);
  });

  it("normalizes anything unknown to new", () => {
    expect(normalizeApplicationStatus("hired")).toBe("hired");
    expect(normalizeApplicationStatus("withdrawn")).toBe("withdrawn");
    expect(normalizeApplicationStatus("archived")).toBe("new");
    expect(normalizeApplicationStatus(null)).toBe("new");
    expect(normalizeApplicationStatus(3)).toBe("new");
  });

  it("calls rejected and hired decided", () => {
    expect(APPLICATION_STATUSES.filter(isApplicationDecided)).toEqual(["rejected", "hired"]);
  });

  it("mirrors the database limits", () => {
    expect(APPLICATION_LIMITS).toMatchObject({
      messageMax: 1000,
      projectsMin: 1,
      projectsMax: 3,
      perDay: 20,
      keepMonths: 12,
    });
  });
});

describe("applicantNoticeFor", () => {
  it("tells the candidate about the first look", () => {
    expect(applicantNoticeFor("new", "viewed")).toBe("viewed");
  });

  it("does not repeat 'viewed' when a decision is taken back", () => {
    expect(applicantNoticeFor("shortlisted", "viewed")).toBeNull();
    expect(applicantNoticeFor("rejected", "viewed")).toBeNull();
    expect(applicantNoticeFor("hired", "viewed")).toBeNull();
  });

  it("tells every decision, from any earlier state", () => {
    for (const previous of ["new", "viewed", "rejected", "hired"] as ApplicationStatus[]) {
      expect(applicantNoticeFor(previous, "shortlisted")).toBe("shortlisted");
    }
    expect(applicantNoticeFor("new", "rejected")).toBe("rejected");
    expect(applicantNoticeFor("shortlisted", "hired")).toBe("hired");
    expect(applicantNoticeFor("rejected", "hired")).toBe("hired");
  });

  it("is silent when nothing changed, after a withdrawal, or for statuses nobody sets", () => {
    expect(applicantNoticeFor("shortlisted", "shortlisted")).toBeNull();
    expect(applicantNoticeFor("withdrawn", "hired")).toBeNull();
    expect(applicantNoticeFor("viewed", "new")).toBeNull();
    expect(applicantNoticeFor("viewed", "withdrawn")).toBeNull();
  });

  it("emails decisions only", () => {
    expect(isApplicantNoticeEmailed("viewed")).toBe(false);
    expect(isApplicantNoticeEmailed("shortlisted")).toBe(true);
    expect(isApplicantNoticeEmailed("rejected")).toBe(true);
    expect(isApplicantNoticeEmailed("hired")).toBe(true);
  });
});

describe("the team's tabs", () => {
  it("reads the tab from the address, all by default", () => {
    expect(parseApplicationTeamFilter("shortlisted")).toBe("shortlisted");
    expect(parseApplicationTeamFilter(["hired", "rejected"])).toBe("hired");
    expect(parseApplicationTeamFilter("everything")).toBe("all");
    expect(parseApplicationTeamFilter(undefined)).toBe("all");
  });

  it("puts each status in the right tabs", () => {
    const tabsOf = (status: ApplicationStatus) =>
      APPLICATION_TEAM_FILTERS.filter((filter) => applicationMatchesTeamFilter(status, filter));

    expect(tabsOf("new")).toEqual(["all", "undecided"]);
    expect(tabsOf("viewed")).toEqual(["all", "undecided"]);
    expect(tabsOf("shortlisted")).toEqual(["all", "shortlisted"]);
    expect(tabsOf("hired")).toEqual(["all", "hired"]);
    expect(tabsOf("rejected")).toEqual(["all", "rejected"]);
    // Nothing to read in a withdrawn one: not under "All".
    expect(tabsOf("withdrawn")).toEqual(["withdrawn"]);
  });

  it("counts the tabs", () => {
    expect(
      countApplicationsByFilter(["new", "new", "viewed", "shortlisted", "rejected", "withdrawn"]),
    ).toEqual({ all: 5, undecided: 3, shortlisted: 1, hired: 0, rejected: 1, withdrawn: 1 });
    expect(countApplicationsByFilter([])).toEqual({
      all: 0,
      undecided: 0,
      shortlisted: 0,
      hired: 0,
      rejected: 0,
      withdrawn: 0,
    });
  });
});

describe("resolveApplyState", () => {
  const ready = {
    signedIn: true,
    isTeam: false,
    vacancyOpen: true,
    hasApplication: false,
    emailConfirmed: true,
    hasProfile: true,
    projectsCount: 2,
  };

  it("offers the form when everything is in place", () => {
    expect(resolveApplyState(ready)).toBe("ready");
  });

  it("asks for the one missing thing, in order", () => {
    expect(resolveApplyState({ ...ready, signedIn: false, emailConfirmed: false, hasProfile: false, projectsCount: 0 })).toBe(
      "sign_in",
    );
    expect(resolveApplyState({ ...ready, emailConfirmed: false, hasProfile: false })).toBe("confirm_email");
    expect(resolveApplyState({ ...ready, hasProfile: false, projectsCount: 0 })).toBe("need_profile");
    expect(resolveApplyState({ ...ready, projectsCount: 0 })).toBe("need_project");
  });

  it("shows the team its own vacancy's applications instead", () => {
    expect(resolveApplyState({ ...ready, isTeam: true, vacancyOpen: false })).toBe("team");
  });

  it("shows an existing application even after the vacancy closed", () => {
    expect(resolveApplyState({ ...ready, hasApplication: true, vacancyOpen: false })).toBe("applied");
  });

  it("says a closed vacancy takes no applications, to guests too", () => {
    expect(resolveApplyState({ ...ready, vacancyOpen: false })).toBe("closed");
    expect(resolveApplyState({ ...ready, vacancyOpen: false, signedIn: false })).toBe("closed");
  });
});

describe("refusals and addresses", () => {
  it("has an HTTP status for every refusal", () => {
    for (const refusal of APPLY_REFUSALS) {
      expect(APPLY_REFUSAL_HTTP_STATUS[refusal]).toBeGreaterThanOrEqual(400);
    }
    expect(APPLY_REFUSAL_HTTP_STATUS.daily_limit).toBe(429);
    expect(APPLY_REFUSAL_HTTP_STATUS.already_applied).toBe(409);
  });

  it("treats an unknown answer as a closed vacancy", () => {
    expect(toApplyRefusal("own_company")).toBe("own_company");
    expect(toApplyRefusal("ok")).toBe("not_open");
    expect(toApplyRefusal(undefined)).toBe("not_open");
  });

  it("builds the two pages' addresses", () => {
    expect(MY_APPLICATIONS_PATH).toBe("/my-space/applications");
    expect(buildTeamApplicationsPath("v1")).toBe("/my-space/vacancies/v1");
  });
});
