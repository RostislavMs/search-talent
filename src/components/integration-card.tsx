import type { ReactNode } from "react";
import IntegrationBrandIcon, {
  type IntegrationBrand,
} from "@/components/integration-brand-icon";

/**
 * The card shell every integration shares: brand mark, name, one status line,
 * one full-width action. Purely presentational — each provider's card owns its
 * own connect/disconnect logic and hands the pieces in here, so the six cards
 * cannot drift apart visually.
 *
 * `status` is reserved a fixed two-line height so the buttons line up across a
 * row whether the text wraps or not.
 */
export default function IntegrationCard({
  brand,
  name,
  status,
  action,
  message,
}: {
  brand: IntegrationBrand;
  name: string;
  status: ReactNode;
  action: ReactNode;
  /** Optional inline result of the last connect/disconnect attempt. */
  message?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`integration-${brand}-title`}
      className="flex flex-col items-center rounded-hero app-card p-6 text-center"
    >
      <IntegrationBrandIcon
        brand={brand}
        className="h-10 w-10 text-[color:var(--foreground)] opacity-80"
      />

      <h2
        id={`integration-${brand}-title`}
        className="font-display mt-4 text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
      >
        {name}
      </h2>

      <p className="mt-1.5 min-h-10 text-sm leading-5 app-muted">{status}</p>

      <div className="mt-4 w-full">{action}</div>

      {message}
    </section>
  );
}
