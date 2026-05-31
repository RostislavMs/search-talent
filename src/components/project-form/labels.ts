import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { ProjectStatus } from "@/lib/projects";
import type {
  AudioGenre,
  AudioRole,
  CodeArchitecture,
  DesignDeliverable,
  DesignRole,
  DesignTool,
  MotionPurpose,
  MotionRole,
  MotionTechnique,
  PhotoGenre,
  PhotoMedium,
  PhotoRole,
  QaMethodology,
  QaRole,
  QaTestType,
  ThreeDRole,
  ThreeDStyle,
  VideoGenre,
  VideoRole,
  WritingFormat,
  WritingLanguage,
  WritingRole,
  WritingTopic,
} from "@/lib/project-kind-metadata";

// Pure label/format helpers extracted from create-project-form.tsx.
// Each maps an enum value (and the active dictionary) to a localized string.

export function getDesignRoleLabel(role: DesignRole, dictionary: Dictionary) {
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

export function getDesignToolLabel(tool: DesignTool, dictionary: Dictionary) {
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

export function getDesignDeliverableLabel(
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

export function parseVideoDurationInput(raw: string): number | null {
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

export function formatVideoDuration(seconds: number): string {
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

export function getVideoRoleLabel(role: VideoRole, dictionary: Dictionary) {
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

export function getVideoGenreLabel(genre: VideoGenre, dictionary: Dictionary) {
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

export function getAudioRoleLabel(role: AudioRole, dictionary: Dictionary) {
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

export function getAudioGenreLabel(value: AudioGenre, dictionary: Dictionary) {
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

export function getWritingRoleLabel(role: WritingRole, dictionary: Dictionary) {
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

export function getWritingFormatLabel(value: WritingFormat, dictionary: Dictionary) {
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

export function getWritingTopicLabel(value: WritingTopic, dictionary: Dictionary) {
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

export function getWritingLanguageLabel(
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

export function getMotionRoleLabel(role: MotionRole, dictionary: Dictionary) {
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

export function getMotionTechniqueLabel(
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

export function getMotionPurposeLabel(value: MotionPurpose, dictionary: Dictionary) {
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

export function getQaRoleLabel(role: QaRole, dictionary: Dictionary) {
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

export function getQaTestTypeLabel(value: QaTestType, dictionary: Dictionary) {
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

export function getQaMethodologyLabel(value: QaMethodology, dictionary: Dictionary) {
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

export function getThreeDRoleLabel(role: ThreeDRole, dictionary: Dictionary) {
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

export function getThreeDStyleLabel(value: ThreeDStyle, dictionary: Dictionary) {
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

export function getPhotoRoleLabel(role: PhotoRole, dictionary: Dictionary) {
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

export function getPhotoGenreLabel(value: PhotoGenre, dictionary: Dictionary) {
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

export function getPhotoMediumLabel(value: PhotoMedium, dictionary: Dictionary) {
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

export function getCodeArchitectureLabel(
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

export function getStatusLabel(status: ProjectStatus, dictionary: Dictionary) {
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
