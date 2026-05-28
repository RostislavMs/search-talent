import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  type PhotoGenre,
  type PhotoKindMetadata,
  type PhotoMedium,
  type PhotoRole,
} from "@/lib/project-kind-metadata";

function getPhotoRoleLabel(role: PhotoRole, dictionary: Dictionary) {
  switch (role) {
    case "photographer":
      return dictionary.forms.photoRolePhotographer;
    case "retoucher":
      return dictionary.forms.photoRoleRetoucher;
    case "art_director":
      return dictionary.forms.photoRoleArtDirector;
    case "stylist":
      return dictionary.forms.photoRoleStylist;
    case "assistant":
      return dictionary.forms.photoRoleAssistant;
    default:
      return role;
  }
}

function getPhotoGenreLabel(value: PhotoGenre, dictionary: Dictionary) {
  switch (value) {
    case "portrait":
      return dictionary.forms.photoGenrePortrait;
    case "product":
      return dictionary.forms.photoGenreProduct;
    case "fashion":
      return dictionary.forms.photoGenreFashion;
    case "wedding":
      return dictionary.forms.photoGenreWedding;
    case "event":
      return dictionary.forms.photoGenreEvent;
    case "landscape":
      return dictionary.forms.photoGenreLandscape;
    case "architecture":
      return dictionary.forms.photoGenreArchitecture;
    case "street":
      return dictionary.forms.photoGenreStreet;
    case "documentary":
      return dictionary.forms.photoGenreDocumentary;
    case "sport":
      return dictionary.forms.photoGenreSport;
    case "food":
      return dictionary.forms.photoGenreFood;
    case "automotive":
      return dictionary.forms.photoGenreAutomotive;
    case "wildlife":
      return dictionary.forms.photoGenreWildlife;
    case "fine_art":
      return dictionary.forms.photoGenreFineArt;
    case "stock":
      return dictionary.forms.photoGenreStock;
    default:
      return value;
  }
}

function getPhotoMediumLabel(value: PhotoMedium, dictionary: Dictionary) {
  switch (value) {
    case "digital":
      return dictionary.forms.photoMediumDigital;
    case "film_35mm":
      return dictionary.forms.photoMediumFilm35mm;
    case "film_medium_format":
      return dictionary.forms.photoMediumFilmMediumFormat;
    case "film_large_format":
      return dictionary.forms.photoMediumFilmLargeFormat;
    case "instant":
      return dictionary.forms.photoMediumInstant;
    case "mobile":
      return dictionary.forms.photoMediumMobile;
    default:
      return value;
  }
}

export default function ProjectPhotoDetails({
  dictionary,
  meta,
}: {
  dictionary: Dictionary;
  meta: PhotoKindMetadata;
}) {
  return (
    <div className="mt-6 space-y-5 rounded-2xl border app-border p-5">
      <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
        {dictionary.forms.photoSectionTitle}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {meta.role && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.photoRoleLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {getPhotoRoleLabel(meta.role, dictionary)}
            </p>
          </div>
        )}
        {meta.medium && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.photoMediumLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {getPhotoMediumLabel(meta.medium, dictionary)}
            </p>
          </div>
        )}
        {meta.shotCount !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.photoShotCountLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.shotCount}
            </p>
          </div>
        )}
        {meta.location && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.photoLocationLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.location}
            </p>
          </div>
        )}
        {meta.client && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.photoClientLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.client}
            </p>
          </div>
        )}
      </div>

      {meta.genres.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.photoGenresLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]"
              >
                {getPhotoGenreLabel(genre, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.cameras.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.photoCamerasLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.cameras.map((camera) => (
              <span
                key={camera}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {camera}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.editingTools.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.photoEditingToolsLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.editingTools.map((tool) => (
              <span
                key={tool}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
