import type { ApplicationStatus } from "@/lib/applications";

const DOT_CLASSES: Record<ApplicationStatus, string> = {
  new: "bg-[color:var(--brand)]",
  viewed: "bg-slate-400",
  shortlisted: "bg-amber-500",
  hired: "bg-emerald-500",
  rejected: "bg-rose-500",
  withdrawn: "bg-slate-300 dark:bg-slate-600",
};

/**
 * Where an application stands, as a quiet pill with a coloured dot. The words
 * differ for the candidate and the team ("The company is interested" /
 * "Shortlisted"), so the caller passes the right set.
 */
export default function ApplicationStatusPill({
  status,
  labels,
}: {
  status: ApplicationStatus;
  labels: Record<ApplicationStatus, string>;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border app-border px-2.5 py-0.5 text-xs font-medium text-[color:var(--foreground)]">
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASSES[status]}`} aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
