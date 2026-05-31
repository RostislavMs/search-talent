"use client";

import FormSelect from "@/components/ui/form-select";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ChipToggleGroup, Field, UrlField } from "./shared";
import {
  getDesignRoleLabel,
  getDesignToolLabel,
  getDesignDeliverableLabel,
  getVideoRoleLabel,
  getVideoGenreLabel,
  getAudioRoleLabel,
  getAudioGenreLabel,
  getWritingRoleLabel,
  getWritingFormatLabel,
  getWritingTopicLabel,
  getWritingLanguageLabel,
  getMotionRoleLabel,
  getMotionTechniqueLabel,
  getMotionPurposeLabel,
  getQaRoleLabel,
  getQaTestTypeLabel,
  getQaMethodologyLabel,
  getThreeDRoleLabel,
  getThreeDStyleLabel,
  getPhotoRoleLabel,
  getPhotoGenreLabel,
  getPhotoMediumLabel,
  getCodeArchitectureLabel,
} from "./labels";
import {
  audioDaws,
  audioGenres,
  audioKeys,
  audioRoles,
  codeArchitectures,
  codeDatabases,
  codeHostings,
  codeLanguages,
  codeLicenses,
  designDeliverables,
  designRoles,
  designTools,
  motionPurposes,
  motionRoles,
  motionTechniques,
  motionTools,
  writingFormats,
  writingLanguages,
  writingRoles,
  writingTools,
  writingTopics,
  qaCertifications,
  qaMethodologies,
  qaRoles,
  qaTestTypes,
  qaTools,
  photoCameraBrands,
  photoEditingTools,
  photoGenres,
  photoMediums,
  photoRoles,
  threeDRenderEngines,
  threeDRoles,
  threeDSoftware,
  threeDStyles,
  videoFrameRates,
  videoGenres,
  videoResolutions,
  videoRoles,
  videoTools,
  type AudioDaw,
  type AudioGenre,
  type AudioKey,
  type AudioKindMetadata,
  type AudioRole,
  type CodeArchitecture,
  type CodeDatabase,
  type CodeHosting,
  type CodeKindMetadata,
  type CodeLanguage,
  type CodeLicense,
  type DesignDeliverable,
  type DesignKindMetadata,
  type DesignRole,
  type DesignTool,
  type MotionKindMetadata,
  type MotionPurpose,
  type MotionRole,
  type MotionTechnique,
  type MotionTool,
  type PhotoCameraBrand,
  type PhotoEditingTool,
  type PhotoGenre,
  type PhotoKindMetadata,
  type PhotoMedium,
  type PhotoRole,
  type QaCertification,
  type QaKindMetadata,
  type QaMethodology,
  type QaRole,
  type QaTestType,
  type QaTool,
  type ThreeDKindMetadata,
  type ThreeDRenderEngine,
  type ThreeDRole,
  type ThreeDSoftware,
  type ThreeDStyle,
  type VideoFrameRate,
  type VideoGenre,
  type VideoKindMetadata,
  type VideoResolution,
  type VideoRole,
  type VideoTool,
  type WritingFormat,
  type WritingKindMetadata,
  type WritingLanguage,
  type WritingRole,
  type WritingTool,
  type WritingTopic,
} from "@/lib/project-kind-metadata";

// Per-kind detail field groups. Each receives { dictionary, value, onChange }
// and is fully controlled by the parent form. Extracted from
// create-project-form.tsx.

export function DesignDetailsFields({
  dictionary,
  value,
  onChange,
}: {
  dictionary: Dictionary;
  value: DesignKindMetadata;
  onChange: (next: DesignKindMetadata) => void;
}) {
  const update = <K extends keyof DesignKindMetadata>(
    field: K,
    next: DesignKindMetadata[K],
  ) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="space-y-5 rounded-2xl border app-border p-5">
      <header>
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.designSectionTitle}
        </h3>
        <p className="mt-1 text-sm app-muted">
          {dictionary.forms.designSectionHint}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={dictionary.forms.designRoleLabel}
          htmlFor="design-role"
        >
          <FormSelect
            name="design-role"
            value={value.role || ""}
            onChange={(next) =>
              update("role", (next as DesignRole) || null)
            }
            placeholder={dictionary.forms.designRolePlaceholder}
            options={designRoles.map((role) => ({
              value: role,
              label: getDesignRoleLabel(role, dictionary),
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.designClientLabel}
          htmlFor="design-client"
        >
          <input
            id="design-client"
            type="text"
            placeholder={dictionary.forms.designClientPlaceholder}
            className="app-input"
            value={value.client ?? ""}
            onChange={(event) =>
              update("client", event.target.value || null)
            }
          />
        </Field>
      </div>

      <Field label={dictionary.forms.designToolsLabel}>
        <ChipToggleGroup<DesignTool>
          options={designTools}
          value={value.tools}
          onChange={(next) => update("tools", next)}
          getLabel={(tool) => getDesignToolLabel(tool, dictionary)}
        />
      </Field>

      <Field label={dictionary.forms.designDeliverablesLabel}>
        <ChipToggleGroup<DesignDeliverable>
          options={designDeliverables}
          value={value.deliverables}
          onChange={(next) => update("deliverables", next)}
          getLabel={(item) => getDesignDeliverableLabel(item, dictionary)}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <UrlField
          id="design-figma-url"
          label={dictionary.forms.designFigmaUrlLabel}
          placeholder={dictionary.forms.designFigmaUrlPlaceholder}
          value={value.figmaUrl ?? ""}
          onChange={(next) => update("figmaUrl", next || null)}
          invalidMessage={dictionary.forms.invalidUrl}
        />

        <UrlField
          id="design-behance-url"
          label={dictionary.forms.designBehanceUrlLabel}
          placeholder={dictionary.forms.designBehanceUrlPlaceholder}
          value={value.behanceUrl ?? ""}
          onChange={(next) => update("behanceUrl", next || null)}
          invalidMessage={dictionary.forms.invalidUrl}
        />

        <UrlField
          id="design-dribbble-url"
          label={dictionary.forms.designDribbbleUrlLabel}
          placeholder={dictionary.forms.designDribbbleUrlPlaceholder}
          value={value.dribbbleUrl ?? ""}
          onChange={(next) => update("dribbbleUrl", next || null)}
          invalidMessage={dictionary.forms.invalidUrl}
        />
      </div>
    </section>
  );
}

export function CodeDetailsFields({
  dictionary,
  value,
  onChange,
}: {
  dictionary: Dictionary;
  value: CodeKindMetadata;
  onChange: (next: CodeKindMetadata) => void;
}) {
  const update = <K extends keyof CodeKindMetadata>(
    field: K,
    next: CodeKindMetadata[K],
  ) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="space-y-5 rounded-2xl border app-border p-5">
      <header>
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.codeSectionTitle}
        </h3>
        <p className="mt-1 text-sm app-muted">
          {dictionary.forms.codeSectionHint}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={dictionary.forms.codeArchitectureLabel}
          htmlFor="code-architecture"
        >
          <FormSelect
            name="code-architecture"
            value={value.architecture || ""}
            onChange={(next) =>
              update("architecture", (next as CodeArchitecture) || null)
            }
            placeholder={dictionary.forms.codeArchitecturePlaceholder}
            options={codeArchitectures.map((arch) => ({
              value: arch,
              label: getCodeArchitectureLabel(arch, dictionary),
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.codePrimaryLanguageLabel}
          htmlFor="code-primary-language"
        >
          <FormSelect
            name="code-primary-language"
            value={value.primaryLanguage || ""}
            onChange={(next) =>
              update("primaryLanguage", (next as CodeLanguage) || null)
            }
            placeholder={dictionary.forms.codePrimaryLanguagePlaceholder}
            options={codeLanguages.map((language) => ({
              value: language,
              label: language,
            }))}
          />
        </Field>
      </div>

      <Field
        label={dictionary.forms.codeHostingLabel}
        description={dictionary.forms.codeHostingHint}
      >
        <ChipToggleGroup<CodeHosting>
          options={codeHostings}
          value={value.hosting}
          onChange={(next) => update("hosting", next)}
          getLabel={(item) => item}
        />
      </Field>

      <Field label={dictionary.forms.codeDatabasesLabel}>
        <ChipToggleGroup<CodeDatabase>
          options={codeDatabases}
          value={value.databases}
          onChange={(next) => update("databases", next)}
          getLabel={(item) => item}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={dictionary.forms.codeLicenseLabel}
          htmlFor="code-license"
        >
          <FormSelect
            name="code-license"
            value={value.license || ""}
            onChange={(next) =>
              update("license", (next as CodeLicense) || null)
            }
            placeholder={dictionary.forms.codeLicensePlaceholder}
            options={codeLicenses.map((license) => ({
              value: license,
              label: license,
            }))}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <UrlField
          id="code-docs-url"
          label={dictionary.forms.codeDocsUrlLabel}
          placeholder={dictionary.forms.codeUrlPlaceholder}
          value={value.docsUrl ?? ""}
          onChange={(next) => update("docsUrl", next || null)}
          invalidMessage={dictionary.forms.invalidUrl}
        />

        <UrlField
          id="code-storybook-url"
          label={dictionary.forms.codeStorybookUrlLabel}
          placeholder={dictionary.forms.codeUrlPlaceholder}
          value={value.storybookUrl ?? ""}
          onChange={(next) => update("storybookUrl", next || null)}
          invalidMessage={dictionary.forms.invalidUrl}
        />

        <UrlField
          id="code-api-playground-url"
          label={dictionary.forms.codeApiPlaygroundUrlLabel}
          placeholder={dictionary.forms.codeUrlPlaceholder}
          value={value.apiPlaygroundUrl ?? ""}
          onChange={(next) => update("apiPlaygroundUrl", next || null)}
          invalidMessage={dictionary.forms.invalidUrl}
        />
      </div>
    </section>
  );
}

export function VideoDetailsFields({
  dictionary,
  value,
  durationInput,
  onChange,
  onDurationInputChange,
}: {
  dictionary: Dictionary;
  value: VideoKindMetadata;
  durationInput: string;
  onChange: (next: VideoKindMetadata) => void;
  onDurationInputChange: (next: string) => void;
}) {
  const update = <K extends keyof VideoKindMetadata>(
    field: K,
    next: VideoKindMetadata[K],
  ) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="space-y-5 rounded-2xl border app-border p-5">
      <header>
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.videoSectionTitle}
        </h3>
        <p className="mt-1 text-sm app-muted">
          {dictionary.forms.videoSectionHint}
        </p>
      </header>

      <UrlField
        id="video-showreel-url"
        label={dictionary.forms.videoShowreelUrlLabel}
        description={dictionary.forms.videoShowreelUrlHint}
        placeholder={dictionary.forms.videoShowreelUrlPlaceholder}
        value={value.showreelUrl ?? ""}
        onChange={(next) => update("showreelUrl", next || null)}
        invalidMessage={dictionary.forms.invalidUrl}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={dictionary.forms.videoRoleLabel} htmlFor="video-role">
          <FormSelect
            name="video-role"
            value={value.role || ""}
            onChange={(next) =>
              update("role", (next as VideoRole) || null)
            }
            placeholder={dictionary.forms.videoRolePlaceholder}
            options={videoRoles.map((role) => ({
              value: role,
              label: getVideoRoleLabel(role, dictionary),
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.videoClientLabel}
          htmlFor="video-client"
        >
          <input
            id="video-client"
            type="text"
            placeholder={dictionary.forms.videoClientPlaceholder}
            className="app-input"
            value={value.client ?? ""}
            onChange={(event) =>
              update("client", event.target.value || null)
            }
          />
        </Field>
      </div>

      <Field label={dictionary.forms.videoToolsLabel}>
        <ChipToggleGroup<VideoTool>
          options={videoTools}
          value={value.tools}
          onChange={(next) => update("tools", next)}
          getLabel={(item) => item}
        />
      </Field>

      <Field label={dictionary.forms.videoGenresLabel}>
        <ChipToggleGroup<VideoGenre>
          options={videoGenres}
          value={value.genres}
          onChange={(next) => update("genres", next)}
          getLabel={(item) => getVideoGenreLabel(item, dictionary)}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label={dictionary.forms.videoResolutionLabel}
          htmlFor="video-resolution"
        >
          <FormSelect
            name="video-resolution"
            value={value.resolution || ""}
            onChange={(next) =>
              update("resolution", (next as VideoResolution) || null)
            }
            placeholder={dictionary.forms.videoResolutionPlaceholder}
            options={videoResolutions.map((res) => ({
              value: res,
              label: res,
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.videoFrameRateLabel}
          htmlFor="video-frame-rate"
        >
          <FormSelect
            name="video-frame-rate"
            value={value.frameRate || ""}
            onChange={(next) =>
              update("frameRate", (next as VideoFrameRate) || null)
            }
            placeholder={dictionary.forms.videoFrameRatePlaceholder}
            options={videoFrameRates.map((fps) => ({
              value: fps,
              label: `${fps} ${dictionary.forms.videoFrameRateOptionSuffix}`,
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.videoDurationLabel}
          htmlFor="video-duration"
          description={dictionary.forms.videoDurationHint}
        >
          <input
            id="video-duration"
            type="text"
            placeholder={dictionary.forms.videoDurationPlaceholder}
            className="app-input"
            value={durationInput}
            onChange={(event) => onDurationInputChange(event.target.value)}
          />
        </Field>
      </div>
    </section>
  );
}

export function PhotoDetailsFields({
  dictionary,
  value,
  onChange,
}: {
  dictionary: Dictionary;
  value: PhotoKindMetadata;
  onChange: (next: PhotoKindMetadata) => void;
}) {
  const update = <K extends keyof PhotoKindMetadata>(
    field: K,
    next: PhotoKindMetadata[K],
  ) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="space-y-5 rounded-2xl border app-border p-5">
      <header>
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.photoSectionTitle}
        </h3>
        <p className="mt-1 text-sm app-muted">
          {dictionary.forms.photoSectionHint}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={dictionary.forms.photoRoleLabel} htmlFor="photo-role">
          <FormSelect
            name="photo-role"
            value={value.role || ""}
            onChange={(next) =>
              update("role", (next as PhotoRole) || null)
            }
            placeholder={dictionary.forms.photoRolePlaceholder}
            options={photoRoles.map((role) => ({
              value: role,
              label: getPhotoRoleLabel(role, dictionary),
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.photoMediumLabel}
          htmlFor="photo-medium"
        >
          <FormSelect
            name="photo-medium"
            value={value.medium || ""}
            onChange={(next) =>
              update("medium", (next as PhotoMedium) || null)
            }
            placeholder={dictionary.forms.photoMediumPlaceholder}
            options={photoMediums.map((medium) => ({
              value: medium,
              label: getPhotoMediumLabel(medium, dictionary),
            }))}
          />
        </Field>
      </div>

      <Field label={dictionary.forms.photoGenresLabel}>
        <ChipToggleGroup<PhotoGenre>
          options={photoGenres}
          value={value.genres}
          onChange={(next) => update("genres", next)}
          getLabel={(item) => getPhotoGenreLabel(item, dictionary)}
        />
      </Field>

      <Field label={dictionary.forms.photoCamerasLabel}>
        <ChipToggleGroup<PhotoCameraBrand>
          options={photoCameraBrands}
          value={value.cameras}
          onChange={(next) => update("cameras", next)}
          getLabel={(item) => item}
        />
      </Field>

      <Field label={dictionary.forms.photoEditingToolsLabel}>
        <ChipToggleGroup<PhotoEditingTool>
          options={photoEditingTools}
          value={value.editingTools}
          onChange={(next) => update("editingTools", next)}
          getLabel={(item) => item}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label={dictionary.forms.photoShotCountLabel}
          htmlFor="photo-shot-count"
        >
          <input
            id="photo-shot-count"
            type="number"
            min={1}
            placeholder={dictionary.forms.photoShotCountPlaceholder}
            className="app-input"
            value={value.shotCount ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              if (!raw) {
                update("shotCount", null);
                return;
              }
              const parsed = Number(raw);
              update(
                "shotCount",
                Number.isFinite(parsed) && parsed > 0
                  ? Math.min(Math.floor(parsed), 1_000_000)
                  : null,
              );
            }}
          />
        </Field>

        <Field
          label={dictionary.forms.photoLocationLabel}
          htmlFor="photo-location"
        >
          <input
            id="photo-location"
            type="text"
            placeholder={dictionary.forms.photoLocationPlaceholder}
            className="app-input"
            value={value.location ?? ""}
            onChange={(event) =>
              update("location", event.target.value || null)
            }
          />
        </Field>

        <Field
          label={dictionary.forms.photoClientLabel}
          htmlFor="photo-client"
        >
          <input
            id="photo-client"
            type="text"
            placeholder={dictionary.forms.photoClientPlaceholder}
            className="app-input"
            value={value.client ?? ""}
            onChange={(event) =>
              update("client", event.target.value || null)
            }
          />
        </Field>
      </div>
    </section>
  );
}

export function ThreeDDetailsFields({
  dictionary,
  value,
  onChange,
}: {
  dictionary: Dictionary;
  value: ThreeDKindMetadata;
  onChange: (next: ThreeDKindMetadata) => void;
}) {
  const update = <K extends keyof ThreeDKindMetadata>(
    field: K,
    next: ThreeDKindMetadata[K],
  ) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="space-y-5 rounded-2xl border app-border p-5">
      <header>
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.threeDSectionTitle}
        </h3>
        <p className="mt-1 text-sm app-muted">
          {dictionary.forms.threeDSectionHint}
        </p>
      </header>

      <UrlField
        id="threed-model-url"
        label={dictionary.forms.threeDModelUrlLabel}
        description={dictionary.forms.threeDModelUrlHint}
        placeholder={dictionary.forms.threeDModelUrlPlaceholder}
        value={value.modelUrl ?? ""}
        onChange={(next) => update("modelUrl", next || null)}
        invalidMessage={dictionary.forms.invalidUrl}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={dictionary.forms.threeDRoleLabel} htmlFor="threed-role">
          <FormSelect
            name="threed-role"
            value={value.role || ""}
            onChange={(next) =>
              update("role", (next as ThreeDRole) || null)
            }
            placeholder={dictionary.forms.threeDRolePlaceholder}
            options={threeDRoles.map((role) => ({
              value: role,
              label: getThreeDRoleLabel(role, dictionary),
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.threeDClientLabel}
          htmlFor="threed-client"
        >
          <input
            id="threed-client"
            type="text"
            placeholder={dictionary.forms.threeDClientPlaceholder}
            className="app-input"
            value={value.client ?? ""}
            onChange={(event) =>
              update("client", event.target.value || null)
            }
          />
        </Field>
      </div>

      <Field label={dictionary.forms.threeDSoftwareLabel}>
        <ChipToggleGroup<ThreeDSoftware>
          options={threeDSoftware}
          value={value.software}
          onChange={(next) => update("software", next)}
          getLabel={(item) => item}
        />
      </Field>

      <Field label={dictionary.forms.threeDStylesLabel}>
        <ChipToggleGroup<ThreeDStyle>
          options={threeDStyles}
          value={value.styles}
          onChange={(next) => update("styles", next)}
          getLabel={(item) => getThreeDStyleLabel(item, dictionary)}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={dictionary.forms.threeDRenderEngineLabel}
          htmlFor="threed-engine"
        >
          <FormSelect
            name="threed-engine"
            value={value.renderEngine || ""}
            onChange={(next) =>
              update("renderEngine", (next as ThreeDRenderEngine) || null)
            }
            placeholder={dictionary.forms.threeDRenderEnginePlaceholder}
            options={threeDRenderEngines.map((engine) => ({
              value: engine,
              label: engine,
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.threeDPolygonCountLabel}
          htmlFor="threed-polygon-count"
        >
          <input
            id="threed-polygon-count"
            type="number"
            min={1}
            placeholder={dictionary.forms.threeDPolygonCountPlaceholder}
            className="app-input"
            value={value.polygonCount ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              if (!raw) {
                update("polygonCount", null);
                return;
              }
              const parsed = Number(raw);
              update(
                "polygonCount",
                Number.isFinite(parsed) && parsed > 0
                  ? Math.min(Math.floor(parsed), 1_000_000_000)
                  : null,
              );
            }}
          />
        </Field>
      </div>
    </section>
  );
}

export function AudioDetailsFields({
  dictionary,
  value,
  durationInput,
  onChange,
  onDurationInputChange,
}: {
  dictionary: Dictionary;
  value: AudioKindMetadata;
  durationInput: string;
  onChange: (next: AudioKindMetadata) => void;
  onDurationInputChange: (next: string) => void;
}) {
  const update = <K extends keyof AudioKindMetadata>(
    field: K,
    next: AudioKindMetadata[K],
  ) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="space-y-5 rounded-2xl border app-border p-5">
      <header>
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.audioSectionTitle}
        </h3>
        <p className="mt-1 text-sm app-muted">
          {dictionary.forms.audioSectionHint}
        </p>
      </header>

      <UrlField
        id="audio-track-url"
        label={dictionary.forms.audioTrackUrlLabel}
        description={dictionary.forms.audioTrackUrlHint}
        placeholder={dictionary.forms.audioTrackUrlPlaceholder}
        value={value.trackUrl ?? ""}
        onChange={(next) => update("trackUrl", next || null)}
        invalidMessage={dictionary.forms.invalidUrl}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={dictionary.forms.audioRoleLabel} htmlFor="audio-role">
          <FormSelect
            name="audio-role"
            value={value.role || ""}
            onChange={(next) =>
              update("role", (next as AudioRole) || null)
            }
            placeholder={dictionary.forms.audioRolePlaceholder}
            options={audioRoles.map((role) => ({
              value: role,
              label: getAudioRoleLabel(role, dictionary),
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.audioClientLabel}
          htmlFor="audio-client"
        >
          <input
            id="audio-client"
            type="text"
            placeholder={dictionary.forms.audioClientPlaceholder}
            className="app-input"
            value={value.client ?? ""}
            onChange={(event) =>
              update("client", event.target.value || null)
            }
          />
        </Field>
      </div>

      <Field label={dictionary.forms.audioGenresLabel}>
        <ChipToggleGroup<AudioGenre>
          options={audioGenres}
          value={value.genres}
          onChange={(next) => update("genres", next)}
          getLabel={(item) => getAudioGenreLabel(item, dictionary)}
        />
      </Field>

      <Field label={dictionary.forms.audioDawsLabel}>
        <ChipToggleGroup<AudioDaw>
          options={audioDaws}
          value={value.daws}
          onChange={(next) => update("daws", next)}
          getLabel={(item) => item}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-4">
        <Field
          label={dictionary.forms.audioDurationLabel}
          htmlFor="audio-duration"
          description={dictionary.forms.audioDurationHint}
        >
          <input
            id="audio-duration"
            type="text"
            placeholder={dictionary.forms.audioDurationPlaceholder}
            className="app-input"
            value={durationInput}
            onChange={(event) => onDurationInputChange(event.target.value)}
          />
        </Field>

        <Field label={dictionary.forms.audioBpmLabel} htmlFor="audio-bpm">
          <input
            id="audio-bpm"
            type="number"
            min={1}
            max={400}
            placeholder={dictionary.forms.audioBpmPlaceholder}
            className="app-input"
            value={value.bpm ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              if (!raw) {
                update("bpm", null);
                return;
              }
              const parsed = Number(raw);
              update(
                "bpm",
                Number.isFinite(parsed) && parsed > 0
                  ? Math.min(Math.floor(parsed), 400)
                  : null,
              );
            }}
          />
        </Field>

        <Field
          label={dictionary.forms.audioKeyLabel}
          htmlFor="audio-key"
          className="md:col-span-2"
        >
          <FormSelect
            name="audio-key"
            value={value.musicalKey || ""}
            onChange={(next) =>
              update("musicalKey", (next as AudioKey) || null)
            }
            placeholder={dictionary.forms.audioKeyPlaceholder}
            options={audioKeys.map((key) => ({
              value: key,
              label: key,
            }))}
          />
        </Field>
      </div>
    </section>
  );
}

export function QaDetailsFields({
  dictionary,
  value,
  onChange,
}: {
  dictionary: Dictionary;
  value: QaKindMetadata;
  onChange: (next: QaKindMetadata) => void;
}) {
  const update = <K extends keyof QaKindMetadata>(
    field: K,
    next: QaKindMetadata[K],
  ) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="space-y-5 rounded-2xl border app-border p-5">
      <header>
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.qaSectionTitle}
        </h3>
        <p className="mt-1 text-sm app-muted">
          {dictionary.forms.qaSectionHint}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={dictionary.forms.qaRoleLabel} htmlFor="qa-role">
          <FormSelect
            name="qa-role"
            value={value.role || ""}
            onChange={(next) => update("role", (next as QaRole) || null)}
            placeholder={dictionary.forms.qaRolePlaceholder}
            options={qaRoles.map((role) => ({
              value: role,
              label: getQaRoleLabel(role, dictionary),
            }))}
          />
        </Field>

        <Field label={dictionary.forms.qaClientLabel} htmlFor="qa-client">
          <input
            id="qa-client"
            type="text"
            placeholder={dictionary.forms.qaClientPlaceholder}
            className="app-input"
            value={value.client ?? ""}
            onChange={(event) =>
              update("client", event.target.value || null)
            }
          />
        </Field>
      </div>

      <Field label={dictionary.forms.qaTestTypesLabel}>
        <ChipToggleGroup<QaTestType>
          options={qaTestTypes}
          value={value.testTypes}
          onChange={(next) => update("testTypes", next)}
          getLabel={(item) => getQaTestTypeLabel(item, dictionary)}
        />
      </Field>

      <Field label={dictionary.forms.qaToolsLabel}>
        <ChipToggleGroup<QaTool>
          options={qaTools}
          value={value.tools}
          onChange={(next) => update("tools", next)}
          getLabel={(item) => item}
        />
      </Field>

      <Field label={dictionary.forms.qaMethodologiesLabel}>
        <ChipToggleGroup<QaMethodology>
          options={qaMethodologies}
          value={value.methodologies}
          onChange={(next) => update("methodologies", next)}
          getLabel={(item) => getQaMethodologyLabel(item, dictionary)}
        />
      </Field>

      <Field label={dictionary.forms.qaCertificationsLabel}>
        <ChipToggleGroup<QaCertification>
          options={qaCertifications}
          value={value.certifications}
          onChange={(next) => update("certifications", next)}
          getLabel={(item) => item}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label={dictionary.forms.qaTestCasesCountLabel}
          htmlFor="qa-test-cases-count"
        >
          <input
            id="qa-test-cases-count"
            type="number"
            min={1}
            placeholder={dictionary.forms.qaTestCasesCountPlaceholder}
            className="app-input"
            value={value.testCasesCount ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              if (!raw) {
                update("testCasesCount", null);
                return;
              }
              const parsed = Number(raw);
              update(
                "testCasesCount",
                Number.isFinite(parsed) && parsed > 0
                  ? Math.min(Math.floor(parsed), 1_000_000)
                  : null,
              );
            }}
          />
        </Field>

        <Field
          label={dictionary.forms.qaBugsFoundCountLabel}
          htmlFor="qa-bugs-found-count"
        >
          <input
            id="qa-bugs-found-count"
            type="number"
            min={1}
            placeholder={dictionary.forms.qaBugsFoundCountPlaceholder}
            className="app-input"
            value={value.bugsFoundCount ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              if (!raw) {
                update("bugsFoundCount", null);
                return;
              }
              const parsed = Number(raw);
              update(
                "bugsFoundCount",
                Number.isFinite(parsed) && parsed > 0
                  ? Math.min(Math.floor(parsed), 1_000_000)
                  : null,
              );
            }}
          />
        </Field>

        <Field
          label={dictionary.forms.qaAutomationCoverageLabel}
          htmlFor="qa-automation-coverage"
        >
          <input
            id="qa-automation-coverage"
            type="number"
            min={0}
            max={100}
            placeholder={dictionary.forms.qaAutomationCoveragePlaceholder}
            className="app-input"
            value={value.automationCoveragePercent ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              if (!raw) {
                update("automationCoveragePercent", null);
                return;
              }
              const parsed = Number(raw);
              update(
                "automationCoveragePercent",
                Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
                  ? Math.round(parsed)
                  : null,
              );
            }}
          />
        </Field>
      </div>

      <UrlField
        id="qa-report-url"
        label={dictionary.forms.qaReportUrlLabel}
        description={dictionary.forms.qaReportUrlHint}
        placeholder={dictionary.forms.qaReportUrlPlaceholder}
        value={value.reportUrl ?? ""}
        onChange={(next) => update("reportUrl", next || null)}
        invalidMessage={dictionary.forms.invalidUrl}
      />
    </section>
  );
}

export function MotionDetailsFields({
  dictionary,
  value,
  durationInput,
  onChange,
  onDurationInputChange,
}: {
  dictionary: Dictionary;
  value: MotionKindMetadata;
  durationInput: string;
  onChange: (next: MotionKindMetadata) => void;
  onDurationInputChange: (next: string) => void;
}) {
  const update = <K extends keyof MotionKindMetadata>(
    field: K,
    next: MotionKindMetadata[K],
  ) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="space-y-5 rounded-2xl border app-border p-5">
      <header>
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.motionSectionTitle}
        </h3>
        <p className="mt-1 text-sm app-muted">
          {dictionary.forms.motionSectionHint}
        </p>
      </header>

      <UrlField
        id="motion-preview-url"
        label={dictionary.forms.motionPreviewUrlLabel}
        description={dictionary.forms.motionPreviewUrlHint}
        placeholder={dictionary.forms.motionPreviewUrlPlaceholder}
        value={value.previewUrl ?? ""}
        onChange={(next) => update("previewUrl", next || null)}
        invalidMessage={dictionary.forms.invalidUrl}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={dictionary.forms.motionRoleLabel} htmlFor="motion-role">
          <FormSelect
            name="motion-role"
            value={value.role || ""}
            onChange={(next) =>
              update("role", (next as MotionRole) || null)
            }
            placeholder={dictionary.forms.motionRolePlaceholder}
            options={motionRoles.map((role) => ({
              value: role,
              label: getMotionRoleLabel(role, dictionary),
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.motionClientLabel}
          htmlFor="motion-client"
        >
          <input
            id="motion-client"
            type="text"
            placeholder={dictionary.forms.motionClientPlaceholder}
            className="app-input"
            value={value.client ?? ""}
            onChange={(event) =>
              update("client", event.target.value || null)
            }
          />
        </Field>
      </div>

      <Field label={dictionary.forms.motionTechniquesLabel}>
        <ChipToggleGroup<MotionTechnique>
          options={motionTechniques}
          value={value.techniques}
          onChange={(next) => update("techniques", next)}
          getLabel={(item) => getMotionTechniqueLabel(item, dictionary)}
        />
      </Field>

      <Field label={dictionary.forms.motionToolsLabel}>
        <ChipToggleGroup<MotionTool>
          options={motionTools}
          value={value.tools}
          onChange={(next) => update("tools", next)}
          getLabel={(item) => item}
        />
      </Field>

      <Field label={dictionary.forms.motionPurposesLabel}>
        <ChipToggleGroup<MotionPurpose>
          options={motionPurposes}
          value={value.purposes}
          onChange={(next) => update("purposes", next)}
          getLabel={(item) => getMotionPurposeLabel(item, dictionary)}
        />
      </Field>

      <Field
        label={dictionary.forms.motionDurationLabel}
        htmlFor="motion-duration"
        description={dictionary.forms.motionDurationHint}
      >
        <input
          id="motion-duration"
          type="text"
          placeholder={dictionary.forms.motionDurationPlaceholder}
          className="app-input"
          value={durationInput}
          onChange={(event) => onDurationInputChange(event.target.value)}
        />
      </Field>
    </section>
  );
}

export function WritingDetailsFields({
  dictionary,
  value,
  onChange,
}: {
  dictionary: Dictionary;
  value: WritingKindMetadata;
  onChange: (next: WritingKindMetadata) => void;
}) {
  const update = <K extends keyof WritingKindMetadata>(
    field: K,
    next: WritingKindMetadata[K],
  ) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="space-y-5 rounded-2xl border app-border p-5">
      <header>
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.forms.writingSectionTitle}
        </h3>
        <p className="mt-1 text-sm app-muted">
          {dictionary.forms.writingSectionHint}
        </p>
      </header>

      <UrlField
        id="writing-article-url"
        label={dictionary.forms.writingArticleUrlLabel}
        description={dictionary.forms.writingArticleUrlHint}
        placeholder={dictionary.forms.writingArticleUrlPlaceholder}
        value={value.articleUrl ?? ""}
        onChange={(next) => update("articleUrl", next || null)}
        invalidMessage={dictionary.forms.invalidUrl}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={dictionary.forms.writingRoleLabel} htmlFor="writing-role">
          <FormSelect
            name="writing-role"
            value={value.role || ""}
            onChange={(next) =>
              update("role", (next as WritingRole) || null)
            }
            placeholder={dictionary.forms.writingRolePlaceholder}
            options={writingRoles.map((role) => ({
              value: role,
              label: getWritingRoleLabel(role, dictionary),
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.writingClientLabel}
          htmlFor="writing-client"
        >
          <input
            id="writing-client"
            type="text"
            placeholder={dictionary.forms.writingClientPlaceholder}
            className="app-input"
            value={value.client ?? ""}
            onChange={(event) =>
              update("client", event.target.value || null)
            }
          />
        </Field>
      </div>

      <Field label={dictionary.forms.writingFormatsLabel}>
        <ChipToggleGroup<WritingFormat>
          options={writingFormats}
          value={value.formats}
          onChange={(next) => update("formats", next)}
          getLabel={(item) => getWritingFormatLabel(item, dictionary)}
        />
      </Field>

      <Field label={dictionary.forms.writingTopicsLabel}>
        <ChipToggleGroup<WritingTopic>
          options={writingTopics}
          value={value.topics}
          onChange={(next) => update("topics", next)}
          getLabel={(item) => getWritingTopicLabel(item, dictionary)}
        />
      </Field>

      <Field label={dictionary.forms.writingToolsLabel}>
        <ChipToggleGroup<WritingTool>
          options={writingTools}
          value={value.tools}
          onChange={(next) => update("tools", next)}
          getLabel={(item) => item}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label={dictionary.forms.writingLanguageLabel}
          htmlFor="writing-language"
        >
          <FormSelect
            name="writing-language"
            value={value.language || ""}
            onChange={(next) =>
              update("language", (next as WritingLanguage) || null)
            }
            placeholder={dictionary.forms.writingLanguagePlaceholder}
            options={writingLanguages.map((lang) => ({
              value: lang,
              label: getWritingLanguageLabel(lang, dictionary),
            }))}
          />
        </Field>

        <Field
          label={dictionary.forms.writingWordCountLabel}
          htmlFor="writing-word-count"
        >
          <input
            id="writing-word-count"
            type="number"
            min={1}
            placeholder={dictionary.forms.writingWordCountPlaceholder}
            className="app-input"
            value={value.wordCount ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              if (!raw) {
                update("wordCount", null);
                return;
              }
              const parsed = Number(raw);
              update(
                "wordCount",
                Number.isFinite(parsed) && parsed > 0
                  ? Math.min(Math.floor(parsed), 10_000_000)
                  : null,
              );
            }}
          />
        </Field>

        <Field
          label={dictionary.forms.writingReadingTimeLabel}
          htmlFor="writing-reading-time"
        >
          <input
            id="writing-reading-time"
            type="number"
            min={1}
            placeholder={dictionary.forms.writingReadingTimePlaceholder}
            className="app-input"
            value={value.readingTimeMinutes ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              if (!raw) {
                update("readingTimeMinutes", null);
                return;
              }
              const parsed = Number(raw);
              update(
                "readingTimeMinutes",
                Number.isFinite(parsed) && parsed > 0
                  ? Math.min(Math.floor(parsed), 10_000)
                  : null,
              );
            }}
          />
        </Field>
      </div>
    </section>
  );
}
