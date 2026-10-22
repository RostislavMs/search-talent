// How an AI draft lands in the project form: a field takes the suggestion only
// while it is blank, so nothing the author wrote or picked is ever replaced.

/** Blank: no value, an empty string or an empty list. */
export function isBlankDraftValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * The part of `suggested` to write: the fields that are blank in `current`
 * and that the draft has a value for. `missed` counts the blank fields the
 * draft had nothing for — the source said too little about them.
 */
export function fillBlankFields<T extends object>(
  current: T,
  suggested: Partial<T> | undefined,
): { patch: Partial<T>; filled: number; missed: number } {
  const patch: Partial<T> = {};
  let missed = 0;

  for (const key of Object.keys(suggested ?? {}) as Array<keyof T>) {
    if (!isBlankDraftValue(current[key])) continue;

    const value = suggested?.[key];
    if (isBlankDraftValue(value)) {
      missed += 1;
    } else {
      patch[key] = value;
    }
  }

  return { patch, filled: Object.keys(patch).length, missed };
}

/** How many of `keys` are still blank in `current`. */
export function countBlankFields<T extends object>(
  current: T,
  keys: ReadonlyArray<keyof T>,
): number {
  return keys.filter((key) => isBlankDraftValue(current[key])).length;
}
