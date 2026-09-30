/**
 * "Verified company" pill. Same look as the profile's verified-email badge, so
 * a check mark means one thing across the site; the hint says what was checked.
 */
export default function CompanyVerifiedBadge({
  label,
  hint,
}: {
  label: string;
  hint: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
      title={hint}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M16.403 12.652a3 3 0 0 1 0-5.304 3 3 0 0 0-3.75-3.751 3 3 0 0 1-5.305 0 3 3 0 0 0-3.751 3.75 3 3 0 0 1 0 5.305 3 3 0 0 0 3.75 3.751 3 3 0 0 1 5.305 0 3 3 0 0 0 3.751-3.75Zm-2.546-4.46a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
          clipRule="evenodd"
        />
      </svg>
      {label}
      <span className="sr-only">. {hint}</span>
    </span>
  );
}
