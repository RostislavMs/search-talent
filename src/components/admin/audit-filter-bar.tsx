"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import FormSelect from "@/components/ui/form-select";

type Props = {
  labels: {
    action: string;
    target: string;
    all: string;
  };
  actionOptions: Array<{ value: string; label: string }>;
  targetOptions: Array<{ value: string; label: string }>;
};

export default function AuditFilterBar({
  labels,
  actionOptions,
  targetOptions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.delete("before");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  const currentAction = searchParams.get("action") || "all";
  const currentTarget = searchParams.get("target") || "all";

  const actionItems = [
    { value: "all", label: labels.all },
    ...actionOptions,
  ];

  const targetItems = [
    { value: "all", label: labels.all },
    ...targetOptions,
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      aria-busy={isPending}
    >
      <div className="flex items-center gap-2 text-sm app-muted sm:min-w-56">
        <span className="shrink-0">{labels.action}:</span>
        <FormSelect
          className="flex-1"
          triggerClassName="app-select-trigger--sm"
          value={currentAction}
          onChange={(value) =>
            updateParam("action", value === "all" ? null : value)
          }
          options={actionItems}
        />
      </div>

      <div className="flex items-center gap-2 text-sm app-muted sm:min-w-56">
        <span className="shrink-0">{labels.target}:</span>
        <FormSelect
          className="flex-1"
          triggerClassName="app-select-trigger--sm"
          value={currentTarget}
          onChange={(value) =>
            updateParam("target", value === "all" ? null : value)
          }
          options={targetItems}
        />
      </div>
    </div>
  );
}
