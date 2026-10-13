"use client";

import { useDictionary } from "@/lib/i18n/client";
import { verifiedBadgeCopy } from "@/lib/i18n/copy/verified-badge";

export default function VerifiedBadge({
  verified,
}: {
  verified: boolean;
}) {
  const dictionary = useDictionary({ verifiedBadge: verifiedBadgeCopy });

  if (!verified) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
      title={dictionary.verifiedBadge.tooltip}
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
      {dictionary.verifiedBadge.label}
    </span>
  );
}
