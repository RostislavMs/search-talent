/**
 * Localized relative timestamp ("3 хв тому" / "3m ago"). Falls back to an
 * absolute medium date once the event is older than ~30 days. Shared by
 * comments and notifications so the wording stays consistent site-wide.
 */
export function formatRelativeTime(isoDate: string, locale: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const uk = locale === "uk";

  if (diffMinutes < 1) {
    return uk ? "щойно" : "just now";
  }

  if (diffMinutes < 60) {
    return uk ? `${diffMinutes} хв тому` : `${diffMinutes}m ago`;
  }

  if (diffHours < 24) {
    return uk ? `${diffHours} год тому` : `${diffHours}h ago`;
  }

  if (diffDays < 30) {
    return uk ? `${diffDays} дн тому` : `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat(uk ? "uk-UA" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}
