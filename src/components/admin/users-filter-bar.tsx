"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FormSelect from "@/components/ui/form-select";

type Props = {
  labels: {
    searchPlaceholder: string;
    filterRole: string;
    filterStatus: string;
    filterAny: string;
    filterAdmins: string;
    filterUsers: string;
    filterApproved: string;
    filterUnderReview: string;
    filterRestricted: string;
    filterRemoved: string;
  };
};

export default function UsersFilterBar({ labels }: Props) {
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

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateParam("q", searchValue.trim() || null);
  }

  const currentRole = searchParams.get("role") || "all";
  const currentStatus = searchParams.get("status") || "all";

  const roleOptions = [
    { value: "all", label: labels.filterAny },
    { value: "admin", label: labels.filterAdmins },
    { value: "user", label: labels.filterUsers },
  ];

  const statusOptions = [
    { value: "all", label: labels.filterAny },
    { value: "approved", label: labels.filterApproved },
    { value: "under_review", label: labels.filterUnderReview },
    { value: "restricted", label: labels.filterRestricted },
    { value: "removed", label: labels.filterRemoved },
  ];

  return (
    <form
      onSubmit={handleSearchSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      aria-busy={isPending}
    >
      <div className="flex-1">
        <input
          type="search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder={labels.searchPlaceholder}
          className="app-input"
        />
      </div>

      <div className="flex items-center gap-2 text-sm app-muted sm:min-w-48">
        <span className="hidden sm:inline shrink-0">{labels.filterRole}:</span>
        <FormSelect
          className="flex-1"
          triggerClassName="app-select-trigger--sm"
          value={currentRole}
          onChange={(value) =>
            updateParam("role", value === "all" ? null : value)
          }
          options={roleOptions}
        />
      </div>

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
