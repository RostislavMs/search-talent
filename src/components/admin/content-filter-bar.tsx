"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FormSelect from "@/components/ui/form-select";

type Props = {
  labels: {
    searchPlaceholder: string;
    filterStatus: string;
    filterAll: string;
    filterApproved: string;
    filterUnderReview: string;
    filterRestricted: string;
    filterRemoved: string;
  };
  showSearch?: boolean;
};

export default function ContentFilterBar({ labels, showSearch = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryFromUrl = searchParams.get("q") || "";
  const [committedQuery, setCommittedQuery] = useState(queryFromUrl);
  const [searchValue, setSearchValue] = useState(queryFromUrl);
  const [isPending, startTransition] = useTransition();

  if (committedQuery !== queryFromUrl) {
    setCommittedQuery(queryFromUrl);
    setSearchValue(queryFromUrl);
  }

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateParam("q", searchValue.trim() || null);
  }

  const currentStatus = searchParams.get("status") || "all";

  const statusOptions = [
    { value: "all", label: labels.filterAll },
    { value: "approved", label: labels.filterApproved },
    { value: "under_review", label: labels.filterUnderReview },
    { value: "restricted", label: labels.filterRestricted },
    { value: "removed", label: labels.filterRemoved },
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      aria-busy={isPending}
    >
      {showSearch ? (
        <div className="flex-1">
          <input
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={labels.searchPlaceholder}
            className="app-input"
          />
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-sm app-muted sm:min-w-56">
        <span className="hidden sm:inline shrink-0">{labels.filterStatus}:</span>
        <FormSelect
          className="flex-1"
          triggerClassName="app-select-trigger--sm"
          value={currentStatus}
          onChange={(value) =>
            updateParam("status", value === "all" ? null : value)
          }
          options={statusOptions}
        />
      </div>
    </form>
  );
}
