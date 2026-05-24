import { describe, expect, it } from "vitest";
import { projectPayloadSchema } from "@/lib/validation/project";

const base = {
  title: "Project A",
  description: "desc",
  role: null,
  projectStatus: null,
  teamSize: null,
  projectUrl: null,
  repositoryUrl: null,
  startedOn: null,
  completedOn: null,
  problem: null,
  solution: null,
  results: null,
  skillIds: [],
  status: "draft",
};

describe("projectPayloadSchema githubFullName", () => {
  it("accepts a valid full name (owner/repo)", () => {
    const result = projectPayloadSchema.safeParse({
      ...base,
      githubFullName: "octo/repo",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubFullName).toBe("octo/repo");
    }
  });

  it("normalizes empty / null / undefined to null", () => {
    for (const value of ["", null, undefined]) {
      const result = projectPayloadSchema.safeParse({
        ...base,
        githubFullName: value,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.githubFullName).toBeNull();
      }
    }
  });

  it("rejects a malformed identifier", () => {
    const result = projectPayloadSchema.safeParse({
      ...base,
      githubFullName: "not-a-repo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a name with whitespace or special chars", () => {
    const result = projectPayloadSchema.safeParse({
      ...base,
      githubFullName: "octo cat/repo",
    });
    expect(result.success).toBe(false);
  });
});

describe("projectPayloadSchema githubRole", () => {
  it("accepts an allowed role value", () => {
    const result = projectPayloadSchema.safeParse({
      ...base,
      githubRole: "maintainer",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubRole).toBe("maintainer");
    }
  });

  it("treats empty / null / undefined as null", () => {
    for (const value of ["", null, undefined]) {
      const result = projectPayloadSchema.safeParse({
        ...base,
        githubRole: value,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.githubRole).toBeNull();
      }
    }
  });

  it("rejects an unknown role", () => {
    const result = projectPayloadSchema.safeParse({
      ...base,
      githubRole: "ceo",
    });
    expect(result.success).toBe(false);
  });
});

describe("projectPayloadSchema github narrative fields", () => {
  it("trims and stores contribution / motivation / techDecisions / learnings / showcaseNotes / productionUsage", () => {
    const result = projectPayloadSchema.safeParse({
      ...base,
      githubContribution: "  Built the auth layer  ",
      githubMotivation: "Solved a personal itch",
      githubTechDecisions: "Picked Postgres over Mongo",
      githubLearnings: "Learned RLS",
      githubShowcaseNotes: "Full-stack",
      githubProductionUsage: "Used at Acme",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubContribution).toBe("Built the auth layer");
      expect(result.data.githubMotivation).toBe("Solved a personal itch");
      expect(result.data.githubTechDecisions).toBe(
        "Picked Postgres over Mongo",
      );
      expect(result.data.githubLearnings).toBe("Learned RLS");
      expect(result.data.githubShowcaseNotes).toBe("Full-stack");
      expect(result.data.githubProductionUsage).toBe("Used at Acme");
    }
  });

  it("normalizes blank narrative fields to null", () => {
    const result = projectPayloadSchema.safeParse({
      ...base,
      githubContribution: "   ",
      githubMotivation: "",
      githubTechDecisions: null,
      githubLearnings: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubContribution).toBeNull();
      expect(result.data.githubMotivation).toBeNull();
      expect(result.data.githubTechDecisions).toBeNull();
      expect(result.data.githubLearnings).toBeNull();
    }
  });

  it("rejects a contribution that exceeds the limit", () => {
    const result = projectPayloadSchema.safeParse({
      ...base,
      githubContribution: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a production usage that exceeds the limit", () => {
    const result = projectPayloadSchema.safeParse({
      ...base,
      githubProductionUsage: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("projectPayloadSchema githubAutoSync", () => {
  it("defaults to true when missing", () => {
    const result = projectPayloadSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubAutoSync).toBe(true);
    }
  });

  it("accepts an explicit false", () => {
    const result = projectPayloadSchema.safeParse({
      ...base,
      githubAutoSync: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubAutoSync).toBe(false);
    }
  });
});

describe("projectPayloadSchema githubDisplayOptions", () => {
  it("accepts partial display options object", () => {
    const result = projectPayloadSchema.safeParse({
      ...base,
      githubDisplayOptions: {
        showStats: false,
        showLanguages: true,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubDisplayOptions?.showStats).toBe(false);
      expect(result.data.githubDisplayOptions?.showLanguages).toBe(true);
    }
  });

  it("normalizes missing / null to null", () => {
    for (const value of [null, undefined]) {
      const result = projectPayloadSchema.safeParse({
        ...base,
        githubDisplayOptions: value,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.githubDisplayOptions).toBeNull();
      }
    }
  });
});
