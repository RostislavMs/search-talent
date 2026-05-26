import type { Dictionary } from "@/lib/i18n/dictionaries";
import LocalizedLink from "@/components/ui/localized-link";
import { buttonStyles } from "@/components/ui/button-styles";
import OptimizedImage from "@/components/ui/optimized-image";

type CreatorCardData = {
  username: string | null;
  name?: string | null;
  headline?: string | null;
  avatar_url?: string | null;
  categoryName?: string | null;
  countryName?: string | null;
  city?: string | null;
  technologies?: Array<{ id: number; name: string }>;
};

export default function CreatorCard({
  creator,
  dictionary,
}: {
  creator: CreatorCardData;
  dictionary: Dictionary;
}) {
  const name = creator.name || creator.username || dictionary.common.creator;

  return (
    <LocalizedLink
      href={`/u/${creator.username}`}
      className="group block rounded-3xl app-card p-5 transition hover:-translate-y-0.5 hover:border-[color:var(--foreground)] hover:shadow-xl"
    >
      <div className="flex items-start gap-4">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border app-border app-surface-muted shadow-sm">
          {creator.avatar_url ? (
            <OptimizedImage
              src={creator.avatar_url}
              alt={name}
              fill
              sizes="72px"
              className="object-cover"
            />
          ) : (
            <span className="font-display flex h-full w-full items-center justify-center text-2xl font-medium text-[color:var(--foreground)]">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="font-display truncate text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
            {name}
          </h3>
          <p className="mt-0.5 truncate text-sm app-muted">
            @{creator.username || dictionary.common.creator.toLowerCase()}
          </p>
        </div>
      </div>

      {creator.headline && (
        <p className="mt-4 line-clamp-2 text-sm leading-6 app-muted">
          {creator.headline}
        </p>
      )}

      {(creator.categoryName || creator.countryName || creator.city) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {creator.categoryName && (
            <span className="rounded-full app-panel px-3 py-1 text-xs app-muted">
              {creator.categoryName}
            </span>
          )}
          {creator.countryName && (
            <span className="rounded-full app-panel px-3 py-1 text-xs app-muted">
              {creator.countryName}
            </span>
          )}
          {creator.city && (
            <span className="rounded-full app-panel px-3 py-1 text-xs app-muted">
              {creator.city}
            </span>
          )}
        </div>
      )}

      {creator.technologies && creator.technologies.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {creator.technologies.slice(0, 3).map((technology) => (
            <span
              key={technology.id}
              className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--foreground)]"
            >
              {technology.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <span className={buttonStyles({ variant: "ghost", size: "sm" })}>
          {dictionary.common.openProfile}
        </span>
      </div>
    </LocalizedLink>
  );
}
