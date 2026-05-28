import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  getVideoEmbedUrl,
  type VideoGenre,
  type VideoKindMetadata,
  type VideoRole,
} from "@/lib/project-kind-metadata";

function getVideoRoleLabel(role: VideoRole, dictionary: Dictionary) {
  switch (role) {
    case "editor":
      return dictionary.forms.videoRoleEditor;
    case "colorist":
      return dictionary.forms.videoRoleColorist;
    case "motion":
      return dictionary.forms.videoRoleMotion;
    case "vfx":
      return dictionary.forms.videoRoleVfx;
    case "sound":
      return dictionary.forms.videoRoleSound;
    case "director":
      return dictionary.forms.videoRoleDirector;
    case "dop":
      return dictionary.forms.videoRoleDop;
    case "animator":
      return dictionary.forms.videoRoleAnimator;
    case "producer":
      return dictionary.forms.videoRoleProducer;
    default:
      return role;
  }
}

function getVideoGenreLabel(genre: VideoGenre, dictionary: Dictionary) {
  switch (genre) {
    case "commercial":
      return dictionary.forms.videoGenreCommercial;
    case "music_video":
      return dictionary.forms.videoGenreMusicVideo;
    case "documentary":
      return dictionary.forms.videoGenreDocumentary;
    case "short_film":
      return dictionary.forms.videoGenreShortFilm;
    case "feature_film":
      return dictionary.forms.videoGenreFeatureFilm;
    case "vlog":
      return dictionary.forms.videoGenreVlog;
    case "gameplay":
      return dictionary.forms.videoGenreGameplay;
    case "tutorial":
      return dictionary.forms.videoGenreTutorial;
    case "corporate":
      return dictionary.forms.videoGenreCorporate;
    case "event":
      return dictionary.forms.videoGenreEvent;
    case "social_media":
      return dictionary.forms.videoGenreSocialMedia;
    case "advertising":
      return dictionary.forms.videoGenreAdvertising;
    case "trailer":
      return dictionary.forms.videoGenreTrailer;
    case "animation":
      return dictionary.forms.videoGenreAnimation;
    default:
      return genre;
  }
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `0:${String(totalSeconds).padStart(2, "0")}`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const remaining = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}:${String(remaining).padStart(2, "0")}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export default function ProjectVideoDetails({
  dictionary,
  meta,
}: {
  dictionary: Dictionary;
  meta: VideoKindMetadata;
}) {
  const embedUrl = getVideoEmbedUrl(meta.showreelUrl);

  return (
    <div className="mt-6 space-y-5 rounded-2xl border app-border p-5">
      <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
        {dictionary.forms.videoSectionTitle}
      </h3>

      {embedUrl ? (
        <div className="overflow-hidden rounded-2xl bg-black">
          <div className="relative aspect-video">
            <iframe
              src={embedUrl}
              title={dictionary.forms.videoShowreelUrlLabel}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      ) : meta.showreelUrl ? (
        <a
          href={meta.showreelUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border app-border px-4 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
        >
          {dictionary.forms.videoShowreelUrlLabel}
        </a>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {meta.role && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.videoRoleLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {getVideoRoleLabel(meta.role, dictionary)}
            </p>
          </div>
        )}
        {meta.client && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.videoClientLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.client}
            </p>
          </div>
        )}
        {meta.resolution && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.videoResolutionLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.resolution}
              {meta.frameRate
                ? ` · ${meta.frameRate} ${dictionary.forms.videoFrameRateOptionSuffix}`
                : ""}
            </p>
          </div>
        )}
        {meta.durationSeconds !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.videoDurationLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {formatDuration(meta.durationSeconds)}
            </p>
          </div>
        )}
      </div>

      {meta.tools.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.videoToolsLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.tools.map((tool) => (
              <span
                key={tool}
                className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.genres.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.videoGenresLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {getVideoGenreLabel(genre, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
