import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  getAudioEmbedUrl,
  type AudioGenre,
  type AudioKindMetadata,
  type AudioRole,
} from "@/lib/project-kind-metadata";

function getAudioRoleLabel(role: AudioRole, dictionary: Dictionary) {
  switch (role) {
    case "composer":
      return dictionary.forms.audioRoleComposer;
    case "producer":
      return dictionary.forms.audioRoleProducer;
    case "sound_designer":
      return dictionary.forms.audioRoleSoundDesigner;
    case "mixing":
      return dictionary.forms.audioRoleMixing;
    case "mastering":
      return dictionary.forms.audioRoleMastering;
    case "songwriter":
      return dictionary.forms.audioRoleSongwriter;
    case "vocalist":
      return dictionary.forms.audioRoleVocalist;
    case "instrumentalist":
      return dictionary.forms.audioRoleInstrumentalist;
    case "dj":
      return dictionary.forms.audioRoleDj;
    case "foley":
      return dictionary.forms.audioRoleFoley;
    case "arranger":
      return dictionary.forms.audioRoleArranger;
    default:
      return role;
  }
}

function getAudioGenreLabel(value: AudioGenre, dictionary: Dictionary) {
  switch (value) {
    case "electronic":
      return dictionary.forms.audioGenreElectronic;
    case "hip_hop":
      return dictionary.forms.audioGenreHipHop;
    case "pop":
      return dictionary.forms.audioGenrePop;
    case "rock":
      return dictionary.forms.audioGenreRock;
    case "jazz":
      return dictionary.forms.audioGenreJazz;
    case "classical":
      return dictionary.forms.audioGenreClassical;
    case "ambient":
      return dictionary.forms.audioGenreAmbient;
    case "techno":
      return dictionary.forms.audioGenreTechno;
    case "house":
      return dictionary.forms.audioGenreHouse;
    case "drum_and_bass":
      return dictionary.forms.audioGenreDrumAndBass;
    case "lofi":
      return dictionary.forms.audioGenreLofi;
    case "folk":
      return dictionary.forms.audioGenreFolk;
    case "metal":
      return dictionary.forms.audioGenreMetal;
    case "rnb":
      return dictionary.forms.audioGenreRnb;
    case "soundtrack":
      return dictionary.forms.audioGenreSoundtrack;
    case "game_audio":
      return dictionary.forms.audioGenreGameAudio;
    case "experimental":
      return dictionary.forms.audioGenreExperimental;
    default:
      return value;
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

export default function ProjectAudioDetails({
  dictionary,
  meta,
}: {
  dictionary: Dictionary;
  meta: AudioKindMetadata;
}) {
  const embedUrl = getAudioEmbedUrl(meta.trackUrl);
  const isSpotify =
    embedUrl !== null && embedUrl.startsWith("https://open.spotify.com/embed/");

  return (
    <div className="mt-6 space-y-5 rounded-2xl border app-border p-5">
      <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
        {dictionary.forms.audioSectionTitle}
      </h3>

      {embedUrl ? (
        <div className="overflow-hidden rounded-2xl bg-black">
          <iframe
            src={embedUrl}
            title={dictionary.forms.audioTrackUrlLabel}
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            className="block w-full"
            style={{ height: isSpotify ? 232 : 166 }}
          />
        </div>
      ) : meta.trackUrl ? (
        <a
          href={meta.trackUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border app-border px-4 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
        >
          {dictionary.forms.audioTrackUrlLabel}
        </a>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {meta.role && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.audioRoleLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {getAudioRoleLabel(meta.role, dictionary)}
            </p>
          </div>
        )}
        {meta.client && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.audioClientLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.client}
            </p>
          </div>
        )}
        {meta.durationSeconds !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.audioDurationLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {formatDuration(meta.durationSeconds)}
            </p>
          </div>
        )}
        {meta.bpm !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.audioBpmLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.bpm}
            </p>
          </div>
        )}
        {meta.musicalKey && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.audioKeyLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.musicalKey}
            </p>
          </div>
        )}
      </div>

      {meta.genres.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.audioGenresLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]"
              >
                {getAudioGenreLabel(genre, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.daws.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.audioDawsLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.daws.map((daw) => (
              <span
                key={daw}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {daw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
