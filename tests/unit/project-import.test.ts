import { describe, expect, it } from "vitest";
import {
  mergeImportedSkills,
  mergeImportedValues,
  type ImportedProjectField,
} from "@/lib/project-import";

const blank: Record<ImportedProjectField, string> = {
  title: "",
  description: "",
  projectUrl: "",
  repositoryUrl: "",
  startedOn: "",
  teamSize: "",
  projectStatus: "",
};

const github = {
  title: "repo-a",
  description: "From GitHub",
  projectUrl: "https://a.example",
  repositoryUrl: "https://github.com/me/repo-a",
  startedOn: "2025-01-01",
  teamSize: "3",
  projectStatus: "",
};

const gitlab = {
  title: "project-b",
  description: "From GitLab",
  projectUrl: "",
  repositoryUrl: "https://gitlab.com/me/project-b",
  startedOn: "2026-02-02",
  teamSize: "",
  projectStatus: "completed",
};

describe("mergeImportedValues", () => {
  it("fills a blank form on the first import", () => {
    expect(mergeImportedValues(blank, github, {})).toEqual(github);
  });

  it("keeps what the author wrote on the first import", () => {
    const patch = mergeImportedValues(
      { ...blank, title: "My app" },
      github,
      {},
    );
    expect(patch.title).toBeUndefined();
    expect(patch.repositoryUrl).toBe(github.repositoryUrl);
  });

  it("replaces the previous import's untouched values with the new source", () => {
    const afterGithub = { ...blank, ...github };
    const patch = mergeImportedValues(afterGithub, gitlab, github);

    expect({ ...afterGithub, ...patch }).toEqual(gitlab);
  });

  it("clears a value the new source does not have", () => {
    const patch = mergeImportedValues({ ...blank, ...github }, gitlab, github);
    expect(patch.projectUrl).toBe("");
  });

  it("never replaces a field the author changed after the import", () => {
    const edited = { ...blank, ...github, title: "My app", description: "Mine" };
    const patch = mergeImportedValues(edited, gitlab, github);

    expect(patch.title).toBeUndefined();
    expect(patch.description).toBeUndefined();
    expect(patch.repositoryUrl).toBe(gitlab.repositoryUrl);
  });
});

describe("mergeImportedSkills", () => {
  it("adds the matched tags on the first import", () => {
    expect(mergeImportedSkills([7], [1, 2], [])).toEqual({
      skillIds: [7, 1, 2],
      added: [1, 2],
    });
  });

  it("does not claim a tag the author already had", () => {
    expect(mergeImportedSkills([1], [1, 2], []).added).toEqual([2]);
  });

  it("swaps the previous import's tags for the new ones", () => {
    expect(mergeImportedSkills([7, 1, 2], [3], [1, 2])).toEqual({
      skillIds: [7, 3],
      added: [3],
    });
  });

  it("keeps a tag both sources share", () => {
    expect(mergeImportedSkills([1, 2], [2, 3], [1, 2]).skillIds).toEqual([2, 3]);
  });
});
