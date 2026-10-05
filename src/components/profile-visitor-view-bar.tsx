import { ButtonLink } from "@/components/ui/Button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Above the owner's page in "view as visitor": what this is, and the way back.
 * Uses the site look, not the author's, so it never reads as part of the page.
 */
export default function ProfileVisitorViewBar({
  dictionary,
  username,
  hiddenFromVisitors,
}: {
  dictionary: Dictionary;
  username: string;
  hiddenFromVisitors: boolean;
}) {
  const copy = dictionary.creatorProfile;

  return (
    <div className="mx-auto max-w-[88rem] px-4 pt-4 sm:px-6 sm:pt-8">
      <div
        className="flex flex-col gap-3 rounded-2xl border border-[color:var(--brand)] bg-[color:var(--brand-soft)] p-4 sm:flex-row sm:items-center sm:justify-between"
        role="status"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{copy.visitorViewTitle}</p>
          <p className="mt-1 text-sm leading-6 app-muted">{copy.visitorViewHint}</p>
          {hiddenFromVisitors ? (
            <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--foreground)]">
              {copy.visitorViewHidden}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ButtonLink href={`/u/${username}`} size="sm">
            {copy.visitorViewExit}
          </ButtonLink>
          <ButtonLink href="/profile/edit" variant="secondary" size="sm">
            {copy.editProfile}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
