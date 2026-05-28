import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  getVideoEmbedUrl,
  type MotionKindMetadata,
  type MotionPurpose,
  type MotionRole,
  type MotionTechnique,
} from "@/lib/project-kind-metadata";

function getMotionRoleLabel(role: MotionRole, dictionary: Dictionary) {
  switch (role) {
    case "motion_designer":
      return dictionary.forms.motionRoleMotionDesigner;
    case "animator":
      return dictionary.forms.motionRoleAnimator;
    case "character_animator":
      return dictionary.forms.motionRoleCharacterAnimator;
    case "art_director":
      return dictionary.forms.motionRoleArtDirector;
    case "illustrator":
      return dictionary.forms.motionRoleIllustrator;
    case "compositor":
      return dictionary.forms.motionRoleCompositor;
    case "fx_artist":
      return dictionary.forms.motionRoleFxArtist;
    case "lead":
      return dictionary.forms.motionRoleLead;
    default:
      return role;
  }
}

function getMotionTechniqueLabel(
  value: MotionTechnique,
  dictionary: Dictionary,
) {
  switch (value) {
    case "2d":
      return dictionary.forms.motionTechnique2d;
    case "3d":
      return dictionary.forms.motionTechnique3d;
    case "mixed":
      return dictionary.forms.motionTechniqueMixed;
    case "frame_by_frame":
      return dictionary.forms.motionTechniqueFrameByFrame;
    case "character":
      return dictionary.forms.motionTechniqueCharacter;
    case "kinetic_typography":
      return dictionary.forms.motionTechniqueKineticTypography;
    case "infographic":
      return dictionary.forms.motionTechniqueInfographic;
    case "particle_fx":
      return dictionary.forms.motionTechniqueParticleFx;
    case "rotoscope":
      return dictionary.forms.motionTechniqueRotoscope;
    case "motion_capture":
      return dictionary.forms.motionTechniqueMotionCapture;
    case "cell_animation":
      return dictionary.forms.motionTechniqueCellAnimation;
    case "stop_motion":
      return dictionary.forms.motionTechniqueStopMotion;
    case "isometric":
      return dictionary.forms.motionTechniqueIsometric;
    default:
      return value;
  }
}

function getMotionPurposeLabel(value: MotionPurpose, dictionary: Dictionary) {
  switch (value) {
    case "logo_reveal":
      return dictionary.forms.motionPurposeLogoReveal;
    case "explainer":
      return dictionary.forms.motionPurposeExplainer;
    case "intro_outro":
      return dictionary.forms.motionPurposeIntroOutro;
    case "commercial":
      return dictionary.forms.motionPurposeCommercial;
    case "social_media":
      return dictionary.forms.motionPurposeSocialMedia;
    case "app_animation":
      return dictionary.forms.motionPurposeAppAnimation;
    case "lottie_animation":
      return dictionary.forms.motionPurposeLottieAnimation;
    case "ui_animation":
      return dictionary.forms.motionPurposeUiAnimation;
    case "opener":
      return dictionary.forms.motionPurposeOpener;
    case "music_video":
      return dictionary.forms.motionPurposeMusicVideo;
    case "title_sequence":
      return dictionary.forms.motionPurposeTitleSequence;
    case "game_animation":
      return dictionary.forms.motionPurposeGameAnimation;
    case "education":
      return dictionary.forms.motionPurposeEducation;
    case "broadcast":
      return dictionary.forms.motionPurposeBroadcast;
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

export default function ProjectMotionDetails({
  dictionary,
  meta,
}: {
  dictionary: Dictionary;
  meta: MotionKindMetadata;
}) {
  const embedUrl = getVideoEmbedUrl(meta.previewUrl);

  return (
    <div className="mt-6 space-y-5 rounded-2xl border app-border p-5">
      <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
        {dictionary.forms.motionSectionTitle}
      </h3>

      {embedUrl ? (
        <div className="overflow-hidden rounded-2xl bg-black">
          <div className="relative aspect-video">
            <iframe
              src={embedUrl}
              title={dictionary.forms.motionPreviewUrlLabel}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      ) : meta.previewUrl ? (
        <a
          href={meta.previewUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border app-border px-4 py-2 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
        >
          {dictionary.forms.motionPreviewUrlLabel}
        </a>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {meta.role && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.motionRoleLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {getMotionRoleLabel(meta.role, dictionary)}
            </p>
          </div>
        )}
        {meta.client && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.motionClientLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {meta.client}
            </p>
          </div>
        )}
        {meta.durationSeconds !== null && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dictionary.forms.motionDurationLabel}
            </p>
            <p className="mt-2 text-sm text-[color:var(--foreground)]">
              {formatDuration(meta.durationSeconds)}
            </p>
          </div>
        )}
      </div>

      {meta.techniques.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.motionTechniquesLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.techniques.map((item) => (
              <span
                key={item}
                className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]"
              >
                {getMotionTechniqueLabel(item, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}

      {meta.tools.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.motionToolsLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.tools.map((tool) => (
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

      {meta.purposes.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {dictionary.forms.motionPurposesLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.purposes.map((item) => (
              <span
                key={item}
                className="rounded-full app-panel px-3 py-1 text-sm app-muted"
              >
                {getMotionPurposeLabel(item, dictionary)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
