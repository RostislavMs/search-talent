import { describe, expect, it } from "vitest";
import {
  ONBOARDING_PROJECT_KINDS,
  buildOnboardingProjectHref,
  getInitialOnboardingStep,
  getNextOnboardingStep,
  getOnboardingChecklist,
  getOnboardingStepNumber,
  getPreviousOnboardingStep,
  parseOnboardingStep,
  type OnboardingChecklistInput,
} from "@/lib/onboarding";
import { projectKinds } from "@/lib/projects";

const complete: OnboardingChecklistInput = {
  username: "olena.koval",
  email: "olena@example.com",
  name: "Olena Koval",
  categoryId: 5,
  skillsCount: 3,
  publishedProjectsCount: 1,
  linkShared: true,
};

describe("onboarding steps", () => {
  it("parses step names and 1-based numbers", () => {
    expect(parseOnboardingStep("project")).toBe("project");
    expect(parseOnboardingStep("3")).toBe("share");
    expect(parseOnboardingStep("1")).toBe("profile");
    expect(parseOnboardingStep("4")).toBeNull();
    expect(parseOnboardingStep("0")).toBeNull();
    expect(parseOnboardingStep("share-now")).toBeNull();
    expect(parseOnboardingStep(null)).toBeNull();
  });

  it("moves forward and back between the three steps", () => {
    expect(getNextOnboardingStep("profile")).toBe("project");
    expect(getNextOnboardingStep("project")).toBe("share");
    expect(getNextOnboardingStep("share")).toBeNull();
    expect(getPreviousOnboardingStep("share")).toBe("project");
    expect(getPreviousOnboardingStep("profile")).toBeNull();
    expect(getOnboardingStepNumber("project")).toBe(2);
  });
});

describe("getOnboardingChecklist", () => {
  it("is all done for a finished portfolio", () => {
    const checklist = getOnboardingChecklist(complete);
    expect(checklist.allDone).toBe(true);
    expect(checklist.doneCount).toBe(3);
    expect(checklist.needsUsername).toBe(false);
  });

  it("needs a name, own nick, direction and a skill for the profile item", () => {
    const profileDone = (patch: Partial<OnboardingChecklistInput>) =>
      getOnboardingChecklist({ ...complete, ...patch }).items[0].done;

    expect(profileDone({})).toBe(true);
    expect(profileDone({ name: "  " })).toBe(false);
    expect(profileDone({ username: "user-ab12cd" })).toBe(false);
    expect(profileDone({ username: "olena" })).toBe(false);
    expect(profileDone({ categoryId: null })).toBe(false);
    expect(profileDone({ skillsCount: 0 })).toBe(false);
  });

  it("flags a temporary or email-derived nick", () => {
    expect(getOnboardingChecklist({ ...complete, username: "user-ab12cd" }).needsUsername).toBe(
      true,
    );
    expect(getOnboardingChecklist({ ...complete, username: "olena" }).needsUsername).toBe(true);
  });

  it("counts only published projects and a known share", () => {
    const fresh = getOnboardingChecklist({
      ...complete,
      publishedProjectsCount: 0,
      linkShared: null,
    });
    expect(fresh.items.map((item) => [item.key, item.done])).toEqual([
      ["profile", true],
      ["project", false],
      ["share", false],
    ]);
    expect(fresh.doneCount).toBe(1);
    expect(fresh.allDone).toBe(false);
  });
});

describe("getInitialOnboardingStep", () => {
  it("honours the step asked for in the URL", () => {
    const checklist = getOnboardingChecklist(complete);
    expect(getInitialOnboardingStep("share", checklist)).toBe("share");
    expect(getInitialOnboardingStep("2", checklist)).toBe("project");
  });

  it("otherwise opens the first thing still to do", () => {
    expect(
      getInitialOnboardingStep(
        null,
        getOnboardingChecklist({ ...complete, publishedProjectsCount: 0 }),
      ),
    ).toBe("project");
    expect(
      getInitialOnboardingStep("nonsense", getOnboardingChecklist({ ...complete, linkShared: false })),
    ).toBe("share");
  });

  it("falls back to the profile when everything is done", () => {
    expect(getInitialOnboardingStep(undefined, getOnboardingChecklist(complete))).toBe("profile");
  });
});

describe("buildOnboardingProjectHref", () => {
  it("opens the wizard with the kind chosen and a way back", () => {
    expect(buildOnboardingProjectHref("design")).toBe("/projects/new?kind=design&from=onboarding");
  });

  it("starts on the import step for an import", () => {
    expect(buildOnboardingProjectHref("code", { importFirst: true })).toBe(
      "/projects/new?kind=code&from=onboarding&step=2",
    );
  });

  it("offers every project kind", () => {
    expect([...ONBOARDING_PROJECT_KINDS]).toEqual([...projectKinds]);
  });
});
