import LocalizedLink from "@/components/ui/localized-link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { OnboardingChecklist } from "@/lib/onboarding";

function StepMark({ done, number }: { done: boolean; number: number }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        done
          ? "bg-[color:var(--brand)] text-[color:var(--brand-foreground)]"
          : "border app-border app-muted"
      }`}
      aria-hidden="true"
    >
      {done ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="m5 12 5 5L20 7"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        number
      )}
    </span>
  );
}

/**
 * The newcomer checklist at the top of "My Space": the same three things as
 * the onboarding, each linking to its step. Hidden once everything is done.
 */
export default function MySpaceChecklist({
  checklist,
  usernameHint,
  dictionary,
}: {
  checklist: OnboardingChecklist;
  /** Why the nick needs changing, when it does (temporary or from the email). */
  usernameHint: string | null;
  dictionary: Dictionary;
}) {
  if (checklist.allDone) {
    return null;
  }

  const copy = dictionary.mySpace;
  const labels = {
    profile: { title: copy.checklist.profile, hint: copy.checklist.profileHint },
    project: { title: copy.checklist.project, hint: copy.checklist.projectHint },
    share: { title: copy.checklist.share, hint: copy.checklist.shareHint },
  };

  return (
    <section className="rounded-hero app-card p-5 sm:p-6" aria-labelledby="my-space-checklist">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="my-space-checklist"
          className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
        >
          {copy.gettingStarted}
        </h2>
        <p className="text-sm app-muted">
          {copy.checklistProgress
            .replace("{done}", String(checklist.doneCount))
            .replace("{total}", String(checklist.items.length))}
        </p>
      </div>

      <ol className="mt-3 divide-y divide-[color:var(--border)]">
        {checklist.items.map((item, index) => {
          const label = labels[item.key];
          const hint = item.key === "profile" && usernameHint ? usernameHint : label.hint;

          return (
            <li key={item.key}>
              {item.done ? (
                <div className="flex items-start gap-3 py-3">
                  <StepMark done number={index + 1} />
                  <p className="text-sm app-muted">{label.title}</p>
                </div>
              ) : (
                <LocalizedLink
                  href={`/onboarding?step=${item.key}`}
                  className="group -mx-2 flex items-start gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-[color:var(--surface-muted)]"
                >
                  <StepMark done={false} number={index + 1} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[color:var(--foreground)]">
                      {label.title}
                    </span>
                    <span className="mt-0.5 block text-sm app-muted">{hint}</span>
                  </span>
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-1 h-4 w-4 shrink-0 app-soft transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--foreground)]"
                    aria-hidden="true"
                  >
                    <path d="M6 3.5 10.5 8 6 12.5" />
                  </svg>
                </LocalizedLink>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
