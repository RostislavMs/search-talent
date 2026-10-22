// How an import (a GitHub repository, a GitLab project) lands in the project
// form when something was imported before.
//
// The first import only fills blank fields. A later one — another repository
// from the same source, or a different source after the first was unlinked —
// must not keep the old source's title, links and tags just because the
// fields are no longer blank. So the form remembers what the last import wrote
// and lets the next import replace exactly that, never what the author typed.

export const importedProjectFields = [
  "title",
  "description",
  "projectUrl",
  "repositoryUrl",
  "startedOn",
  "teamSize",
  "projectStatus",
] as const;

export type ImportedProjectField = (typeof importedProjectFields)[number];

export type ImportedProjectValues<
  T extends Record<ImportedProjectField, string> = Record<ImportedProjectField, string>,
> = Partial<Pick<T, ImportedProjectField>>;

/**
 * The fields the new import should write: those that are blank or still hold
 * the previous import's value. A value the new source lacks clears the old
 * one (an empty string), so a stale homepage does not outlive its repository.
 */
export function mergeImportedValues<T extends Record<ImportedProjectField, string>>(
  current: T,
  next: ImportedProjectValues<T>,
  previous: ImportedProjectValues<T>,
): ImportedProjectValues<T> {
  const patch: ImportedProjectValues<T> = {};

  for (const field of importedProjectFields) {
    const value = current[field];
    const untouched =
      value.trim().length === 0 ||
      (previous[field] !== undefined && value === previous[field]);

    if (untouched) {
      patch[field] = next[field] ?? ("" as T[typeof field]);
    }
  }

  return patch;
}

/**
 * Technology tags after a new import: the tags the previous import added are
 * dropped (unless the new source has them too), the new matches are added.
 * Tags the author picked themselves are kept. `added` is what to remember for
 * the next import.
 */
export function mergeImportedSkills(
  current: number[],
  matched: number[],
  previouslyAdded: number[],
): { skillIds: number[]; added: number[] } {
  const kept = current.filter((id) => !previouslyAdded.includes(id));
  const added = Array.from(new Set(matched)).filter((id) => !kept.includes(id));

  return { skillIds: [...kept, ...added], added };
}
