"use client";

import ErrorState from "@/components/error-state";
import InteractiveBackground from "@/components/interactive-background";

export default function LocalizedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <InteractiveBackground />
      <ErrorState error={error} reset={reset} />
    </>
  );
}
