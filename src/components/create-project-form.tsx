"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import GithubRepoImporter, {
  type GithubImportPayload,
} from "@/components/github-repo-importer";
import TagSelect from "@/components/ui/tag-select";
import FormSelect from "@/components/ui/form-select";
import FormTextarea from "@/components/ui/form-textarea";
import { apiFetch } from "@/lib/api-client";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { compressImageFile } from "@/lib/image-compression";
import {
  buildProjectPath,
  getProjectKindLabel,
  projectKinds,
  projectStatuses,
  slugify,
  type ProjectKind,
  type ProjectStatus,
  type ProjectVisibilityStatus,
} from "@/lib/projects";
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
  normalizeAudioKindMetadata,
  normalizeCodeKindMetadata,
  normalizeDesignKindMetadata,
  normalizeMotionKindMetadata,
  normalizePhotoKindMetadata,
  normalizeQaKindMetadata,
  normalizeThreeDKindMetadata,
  normalizeVideoKindMetadata,
  normalizeWritingKindMetadata,
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
  type ProjectKindMetadata,
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
import {
  DEFAULT_GITHUB_DISPLAY_OPTIONS,
  GITHUB_FIELD_LIMITS,
  GITHUB_PROJECT_ROLES,
  type GithubDisplayOptions,
  type GithubProjectRole,
} from "@/lib/constants/github";
import {
  buildYouTubeEmbedUrl,
  getYouTubeVideoId,
  inferProjectMediaKind,
  type ProjectMediaItem,
  type ProjectMediaKind,
} from "@/lib/project-media";
import { projectPayloadSchema } from "@/lib/validation/project";
import { isValidPublicUrl } from "@/lib/url-validation";
import { uploadWithProgress } from "@/lib/storage/upload-with-progress";

// Photography projects keep originals at full resolution, so they get the
// largest budget. Other kinds compress images on upload (browser-image-
// compression to ~0.6 MB), so the raw cap is intentionally tight — anyone
// uploading >5 MB outside of photo is almost always misclicking.
const MAX_NON_PHOTO_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_IMAGE_BYTES = 25 * 1024 * 1024;
// Video projects upload showreels and extras as primary content. Other
// kinds (design, code, motion, etc.) might attach a short clip but rarely
// need anything over 100 MB.
const MAX_NON_VIDEO_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_KIND_VIDEO_BYTES = 400 * 1024 * 1024;

function getImageSizeLimitBytes(kind: ProjectKind | ""): number {
  return kind === "photo" ? MAX_PHOTO_IMAGE_BYTES : MAX_NON_PHOTO_IMAGE_BYTES;
}

function getVideoSizeLimitBytes(kind: ProjectKind | ""): number {
  return kind === "video"
    ? MAX_VIDEO_KIND_VIDEO_BYTES
    : MAX_NON_VIDEO_VIDEO_BYTES;
}

function bytesToMb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}
const BASE_TOTAL_STEPS = 5;
const DEFAULT_ASPECT_RATIO = 16 / 10;

type MetaOption = {
  id: number;
  name: string;
};

export type EditableProject = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  role: string | null;
  kind: ProjectKind | null;
  kind_metadata?: ProjectKindMetadata | null;
  project_status: ProjectStatus | null;
  team_size: number | null;
  project_url: string | null;
  repository_url: string | null;
  started_on: string | null;
  completed_on: string | null;
  problem: string | null;
  solution: string | null;
  results: string | null;
  status?: ProjectVisibilityStatus | null;
  technologies: { id: number; name: string }[];
  media?: ProjectMediaItem[];
  github_full_name?: string | null;
  github_role?: GithubProjectRole | null;
  github_contribution?: string | null;
  github_motivation?: string | null;
  github_tech_decisions?: string | null;
  github_learnings?: string | null;
  github_showcase_notes?: string | null;
  github_production_usage?: string | null;
  github_display_options?: Partial<GithubDisplayOptions> | null;
  github_auto_sync?: boolean | null;
  allow_downloads?: boolean | null;
};

type ProjectFormState = {
  title: string;
  description: string;
  role: string;
  kind: ProjectKind | "";
  designMeta: DesignKindMetadata;
  codeMeta: CodeKindMetadata;
  videoMeta: VideoKindMetadata;
  videoDurationInput: string;
  photoMeta: PhotoKindMetadata;
  threeDMeta: ThreeDKindMetadata;
  audioMeta: AudioKindMetadata;
  audioDurationInput: string;
  qaMeta: QaKindMetadata;
  motionMeta: MotionKindMetadata;
  motionDurationInput: string;
  writingMeta: WritingKindMetadata;
  projectStatus: ProjectStatus | "";
  teamSize: string;
  projectUrl: string;
  repositoryUrl: string;
  startedOn: string;
  completedOn: string;
  problem: string;
  solution: string;
  results: string;
  githubRole: GithubProjectRole | "";
  githubContribution: string;
  githubMotivation: string;
  githubTechDecisions: string;
  githubLearnings: string;
  githubShowcaseNotes: string;
  githubProductionUsage: string;
  githubDisplayOptions: GithubDisplayOptions;
  githubAutoSync: boolean;
  allowDownloads: boolean;
};

type SaveMode = "draft" | "publish";

type LocalMediaItem = {
  id: string;
  kind: "local";
  file: File;
  previewUrl: string;
  mediaKind: ProjectMediaKind;
  aspectRatio: number;
};

type RemoteMediaItem = {
  id: string;
  kind: "remote";
  remoteId: string;
  url: string;
  mediaKind: ProjectMediaKind;
  storagePath: string | null;
  mimeType: string | null;
  fileSize: number | null;
  aspectRatio: number;
  youTubeId: string | null;
};

type YouTubeMediaItem = {
  id: string;
  kind: "youtube";
  url: string;
  videoId: string;
  mediaKind: "video";
  aspectRatio: number;
};

type WizardMediaItem = LocalMediaItem | RemoteMediaItem | YouTubeMediaItem;

function getDesignRoleLabel(role: DesignRole, dictionary: Dictionary) {
  switch (role) {
    case "ui":
      return dictionary.forms.designRoleUi;
    case "ux":
      return dictionary.forms.designRoleUx;
    case "product":
      return dictionary.forms.designRoleProduct;
    case "brand":
      return dictionary.forms.designRoleBrand;
    case "web":
      return dictionary.forms.designRoleWeb;
    case "mobile":
      return dictionary.forms.designRoleMobile;
    case "illustration":
      return dictionary.forms.designRoleIllustration;
    case "motion":
      return dictionary.forms.designRoleMotion;
    case "type":
      return dictionary.forms.designRoleType;
    case "packaging":
      return dictionary.forms.designRolePackaging;
    case "icon":
      return dictionary.forms.designRoleIcon;
    default:
      return role;
  }
}

function getDesignToolLabel(tool: DesignTool, dictionary: Dictionary) {
  switch (tool) {
    case "figma":
      return dictionary.forms.designToolFigma;
    case "sketch":
      return dictionary.forms.designToolSketch;
    case "adobe_xd":
      return dictionary.forms.designToolAdobeXd;
    case "photoshop":
      return dictionary.forms.designToolPhotoshop;
    case "illustrator":
      return dictionary.forms.designToolIllustrator;
    case "indesign":
      return dictionary.forms.designToolIndesign;
    case "after_effects":
      return dictionary.forms.designToolAfterEffects;
    case "framer":
      return dictionary.forms.designToolFramer;
    case "webflow":
      return dictionary.forms.designToolWebflow;
    case "procreate":
      return dictionary.forms.designToolProcreate;
    case "blender":
      return dictionary.forms.designToolBlender;
    case "spline":
      return dictionary.forms.designToolSpline;
    default:
      return tool;
  }
}

function getDesignDeliverableLabel(
  value: DesignDeliverable,
  dictionary: Dictionary,
) {
  switch (value) {
    case "logo":
      return dictionary.forms.designDeliverableLogo;
    case "brand_book":
      return dictionary.forms.designDeliverableBrandBook;
    case "ui_kit":
      return dictionary.forms.designDeliverableUiKit;
    case "design_system":
      return dictionary.forms.designDeliverableDesignSystem;
    case "landing":
      return dictionary.forms.designDeliverableLanding;
    case "website":
      return dictionary.forms.designDeliverableWebsite;
    case "mobile_screens":
      return dictionary.forms.designDeliverableMobileScreens;
    case "prototype":
      return dictionary.forms.designDeliverablePrototype;
    case "icon_set":
      return dictionary.forms.designDeliverableIconSet;
    case "illustration":
      return dictionary.forms.designDeliverableIllustration;
    case "packaging":
      return dictionary.forms.designDeliverablePackaging;
    case "print":
      return dictionary.forms.designDeliverablePrint;
    case "animation":
      return dictionary.forms.designDeliverableAnimation;
    default:
      return value;
  }
}

function parseVideoDurationInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((part) => part.trim());
    if (parts.length < 2 || parts.length > 3) return null;
    const numbers = parts.map((part) => Number(part));
    if (numbers.some((n) => !Number.isFinite(n) || n < 0)) return null;
    let total = 0;
    for (const n of numbers) total = total * 60 + n;
    return total > 0 ? Math.min(Math.floor(total), 24 * 60 * 60) : null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(Math.floor(parsed), 24 * 60 * 60);
}

function formatVideoDuration(seconds: number): string {
  if (seconds < 60) return `0:${String(seconds).padStart(2, "0")}`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) {
    return `${minutes}:${String(remaining).padStart(2, "0")}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

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

function getWritingRoleLabel(role: WritingRole, dictionary: Dictionary) {
  switch (role) {
    case "author":
      return dictionary.forms.writingRoleAuthor;
    case "copywriter":
      return dictionary.forms.writingRoleCopywriter;
    case "technical_writer":
      return dictionary.forms.writingRoleTechnicalWriter;
    case "editor":
      return dictionary.forms.writingRoleEditor;
    case "translator":
      return dictionary.forms.writingRoleTranslator;
    case "proofreader":
      return dictionary.forms.writingRoleProofreader;
    case "ghostwriter":
      return dictionary.forms.writingRoleGhostwriter;
    case "journalist":
      return dictionary.forms.writingRoleJournalist;
    case "content_strategist":
      return dictionary.forms.writingRoleContentStrategist;
    case "ux_writer":
      return dictionary.forms.writingRoleUxWriter;
    default:
      return role;
  }
}

function getWritingFormatLabel(value: WritingFormat, dictionary: Dictionary) {
  switch (value) {
    case "article":
      return dictionary.forms.writingFormatArticle;
    case "blog_post":
      return dictionary.forms.writingFormatBlogPost;
    case "whitepaper":
      return dictionary.forms.writingFormatWhitepaper;
    case "ebook":
      return dictionary.forms.writingFormatEbook;
    case "documentation":
      return dictionary.forms.writingFormatDocumentation;
    case "tutorial":
      return dictionary.forms.writingFormatTutorial;
    case "case_study":
      return dictionary.forms.writingFormatCaseStudy;
    case "press_release":
      return dictionary.forms.writingFormatPressRelease;
    case "newsletter":
      return dictionary.forms.writingFormatNewsletter;
    case "script":
      return dictionary.forms.writingFormatScript;
    case "copywriting":
      return dictionary.forms.writingFormatCopywriting;
    case "ux_writing":
      return dictionary.forms.writingFormatUxWriting;
    case "technical_spec":
      return dictionary.forms.writingFormatTechnicalSpec;
    case "research_paper":
      return dictionary.forms.writingFormatResearchPaper;
    case "translation":
      return dictionary.forms.writingFormatTranslation;
    case "social_media":
      return dictionary.forms.writingFormatSocialMedia;
    default:
      return value;
  }
}

function getWritingTopicLabel(value: WritingTopic, dictionary: Dictionary) {
  switch (value) {
    case "technology":
      return dictionary.forms.writingTopicTechnology;
    case "design":
      return dictionary.forms.writingTopicDesign;
    case "marketing":
      return dictionary.forms.writingTopicMarketing;
    case "business":
      return dictionary.forms.writingTopicBusiness;
    case "science":
      return dictionary.forms.writingTopicScience;
    case "education":
      return dictionary.forms.writingTopicEducation;
    case "finance":
      return dictionary.forms.writingTopicFinance;
    case "health":
      return dictionary.forms.writingTopicHealth;
    case "lifestyle":
      return dictionary.forms.writingTopicLifestyle;
    case "gaming":
      return dictionary.forms.writingTopicGaming;
    case "travel":
      return dictionary.forms.writingTopicTravel;
    case "culture":
      return dictionary.forms.writingTopicCulture;
    case "politics":
      return dictionary.forms.writingTopicPolitics;
    case "sports":
      return dictionary.forms.writingTopicSports;
    default:
      return value;
  }
}

function getWritingLanguageLabel(
  value: WritingLanguage,
  dictionary: Dictionary,
) {
  switch (value) {
    case "uk":
      return dictionary.forms.writingLanguageUk;
    case "en":
      return dictionary.forms.writingLanguageEn;
    case "pl":
      return dictionary.forms.writingLanguagePl;
    case "de":
      return dictionary.forms.writingLanguageDe;
    case "es":
      return dictionary.forms.writingLanguageEs;
    case "fr":
      return dictionary.forms.writingLanguageFr;
    case "it":
      return dictionary.forms.writingLanguageIt;
    case "pt":
      return dictionary.forms.writingLanguagePt;
    case "cs":
      return dictionary.forms.writingLanguageCs;
    case "multi":
      return dictionary.forms.writingLanguageMulti;
    default:
      return value;
  }
}

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

function getQaRoleLabel(role: QaRole, dictionary: Dictionary) {
  switch (role) {
    case "manual_qa":
      return dictionary.forms.qaRoleManualQa;
    case "automation_qa":
      return dictionary.forms.qaRoleAutomationQa;
    case "qa_lead":
      return dictionary.forms.qaRoleQaLead;
    case "test_architect":
      return dictionary.forms.qaRoleTestArchitect;
    case "performance":
      return dictionary.forms.qaRolePerformance;
    case "security":
      return dictionary.forms.qaRoleSecurity;
    case "mobile":
      return dictionary.forms.qaRoleMobile;
    case "accessibility":
      return dictionary.forms.qaRoleAccessibility;
    case "usability":
      return dictionary.forms.qaRoleUsability;
    case "exploratory":
      return dictionary.forms.qaRoleExploratory;
    default:
      return role;
  }
}

function getQaTestTypeLabel(value: QaTestType, dictionary: Dictionary) {
  switch (value) {
    case "manual":
      return dictionary.forms.qaTestTypeManual;
    case "automation":
      return dictionary.forms.qaTestTypeAutomation;
    case "performance":
      return dictionary.forms.qaTestTypePerformance;
    case "load":
      return dictionary.forms.qaTestTypeLoad;
    case "security":
      return dictionary.forms.qaTestTypeSecurity;
    case "api":
      return dictionary.forms.qaTestTypeApi;
    case "ui":
      return dictionary.forms.qaTestTypeUi;
    case "mobile":
      return dictionary.forms.qaTestTypeMobile;
    case "accessibility":
      return dictionary.forms.qaTestTypeAccessibility;
    case "usability":
      return dictionary.forms.qaTestTypeUsability;
    case "regression":
      return dictionary.forms.qaTestTypeRegression;
    case "smoke":
      return dictionary.forms.qaTestTypeSmoke;
    case "exploratory":
      return dictionary.forms.qaTestTypeExploratory;
    case "integration":
      return dictionary.forms.qaTestTypeIntegration;
    case "unit":
      return dictionary.forms.qaTestTypeUnit;
    case "e2e":
      return dictionary.forms.qaTestTypeE2e;
    default:
      return value;
  }
}

function getQaMethodologyLabel(value: QaMethodology, dictionary: Dictionary) {
  switch (value) {
    case "agile":
      return dictionary.forms.qaMethodologyAgile;
    case "scrum":
      return dictionary.forms.qaMethodologyScrum;
    case "kanban":
      return dictionary.forms.qaMethodologyKanban;
    case "waterfall":
      return dictionary.forms.qaMethodologyWaterfall;
    case "bdd":
      return dictionary.forms.qaMethodologyBdd;
    case "tdd":
      return dictionary.forms.qaMethodologyTdd;
    case "shift_left":
      return dictionary.forms.qaMethodologyShiftLeft;
    case "risk_based":
      return dictionary.forms.qaMethodologyRiskBased;
    default:
      return value;
  }
}

function getThreeDRoleLabel(role: ThreeDRole, dictionary: Dictionary) {
  switch (role) {
    case "modeling":
      return dictionary.forms.threeDRoleModeling;
    case "sculpting":
      return dictionary.forms.threeDRoleSculpting;
    case "rigging":
      return dictionary.forms.threeDRoleRigging;
    case "animation":
      return dictionary.forms.threeDRoleAnimation;
    case "texturing":
      return dictionary.forms.threeDRoleTexturing;
    case "lighting":
      return dictionary.forms.threeDRoleLighting;
    case "fx":
      return dictionary.forms.threeDRoleFx;
    case "look_dev":
      return dictionary.forms.threeDRoleLookDev;
    case "generalist":
      return dictionary.forms.threeDRoleGeneralist;
    case "concept":
      return dictionary.forms.threeDRoleConcept;
    default:
      return role;
  }
}

function getThreeDStyleLabel(value: ThreeDStyle, dictionary: Dictionary) {
  switch (value) {
    case "realistic":
      return dictionary.forms.threeDStyleRealistic;
    case "stylized":
      return dictionary.forms.threeDStyleStylized;
    case "lowpoly":
      return dictionary.forms.threeDStyleLowpoly;
    case "voxel":
      return dictionary.forms.threeDStyleVoxel;
    case "anime":
      return dictionary.forms.threeDStyleAnime;
    case "hard_surface":
      return dictionary.forms.threeDStyleHardSurface;
    case "organic":
      return dictionary.forms.threeDStyleOrganic;
    case "sculpt":
      return dictionary.forms.threeDStyleSculpt;
    case "abstract":
      return dictionary.forms.threeDStyleAbstract;
    default:
      return value;
  }
}

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

function getCodeArchitectureLabel(
  value: CodeArchitecture,
  dictionary: Dictionary,
) {
  switch (value) {
    case "web_app":
      return dictionary.forms.codeArchitectureWebApp;
    case "mobile_app":
      return dictionary.forms.codeArchitectureMobileApp;
    case "desktop_app":
      return dictionary.forms.codeArchitectureDesktopApp;
    case "browser_extension":
      return dictionary.forms.codeArchitectureBrowserExtension;
    case "cli_tool":
      return dictionary.forms.codeArchitectureCliTool;
    case "library":
      return dictionary.forms.codeArchitectureLibrary;
    case "sdk":
      return dictionary.forms.codeArchitectureSdk;
    case "api":
      return dictionary.forms.codeArchitectureApi;
    case "microservices":
      return dictionary.forms.codeArchitectureMicroservices;
    case "monolith":
      return dictionary.forms.codeArchitectureMonolith;
    case "monorepo":
      return dictionary.forms.codeArchitectureMonorepo;
    case "bot":
      return dictionary.forms.codeArchitectureBot;
    case "game":
      return dictionary.forms.codeArchitectureGame;
    case "plugin":
      return dictionary.forms.codeArchitecturePlugin;
    case "framework":
      return dictionary.forms.codeArchitectureFramework;
    case "data_pipeline":
      return dictionary.forms.codeArchitectureDataPipeline;
    case "ml_model":
      return dictionary.forms.codeArchitectureMlModel;
    case "other":
      return dictionary.forms.codeArchitectureOther;
    default:
      return value;
  }
}

function getStatusLabel(status: ProjectStatus, dictionary: Dictionary) {
  switch (status) {
    case "planning":
      return dictionary.forms.projectStatusPlanning;
    case "in_progress":
      return dictionary.forms.projectStatusInProgress;
    case "completed":
      return dictionary.forms.projectStatusCompleted;
    case "on_hold":
      return dictionary.forms.projectStatusOnHold;
    default:
      return status;
  }
}

function getInitialFormState(
  project?: EditableProject | null,
): ProjectFormState {
  const role = project?.github_role;
  const isValidRole =
    role && (GITHUB_PROJECT_ROLES as readonly string[]).includes(role);

  return {
    title: project?.title || "",
    description: project?.description || "",
    role: project?.role || "",
    kind: project?.kind || "",
    designMeta: normalizeDesignKindMetadata(
      project?.kind_metadata?.design ?? null,
    ),
    codeMeta: normalizeCodeKindMetadata(
      project?.kind_metadata?.code ?? null,
    ),
    videoMeta: normalizeVideoKindMetadata(
      project?.kind_metadata?.video ?? null,
    ),
    videoDurationInput: project?.kind_metadata?.video?.durationSeconds
      ? formatVideoDuration(project.kind_metadata.video.durationSeconds)
      : "",
    photoMeta: normalizePhotoKindMetadata(
      project?.kind_metadata?.photo ?? null,
    ),
    threeDMeta: normalizeThreeDKindMetadata(
      project?.kind_metadata?.threeD ?? null,
    ),
    audioMeta: normalizeAudioKindMetadata(
      project?.kind_metadata?.audio ?? null,
    ),
    audioDurationInput: project?.kind_metadata?.audio?.durationSeconds
      ? formatVideoDuration(project.kind_metadata.audio.durationSeconds)
      : "",
    qaMeta: normalizeQaKindMetadata(project?.kind_metadata?.qa ?? null),
    motionMeta: normalizeMotionKindMetadata(
      project?.kind_metadata?.motion ?? null,
    ),
    motionDurationInput: project?.kind_metadata?.motion?.durationSeconds
      ? formatVideoDuration(project.kind_metadata.motion.durationSeconds)
      : "",
    writingMeta: normalizeWritingKindMetadata(
      project?.kind_metadata?.writing ?? null,
    ),
    projectStatus: project?.project_status || "",
    teamSize: project?.team_size ? String(project.team_size) : "",
    projectUrl: project?.project_url || "",
    repositoryUrl: project?.repository_url || "",
    startedOn: project?.started_on || "",
    completedOn: project?.completed_on || "",
    problem: project?.problem || "",
    solution: project?.solution || "",
    results: project?.results || "",
    githubRole: isValidRole ? (role as GithubProjectRole) : "",
    githubContribution: project?.github_contribution || "",
    githubMotivation: project?.github_motivation || "",
    githubTechDecisions: project?.github_tech_decisions || "",
    githubLearnings: project?.github_learnings || "",
    githubShowcaseNotes: project?.github_showcase_notes || "",
    githubProductionUsage: project?.github_production_usage || "",
    githubDisplayOptions: {
      ...DEFAULT_GITHUB_DISPLAY_OPTIONS,
      ...(project?.github_display_options || {}),
    },
    githubAutoSync:
      typeof project?.github_auto_sync === "boolean"
        ? project.github_auto_sync
        : true,
    allowDownloads:
      typeof project?.allow_downloads === "boolean"
        ? project.allow_downloads
        : true,
  };
}

function toRemoteMediaItem(item: ProjectMediaItem): RemoteMediaItem {
  const youTubeId = getYouTubeVideoId(item.url);
  const mediaKind = (item.media_kind ||
    inferProjectMediaKind(item.mime_type, item.file_name || item.url)) as ProjectMediaKind;

  return {
    id: `remote-${item.id}`,
    kind: "remote",
    remoteId: item.id,
    url: item.url,
    mediaKind,
    storagePath: item.storage_path,
    mimeType: item.mime_type,
    fileSize: item.file_size,
    aspectRatio: youTubeId ? 16 / 9 : DEFAULT_ASPECT_RATIO,
    youTubeId,
  };
}

export default function CreateProjectForm({
  project,
}: {
  project?: EditableProject | null;
}) {
  const router = useLocalizedRouter();
  const dictionary = useDictionary();
  const isEditMode = Boolean(project);

  const [metaSkills, setMetaSkills] = useState<MetaOption[]>([]);
  const [skillIds, setSkillIds] = useState<number[]>(
    project?.technologies.map((technology) => technology.id) || [],
  );
  const [step, setStep] = useState<number>(1);
  const [pendingSaveMode, setPendingSaveMode] = useState<SaveMode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    currentIndex: number;
    totalFiles: number;
    fileName: string;
    percent: number;
  } | null>(null);
  const [form, setForm] = useState<ProjectFormState>(() =>
    getInitialFormState(project),
  );
  const [githubFullName, setGithubFullName] = useState<string | null>(
    project?.github_full_name || null,
  );

  const [mediaItems, setMediaItems] = useState<WizardMediaItem[]>(
    () => (project?.media || []).map(toRemoteMediaItem),
  );
  const [mediaWorking, setMediaWorking] = useState(false);
  const [isProjectOngoing, setIsProjectOngoing] = useState<boolean>(
    () => Boolean(project) && !project?.completed_on,
  );
  const [youTubeInput, setYouTubeInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const initialFormSnapshot = useMemo(
    () => JSON.stringify(getInitialFormState(project)),
    [project],
  );
  const initialSkillsSnapshot = useMemo(
    () =>
      JSON.stringify(
        [...(project?.technologies.map((t) => t.id) || [])].sort(),
      ),
    [project],
  );
  const initialRemoteMediaSnapshot = useMemo(
    () =>
      JSON.stringify((project?.media || []).map((item) => item.id)),
    [project],
  );

  const hasLocalOrYouTubeMedia = mediaItems.some(
    (item) => item.kind === "local" || item.kind === "youtube",
  );
  const currentRemoteMediaSnapshot = JSON.stringify(
    mediaItems
      .filter((item): item is RemoteMediaItem => item.kind === "remote")
      .map((item) => item.remoteId),
  );
  const isDirty =
    pendingSaveMode === null &&
    (JSON.stringify(form) !== initialFormSnapshot ||
      JSON.stringify([...skillIds].sort()) !== initialSkillsSnapshot ||
      currentRemoteMediaSnapshot !== initialRemoteMediaSnapshot ||
      hasLocalOrYouTubeMedia);

  const { isWarningOpen, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    const stored = objectUrlsRef.current;

    return () => {
      stored.forEach((url) => URL.revokeObjectURL(url));
      stored.clear();
    };
  }, []);

  useEffect(() => {
    async function loadMeta() {
      const result = await apiFetch<{ skills?: MetaOption[] }>("/api/meta");
      if (result.ok) {
        setMetaSkills(result.data.skills || []);
      }
    }

    loadMeta();
  }, []);

  const update = useCallback(
    <K extends keyof ProjectFormState>(field: K, value: ProjectFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const measureLocalAspectRatio = useCallback(
    async (file: File, mediaKind: ProjectMediaKind): Promise<number> => {
      const objectUrl = URL.createObjectURL(file);

      try {
        if (mediaKind === "image") {
          const aspect = await new Promise<number>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const ratio =
                img.naturalWidth && img.naturalHeight
                  ? img.naturalWidth / img.naturalHeight
                  : DEFAULT_ASPECT_RATIO;
              resolve(ratio);
            };
            img.onerror = () => resolve(DEFAULT_ASPECT_RATIO);
            img.src = objectUrl;
          });
          return aspect;
        }

        if (mediaKind === "video") {
          const aspect = await new Promise<number>((resolve) => {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.onloadedmetadata = () => {
              const ratio =
                video.videoWidth && video.videoHeight
                  ? video.videoWidth / video.videoHeight
                  : DEFAULT_ASPECT_RATIO;
              resolve(ratio);
            };
            video.onerror = () => resolve(DEFAULT_ASPECT_RATIO);
            video.src = objectUrl;
          });
          return aspect;
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
      }

      return DEFAULT_ASPECT_RATIO;
    },
    [],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || mediaWorking) return;

      setErrorMessage(null);
      setSuccessMessage(null);
      setMediaWorking(true);

      const newItems: WizardMediaItem[] = [];

      const isPhotoProject = form.kind === "photo";
      const imagePreset = isPhotoProject ? "photo" : "inline";
      const imageSizeLimit = getImageSizeLimitBytes(form.kind);
      const videoSizeLimit = getVideoSizeLimitBytes(form.kind);
      const imageLimitMb = bytesToMb(imageSizeLimit);
      const videoLimitMb = bytesToMb(videoSizeLimit);

      try {
        for (const rawFile of files) {
          const initialKind = inferProjectMediaKind(rawFile.type, rawFile.name);

          if (initialKind !== "image" && initialKind !== "video") {
            setErrorMessage(dictionary.forms.mediaUnsupportedKind);
            continue;
          }

          // Reject huge raw uploads before compression — keeps the worker
          // from spending 30 s on a 200 MB image just to fit it under the
          // limit. Photo kind skips compression entirely so this is moot.
          if (
            !isPhotoProject &&
            initialKind === "image" &&
            rawFile.size > MAX_PHOTO_IMAGE_BYTES
          ) {
            setErrorMessage(
              dictionary.forms.mediaImageTooLarge.replace(
                "{limit}",
                String(imageLimitMb),
              ),
            );
            continue;
          }

          const file =
            initialKind === "image"
              ? await compressImageFile(rawFile, imagePreset)
              : rawFile;
          const mediaKind = inferProjectMediaKind(file.type, file.name);

          if (mediaKind === "image" && file.size > imageSizeLimit) {
            setErrorMessage(
              dictionary.forms.mediaImageTooLarge.replace(
                "{limit}",
                String(imageLimitMb),
              ),
            );
            continue;
          }

          if (mediaKind === "video" && file.size > videoSizeLimit) {
            setErrorMessage(
              dictionary.forms.mediaVideoTooLarge.replace(
                "{limit}",
                String(videoLimitMb),
              ),
            );
            continue;
          }

          const previewUrl = URL.createObjectURL(file);
          objectUrlsRef.current.add(previewUrl);
          const aspect = await measureLocalAspectRatio(file, mediaKind);

          newItems.push({
            id: `local-${crypto.randomUUID()}`,
            kind: "local",
            file,
            previewUrl,
            mediaKind,
            aspectRatio: aspect,
          });
        }

        if (newItems.length > 0) {
          setMediaItems((prev) => [...prev, ...newItems]);
        }
      } finally {
        setMediaWorking(false);
      }
    },
    [
      dictionary.forms.mediaUnsupportedKind,
      dictionary.forms.mediaImageTooLarge,
      dictionary.forms.mediaVideoTooLarge,
      form.kind,
      measureLocalAspectRatio,
      mediaWorking,
    ],
  );

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";

      if (files.length > 0) {
        void addFiles(files);
      }
    },
    [addFiles],
  );

  const handleFileDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files || []);

      if (files.length > 0) {
        void addFiles(files);
      }
    },
    [addFiles],
  );

  const removeMediaItem = useCallback((itemId: string) => {
    setMediaItems((prev) => {
      const target = prev.find((item) => item.id === itemId);

      if (target?.kind === "local") {
        URL.revokeObjectURL(target.previewUrl);
        objectUrlsRef.current.delete(target.previewUrl);
      }

      return prev.filter((item) => item.id !== itemId);
    });
  }, []);

  const addYouTubeItem = useCallback(() => {
    const trimmed = youTubeInput.trim();
    if (!trimmed) return;

    const videoId = getYouTubeVideoId(trimmed);

    if (!videoId) {
      setErrorMessage(dictionary.forms.mediaYouTubeInvalid);
      return;
    }

    setMediaItems((prev) => {
      const exists = prev.some(
        (item) => item.kind === "youtube" && item.videoId === videoId,
      );
      if (exists) {
        return prev;
      }

      const next: YouTubeMediaItem = {
        id: `youtube-${crypto.randomUUID()}`,
        kind: "youtube",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoId,
        mediaKind: "video",
        aspectRatio: 16 / 9,
      };
      return [...prev, next];
    });

    setYouTubeInput("");
    setErrorMessage(null);
  }, [dictionary.forms.mediaYouTubeInvalid, youTubeInput]);

  const moveMediaItem = useCallback((fromIndex: number, toIndex: number) => {
    setMediaItems((prev) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const reachedStep = useCallback(
    (target: number) => {
      if (target === 1) return true;

      const titleReady = form.title.trim().length > 0;

      if (target > 1 && !titleReady) {
        return false;
      }

      return true;
    },
    [form.title],
  );

  const goToStep = useCallback(
    (target: number) => {
      const safe = Math.min(Math.max(target, 1), BASE_TOTAL_STEPS);

      if (safe > step && !reachedStep(safe)) {
        setErrorMessage(dictionary.forms.mediaTitleRequired);
        return;
      }

      setErrorMessage(null);
      setSuccessMessage(null);
      setStep(safe);
    },
    [dictionary.forms.mediaTitleRequired, reachedStep, step],
  );

  const uploadLocalFile = useCallback(
    async (
      projectId: string,
      item: LocalMediaItem,
      sortIndex: number,
      onProgress?: (percent: number) => void,
    ) => {
      const contentType = item.file.type || "application/octet-stream";

      const presign = await apiFetch<{
        uploadUrl: string;
        publicUrl: string;
        storagePath: string;
      }>("/api/storage/presign", {
        method: "POST",
        body: {
          scope: "project-media",
          projectId,
          fileName: item.file.name,
          contentType,
          fileSize: item.file.size,
        },
      });

      if (!presign.ok) {
        throw new Error(
          presign.error || dictionary.dashboardProjects.uploadFailed,
        );
      }

      const { uploadUrl, publicUrl, storagePath } = presign.data;

      try {
        await uploadWithProgress({
          url: uploadUrl,
          file: item.file,
          contentType,
          onProgress: (progress) => onProgress?.(progress.percent),
        });
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? error.message
            : dictionary.dashboardProjects.uploadFailed,
        );
      }

      const result = await apiFetch<{
        media?: ProjectMediaItem;
      }>("/project-media", {
        method: "POST",
        body: {
          projectId,
          url: publicUrl,
          storagePath,
          fileName: item.file.name,
          mimeType: item.file.type || null,
          fileSize: item.file.size,
          mediaKind: item.mediaKind,
          sortIndex,
        },
      });

      if (!result.ok || !result.data.media) {
        throw new Error(
          result.ok
            ? dictionary.dashboardProjects.uploadFailed
            : result.error || dictionary.dashboardProjects.uploadFailed,
        );
      }

      return result.data.media;
    },
    [dictionary.dashboardProjects.uploadFailed],
  );

  const uploadYouTubeItem = useCallback(
    async (
      projectId: string,
      item: YouTubeMediaItem,
      sortIndex: number,
    ): Promise<ProjectMediaItem> => {
      const result = await apiFetch<{
        media?: ProjectMediaItem;
      }>("/project-media", {
        method: "POST",
        body: {
          projectId,
          url: item.url,
          storagePath: null,
          fileName: null,
          mimeType: "video/youtube",
          fileSize: null,
          mediaKind: "video",
          sortIndex,
        },
      });

      if (!result.ok || !result.data.media) {
        throw new Error(
          result.ok
            ? dictionary.dashboardProjects.uploadFailed
            : result.error || dictionary.dashboardProjects.uploadFailed,
        );
      }

      return result.data.media;
    },
    [dictionary.dashboardProjects.uploadFailed],
  );

  const persistMediaOrder = useCallback(
    async (projectId: string, orderedRemoteIds: string[]) => {
      if (orderedRemoteIds.length === 0) return;

      await apiFetch("/project-media", {
        method: "PUT",
        body: { projectId, mediaIds: orderedRemoteIds },
      });
    },
    [],
  );

  const buildPayload = useCallback(
    (status: ProjectVisibilityStatus) => {
      const slug = slugify(form.title);

      return {
        title: form.title,
        slug,
        description: form.description,
        role: form.role,
        kind: form.kind || null,
        kindMetadata: {
          design:
            form.kind === "design"
              ? {
                  role: form.designMeta.role,
                  tools: form.designMeta.tools,
                  figmaUrl: form.designMeta.figmaUrl,
                  behanceUrl: form.designMeta.behanceUrl,
                  dribbbleUrl: form.designMeta.dribbbleUrl,
                  client: form.designMeta.client,
                  deliverables: form.designMeta.deliverables,
                }
              : undefined,
          code:
            form.kind === "code"
              ? {
                  architecture: form.codeMeta.architecture,
                  primaryLanguage: form.codeMeta.primaryLanguage,
                  hosting: form.codeMeta.hosting,
                  databases: form.codeMeta.databases,
                  license: form.codeMeta.license,
                  docsUrl: form.codeMeta.docsUrl,
                  storybookUrl: form.codeMeta.storybookUrl,
                  apiPlaygroundUrl: form.codeMeta.apiPlaygroundUrl,
                }
              : undefined,
          video:
            form.kind === "video"
              ? {
                  role: form.videoMeta.role,
                  tools: form.videoMeta.tools,
                  genres: form.videoMeta.genres,
                  resolution: form.videoMeta.resolution,
                  frameRate: form.videoMeta.frameRate,
                  durationSeconds: parseVideoDurationInput(
                    form.videoDurationInput,
                  ),
                  showreelUrl: form.videoMeta.showreelUrl,
                  client: form.videoMeta.client,
                }
              : undefined,
          photo:
            form.kind === "photo"
              ? {
                  role: form.photoMeta.role,
                  genres: form.photoMeta.genres,
                  cameras: form.photoMeta.cameras,
                  editingTools: form.photoMeta.editingTools,
                  medium: form.photoMeta.medium,
                  shotCount: form.photoMeta.shotCount,
                  location: form.photoMeta.location,
                  client: form.photoMeta.client,
                }
              : undefined,
          threeD:
            form.kind === "3d"
              ? {
                  role: form.threeDMeta.role,
                  software: form.threeDMeta.software,
                  renderEngine: form.threeDMeta.renderEngine,
                  styles: form.threeDMeta.styles,
                  polygonCount: form.threeDMeta.polygonCount,
                  modelUrl: form.threeDMeta.modelUrl,
                  client: form.threeDMeta.client,
                }
              : undefined,
          audio:
            form.kind === "audio"
              ? {
                  role: form.audioMeta.role,
                  genres: form.audioMeta.genres,
                  daws: form.audioMeta.daws,
                  trackUrl: form.audioMeta.trackUrl,
                  durationSeconds: parseVideoDurationInput(
                    form.audioDurationInput,
                  ),
                  bpm: form.audioMeta.bpm,
                  musicalKey: form.audioMeta.musicalKey,
                  client: form.audioMeta.client,
                }
              : undefined,
          qa:
            form.kind === "qa"
              ? {
                  role: form.qaMeta.role,
                  testTypes: form.qaMeta.testTypes,
                  tools: form.qaMeta.tools,
                  methodologies: form.qaMeta.methodologies,
                  certifications: form.qaMeta.certifications,
                  testCasesCount: form.qaMeta.testCasesCount,
                  bugsFoundCount: form.qaMeta.bugsFoundCount,
                  automationCoveragePercent:
                    form.qaMeta.automationCoveragePercent,
                  reportUrl: form.qaMeta.reportUrl,
                  client: form.qaMeta.client,
                }
              : undefined,
          motion:
            form.kind === "motion"
              ? {
                  role: form.motionMeta.role,
                  techniques: form.motionMeta.techniques,
                  tools: form.motionMeta.tools,
                  purposes: form.motionMeta.purposes,
                  durationSeconds: parseVideoDurationInput(
                    form.motionDurationInput,
                  ),
                  previewUrl: form.motionMeta.previewUrl,
                  client: form.motionMeta.client,
                }
              : undefined,
          writing:
            form.kind === "writing"
              ? {
                  role: form.writingMeta.role,
                  formats: form.writingMeta.formats,
                  topics: form.writingMeta.topics,
                  tools: form.writingMeta.tools,
                  language: form.writingMeta.language,
                  wordCount: form.writingMeta.wordCount,
                  readingTimeMinutes: form.writingMeta.readingTimeMinutes,
                  articleUrl: form.writingMeta.articleUrl,
                  client: form.writingMeta.client,
                }
              : undefined,
        },
        projectStatus: form.projectStatus || null,
        teamSize: form.teamSize ? Number(form.teamSize) : null,
        projectUrl: form.projectUrl,
        repositoryUrl: form.repositoryUrl,
        startedOn: form.startedOn,
        completedOn: form.completedOn,
        problem: form.problem,
        solution: form.solution,
        results: form.results,
        skillIds,
        githubFullName,
        githubRole: form.githubRole || null,
        githubContribution: form.githubContribution,
        githubMotivation: form.githubMotivation,
        githubTechDecisions: form.githubTechDecisions,
        githubLearnings: form.githubLearnings,
        githubShowcaseNotes: form.githubShowcaseNotes,
        githubProductionUsage: form.githubProductionUsage,
        githubDisplayOptions: form.githubDisplayOptions,
        githubAutoSync: form.githubAutoSync,
        allowDownloads: form.allowDownloads,
        status,
      };
    },
    [form, skillIds, githubFullName],
  );

  const applyGithubImport = useCallback(
    ({ repo }: GithubImportPayload) => {
      setGithubFullName(repo.fullName);

      const startedOn = repo.createdAt
        ? repo.createdAt.slice(0, 10)
        : "";
      const archivedStatus: ProjectStatus | "" = repo.isArchived
        ? "completed"
        : "";

      // README is intentionally NOT copied into `solution` — it lives
      // in its own `github_readme` column and renders as a collapsible
      // "Project README" card on the project page. Solution is for the
      // author's voice, set via the AI draft or manual edit.
      setForm((prev) => ({
        ...prev,
        title: prev.title || repo.name,
        description: prev.description || repo.description || "",
        projectUrl: prev.projectUrl || repo.homepage || "",
        repositoryUrl: prev.repositoryUrl || repo.htmlUrl,
        startedOn: prev.startedOn || startedOn,
        teamSize:
          prev.teamSize ||
          (repo.contributorsCount > 0
            ? String(repo.contributorsCount)
            : ""),
        projectStatus: prev.projectStatus || archivedStatus,
      }));

      // Merge GitHub topics into the technology tags (deduped, only if
      // the catalogue already contains a matching skill).
      if (repo.topics.length > 0 && metaSkills.length > 0) {
        const lookup = new Map(
          metaSkills.map((skill) => [skill.name.toLowerCase(), skill.id]),
        );
        const matched: number[] = [];
        for (const topic of repo.topics) {
          const id = lookup.get(topic.toLowerCase());
          if (id) matched.push(id);
        }
        if (matched.length > 0) {
          setSkillIds((prev) =>
            Array.from(new Set([...prev, ...matched])),
          );
        }
      }

      setSuccessMessage(dictionary.githubIntegration.importApplied);
      setErrorMessage(null);
    },
    [dictionary.githubIntegration.importApplied, metaSkills],
  );

  const updateGithubDisplayOption = useCallback(
    <K extends keyof GithubDisplayOptions>(
      key: K,
      value: GithubDisplayOptions[K],
    ) => {
      setForm((prev) => ({
        ...prev,
        githubDisplayOptions: {
          ...prev.githubDisplayOptions,
          [key]: value,
        },
      }));
    },
    [],
  );

  const handleGithubUnlink = useCallback(() => {
    setGithubFullName(null);
    setForm((prev) => ({
      ...prev,
      githubRole: "",
      githubContribution: "",
      githubMotivation: "",
      githubTechDecisions: "",
      githubLearnings: "",
      githubShowcaseNotes: "",
      githubProductionUsage: "",
      githubAutoSync: false,
      githubDisplayOptions: { ...DEFAULT_GITHUB_DISPLAY_OPTIONS },
    }));
    // Move user away from the now-gone "GitHub" step.
    setStep(1);
    setSuccessMessage(dictionary.githubIntegration.unlinkedMessage);
    setErrorMessage(null);
  }, [dictionary.githubIntegration.unlinkedMessage]);

  const handleSave = useCallback(
    async (mode: SaveMode) => {
      if (pendingSaveMode) return;

      if (!form.title.trim()) {
        setErrorMessage(dictionary.forms.mediaTitleRequired);
        setStep(1);
        return;
      }

      if (
        form.startedOn &&
        form.completedOn &&
        form.completedOn < form.startedOn
      ) {
        setErrorMessage(dictionary.forms.invalidProjectDateRange);
        setStep(2);
        return;
      }

      const status: ProjectVisibilityStatus =
        mode === "draft" ? "draft" : "published";
      const payload = buildPayload(status);

      const parsedPayload = projectPayloadSchema.safeParse(payload);

      if (!parsedPayload.success) {
        setErrorMessage(
          parsedPayload.error.issues[0]?.message ||
            dictionary.forms.errorCreatingProject,
        );
        return;
      }

      setPendingSaveMode(mode);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const endpoint = isEditMode
          ? `/api/projects/${project?.id}`
          : "/api/projects";
        const method = isEditMode ? "PATCH" : "POST";
        const projectResult = await apiFetch<{
          projectId?: string;
          slug?: string;
        }>(endpoint, {
          method,
          body: parsedPayload.data,
        });

        if (!projectResult.ok) {
          setErrorMessage(
            projectResult.error ||
              (isEditMode
                ? dictionary.forms.errorUpdatingProject
                : dictionary.forms.errorCreatingProject),
          );
          return;
        }

        const projectId =
          projectResult.data.projectId || project?.id || "";
        const projectSlug = projectResult.data.slug || parsedPayload.data.slug;

        if (!projectId) {
          setErrorMessage(dictionary.forms.errorCreatingProject);
          return;
        }

        const orderedRemoteIds: string[] = [];
        const localItemsCount = mediaItems.filter(
          (item) => item.kind === "local",
        ).length;
        let localItemsProcessed = 0;

        for (let index = 0; index < mediaItems.length; index += 1) {
          const item = mediaItems[index];

          if (item.kind === "local") {
            localItemsProcessed += 1;
            const fileIndex = localItemsProcessed;
            setUploadProgress({
              currentIndex: fileIndex,
              totalFiles: localItemsCount,
              fileName: item.file.name,
              percent: 0,
            });

            try {
              const uploaded = await uploadLocalFile(
                projectId,
                item,
                index,
                (percent) => {
                  setUploadProgress({
                    currentIndex: fileIndex,
                    totalFiles: localItemsCount,
                    fileName: item.file.name,
                    percent,
                  });
                },
              );
              orderedRemoteIds.push(uploaded.id);
            } catch (error) {
              setUploadProgress(null);
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : dictionary.dashboardProjects.uploadFailed,
              );
              return;
            }
          } else if (item.kind === "youtube") {
            try {
              const uploaded = await uploadYouTubeItem(projectId, item, index);
              orderedRemoteIds.push(uploaded.id);
            } catch (error) {
              setUploadProgress(null);
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : dictionary.dashboardProjects.uploadFailed,
              );
              return;
            }
          } else {
            orderedRemoteIds.push(item.remoteId);
          }
        }

        setUploadProgress(null);

        if (isEditMode && orderedRemoteIds.length > 0) {
          await persistMediaOrder(projectId, orderedRemoteIds);
        }

        setSuccessMessage(
          mode === "draft"
            ? dictionary.forms.projectSavedAsDraft
            : dictionary.forms.projectPublished,
        );

        startTransition(() => {
          router.refresh();
        });

        const targetPath = buildProjectPath(projectId, projectSlug);

        if (mode === "publish") {
          router.push(targetPath);
        } else if (isEditMode) {
          router.push(targetPath);
        } else {
          router.push(`/projects/edit/${projectId}`);
        }
      } finally {
        setPendingSaveMode(null);
        setUploadProgress(null);
      }
    },
    [
      buildPayload,
      dictionary.dashboardProjects.uploadFailed,
      dictionary.forms.errorCreatingProject,
      dictionary.forms.errorUpdatingProject,
      dictionary.forms.invalidProjectDateRange,
      dictionary.forms.mediaTitleRequired,
      dictionary.forms.projectPublished,
      dictionary.forms.projectSavedAsDraft,
      form.completedOn,
      form.startedOn,
      form.title,
      isEditMode,
      mediaItems,
      pendingSaveMode,
      persistMediaOrder,
      project?.id,
      router,
      uploadLocalFile,
      uploadYouTubeItem,
    ],
  );

  // The wizard is fixed at 5 steps: basics → specifics → details → story → media.
  // The "specifics" step renders kind-aware fields (Design, Code+GitHub,
  // Video, Photo, 3D, Audio). For code projects the GitHub importer
  // and narrative live inline inside specifics, so there is no
  // separate GitHub step anymore.
  const stepDescriptors = useMemo(() => {
    return [
      {
        key: "basics",
        title: dictionary.forms.stepBasicsTitle,
        description: dictionary.forms.stepBasicsDescription,
      },
      {
        key: "specifics",
        title: dictionary.forms.stepSpecificsTitle,
        description: dictionary.forms.stepSpecificsDescription,
      },
      {
        key: "details",
        title: dictionary.forms.stepDetailsTitle,
        description: dictionary.forms.stepDetailsDescription,
      },
      {
        key: "story",
        title: dictionary.forms.stepStoryTitle,
        description: dictionary.forms.stepStoryDescription,
      },
      {
        key: "media",
        title: dictionary.forms.stepMediaTitle,
        description: dictionary.forms.stepMediaDescription,
      },
    ].map((entry, idx) => ({ ...entry, index: idx + 1 }));
  }, [dictionary.forms]);

  const totalSteps = stepDescriptors.length;
  const currentDescriptor = stepDescriptors[step - 1];
  const currentStepKey = currentDescriptor?.key;
  const submitting = pendingSaveMode !== null;
  const isLastStep = step === totalSteps;
  const draftLabel =
    pendingSaveMode === "draft"
      ? dictionary.forms.savingDraft
      : dictionary.forms.saveDraft;
  const publishLabel = isEditMode
    ? pendingSaveMode === "publish"
      ? dictionary.forms.updatingProject
      : dictionary.forms.updateProject
    : pendingSaveMode === "publish"
      ? dictionary.forms.publishing
      : dictionary.forms.publishProject;

  return (
    <div className="space-y-6">
      <StepHeader
        descriptors={stepDescriptors}
        current={step}
        onSelect={goToStep}
        dictionary={dictionary}
      />

      <div className="space-y-2">
        <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
          {currentDescriptor.title}
        </h2>
        <p className="text-sm app-muted">{currentDescriptor.description}</p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isLastStep) {
            void handleSave("publish");
          } else {
            goToStep(step + 1);
          }
        }}
        className="space-y-6"
      >
        {currentStepKey === "basics" && (
          <StepBasics
            dictionary={dictionary}
            form={form}
            update={update}
            metaSkills={metaSkills}
            skillIds={skillIds}
            onSkillsChange={setSkillIds}
          />
        )}

        {currentStepKey === "specifics" && (
          <StepSpecifics
            dictionary={dictionary}
            form={form}
            update={update}
            updateDisplayOption={updateGithubDisplayOption}
            githubFullName={githubFullName}
            projectId={project?.id || null}
            onGithubImport={isEditMode ? undefined : applyGithubImport}
            onUnlinked={handleGithubUnlink}
          />
        )}

        {currentStepKey === "details" && (
          <StepDetails
            dictionary={dictionary}
            form={form}
            update={update}
            isOngoing={isProjectOngoing}
            onOngoingChange={setIsProjectOngoing}
          />
        )}

        {currentStepKey === "story" && (
          <StepStory dictionary={dictionary} form={form} update={update} />
        )}

        {currentStepKey === "media" && (
          <StepMedia
            dictionary={dictionary}
            kind={form.kind}
            mediaItems={mediaItems}
            onPickFiles={() => fileInputRef.current?.click()}
            onDropFiles={handleFileDrop}
            onRemove={removeMediaItem}
            onMove={moveMediaItem}
            working={mediaWorking}
            youTubeInput={youTubeInput}
            onYouTubeInputChange={setYouTubeInput}
            onAddYouTube={addYouTubeItem}
            allowDownloads={form.allowDownloads}
            onToggleAllowDownloads={(value) =>
              update("allowDownloads", value)
            }
          />
        )}

        {uploadProgress && (
          <div
            className="rounded-2xl border app-border bg-[color:var(--surface)] p-4"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-[color:var(--foreground)]">
                {dictionary.forms.uploadProgressLabel
                  .replace("{current}", String(uploadProgress.currentIndex))
                  .replace("{total}", String(uploadProgress.totalFiles))}
                <span className="ml-1 app-muted">
                  · {uploadProgress.fileName}
                </span>
              </span>
              <span
                className="font-display tabular-nums text-[color:var(--foreground)]"
                aria-label={`${uploadProgress.percent}%`}
              >
                {uploadProgress.percent}%
              </span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-muted)]"
              role="progressbar"
              aria-label={dictionary.forms.uploadProgressLabel
                .replace("{current}", String(uploadProgress.currentIndex))
                .replace("{total}", String(uploadProgress.totalFiles))}
              aria-valuenow={uploadProgress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-[color:var(--foreground)] transition-[width] duration-150"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-500"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {!errorMessage && successMessage && (
          <div
            className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-600"
            role="status"
          >
            {successMessage}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-dashed app-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => goToStep(step - 1)}
              disabled={step === 1 || submitting}
            >
              {dictionary.forms.stepBack}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleSave("draft")}
              disabled={submitting}
            >
              {draftLabel}
            </Button>
            <Button type="submit" disabled={submitting}>
              {isLastStep ? publishLabel : dictionary.forms.stepNext}
            </Button>
          </div>
        </div>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="sr-only"
        aria-label={dictionary.forms.mediaBrowseFiles}
      />

      <ConfirmDialog
        open={isWarningOpen}
        title={dictionary.common.unsavedChangesTitle}
        description={dictionary.common.unsavedChangesDescription}
        confirmLabel={dictionary.common.unsavedChangesLeave}
        cancelLabel={dictionary.common.unsavedChangesStay}
        confirmVariant="primary"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </div>
  );
}

type StepDescriptor = {
  index: number;
  title: string;
  description: string;
  key?: string;
};

function StepHeader({
  descriptors,
  current,
  onSelect,
  dictionary,
}: {
  descriptors: StepDescriptor[];
  current: number;
  onSelect: (target: number) => void;
  dictionary: Dictionary;
}) {
  const total = descriptors.length;
  return (
    <ol
      aria-label={dictionary.forms.stepLabel}
      className={`grid gap-3 ${
        total >= 5 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"
      }`}
    >
      {descriptors.map((descriptor) => {
        const isActive = current === descriptor.index;
        const isCompleted = current > descriptor.index;
        const isClickable = descriptor.index <= current || isCompleted;

        return (
          <li key={descriptor.index} className="contents">
            <button
              type="button"
              onClick={() => onSelect(descriptor.index)}
              disabled={!isClickable}
              className={`group flex w-full flex-col gap-1 rounded-2xl border p-3 text-left transition ${
                isActive
                  ? "border-[color:var(--accent)] bg-[color:var(--surface)] shadow-sm"
                  : isCompleted
                    ? "app-border bg-[color:var(--surface-muted)]"
                    : "app-border bg-transparent"
              } ${
                isClickable ? "cursor-pointer hover:bg-[color:var(--surface-muted)]" : "cursor-not-allowed opacity-60"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {dictionary.forms.stepLabel} {descriptor.index} / {total}
              </span>
              <span className="text-sm font-semibold text-[color:var(--foreground)]">
                {descriptor.title}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepBasics({
  dictionary,
  form,
  update,
  metaSkills,
  skillIds,
  onSkillsChange,
}: {
  dictionary: Dictionary;
  form: ProjectFormState;
  update: <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) => void;
  metaSkills: MetaOption[];
  skillIds: number[];
  onSkillsChange: (next: number[]) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        label={dictionary.forms.projectTitle}
        htmlFor="project-title"
        className="md:col-span-2"
      >
        <input
          id="project-title"
          type="text"
          placeholder={dictionary.forms.projectTitlePlaceholder}
          className="app-input"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          required
        />
      </Field>

      <Field
        label={dictionary.forms.description}
        htmlFor="project-description"
        className="md:col-span-2"
      >
        <FormTextarea
          id="project-description"
          placeholder={dictionary.forms.projectDescriptionPlaceholder}
          className="min-h-32 p-4 text-[color:var(--foreground)]"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </Field>

      <Field
        label={dictionary.forms.projectKind}
        htmlFor="project-kind"
        description={dictionary.forms.projectKindHint}
        className="md:col-span-2"
      >
        <FormSelect
          name="project-kind"
          value={form.kind}
          onChange={(value) => update("kind", value as ProjectKind | "")}
          placeholder={dictionary.forms.projectKindPlaceholder}
          options={projectKinds.map((kind) => ({
            value: kind,
            label: getProjectKindLabel(kind, dictionary),
          }))}
        />
      </Field>

      <Field label={dictionary.forms.projectRole} htmlFor="project-role">
        <input
          id="project-role"
          type="text"
          placeholder={dictionary.forms.projectRolePlaceholder}
          className="app-input"
          value={form.role}
          onChange={(e) => update("role", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.technologies}>
        <TagSelect
          options={metaSkills}
          value={skillIds}
          placeholder={dictionary.forms.searchProjectTechnologies}
          onChange={(values) => onSkillsChange(values.map(Number))}
        />
      </Field>
    </div>
  );
}

function StepSpecifics({
  dictionary,
  form,
  update,
  updateDisplayOption,
  githubFullName,
  projectId,
  onGithubImport,
  onUnlinked,
}: {
  dictionary: Dictionary;
  form: ProjectFormState;
  update: <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) => void;
  updateDisplayOption: <K extends keyof GithubDisplayOptions>(
    key: K,
    value: GithubDisplayOptions[K],
  ) => void;
  githubFullName: string | null;
  projectId: string | null;
  onGithubImport?: (payload: GithubImportPayload) => void;
  onUnlinked: () => void;
}) {
  if (!form.kind) {
    return (
      <div className="rounded-2xl border app-border bg-(--surface-muted) p-6 text-sm app-muted">
        {dictionary.forms.stepSpecificsEmpty}
      </div>
    );
  }

  if (form.kind === "design") {
    return (
      <DesignDetailsFields
        dictionary={dictionary}
        value={form.designMeta}
        onChange={(next) => update("designMeta", next)}
      />
    );
  }

  if (form.kind === "code") {
    return (
      <div className="space-y-6">
        {onGithubImport ? <GithubRepoImporter onImport={onGithubImport} /> : null}
        <UrlField
          id="project-repository-url"
          label={dictionary.forms.repositoryUrl}
          placeholder={dictionary.forms.repositoryUrlPlaceholder}
          value={form.repositoryUrl}
          onChange={(next) => update("repositoryUrl", next)}
          invalidMessage={dictionary.forms.invalidUrl}
        />
        <CodeDetailsFields
          dictionary={dictionary}
          value={form.codeMeta}
          onChange={(next) => update("codeMeta", next)}
        />
        {githubFullName ? (
          <StepGithub
            dictionary={dictionary}
            form={form}
            update={update}
            updateDisplayOption={updateDisplayOption}
            githubFullName={githubFullName}
            projectId={projectId}
            onUnlinked={onUnlinked}
          />
        ) : null}
      </div>
    );
  }

  if (form.kind === "video") {
    return (
      <VideoDetailsFields
        dictionary={dictionary}
        value={form.videoMeta}
        durationInput={form.videoDurationInput}
        onChange={(next) => update("videoMeta", next)}
        onDurationInputChange={(next) => update("videoDurationInput", next)}
      />
    );
  }

  if (form.kind === "photo") {
    return (
      <PhotoDetailsFields
        dictionary={dictionary}
        value={form.photoMeta}
        onChange={(next) => update("photoMeta", next)}
      />
    );
  }

  if (form.kind === "3d") {
    return (
      <ThreeDDetailsFields
        dictionary={dictionary}
        value={form.threeDMeta}
        onChange={(next) => update("threeDMeta", next)}
      />
    );
  }

  if (form.kind === "audio") {
    return (
      <AudioDetailsFields
        dictionary={dictionary}
        value={form.audioMeta}
        durationInput={form.audioDurationInput}
        onChange={(next) => update("audioMeta", next)}
        onDurationInputChange={(next) => update("audioDurationInput", next)}
      />
    );
  }

  if (form.kind === "qa") {
    return (
      <QaDetailsFields
        dictionary={dictionary}
        value={form.qaMeta}
        onChange={(next) => update("qaMeta", next)}
      />
    );
  }

  if (form.kind === "motion") {
    return (
      <MotionDetailsFields
        dictionary={dictionary}
        value={form.motionMeta}
        durationInput={form.motionDurationInput}
        onChange={(next) => update("motionMeta", next)}
        onDurationInputChange={(next) => update("motionDurationInput", next)}
      />
    );
  }

  if (form.kind === "writing") {
    return (
      <WritingDetailsFields
        dictionary={dictionary}
        value={form.writingMeta}
        onChange={(next) => update("writingMeta", next)}
      />
    );
  }

  return (
    <div className="rounded-2xl border app-border bg-(--surface-muted) p-6 text-sm app-muted">
      {dictionary.forms.stepSpecificsEmpty}
    </div>
  );
}

function ChipToggleGroup<T extends string>({
  options,
  value,
  onChange,
  getLabel,
}: {
  options: readonly T[];
  value: T[];
  onChange: (next: T[]) => void;
  getLabel: (option: T) => string;
}) {
  const selected = new Set<T>(value);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = selected.has(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => {
              const next = new Set<T>(value);
              if (isActive) {
                next.delete(option);
              } else {
                next.add(option);
              }
              onChange(Array.from(next));
            }}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              isActive
                ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                : "app-border app-muted hover:bg-[color:var(--surface-muted)]"
            }`}
          >
            {getLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

function DesignDetailsFields({
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

function CodeDetailsFields({
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

function VideoDetailsFields({
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

function PhotoDetailsFields({
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

function ThreeDDetailsFields({
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

function AudioDetailsFields({
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

function QaDetailsFields({
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

function MotionDetailsFields({
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

function WritingDetailsFields({
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

function StepGithub({
  dictionary,
  form,
  update,
  updateDisplayOption,
  githubFullName,
  projectId,
  onUnlinked,
}: {
  dictionary: Dictionary;
  form: ProjectFormState;
  update: <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) => void;
  updateDisplayOption: <K extends keyof GithubDisplayOptions>(
    key: K,
    value: GithubDisplayOptions[K],
  ) => void;
  githubFullName: string;
  projectId: string | null;
  onUnlinked: () => void;
}) {
  const dict = dictionary.githubIntegration;
  const aiDict = dictionary.aiDraft;
  const router = useLocalizedRouter();
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState<
    | { kind: "ok"; appliedCount: number }
    | { kind: "info"; reason: "all_filled" }
    | { kind: "error"; message: string }
    | null
  >(null);

  const roleOptions = useMemo(
    () =>
      GITHUB_PROJECT_ROLES.map((role) => ({
        value: role,
        label: dict.roles[role],
      })),
    [dict.roles],
  );

  const generateAiDraft = async () => {
    setAiGenerating(true);
    setAiMessage(null);

    const result = await apiFetch<{
      draft: {
        role: GithubProjectRole | null;
        contribution: string;
        motivation: string;
        techDecisions: string;
        learnings: string;
        showcaseNotes: string;
        productionUsage: string;
        projectRole: string;
        problem: string;
        solution: string;
        results: string;
      };
      details?: string;
    }>("/api/ai/github-draft", {
      method: "POST",
      body: {
        fullName: githubFullName,
        locale: router.locale,
        existing: {
          role: form.githubRole || null,
          contribution: form.githubContribution,
          motivation: form.githubMotivation,
          techDecisions: form.githubTechDecisions,
          learnings: form.githubLearnings,
          showcaseNotes: form.githubShowcaseNotes,
          productionUsage: form.githubProductionUsage,
          projectRole: form.role,
          problem: form.problem,
          solution: form.solution,
          results: form.results,
        },
      },
    });

    setAiGenerating(false);

    if (!result.ok) {
      setAiMessage({
        kind: "error",
        message: result.error || aiDict.error,
      });
      return;
    }

    const draft = result.data.draft;

    // Apply only to empty fields — never overwrite the user's text.
    let applied = 0;
    if (!form.githubRole && draft.role) {
      update("githubRole", draft.role);
      applied += 1;
    }
    const setIfEmpty = <K extends keyof ProjectFormState>(
      field: K,
      value: string,
    ) => {
      if (typeof form[field] === "string" && (form[field] as string).trim().length === 0 && value.trim().length > 0) {
        update(field, value as ProjectFormState[K]);
        applied += 1;
      }
    };
    setIfEmpty("githubContribution", draft.contribution);
    setIfEmpty("githubMotivation", draft.motivation);
    setIfEmpty("githubTechDecisions", draft.techDecisions);
    setIfEmpty("githubLearnings", draft.learnings);
    setIfEmpty("githubShowcaseNotes", draft.showcaseNotes);
    setIfEmpty("githubProductionUsage", draft.productionUsage);
    // Standard project narrative fields (Steps 1 + 3).
    setIfEmpty("role", draft.projectRole);
    setIfEmpty("problem", draft.problem);
    setIfEmpty("solution", draft.solution);
    setIfEmpty("results", draft.results);

    setAiMessage(
      applied === 0
        ? { kind: "info", reason: "all_filled" }
        : { kind: "ok", appliedCount: applied },
    );
  };

  const requestUnlink = () => {
    setUnlinkError(null);
    setConfirmingUnlink(true);
  };

  const cancelUnlink = () => {
    setConfirmingUnlink(false);
  };

  const performUnlink = async () => {
    setUnlinking(true);
    setUnlinkError(null);

    if (projectId) {
      const result = await apiFetch(
        `/api/projects/${projectId}/unlink-github`,
        { method: "POST" },
      );
      if (!result.ok) {
        setUnlinking(false);
        setUnlinkError(result.error || dict.unlinkError);
        return;
      }
    }

    setUnlinking(false);
    setConfirmingUnlink(false);
    onUnlinked();
  };

  const togglesGroup: Array<{
    key: keyof GithubDisplayOptions;
    label: string;
  }> = [
    { key: "showStats", label: dict.toggleStats },
    { key: "showLanguages", label: dict.toggleLanguages },
    { key: "showTopics", label: dict.toggleTopics },
    { key: "showRelease", label: dict.toggleRelease },
    { key: "showLicense", label: dict.toggleLicense },
    { key: "showContributors", label: dict.toggleContributors },
    { key: "showActivity", label: dict.toggleActivity },
    { key: "showReadme", label: dict.toggleReadme },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border app-border bg-[color:var(--surface-muted)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {dict.linkedHeader}
            </p>
            <a
              href={`https://github.com/${githubFullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block break-all text-sm font-semibold text-[color:var(--foreground)] hover:underline"
            >
              {githubFullName}
            </a>
          </div>
          {!confirmingUnlink ? (
            <button
              type="button"
              onClick={requestUnlink}
              className="cursor-pointer rounded-full app-panel px-3 py-1.5 text-xs font-medium app-soft transition-colors hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
            >
              {dict.unlink}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void performUnlink()}
                disabled={unlinking}
                className="cursor-pointer rounded-full bg-rose-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
              >
                {unlinking ? dict.unlinking : dict.confirmUnlink}
              </button>
              <button
                type="button"
                onClick={cancelUnlink}
                disabled={unlinking}
                className="cursor-pointer rounded-full app-panel px-3 py-1.5 text-xs font-medium app-soft transition-colors hover:bg-[color:var(--surface)]"
              >
                {dict.cancel}
              </button>
            </div>
          )}
        </div>
        {confirmingUnlink ? (
          <p className="mt-2 text-xs app-muted">{dict.unlinkConfirm}</p>
        ) : null}
        {unlinkError ? (
          <p role="alert" className="mt-2 text-xs text-rose-500">
            {unlinkError}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-dashed app-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              ✨ {aiDict.title}
            </p>
            <p className="mt-0.5 text-xs app-muted">{aiDict.description}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void generateAiDraft()}
            disabled={aiGenerating}
          >
            {aiGenerating ? aiDict.generating : aiDict.button}
          </Button>
        </div>

        {aiMessage?.kind === "error" ? (
          <p role="alert" className="mt-2 text-xs text-rose-500">
            {aiMessage.message}
          </p>
        ) : null}
        {aiMessage?.kind === "ok" ? (
          <p role="status" className="mt-2 text-xs text-emerald-600">
            {aiDict.applied.replace("{count}", String(aiMessage.appliedCount))}
          </p>
        ) : null}
        {aiMessage?.kind === "info" ? (
          <p role="status" className="mt-2 text-xs app-muted">
            {aiDict.allFilled}
          </p>
        ) : null}
      </div>

      <Field label={dict.roleLabel}>
        <FormSelect
          value={form.githubRole || ""}
          onChange={(value) =>
            update("githubRole", value as ProjectFormState["githubRole"])
          }
          placeholder={dict.rolePlaceholder}
          options={roleOptions}
        />
      </Field>

      <Field
        label={dict.contributionLabel}
        htmlFor="github-contribution"
        description={dict.contributionHint}
      >
        <FormTextarea
          id="github-contribution"
          value={form.githubContribution}
          onChange={(event) =>
            update("githubContribution", event.target.value)
          }
          placeholder={dict.contributionPlaceholder}
          className="min-h-28 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.contribution}
        />
      </Field>

      <Field
        label={dict.motivationLabel}
        htmlFor="github-motivation"
        description={dict.motivationHint}
      >
        <FormTextarea
          id="github-motivation"
          value={form.githubMotivation}
          onChange={(event) => update("githubMotivation", event.target.value)}
          placeholder={dict.motivationPlaceholder}
          className="min-h-24 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.motivation}
        />
      </Field>

      <Field
        label={dict.techDecisionsLabel}
        htmlFor="github-tech-decisions"
        description={dict.techDecisionsHint}
      >
        <FormTextarea
          id="github-tech-decisions"
          value={form.githubTechDecisions}
          onChange={(event) =>
            update("githubTechDecisions", event.target.value)
          }
          placeholder={dict.techDecisionsPlaceholder}
          className="min-h-28 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.techDecisions}
        />
      </Field>

      <Field
        label={dict.learningsLabel}
        htmlFor="github-learnings"
        description={dict.learningsHint}
      >
        <FormTextarea
          id="github-learnings"
          value={form.githubLearnings}
          onChange={(event) => update("githubLearnings", event.target.value)}
          placeholder={dict.learningsPlaceholder}
          className="min-h-24 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.learnings}
        />
      </Field>

      <Field
        label={dict.showcaseLabel}
        htmlFor="github-showcase"
        description={dict.showcaseHint}
      >
        <FormTextarea
          id="github-showcase"
          value={form.githubShowcaseNotes}
          onChange={(event) =>
            update("githubShowcaseNotes", event.target.value)
          }
          placeholder={dict.showcasePlaceholder}
          className="min-h-24 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.showcaseNotes}
        />
      </Field>

      <Field
        label={dict.productionUsageLabel}
        htmlFor="github-production-usage"
        description={dict.productionUsageHint}
      >
        <FormTextarea
          id="github-production-usage"
          value={form.githubProductionUsage}
          onChange={(event) =>
            update("githubProductionUsage", event.target.value)
          }
          placeholder={dict.productionUsagePlaceholder}
          className="min-h-20 p-3 text-sm text-[color:var(--foreground)]"
          maxLength={GITHUB_FIELD_LIMITS.productionUsage}
        />
      </Field>

      <fieldset className="rounded-2xl border app-border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-eyebrow app-soft">
          {dict.displayPreferences}
        </legend>
        <p className="mt-1 mb-3 text-xs app-muted">
          {dict.displayPreferencesHint}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {togglesGroup.map((toggle) => (
            <label
              key={toggle.key}
              className="flex cursor-pointer items-center gap-2 rounded-xl p-2 hover:bg-[color:var(--surface-muted)]"
            >
              <input
                type="checkbox"
                checked={form.githubDisplayOptions[toggle.key]}
                onChange={(event) =>
                  updateDisplayOption(toggle.key, event.target.checked)
                }
                className="h-4 w-4 cursor-pointer accent-[color:var(--accent)]"
              />
              <span className="text-sm text-[color:var(--foreground)]">
                {toggle.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border app-border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-eyebrow app-soft">
          {dict.syncPreferences}
        </legend>
        <label className="mt-2 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={form.githubAutoSync}
            onChange={(event) => update("githubAutoSync", event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[color:var(--accent)]"
          />
          <span className="text-sm text-[color:var(--foreground)]">
            {dict.autoSyncLabel}
          </span>
        </label>
        <p className="mt-1 ml-6 text-xs app-muted">{dict.autoSyncHint}</p>
      </fieldset>
    </div>
  );
}

function StepDetails({
  dictionary,
  form,
  update,
  isOngoing,
  onOngoingChange,
}: {
  dictionary: Dictionary;
  form: ProjectFormState;
  update: <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) => void;
  isOngoing: boolean;
  onOngoingChange: (next: boolean) => void;
}) {
  const handleOngoingToggle = (checked: boolean) => {
    onOngoingChange(checked);
    if (checked) {
      update("completedOn", "");
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field
        label={dictionary.forms.projectStatus}
        htmlFor="project-status"
      >
        <FormSelect
          className="w-full"
          triggerClassName="w-full"
          value={form.projectStatus}
          placeholder={dictionary.forms.projectStatusPlaceholder}
          onChange={(value) =>
            update("projectStatus", value as ProjectStatus | "")
          }
          options={projectStatuses.map((status) => ({
            value: status,
            label: getStatusLabel(status, dictionary),
          }))}
        />
      </Field>

      <Field label={dictionary.forms.teamSize} htmlFor="project-team-size">
        <input
          id="project-team-size"
          type="number"
          min="1"
          placeholder={dictionary.forms.teamSizePlaceholder}
          className="app-input"
          value={form.teamSize}
          onChange={(e) => update("teamSize", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.startedOn} htmlFor="project-started-on">
        <input
          id="project-started-on"
          type="date"
          title={dictionary.forms.startedOn}
          className="app-input"
          value={form.startedOn}
          onChange={(e) => update("startedOn", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.completedOn} htmlFor="project-completed-on">
        <input
          id="project-completed-on"
          type="date"
          title={dictionary.forms.completedOn}
          className="app-input disabled:cursor-not-allowed disabled:opacity-60"
          value={isOngoing ? "" : form.completedOn}
          onChange={(e) => update("completedOn", e.target.value)}
          disabled={isOngoing}
        />
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm app-muted">
          <input
            type="checkbox"
            checked={isOngoing}
            onChange={(e) => handleOngoingToggle(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border app-border accent-[color:var(--accent)]"
          />
          {dictionary.forms.projectStillOngoing}
        </label>
      </Field>

      <UrlField
        id="project-url"
        label={dictionary.forms.projectUrl}
        placeholder={dictionary.forms.projectUrlPlaceholder}
        value={form.projectUrl}
        onChange={(next) => update("projectUrl", next)}
        invalidMessage={dictionary.forms.invalidUrl}
      />
    </div>
  );
}

function StepStory({
  dictionary,
  form,
  update,
}: {
  dictionary: Dictionary;
  form: ProjectFormState;
  update: <K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) => void;
}) {
  return (
    <div className="grid gap-4">
      <Field label={dictionary.forms.problem} htmlFor="project-problem">
        <FormTextarea
          id="project-problem"
          placeholder={dictionary.forms.problemPlaceholder}
          className="min-h-28 p-4 text-[color:var(--foreground)]"
          value={form.problem}
          onChange={(e) => update("problem", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.solution} htmlFor="project-solution">
        <FormTextarea
          id="project-solution"
          placeholder={dictionary.forms.solutionPlaceholder}
          className="min-h-28 p-4 text-[color:var(--foreground)]"
          value={form.solution}
          onChange={(e) => update("solution", e.target.value)}
        />
      </Field>

      <Field label={dictionary.forms.results} htmlFor="project-results">
        <FormTextarea
          id="project-results"
          placeholder={dictionary.forms.resultsPlaceholder}
          className="min-h-28 p-4 text-[color:var(--foreground)]"
          value={form.results}
          onChange={(e) => update("results", e.target.value)}
        />
      </Field>
    </div>
  );
}

function getMediaHint(
  kind: ProjectKind | "",
  dictionary: Dictionary,
): string | null {
  switch (kind) {
    case "code":
      return dictionary.forms.stepMediaHintCode;
    case "design":
      return dictionary.forms.stepMediaHintDesign;
    case "video":
      return dictionary.forms.stepMediaHintVideo;
    case "photo":
      return dictionary.forms.stepMediaHintPhoto;
    case "3d":
      return dictionary.forms.stepMediaHint3d;
    case "audio":
      return dictionary.forms.stepMediaHintAudio;
    case "qa":
      return dictionary.forms.stepMediaHintQa;
    case "writing":
      return dictionary.forms.stepMediaHintWriting;
    case "motion":
      return dictionary.forms.stepMediaHintMotion;
    case "other":
      return dictionary.forms.stepMediaHintOther;
    default:
      return null;
  }
}

function StepMedia({
  dictionary,
  kind,
  mediaItems,
  onPickFiles,
  onDropFiles,
  onRemove,
  onMove,
  working,
  youTubeInput,
  onYouTubeInputChange,
  onAddYouTube,
  allowDownloads,
  onToggleAllowDownloads,
}: {
  dictionary: Dictionary;
  kind: ProjectKind | "";
  mediaItems: WizardMediaItem[];
  onPickFiles: () => void;
  onDropFiles: (event: DragEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  working: boolean;
  youTubeInput: string;
  onYouTubeInputChange: (value: string) => void;
  onAddYouTube: () => void;
  allowDownloads: boolean;
  onToggleAllowDownloads: (value: boolean) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const kindHint = getMediaHint(kind, dictionary);

  return (
    <div className="space-y-5">
      {kindHint ? (
        <p className="text-sm app-muted">{kindHint}</p>
      ) : null}

      <fieldset className="rounded-2xl border app-border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-eyebrow app-soft">
          {dictionary.forms.allowDownloadsLegend}
        </legend>
        <label className="mt-2 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={allowDownloads}
            onChange={(event) => onToggleAllowDownloads(event.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-[color:var(--accent)]"
          />
          <span className="text-sm text-[color:var(--foreground)]">
            {dictionary.forms.allowDownloadsLabel}
          </span>
        </label>
        <p className="mt-1 ml-6 text-xs app-muted">
          {dictionary.forms.allowDownloadsHint}
        </p>
      </fieldset>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDropFiles}
        className="rounded-3xl border border-dashed app-border bg-[color:var(--surface)] p-6 text-center"
      >
        <p className="text-sm font-medium text-[color:var(--foreground)]">
          {dictionary.forms.mediaDropHint}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onPickFiles}
            disabled={working}
          >
            {mediaItems.length === 0
              ? dictionary.forms.mediaBrowseFiles
              : dictionary.forms.mediaUploadAnother}
          </Button>
        </div>
        <p className="mt-3 text-xs app-soft">
          {dictionary.forms.mediaImageLimit.replace(
            "{limit}",
            String(bytesToMb(getImageSizeLimitBytes(kind))),
          )}{" "}
          {dictionary.forms.mediaVideoLimit.replace(
            "{limit}",
            String(bytesToMb(getVideoSizeLimitBytes(kind))),
          )}
        </p>
      </div>

      <div className="rounded-3xl border app-border bg-[color:var(--surface)] p-4">
        <label
          htmlFor="project-youtube-url"
          className="block text-sm font-medium text-[color:var(--foreground)]"
        >
          {dictionary.forms.mediaYouTubeLabel}
        </label>
        <p className="mt-1 text-xs app-soft">
          {dictionary.forms.mediaYouTubeHint}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="project-youtube-url"
            type="url"
            inputMode="url"
            placeholder={dictionary.forms.mediaYouTubePlaceholder}
            className="app-input flex-1"
            value={youTubeInput}
            onChange={(event) => onYouTubeInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddYouTube();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={onAddYouTube}
            disabled={!youTubeInput.trim()}
          >
            {dictionary.forms.mediaYouTubeAdd}
          </Button>
        </div>
      </div>

      {mediaItems.length === 0 ? (
        <div className="rounded-3xl app-panel-dashed p-6 text-sm app-muted">
          {dictionary.forms.mediaEmptyState}
        </div>
      ) : (
        <>
          <p className="text-xs app-soft">
            {dictionary.forms.mediaReorderHint}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {mediaItems.map((item, index) => {
              const isDragging = dragIndex === index;
              const isOver = overIndex === index && dragIndex !== index;
              const isYouTube = item.kind === "youtube";
              const previewUrl =
                item.kind === "local" ? item.previewUrl : item.url;
              const ratio = Math.min(Math.max(item.aspectRatio, 0.4), 3);

              return (
                <li
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    setDragIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setOverIndex(index);
                  }}
                  onDragLeave={() => {
                    setOverIndex((current) =>
                      current === index ? null : current,
                    );
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragIndex !== null && dragIndex !== index) {
                      onMove(dragIndex, index);
                    }
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className={`group relative cursor-move overflow-hidden rounded-3xl border app-border bg-[color:var(--surface)] transition ${
                    isDragging ? "opacity-50" : ""
                  } ${
                    isOver
                      ? "ring-2 ring-[color:var(--accent)] ring-offset-2 ring-offset-[color:var(--background)]"
                      : ""
                  }`}
                >
                  <div
                    className="relative flex w-full items-center justify-center bg-[color:var(--surface-muted)]"
                    style={{ aspectRatio: ratio }}
                  >
                    {index === 0 && item.mediaKind === "image" && (
                      <span className="absolute left-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                        {dictionary.dashboardProjects.previewBadge}
                      </span>
                    )}

                    {isYouTube ? (
                      <iframe
                        src={buildYouTubeEmbedUrl(item.videoId)}
                        title="YouTube preview"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="absolute inset-0 h-full w-full"
                      />
                    ) : item.mediaKind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <video
                        src={previewUrl}
                        controls
                        preload="metadata"
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 p-3">
                    <span className="text-xs uppercase tracking-eyebrow app-soft">
                      {dictionary.forms.stepLabel} {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <IconButton
                        ariaLabel={dictionary.forms.stepBack}
                        onClick={() => onMove(index, Math.max(0, index - 1))}
                        disabled={index === 0}
                      >
                        <span aria-hidden>↑</span>
                      </IconButton>
                      <IconButton
                        ariaLabel={dictionary.forms.stepNext}
                        onClick={() =>
                          onMove(
                            index,
                            Math.min(mediaItems.length - 1, index + 1),
                          )
                        }
                        disabled={index === mediaItems.length - 1}
                      >
                        <span aria-hidden>↓</span>
                      </IconButton>
                      <IconButton
                        ariaLabel={dictionary.forms.mediaRemove}
                        onClick={() => onRemove(item.id)}
                      >
                        <span aria-hidden>✕</span>
                      </IconButton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border app-border bg-[color:var(--surface)] text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
  htmlFor,
  className,
  description,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
  description?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-[color:var(--foreground)]"
      >
        {label}
      </label>
      {description ? (
        <p className="-mt-1 mb-2 text-xs app-muted">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

function UrlField({
  id,
  label,
  description,
  placeholder,
  value,
  onChange,
  invalidMessage,
  className,
}: {
  id: string;
  label: string;
  description?: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  invalidMessage: string;
  className?: string;
}) {
  const [touched, setTouched] = useState(false);
  const trimmed = value.trim();
  const invalid = touched && trimmed.length > 0 && !isValidPublicUrl(trimmed);
  const errorId = `${id}-error`;

  return (
    <Field
      label={label}
      htmlFor={id}
      description={description}
      className={className}
    >
      <input
        id={id}
        type="url"
        inputMode="url"
        placeholder={placeholder}
        className={`app-input${invalid ? " border-rose-500 focus:border-rose-500" : ""}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
      />
      {invalid ? (
        <p id={errorId} className="mt-1.5 text-xs text-rose-500">
          {invalidMessage}
        </p>
      ) : null}
    </Field>
  );
}
