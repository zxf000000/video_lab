export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type JsonObject = Record<string, unknown>;

// ── API response types ──

export interface AppConfig {
  text_model: string;
  image_model: string;
  video_model: string;
  voice_model: string;
  api_base: string;
  has_api_key?: boolean;
  api_key_masked?: string;
}

export interface ModelItem {
  id: string;
  label: string;
}

export interface PromptTab {
  key: string;
  label: string;
  desc: string;
  fields: { key: string; label: string; type: string }[];
}

export interface PromptsData {
  prompts: Record<string, string>;
  defaults: Record<string, string>;
  vars: Record<string, string[]>;
}

export interface SeedanceConfig {
  seedance_api_base: string;
  seedance_model: string;
}

export interface KlingConfig {
  kling_api_base: string;
}

export interface VideoTaskBase {
  id: number;
  task_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  params?: JsonObject;
  result?: JsonObject;
  error?: string;
}

/** Extended task type for video/image generation backends (Seedance, Kling, etc.) */
export interface VideoGenerationTask extends VideoTaskBase {
  output_path?: string;
  error_message?: string;
  image_url?: string;
  video_url?: string;
  story_prompt?: string;
  target_duration?: number;
  aspect_ratio?: string;
  resolution?: string;
}

export interface DeletedProject {
  id: number;
  title: string;
  story_prompt: string;
  deleted_at: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

async function request<T>(path: string, options: RequestInit & { headers?: Record<string, string> } = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error((payload as { error?: string } | null)?.error || `Request failed: ${response.status}`);
  }

  return payload as T;
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

export interface ProjectSummary {
  id: number;
  name: string;
  genre: string;
  targetPlatform: string;
  episodeCountPlanned: number;
  currentStage: string;
  status: string;
  storyPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBrief {
  logline: string;
  targetAudience: string;
  genreTags: string[];
  styleKeywords: string[];
  worldRules: string;
  mainConflict: string;
  relationshipSummary: string;
  reversalRules: string;
  forbiddenRules: string;
  status: string;
}

export type CopilotModuleType = "brief" | "character" | "scene" | "episode" | "shot" | "screenplay";
export type CopilotIntent = "generate" | "rewrite" | "expand" | "compress" | "fill_missing" | "regenerate" | "optimize_prompt";

export interface BriefProposal {
  logline: string;
  targetAudience: string;
  genreTags: string[];
  styleKeywords: string[];
  worldRules: string;
  mainConflict: string;
  relationshipSummary: string;
  reversalRules: string;
  forbiddenRules: string;
}

export interface SceneProposal {
  name: string;
  sceneType: string;
  spaceDescription: string;
  lightingStyle: string;
  timeOfDay: string;
  weather: string;
  propList: string[];
  negativeConstraints: string;
  imagePrompt: string;
  negativePrompt: string;
  episodeId?: number | null;
}

export interface SceneCollectionProposal {
  scenes: SceneProposal[];
}

export type SceneCopilotProposal = SceneCollectionProposal;

export interface ShotProposal {
  shotNo: number;
  sceneBlock: string;
  visualGoal: string;
  shotSize: string;
  cameraAngle: string;
  composition: string;
  actionDescription: string;
  facialEmotion: string;
  cameraMotion: string;
  dialogueExcerpt: string;
  estimatedDurationMs: number;
  scenePresetId: number | null;
  characterIds: number[];
}

export interface ShotCollectionProposal {
  shots: ShotProposal[];
}

export type ShotCopilotProposal = ShotCollectionProposal;

export interface CharacterProposal {
  characterProfile: {
    name: string;
    roleType: string;
    species: string;
    identitySummary: string;
    appearanceSummary: string;
    personalityTags: string[];
    speechStyle: string;
    negativeConstraints: string;
  };
  imageSpec: {
    genderPresentation: string;
    ageRange: string;
    bodyType: string;
    faceFeatures: string;
    hairStyle: string;
    hairColor: string;
    eyeStyle: string;
    signatureExpression: string;
    signaturePose: string;
    clothingStyle: string;
    colorPalette: string[];
    visualKeywords: string[];
    negativeVisualConstraints: string[];
    imagePrompt: string;
    negativePrompt: string;
  };
  appearanceAnchor?: string;
}

export interface CharacterCollectionProposal {
  mode?: "base_character";
  roles: CharacterProposal[];
}

export type CharacterVariantMode = "base_character" | "character_variant";

export type CharacterVariantType =
  | "default"
  | "battle"
  | "disguise"
  | "flashback"
  | "wedding"
  | "injured"
  | "darkened"
  | "young_version"
  | "work_uniform"
  | "casual_home"
  | (string & {});

export interface CharacterVariantInheritRules {
  keepFaceIdentity: boolean;
  keepAgeRange: boolean;
  keepBodyType: boolean;
  keepCoreTemperament: boolean;
}

export interface CharacterVariantImageSpecOverride {
  genderPresentation?: string;
  ageRange?: string;
  bodyType?: string;
  faceFeatures?: string;
  hairStyle?: string;
  hairColor?: string;
  eyeStyle?: string;
  signatureExpression?: string;
  signaturePose?: string;
  clothingStyle?: string;
  colorPalette?: string[];
  visualKeywords?: string[];
  negativeVisualConstraints?: string[];
  imagePrompt?: string;
  negativePrompt?: string;
}

export interface CharacterVariantProposal {
  variantName: string;
  variantType: CharacterVariantType;
  triggerReason: string;
  visualChangesSummary: string;
  inheritRules: CharacterVariantInheritRules;
  imageSpecOverride: CharacterVariantImageSpecOverride;
}

export interface CharacterVariantCollectionProposal {
  mode: "character_variant";
  baseCharacter?: CharacterProposal | null;
  variants: CharacterVariantProposal[];
}

export interface EpisodeProposal {
  episodeNo: number;
  title: string;
  summary: string;
  goal: string;
  coreConflict: string;
  openingHook: string;
  climax: string;
  endingHook: string;
}

export interface EpisodeCollectionProposal {
  episodes: EpisodeProposal[];
}

export interface ScreenplaySceneProposal {
  sceneNo: number;
  location: string;
  summary: string;
  content: string;
}

export interface ScreenplayProposal {
  content: string;
  scenes: ScreenplaySceneProposal[];
}

export type CopilotProposal =
  | BriefProposal
  | CharacterCollectionProposal
  | CharacterVariantCollectionProposal
  | SceneCopilotProposal
  | EpisodeCollectionProposal
  | ScreenplayProposal
  | ShotCopilotProposal;

export interface CopilotStreamRequest {
  moduleType: CopilotModuleType;
  projectId: number;
  entityId?: number | null;
  intent: CopilotIntent;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context: JsonObject;
}

export interface CopilotDeltaEvent {
  type: "delta";
  content: string;
}

export interface CopilotProposalEvent<TProposal> {
  type: "proposal";
  proposal: TProposal;
}

export interface CharacterAsset {
  id: number;
  projectId: number;
  name: string;
  roleType: string;
  species: string;
  appearanceSummary: string;
  appearancePrompt: string;
  personalityTags: string[];
  speechStyle: string;
  identitySummary: string;
  visualProfile: JsonObject;
  imagePrompt: string;
  negativePrompt: string;
  imagePath: string;
  photoPath: string;
  voiceProfile: JsonObject;
  outfitPresets: unknown[];
  negativeConstraints: string;
  referenceAssetIds: unknown[];
  status: string;
  imageStatus: string;
  promptStatus: string;
  anchorStatus: string;
  regenerateStatus: string;
  versionNo: number;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodeSceneOverride {
  id: number;
  episodeId: number;
  scenePresetId: number;
  lightingStyle: string;
  timeOfDay: string;
  weather: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScenePreset {
  id: number;
  projectId: number;
  name: string;
  sceneType: string;
  spaceDescription: string;
  lightingStyle: string;
  timeOfDay: string;
  weather: string;
  propList: string[];
  negativeConstraints: string;
  imagePrompt: string;
  negativePrompt: string;
  referenceAssetIds: unknown[];
  variants: unknown[];
  status: string;
  versionNo: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenplayScene {
  sceneNo: number;
  location: string;
  summary: string;
  content: string;
  scenePresetId: number | null;
}

export interface Episode {
  id: number;
  projectId: number;
  episodeNo: number;
  title: string;
  summary: string;
  goal: string;
  coreConflict: string;
  openingHook: string;
  climax: string;
  endingHook: string;
  screenplayContent: string;
  screenplayContentEn: string;
  screenplayScenes: ScreenplayScene[];
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Shot {
  id: number;
  episodeId: number;
  sceneBlock: string;
  shotNo: number;
  visualGoal: string;
  characterIds: number[];
  scenePresetId: number | null;
  shotSize: string;
  cameraAngle: string;
  composition: string;
  actionDescription: string;
  facialEmotion: string;
  cameraMotion: string;
  dialogueExcerpt: string;
  estimatedDurationMs: number;
  status: string;
  sortOrder: number;
  batchId: number | null;
  firstFrameUrl: string;
  videoUrl: string;
  storyboardUrl: string;
  storyboardPrompt: string;
  storyboardVideoPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShotBatch {
  id: number;
  episodeId: number;
  versionNo: number;
  taskId: number | null;
  shotCount: number;
  createdAt: string;
}

export interface ShotPrompt {
  id: number;
  shotId: number;
  versionNo: number;
  promptText: string;
  firstFramePrompt: string;
  firstFrameNegativePrompt: string;
  videoPrompt: string;
  videoNegativePrompt: string;
  negativePrompt: string;
  modelParams: JsonObject;
  referenceAssetIds: unknown[];
  firstFrameUrl: string;
  firstFrameStatus: string;
  videoUrl: string;
  videoStatus: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationTask {
  id: number;
  projectId: number;
  episodeId: number | null;
  shotId: number | null;
  shotPromptId: number | null;
  taskType: string;
  provider: string;
  modelName: string;
  status: string;
  inputPayload: JsonObject;
  outputAssets: unknown[];
  retryCount: number;
  errorMessage: string;
  costAmount: number;
  durationMs: number;
  submittedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewIssue {
  id: number;
  projectId: number;
  episodeId: number | null;
  shotId: number | null;
  generationTaskId: number | null;
  issueType: string;
  severity: string;
  description: string;
  reworkTargetType: string;
  resolutionStatus: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface EpisodeExport {
  id: number;
  episodeId: number;
  versionNo: number;
  selectedTaskIds: number[];
  timelineData: JsonObject;
  subtitleData: JsonObject;
  audioData: JsonObject;
  previewUrl: string;
  exportUrl: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  brief: ProjectBrief;
  episodes: Episode[];
  characters: CharacterAsset[];
  scenes: ScenePreset[];
  tasks: GenerationTask[];
}

export interface CreateProjectInput {
  name: string;
  genre: string;
  targetPlatform: string;
  episodeCountPlanned: number;
  logline: string;
  targetAudience: string;
  genreTags: string[];
  styleKeywords: string[];
}

function normalizeProjectSummary(raw: Record<string, unknown>): ProjectSummary {
  return {
    id: asNumber(raw.id),
    name: asString(raw.name),
    genre: asString(raw.genre),
    targetPlatform: asString(raw.target_platform),
    episodeCountPlanned: asNumber(raw.episode_count_planned, 0),
    currentStage: asString(raw.current_stage, "draft"),
    status: asString(raw.status, "draft"),
    storyPrompt: raw.story_prompt != null ? asString(raw.story_prompt) : undefined,
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

function normalizeBrief(raw: Record<string, unknown> | undefined): ProjectBrief {
  const brief = raw ?? {};
  return {
    logline: asString(brief.logline),
    targetAudience: asString(brief.target_audience),
    genreTags: parseJsonValue<string[]>(brief.genre_tags, []),
    styleKeywords: parseJsonValue<string[]>(brief.style_keywords, []),
    worldRules: asString(brief.world_rules),
    mainConflict: asString(brief.main_conflict),
    relationshipSummary: asString(brief.relationship_summary),
    reversalRules: asString(brief.reversal_rules),
    forbiddenRules: asString(brief.forbidden_rules),
    status: asString(brief.status, "draft"),
  };
}

function normalizeBriefProposal(raw: Record<string, unknown>): BriefProposal {
  return {
    logline: asString(raw.logline),
    targetAudience: asString(raw.target_audience ?? raw.targetAudience),
    genreTags: parseJsonValue<string[]>(raw.genre_tags ?? raw.genreTags, []),
    styleKeywords: parseJsonValue<string[]>(raw.style_keywords ?? raw.styleKeywords, []),
    worldRules: asString(raw.world_rules ?? raw.worldRules),
    mainConflict: asString(raw.main_conflict ?? raw.mainConflict),
    relationshipSummary: asString(raw.relationship_summary ?? raw.relationshipSummary),
    reversalRules: asString(raw.reversal_rules ?? raw.reversalRules),
    forbiddenRules: asString(raw.forbidden_rules ?? raw.forbiddenRules),
  };
}

function normalizeCharacterProposal(raw: Record<string, unknown>): CharacterProposal {
  const profile = typeof raw.character_profile === "object" && raw.character_profile !== null
    ? raw.character_profile as Record<string, unknown>
    : raw;
  const imageSpec = typeof raw.image_spec === "object" && raw.image_spec !== null
    ? raw.image_spec as Record<string, unknown>
    : {};
  return {
    characterProfile: {
      name: asString(profile.name),
      roleType: asString(profile.role_type ?? profile.roleType),
      species: asString(profile.species),
      identitySummary: asString(profile.identity_summary ?? profile.identitySummary),
      appearanceSummary: asString(profile.appearance_summary ?? profile.appearanceSummary),
      personalityTags: parseJsonValue<string[]>(profile.personality_tags ?? profile.personalityTags, []),
      speechStyle: asString(profile.speech_style ?? profile.speechStyle),
      negativeConstraints: asString(profile.negative_constraints ?? profile.negativeConstraints),
    },
    imageSpec: {
      genderPresentation: asString(imageSpec.gender_presentation ?? imageSpec.genderPresentation),
      ageRange: asString(imageSpec.age_range ?? imageSpec.ageRange),
      bodyType: asString(imageSpec.body_type ?? imageSpec.bodyType),
      faceFeatures: asString(imageSpec.face_features ?? imageSpec.faceFeatures),
      hairStyle: asString(imageSpec.hair_style ?? imageSpec.hairStyle),
      hairColor: asString(imageSpec.hair_color ?? imageSpec.hairColor),
      eyeStyle: asString(imageSpec.eye_style ?? imageSpec.eyeStyle),
      signatureExpression: asString(imageSpec.signature_expression ?? imageSpec.signatureExpression),
      signaturePose: asString(imageSpec.signature_pose ?? imageSpec.signaturePose),
      clothingStyle: asString(imageSpec.clothing_style ?? imageSpec.clothingStyle),
      colorPalette: parseJsonValue<string[]>(imageSpec.color_palette ?? imageSpec.colorPalette, []),
      visualKeywords: parseJsonValue<string[]>(imageSpec.visual_keywords ?? imageSpec.visualKeywords, []),
      negativeVisualConstraints: parseJsonValue<string[]>(
        imageSpec.negative_visual_constraints ?? imageSpec.negativeVisualConstraints,
        [],
      ),
      imagePrompt: asString(imageSpec.image_prompt ?? imageSpec.imagePrompt),
      negativePrompt: asString(imageSpec.negative_prompt ?? imageSpec.negativePrompt),
    },
    appearanceAnchor: asString(raw.appearance_anchor ?? raw.appearanceAnchor) || undefined,
  };
}

function normalizeCharacterCollectionProposal(raw: Record<string, unknown>): CharacterCollectionProposal {
  const roles = Array.isArray(raw.roles)
    ? raw.roles
    : Array.isArray(raw.characters)
      ? raw.characters
      : [];
  return {
    mode: "base_character",
    roles: roles
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map(normalizeCharacterProposal),
  };
}

function normalizeSceneProposal(raw: Record<string, unknown>): SceneProposal {
  return {
    name: asString(raw.name),
    sceneType: asString(raw.scene_type ?? raw.sceneType),
    spaceDescription: asString(raw.space_description ?? raw.spaceDescription),
    lightingStyle: asString(raw.lighting_style ?? raw.lightingStyle),
    timeOfDay: asString(raw.time_of_day ?? raw.timeOfDay),
    weather: asString(raw.weather),
    propList: parseJsonValue<string[]>(raw.prop_list ?? raw.propList, []),
    negativeConstraints: asString(raw.negative_constraints ?? raw.negativeConstraints),
    imagePrompt: asString(raw.image_prompt ?? raw.imagePrompt),
    negativePrompt: asString(raw.negative_prompt ?? raw.negativePrompt),
  };
}

function normalizeSceneCollectionProposal(raw: Record<string, unknown>): SceneCollectionProposal {
  const scenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  return {
    scenes: scenes
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map(normalizeSceneProposal),
  };
}

function normalizeShotProposal(raw: Record<string, unknown>): ShotProposal {
  const characterIds = Array.isArray(raw.character_ids)
    ? raw.character_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
    : typeof raw.character_ids === "string"
    ? raw.character_ids.split(",").map((s) => Number(s.trim())).filter((x) => Number.isFinite(x) && x > 0)
    : [];
  return {
    shotNo: Number(raw.shot_no ?? raw.shotNo ?? 0),
    sceneBlock: asString(raw.scene_block ?? raw.sceneBlock),
    visualGoal: asString(raw.visual_goal ?? raw.visualGoal),
    shotSize: asString(raw.shot_size ?? raw.shotSize),
    cameraAngle: asString(raw.camera_angle ?? raw.cameraAngle),
    composition: asString(raw.composition),
    actionDescription: asString(raw.action_description ?? raw.actionDescription),
    facialEmotion: asString(raw.facial_emotion ?? raw.facialEmotion),
    cameraMotion: asString(raw.camera_motion ?? raw.cameraMotion),
    dialogueExcerpt: asString(raw.dialogue_excerpt ?? raw.dialogueExcerpt),
    estimatedDurationMs: Number(raw.estimated_duration_ms ?? raw.estimatedDurationMs ?? 3000),
    scenePresetId: raw.scene_preset_id == null ? null : Number(raw.scene_preset_id),
    characterIds,
  };
}

function normalizeShotCollectionProposal(raw: Record<string, unknown>): ShotCollectionProposal {
  const shots = Array.isArray(raw.shots) ? raw.shots : [];
  return {
    shots: shots
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map(normalizeShotProposal),
  };
}

function normalizeEpisodeProposal(raw: Record<string, unknown>): EpisodeProposal {
  return {
    episodeNo: Number(raw.episode_no ?? raw.episodeNo ?? 0),
    title: String(raw.title ?? ""),
    summary: String(raw.summary ?? ""),
    goal: String(raw.goal ?? ""),
    coreConflict: String(raw.core_conflict ?? raw.coreConflict ?? ""),
    openingHook: String(raw.opening_hook ?? raw.openingHook ?? ""),
    climax: String(raw.climax ?? ""),
    endingHook: String(raw.ending_hook ?? raw.endingHook ?? ""),
  };
}

function normalizeScreenplaySceneProposal(raw: Record<string, unknown>): ScreenplaySceneProposal {
  return {
    sceneNo: Number(raw.scene_no ?? raw.sceneNo ?? 0),
    location: asString(raw.location),
    summary: asString(raw.summary),
    content: asString(raw.content),
  };
}

function normalizeScreenplayProposal(raw: Record<string, unknown>): ScreenplayProposal {
  const scenes = Array.isArray(raw.scenes)
    ? raw.scenes.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null).map(normalizeScreenplaySceneProposal)
    : [];
  return {
    content: asString(raw.content),
    scenes,
  };
}

function normalizeEpisodeCollectionProposal(raw: Record<string, unknown>): EpisodeCollectionProposal {
  const episodes = Array.isArray(raw.episodes) ? raw.episodes : [];
  return {
    episodes: episodes
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map(normalizeEpisodeProposal),
  };
}

function normalizeCharacterVariantProposal(raw: Record<string, unknown>): CharacterVariantProposal {
  const inheritRules = typeof raw.inherit_rules === "object" && raw.inherit_rules !== null
    ? raw.inherit_rules as Record<string, unknown>
    : {};
  const override = typeof raw.image_spec_override === "object" && raw.image_spec_override !== null
    ? raw.image_spec_override as Record<string, unknown>
    : {};
  return {
    variantName: asString(raw.variant_name ?? raw.variantName),
    variantType: asString(raw.variant_type ?? raw.variantType) as CharacterVariantType,
    triggerReason: asString(raw.trigger_reason ?? raw.triggerReason),
    visualChangesSummary: asString(raw.visual_changes_summary ?? raw.visualChangesSummary),
    inheritRules: {
      keepFaceIdentity: Boolean(inheritRules.keep_face_identity ?? inheritRules.keepFaceIdentity),
      keepAgeRange: Boolean(inheritRules.keep_age_range ?? inheritRules.keepAgeRange),
      keepBodyType: Boolean(inheritRules.keep_body_type ?? inheritRules.keepBodyType),
      keepCoreTemperament: Boolean(inheritRules.keep_core_temperament ?? inheritRules.keepCoreTemperament),
    },
    imageSpecOverride: {
      ...(override.gender_presentation !== undefined || override.genderPresentation !== undefined
        ? { genderPresentation: asString(override.gender_presentation ?? override.genderPresentation) }
        : {}),
      ...(override.age_range !== undefined || override.ageRange !== undefined
        ? { ageRange: asString(override.age_range ?? override.ageRange) }
        : {}),
      ...(override.body_type !== undefined || override.bodyType !== undefined
        ? { bodyType: asString(override.body_type ?? override.bodyType) }
        : {}),
      ...(override.face_features !== undefined || override.faceFeatures !== undefined
        ? { faceFeatures: asString(override.face_features ?? override.faceFeatures) }
        : {}),
      ...(override.hair_style !== undefined || override.hairStyle !== undefined
        ? { hairStyle: asString(override.hair_style ?? override.hairStyle) }
        : {}),
      ...(override.hair_color !== undefined || override.hairColor !== undefined
        ? { hairColor: asString(override.hair_color ?? override.hairColor) }
        : {}),
      ...(override.eye_style !== undefined || override.eyeStyle !== undefined
        ? { eyeStyle: asString(override.eye_style ?? override.eyeStyle) }
        : {}),
      ...(override.signature_expression !== undefined || override.signatureExpression !== undefined
        ? { signatureExpression: asString(override.signature_expression ?? override.signatureExpression) }
        : {}),
      ...(override.signature_pose !== undefined || override.signaturePose !== undefined
        ? { signaturePose: asString(override.signature_pose ?? override.signaturePose) }
        : {}),
      ...(override.clothing_style !== undefined || override.clothingStyle !== undefined
        ? { clothingStyle: asString(override.clothing_style ?? override.clothingStyle) }
        : {}),
      ...(override.color_palette !== undefined || override.colorPalette !== undefined
        ? { colorPalette: parseJsonValue<string[]>(override.color_palette ?? override.colorPalette, []) }
        : {}),
      ...(override.visual_keywords !== undefined || override.visualKeywords !== undefined
        ? { visualKeywords: parseJsonValue<string[]>(override.visual_keywords ?? override.visualKeywords, []) }
        : {}),
      ...(override.negative_visual_constraints !== undefined || override.negativeVisualConstraints !== undefined
        ? {
            negativeVisualConstraints: parseJsonValue<string[]>(
              override.negative_visual_constraints ?? override.negativeVisualConstraints,
              [],
            ),
          }
        : {}),
      ...(override.image_prompt !== undefined || override.imagePrompt !== undefined
        ? { imagePrompt: asString(override.image_prompt ?? override.imagePrompt) }
        : {}),
      ...(override.negative_prompt !== undefined || override.negativePrompt !== undefined
        ? { negativePrompt: asString(override.negative_prompt ?? override.negativePrompt) }
        : {}),
    },
  };
}

function normalizeCharacterVariantCollectionProposal(raw: Record<string, unknown>): CharacterVariantCollectionProposal {
  const baseCharacterRaw = typeof raw.base_character === "object" && raw.base_character !== null
    ? raw.base_character as Record<string, unknown>
    : null;
  const variants = Array.isArray(raw.variants) ? raw.variants : [];
  return {
    mode: "character_variant",
    baseCharacter: baseCharacterRaw ? normalizeCharacterProposal(baseCharacterRaw) : null,
    variants: variants
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map(normalizeCharacterVariantProposal),
  };
}

function normalizeCharacter(raw: Record<string, unknown>): CharacterAsset {
  return {
    id: asNumber(raw.id),
    projectId: asNumber(raw.project_id),
    name: asString(raw.name),
    roleType: asString(raw.role_type),
    species: asString(raw.species),
    identitySummary: asString(raw.identity_summary),
    appearanceSummary: asString(raw.appearance_summary),
    appearancePrompt: asString(raw.appearance_prompt),
    personalityTags: parseJsonValue<string[]>(raw.personality_tags, []),
    speechStyle: asString(raw.speech_style),
    visualProfile: parseJsonValue<JsonObject>(raw.visual_profile, {}),
    imagePrompt: asString(raw.image_prompt),
    negativePrompt: asString(raw.negative_prompt),
    imagePath: asString(raw.image_path),
    photoPath: asString(raw.photo_path),
    voiceProfile: parseJsonValue<JsonObject>(raw.voice_profile, {}),
    outfitPresets: parseJsonValue<unknown[]>(raw.outfit_presets, []),
    negativeConstraints: asString(raw.negative_constraints),
    referenceAssetIds: parseJsonValue<unknown[]>(raw.reference_asset_ids, []),
    status: asString(raw.status, "draft"),
    imageStatus: asString(raw.image_status),
    promptStatus: asString(raw.prompt_status, ""),
    anchorStatus: asString(raw.anchor_status, ""),
    regenerateStatus: asString(raw.regenerate_status, ""),
    versionNo: asNumber(raw.version_no, 1),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

function normalizeScene(raw: Record<string, unknown>): ScenePreset {
  return {
    id: asNumber(raw.id),
    projectId: asNumber(raw.project_id),
    name: asString(raw.name),
    sceneType: asString(raw.scene_type),
    spaceDescription: asString(raw.space_description),
    lightingStyle: asString(raw.lighting_style),
    timeOfDay: asString(raw.time_of_day),
    weather: asString(raw.weather),
    propList: parseJsonValue<string[]>(raw.prop_list, []),
    negativeConstraints: asString(raw.negative_constraints),
    imagePrompt: asString(raw.image_prompt),
    negativePrompt: asString(raw.negative_prompt),
    referenceAssetIds: parseJsonValue<unknown[]>(raw.reference_asset_ids, []),
    variants: parseJsonValue<unknown[]>(raw.variants, []),
    status: asString(raw.status, "draft"),
    versionNo: asNumber(raw.version_no, 1),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

function normalizeEpisode(raw: Record<string, unknown>): Episode {
  return {
    id: asNumber(raw.id),
    projectId: asNumber(raw.project_id),
    episodeNo: asNumber(raw.episode_no, asNumber(raw.episode_number, 1)),
    title: asString(raw.title),
    summary: asString(raw.summary),
    goal: asString(raw.goal),
    coreConflict: asString(raw.core_conflict),
    openingHook: asString(raw.opening_hook),
    climax: asString(raw.climax),
    endingHook: asString(raw.ending_hook),
    screenplayContent: asString(raw.screenplay_content ?? raw.screenplayContent),
    screenplayContentEn: asString(raw.screenplay_content_en ?? raw.screenplayContentEn),
    screenplayScenes: parseJsonValue<ScreenplayScene[]>(raw.screenplay_scenes, []),
    status: asString(raw.status, "draft"),
    sortOrder: asNumber(raw.sort_order, 0),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

function normalizeShot(raw: Record<string, unknown>): Shot {
  return {
    id: asNumber(raw.id),
    episodeId: asNumber(raw.episode_id),
    sceneBlock: asString(raw.scene_block),
    shotNo: asNumber(raw.shot_no, 1),
    visualGoal: asString(raw.visual_goal),
    characterIds: parseJsonValue<number[]>(raw.character_ids, []),
    scenePresetId: raw.scene_preset_id == null ? null : asNumber(raw.scene_preset_id),
    shotSize: asString(raw.shot_size),
    cameraAngle: asString(raw.camera_angle),
    composition: asString(raw.composition),
    actionDescription: asString(raw.action_description),
    facialEmotion: asString(raw.facial_emotion),
    cameraMotion: asString(raw.camera_motion),
    dialogueExcerpt: asString(raw.dialogue_excerpt),
    estimatedDurationMs: asNumber(raw.estimated_duration_ms, 0),
    status: asString(raw.status, "draft"),
    sortOrder: asNumber(raw.sort_order, 0),
    batchId: raw.batch_id == null ? null : asNumber(raw.batch_id),
    firstFrameUrl: asString(raw.firstFrameUrl),
    videoUrl: asString(raw.videoUrl),
    storyboardUrl: asString(raw.storyboard_url),
    storyboardPrompt: asString(raw.storyboard_prompt),
    storyboardVideoPrompt: asString(raw.storyboard_video_prompt),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

function normalizePrompt(raw: Record<string, unknown>): ShotPrompt {
  return {
    id: asNumber(raw.id),
    shotId: asNumber(raw.shot_id),
    versionNo: asNumber(raw.version_no, 1),
    promptText: asString(raw.prompt_text),
    firstFramePrompt: asString(raw.first_frame_prompt),
    firstFrameNegativePrompt: asString(raw.first_frame_negative_prompt),
    videoPrompt: asString(raw.video_prompt),
    videoNegativePrompt: asString(raw.video_negative_prompt),
    negativePrompt: asString(raw.negative_prompt),
    modelParams: parseJsonValue<JsonObject>(raw.model_params, {}),
    referenceAssetIds: parseJsonValue<unknown[]>(raw.reference_asset_ids, []),
    firstFrameUrl: asString(raw.first_frame_url),
    firstFrameStatus: asString(raw.first_frame_status),
    videoUrl: asString(raw.video_url),
    videoStatus: asString(raw.video_status),
    status: asString(raw.status, "draft"),
    isActive: Boolean(raw.is_active),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

function normalizeTask(raw: Record<string, unknown>): GenerationTask {
  return {
    id: asNumber(raw.id),
    projectId: asNumber(raw.project_id),
    episodeId: raw.episode_id == null ? null : asNumber(raw.episode_id),
    shotId: raw.shot_id == null ? null : asNumber(raw.shot_id),
    shotPromptId: raw.shot_prompt_id == null ? null : asNumber(raw.shot_prompt_id),
    taskType: asString(raw.task_type),
    provider: asString(raw.provider),
    modelName: asString(raw.model_name),
    status: asString(raw.status, "queued"),
    inputPayload: typeof raw.input_payload === "object" && raw.input_payload !== null
      ? (raw.input_payload as JsonObject)
      : parseJsonValue<JsonObject>(raw.input_payload, {}),
    outputAssets: Array.isArray(raw.output_assets) ? raw.output_assets : parseJsonValue<unknown[]>(raw.output_assets, []),
    retryCount: asNumber(raw.retry_count, 0),
    errorMessage: asString(raw.error_message),
    costAmount: asNumber(raw.cost_amount, 0),
    durationMs: asNumber(raw.duration_ms, 0),
    submittedAt: asString(raw.submitted_at),
    finishedAt: raw.finished_at == null ? null : asString(raw.finished_at),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

function normalizeReviewIssue(raw: Record<string, unknown>): ReviewIssue {
  return {
    id: asNumber(raw.id),
    projectId: asNumber(raw.project_id),
    episodeId: raw.episode_id == null ? null : asNumber(raw.episode_id),
    shotId: raw.shot_id == null ? null : asNumber(raw.shot_id),
    generationTaskId: raw.generation_task_id == null ? null : asNumber(raw.generation_task_id),
    issueType: asString(raw.issue_type),
    severity: asString(raw.severity),
    description: asString(raw.description),
    reworkTargetType: asString(raw.rework_target_type),
    resolutionStatus: asString(raw.resolution_status),
    createdAt: asString(raw.created_at),
    resolvedAt: raw.resolved_at == null ? null : asString(raw.resolved_at),
  };
}

function normalizeEpisodeExport(raw: Record<string, unknown>): EpisodeExport {
  return {
    id: asNumber(raw.id),
    episodeId: asNumber(raw.episode_id),
    versionNo: asNumber(raw.version_no, 1),
    selectedTaskIds: parseJsonValue<number[]>(raw.selected_task_ids, []),
    timelineData: parseJsonValue<JsonObject>(raw.timeline_data, {}),
    subtitleData: parseJsonValue<JsonObject>(raw.subtitle_data, {}),
    audioData: parseJsonValue<JsonObject>(raw.audio_data, {}),
    previewUrl: asString(raw.preview_url),
    exportUrl: asString(raw.export_url),
    status: asString(raw.status, "draft"),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

export function getApiBase() {
  return API_BASE;
}

export async function listProjects(): Promise<{ projects: ProjectSummary[] }> {
  const payload = await request<{ projects: Record<string, unknown>[] }>("/api/projects");
  return { projects: payload.projects.map(normalizeProjectSummary) };
}

export async function createProject(input: CreateProjectInput) {
  const payload = await request<{ project: Record<string, unknown> }>("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      genre: input.genre,
      target_platform: input.targetPlatform,
      episode_count_planned: input.episodeCountPlanned,
      logline: input.logline,
      target_audience: input.targetAudience,
      genre_tags: input.genreTags,
      style_keywords: input.styleKeywords,
      current_stage: "brief_ready",
      status: "brief_ready",
      brief_status: "draft",
    }),
  });
  return { project: normalizeProjectSummary(payload.project) };
}

export async function getProject(projectId: number): Promise<{ project: ProjectDetail }> {
  const payload = await request<{ project: Record<string, unknown> & {
    brief?: Record<string, unknown>;
    episodes?: Record<string, unknown>[];
    characters?: Record<string, unknown>[];
    scenes?: Record<string, unknown>[];
    tasks?: Record<string, unknown>[];
  } }>(`/api/projects/${projectId}`);
  const project = payload.project;
  return {
    project: {
      ...normalizeProjectSummary(project),
      brief: normalizeBrief(project.brief),
      episodes: (project.episodes ?? []).map(normalizeEpisode),
      characters: (project.characters ?? []).map(normalizeCharacter),
      scenes: (project.scenes ?? []).map(normalizeScene),
      tasks: (project.tasks ?? []).map(normalizeTask),
    },
  };
}

export async function updateProject(projectId: number, data: Partial<CreateProjectInput> & { currentStage?: string; status?: string }) {
  const payload = await request<{ project: Record<string, unknown> }>(`/api/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.genre !== undefined ? { genre: data.genre } : {}),
      ...(data.targetPlatform !== undefined ? { target_platform: data.targetPlatform } : {}),
      ...(data.episodeCountPlanned !== undefined ? { episode_count_planned: data.episodeCountPlanned } : {}),
      ...(data.currentStage !== undefined ? { current_stage: data.currentStage } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    }),
  });
  return { project: normalizeProjectSummary(payload.project) };
}

export function deleteProject(projectId: number) {
  return request<{ ok: boolean }>(`/api/projects/${projectId}`, { method: "DELETE" });
}

export function deleteProjects(projectIds: number[]) {
  return request<{ ok: boolean; deleted: number }>("/api/projects/batch-delete", {
    method: "POST",
    body: JSON.stringify({ ids: projectIds }),
  });
}

export async function getProjectBrief(projectId: number): Promise<{ brief: ProjectBrief }> {
  const payload = await request<{ brief: Record<string, unknown> }>(`/api/projects/${projectId}/brief`);
  return { brief: normalizeBrief(payload.brief) };
}

export async function updateProjectBrief(projectId: number, data: ProjectBrief) {
  const payload = await request<{ brief: Record<string, unknown> }>(`/api/projects/${projectId}/brief`, {
    method: "PUT",
    body: JSON.stringify({
      logline: data.logline,
      target_audience: data.targetAudience,
      genre_tags: data.genreTags,
      style_keywords: data.styleKeywords,
      world_rules: data.worldRules,
      main_conflict: data.mainConflict,
      relationship_summary: data.relationshipSummary,
      reversal_rules: data.reversalRules,
      forbidden_rules: data.forbiddenRules,
      status: data.status,
    }),
  });
  return { brief: normalizeBrief(payload.brief) };
}

export async function listCharacters(projectId: number) {
  const payload = await request<{ characters: Record<string, unknown>[] }>(`/api/projects/${projectId}/characters`);
  return { characters: payload.characters.map(normalizeCharacter) };
}

export async function createCharacter(projectId: number, data: Partial<CharacterAsset> & { name: string }) {
  const payload = await request<{ character: Record<string, unknown> }>(`/api/projects/${projectId}/characters`, {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      role_type: data.roleType ?? "",
      identity_summary: data.identitySummary ?? "",
      appearance_summary: data.appearanceSummary ?? "",
      appearance_prompt: data.appearancePrompt ?? "",
      personality_tags: data.personalityTags ?? [],
      speech_style: data.speechStyle ?? "",
      visual_profile: data.visualProfile ?? {},
      image_prompt: data.imagePrompt ?? "",
      negative_prompt: data.negativePrompt ?? "",
      image_path: data.imagePath ?? "",
      voice_profile: data.voiceProfile ?? {},
      outfit_presets: data.outfitPresets ?? [],
      negative_constraints: data.negativeConstraints ?? "",
      reference_asset_ids: data.referenceAssetIds ?? [],
      status: data.status ?? "draft",
      version_no: data.versionNo ?? 1,
    }),
  });
  return { character: normalizeCharacter(payload.character) };
}

export async function updateCharacter(characterId: number, projectId: number, data: Partial<CharacterAsset>) {
  const payload = await request<{ character: Record<string, unknown> }>(`/api/characters/${characterId}`, {
    method: "PUT",
    body: JSON.stringify({
      id: characterId,
      project_id: projectId,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.roleType !== undefined ? { role_type: data.roleType } : {}),
      ...(data.identitySummary !== undefined ? { identity_summary: data.identitySummary } : {}),
      ...(data.appearanceSummary !== undefined ? { appearance_summary: data.appearanceSummary } : {}),
      ...(data.appearancePrompt !== undefined ? { appearance_prompt: data.appearancePrompt } : {}),
      ...(data.personalityTags !== undefined ? { personality_tags: data.personalityTags } : {}),
      ...(data.speechStyle !== undefined ? { speech_style: data.speechStyle } : {}),
      ...(data.visualProfile !== undefined ? { visual_profile: data.visualProfile } : {}),
      ...(data.imagePrompt !== undefined ? { image_prompt: data.imagePrompt } : {}),
      ...(data.negativePrompt !== undefined ? { negative_prompt: data.negativePrompt } : {}),
      ...(data.imagePath !== undefined ? { image_path: data.imagePath } : {}),
      ...(data.voiceProfile !== undefined ? { voice_profile: data.voiceProfile } : {}),
      ...(data.outfitPresets !== undefined ? { outfit_presets: data.outfitPresets } : {}),
      ...(data.negativeConstraints !== undefined ? { negative_constraints: data.negativeConstraints } : {}),
      ...(data.referenceAssetIds !== undefined ? { reference_asset_ids: data.referenceAssetIds } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.versionNo !== undefined ? { version_no: data.versionNo } : {}),
    }),
  });
  return { character: normalizeCharacter(payload.character) };
}

export function deleteCharacter(characterId: number) {
  return request<{ ok: boolean }>(`/api/characters/${characterId}`, { method: "DELETE" });
}

export async function generateCharacterImage(characterId: number) {
  const payload = await request<{ task: Record<string, unknown> }>(`/api/characters/${characterId}/generate-image`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return { task: normalizeTask(payload.task) };
}

export async function optimizeCharacterPrompt(characterId: number): Promise<{ task_id: number; status: string }> {
  return request(`/api/characters/${characterId}/optimize-prompt`, { method: "POST" });
}

export async function generateCharacterPrompt(characterId: number): Promise<{ task_id: number; status: string }> {
  return request(`/api/characters/${characterId}/generate-prompt`, { method: "POST" });
}

export async function generateCharacterAnchor(characterId: number): Promise<{ task_id: number; status: string }> {
  return request(`/api/characters/${characterId}/generate-anchor`, { method: "POST" });
}

export async function regenerateCharacter(characterId: number, input: string): Promise<{ task_id: number; status: string }> {
  return request(`/api/characters/${characterId}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ input }),
  });
}

export async function generateSceneImage(sceneId: number) {
  const payload = await request<{ scene: Record<string, unknown> }>(`/api/scenes/${sceneId}/generate-image`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return { scene: normalizeScene(payload.scene) };
}

export async function listScenes(projectId: number) {
  const payload = await request<{ scenes: Record<string, unknown>[] }>(`/api/projects/${projectId}/scenes`);
  return { scenes: payload.scenes.map(normalizeScene) };
}

export async function createScene(projectId: number, data: Partial<ScenePreset> & { name: string }) {
  const payload = await request<{ scene: Record<string, unknown> }>(`/api/projects/${projectId}/scenes`, {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      scene_type: data.sceneType ?? "",
      space_description: data.spaceDescription ?? "",
      lighting_style: data.lightingStyle ?? "",
      time_of_day: data.timeOfDay ?? "",
      weather: data.weather ?? "",
      prop_list: data.propList ?? [],
      negative_constraints: data.negativeConstraints ?? "",
      image_prompt: data.imagePrompt ?? "",
      negative_prompt: data.negativePrompt ?? "",
      reference_asset_ids: data.referenceAssetIds ?? [],
      variants: data.variants ?? [],
      status: data.status ?? "draft",
      version_no: data.versionNo ?? 1,
    }),
  });
  return { scene: normalizeScene(payload.scene) };
}

export async function updateScene(sceneId: number, projectId: number, data: Partial<ScenePreset>) {
  const payload = await request<{ scene: Record<string, unknown> }>(`/api/scenes/${sceneId}`, {
    method: "PUT",
    body: JSON.stringify({
      id: sceneId,
      project_id: projectId,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.sceneType !== undefined ? { scene_type: data.sceneType } : {}),
      ...(data.spaceDescription !== undefined ? { space_description: data.spaceDescription } : {}),
      ...(data.lightingStyle !== undefined ? { lighting_style: data.lightingStyle } : {}),
      ...(data.timeOfDay !== undefined ? { time_of_day: data.timeOfDay } : {}),
      ...(data.weather !== undefined ? { weather: data.weather } : {}),
      ...(data.propList !== undefined ? { prop_list: data.propList } : {}),
      ...(data.negativeConstraints !== undefined ? { negative_constraints: data.negativeConstraints } : {}),
      ...(data.imagePrompt !== undefined ? { image_prompt: data.imagePrompt } : {}),
      ...(data.negativePrompt !== undefined ? { negative_prompt: data.negativePrompt } : {}),
      ...(data.referenceAssetIds !== undefined ? { reference_asset_ids: data.referenceAssetIds } : {}),
      ...(data.variants !== undefined ? { variants: data.variants } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.versionNo !== undefined ? { version_no: data.versionNo } : {}),
    }),
  });
  return { scene: normalizeScene(payload.scene) };
}

export function deleteScene(sceneId: number) {
  return request<{ ok: boolean }>(`/api/scenes/${sceneId}`, { method: "DELETE" });
}

function normalizeOverride(raw: Record<string, unknown>): EpisodeSceneOverride {
  return {
    id: asNumber(raw.id),
    episodeId: asNumber(raw.episode_id),
    scenePresetId: asNumber(raw.scene_preset_id),
    lightingStyle: asString(raw.lighting_style),
    timeOfDay: asString(raw.time_of_day),
    weather: asString(raw.weather),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
  };
}

export async function listSceneOverrides(scenePresetId: number) {
  const payload = await request<{ overrides: Record<string, unknown>[] }>(
    `/api/scene-presets/${scenePresetId}/overrides`
  );
  return { overrides: payload.overrides.map(normalizeOverride) };
}

export async function upsertSceneOverride(
  episodeId: number,
  scenePresetId: number,
  data: Partial<EpisodeSceneOverride>
) {
  const payload = await request<{ override: Record<string, unknown> }>(
    `/api/episodes/${episodeId}/scene-presets/${scenePresetId}/overrides`,
    {
      method: "POST",
      body: JSON.stringify({
        lighting_style: data.lightingStyle ?? "",
        time_of_day: data.timeOfDay ?? "",
        weather: data.weather ?? "",
      }),
    }
  );
  return { override: normalizeOverride(payload.override) };
}

export async function updateSceneOverride(
  overrideId: number,
  data: Partial<EpisodeSceneOverride>
) {
  const payload = await request<{ override: Record<string, unknown> }>(
    `/api/episode-scene-overrides/${overrideId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        lighting_style: data.lightingStyle ?? "",
        time_of_day: data.timeOfDay ?? "",
        weather: data.weather ?? "",
      }),
    }
  );
  return { override: normalizeOverride(payload.override) };
}

export async function listEpisodes(projectId: number) {
  const payload = await request<{ episodes: Record<string, unknown>[] }>(`/api/projects/${projectId}/episodes`);
  return { episodes: payload.episodes.map(normalizeEpisode) };
}

export async function createEpisode(projectId: number, data: Partial<Episode> & { title?: string }) {
  const payload = await request<{ episode: Record<string, unknown> }>(`/api/projects/${projectId}/episodes`, {
    method: "POST",
    body: JSON.stringify({
      episode_no: data.episodeNo,
      title: data.title,
      summary: data.summary,
      goal: data.goal,
      core_conflict: data.coreConflict,
      opening_hook: data.openingHook,
      climax: data.climax,
      ending_hook: data.endingHook,
      status: data.status,
      sort_order: data.sortOrder,
    }),
  });
  return { episode: normalizeEpisode(payload.episode) };
}

export async function updateEpisode(episodeId: number, data: Partial<Episode>) {
  const payload = await request<{ episode: Record<string, unknown> }>(`/api/episodes/${episodeId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...(data.episodeNo !== undefined ? { episode_no: data.episodeNo } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.summary !== undefined ? { summary: data.summary } : {}),
      ...(data.goal !== undefined ? { goal: data.goal } : {}),
      ...(data.coreConflict !== undefined ? { core_conflict: data.coreConflict } : {}),
      ...(data.openingHook !== undefined ? { opening_hook: data.openingHook } : {}),
      ...(data.climax !== undefined ? { climax: data.climax } : {}),
      ...(data.endingHook !== undefined ? { ending_hook: data.endingHook } : {}),
      ...(data.screenplayContent !== undefined ? { screenplay_content: data.screenplayContent } : {}),
      ...(data.screenplayContentEn !== undefined ? { screenplay_content_en: data.screenplayContentEn } : {}),
      ...(data.screenplayScenes !== undefined ? { screenplay_scenes: data.screenplayScenes } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
    }),
  });
  return { episode: normalizeEpisode(payload.episode) };
}

export function deleteEpisode(episodeId: number) {
  return request<{ ok: boolean }>(`/api/episodes/${episodeId}`, { method: "DELETE" });
}

export async function listShots(episodeId: number) {
  const payload = await request<{ shots: Record<string, unknown>[] }>(`/api/episodes/${episodeId}/shots`);
  return { shots: payload.shots.map(normalizeShot) };
}

export async function createShot(episodeId: number, data: Partial<Shot>) {
  const payload = await request<{ shot: Record<string, unknown> }>(`/api/episodes/${episodeId}/shots`, {
    method: "POST",
    body: JSON.stringify({
      scene_block: data.sceneBlock ?? "",
      shot_no: data.shotNo ?? 1,
      visual_goal: data.visualGoal ?? "",
      character_ids: data.characterIds ?? [],
      scene_preset_id: data.scenePresetId,
      shot_size: data.shotSize ?? "",
      camera_angle: data.cameraAngle ?? "",
      composition: data.composition ?? "",
      action_description: data.actionDescription ?? "",
      facial_emotion: data.facialEmotion ?? "",
      camera_motion: data.cameraMotion ?? "",
      dialogue_excerpt: data.dialogueExcerpt ?? "",
      estimated_duration_ms: data.estimatedDurationMs ?? 0,
      status: data.status ?? "draft",
      sort_order: data.sortOrder ?? data.shotNo ?? 1,
    }),
  });
  return { shot: normalizeShot(payload.shot) };
}

export async function getShot(shotId: number) {
  const payload = await request<{ shot: Record<string, unknown> }>(`/api/shots/${shotId}`);
  return { shot: normalizeShot(payload.shot) };
}

export async function updateShot(shotId: number, data: Partial<Shot>) {
  const payload = await request<{ shot: Record<string, unknown> }>(`/api/shots/${shotId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...(data.sceneBlock !== undefined ? { scene_block: data.sceneBlock } : {}),
      ...(data.shotNo !== undefined ? { shot_no: data.shotNo } : {}),
      ...(data.visualGoal !== undefined ? { visual_goal: data.visualGoal } : {}),
      ...(data.characterIds !== undefined ? { character_ids: data.characterIds } : {}),
      ...(data.scenePresetId !== undefined ? { scene_preset_id: data.scenePresetId } : {}),
      ...(data.shotSize !== undefined ? { shot_size: data.shotSize } : {}),
      ...(data.cameraAngle !== undefined ? { camera_angle: data.cameraAngle } : {}),
      ...(data.composition !== undefined ? { composition: data.composition } : {}),
      ...(data.actionDescription !== undefined ? { action_description: data.actionDescription } : {}),
      ...(data.facialEmotion !== undefined ? { facial_emotion: data.facialEmotion } : {}),
      ...(data.cameraMotion !== undefined ? { camera_motion: data.cameraMotion } : {}),
      ...(data.dialogueExcerpt !== undefined ? { dialogue_excerpt: data.dialogueExcerpt } : {}),
      ...(data.estimatedDurationMs !== undefined ? { estimated_duration_ms: data.estimatedDurationMs } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.sortOrder !== undefined ? { sort_order: data.sortOrder } : {}),
    }),
  });
  return { shot: normalizeShot(payload.shot) };
}

export function deleteShot(shotId: number) {
  return request<{ ok: boolean }>(`/api/shots/${shotId}`, { method: "DELETE" });
}

export async function listShotPrompts(shotId: number) {
  const payload = await request<{ prompts: Record<string, unknown>[] }>(`/api/shots/${shotId}/prompts`);
  return { prompts: payload.prompts.map(normalizePrompt) };
}

export async function createShotPrompt(shotId: number, data: Partial<ShotPrompt> & { promptText: string }) {
  const payload = await request<{ prompt: Record<string, unknown> }>(`/api/shots/${shotId}/prompts`, {
    method: "POST",
    body: JSON.stringify({
      prompt_text: data.promptText,
      first_frame_prompt: data.firstFramePrompt ?? "",
      first_frame_negative_prompt: data.firstFrameNegativePrompt ?? "",
      video_prompt: data.videoPrompt ?? "",
      video_negative_prompt: data.videoNegativePrompt ?? "",
      negative_prompt: data.negativePrompt ?? "",
      model_params: data.modelParams ?? {},
      reference_asset_ids: data.referenceAssetIds ?? [],
      status: data.status ?? "draft",
      is_active: data.isActive ?? false,
    }),
  });
  return { prompt: normalizePrompt(payload.prompt) };
}

export async function updateShotPromptVersion(promptId: number, data: Partial<ShotPrompt>) {
  const payload = await request<{ prompt: Record<string, unknown> }>(`/api/prompts/${promptId}`, {
    method: "PUT",
    body: JSON.stringify({
      ...(data.promptText !== undefined ? { prompt_text: data.promptText } : {}),
      ...(data.firstFramePrompt !== undefined ? { first_frame_prompt: data.firstFramePrompt } : {}),
      ...(data.firstFrameNegativePrompt !== undefined ? { first_frame_negative_prompt: data.firstFrameNegativePrompt } : {}),
      ...(data.videoPrompt !== undefined ? { video_prompt: data.videoPrompt } : {}),
      ...(data.videoNegativePrompt !== undefined ? { video_negative_prompt: data.videoNegativePrompt } : {}),
      ...(data.negativePrompt !== undefined ? { negative_prompt: data.negativePrompt } : {}),
      ...(data.modelParams !== undefined ? { model_params: data.modelParams } : {}),
      ...(data.referenceAssetIds !== undefined ? { reference_asset_ids: data.referenceAssetIds } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
    }),
  });
  return { prompt: normalizePrompt(payload.prompt) };
}

export async function activateShotPrompt(promptId: number) {
  const payload = await request<{ prompt: Record<string, unknown> }>(`/api/prompts/${promptId}/activate`, {
    method: "POST",
  });
  return { prompt: normalizePrompt(payload.prompt) };
}

export interface ImageReference {
  label: string;
  type: "character" | "scene";
  name: string;
  path: string;
}

export async function generateShotPromptFromShot(shotId: number, opts?: { withFirstFrame?: boolean; rhythmLevel?: string; withStoryboard?: boolean }) {
  const payload = await request<{ first_frame_prompt: string; first_frame_negative_prompt: string; video_prompt: string; video_negative_prompt: string; negative_prompt: string; duration_seconds: number; image_references: ImageReference[]; storyboard_url?: string }>(`/api/shots/${shotId}/generate-prompt`, {
    method: "POST",
    body: JSON.stringify({ with_first_frame: opts?.withFirstFrame ?? false, rhythm_level: opts?.rhythmLevel ?? "", with_storyboard: opts?.withStoryboard ?? false }),
  });
  return {
    firstFramePrompt: payload.first_frame_prompt,
    firstFrameNegativePrompt: payload.first_frame_negative_prompt,
    videoPrompt: payload.video_prompt,
    videoNegativePrompt: payload.video_negative_prompt,
    negativePrompt: payload.negative_prompt,
    durationSeconds: payload.duration_seconds ?? 3,
    imageReferences: payload.image_references ?? [],
    storyboardUrl: payload.storyboard_url ?? "",
  };
}

export async function generateShotStoryboard(shotId: number) {
  const payload = await request<{ task: Record<string, unknown> }>(`/api/shots/${shotId}/generate-storyboard`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return { task: normalizeTask(payload.task) };
}

export async function generatePromptFrame(promptId: number, referenceImages: string[], aspectRatio?: string) {
  const payload = await request<{ task: Record<string, unknown> }>(`/api/shot-prompts/${promptId}/generate-frame`, {
    method: "POST",
    body: JSON.stringify({ referenceImages, aspect_ratio: aspectRatio ?? "16:9" }),
  });
  return { task: normalizeTask(payload.task) };
}

export async function generatePromptVideo(promptId: number, opts?: { aspectRatio?: string; withFirstFrame?: boolean; duration?: number; resolution?: string }) {
  const payload = await request<{ task: Record<string, unknown> }>(`/api/shot-prompts/${promptId}/generate-video`, {
    method: "POST",
    body: JSON.stringify({ aspect_ratio: opts?.aspectRatio ?? "16:9", with_first_frame: opts?.withFirstFrame ?? false, duration: opts?.duration, resolution: opts?.resolution }),
  });
  return { task: normalizeTask(payload.task) };
}

export async function generateShot(shotId: number, data: { provider?: string; modelName?: string; shotPromptId?: number }) {
  const payload = await request<{ task: Record<string, unknown> }>(`/api/shots/${shotId}/generate`, {
    method: "POST",
    body: JSON.stringify({
      provider: data.provider,
      model_name: data.modelName,
      shot_prompt_id: data.shotPromptId,
    }),
  });
  return { task: normalizeTask(payload.task) };
}

export async function generateEpisodeBatch(episodeId: number, data: { provider?: string; modelName?: string } = {}) {
  const payload = await request<{ tasks: Record<string, unknown>[] }>(`/api/episodes/${episodeId}/generate-batch`, {
    method: "POST",
    body: JSON.stringify({
      provider: data.provider,
      model_name: data.modelName,
    }),
  });
  return { tasks: payload.tasks.map(normalizeTask) };
}

export async function generateScreenplay(
  episodeId: number,
  data: { context: Record<string, unknown>; messages: { role: string; content: string }[] },
) {
  const payload = await request<{ task: Record<string, unknown> }>(`/api/episodes/${episodeId}/generate-screenplay`, {
    method: "POST",
    body: JSON.stringify({ context: data.context, messages: data.messages }),
  });
  return { task: normalizeTask(payload.task) };
}

export async function generateScenes(
  episodeId: number,
  data: { context: Record<string, unknown>; messages: { role: string; content: string }[] },
) {
  const payload = await request<{ task: Record<string, unknown> }>(`/api/episodes/${episodeId}/generate-scenes`, {
    method: "POST",
    body: JSON.stringify({ context: data.context, messages: data.messages }),
  });
  return { task: normalizeTask(payload.task) };
}

export async function generateShots(
  episodeId: number,
  data: { context: Record<string, unknown>; messages: { role: string; content: string }[]; rhythmLevel?: string },
) {
  const payload = await request<{ task: Record<string, unknown> }>(`/api/episodes/${episodeId}/generate-shots`, {
    method: "POST",
    body: JSON.stringify({ context: data.context, messages: data.messages, rhythm_level: data.rhythmLevel ?? "" }),
  });
  return { task: normalizeTask(payload.task) };
}

export async function getTask(taskId: number) {
  const payload = await request<{ task: Record<string, unknown> }>(`/api/tasks/${taskId}`);
  return { task: normalizeTask(payload.task) };
}

export async function listShotBatches(episodeId: number) {
  const payload = await request<{ batches: Record<string, unknown>[] }>(
    `/api/episodes/${episodeId}/shot-batches`
  );
  return {
    batches: payload.batches.map(
      (b: Record<string, unknown>): ShotBatch => ({
        id: asNumber(b.id),
        episodeId: asNumber(b.episode_id),
        versionNo: asNumber(b.version_no, 1),
        taskId: b.task_id == null ? null : asNumber(b.task_id),
        shotCount: asNumber(b.shot_count, 0),
        createdAt: asString(b.created_at),
      })
    ),
  };
}

export async function listBatchShots(batchId: number) {
  const payload = await request<{ shots: Record<string, unknown>[] }>(
    `/api/shot-batches/${batchId}/shots`
  );
  return { shots: payload.shots.map(normalizeShot) };
}

export async function retryTask(taskId: number) {
  const payload = await request<{ task: Record<string, unknown> }>(`/api/tasks/${taskId}/retry`, {
    method: "POST",
  });
  return { task: normalizeTask(payload.task) };
}

export async function listReviewIssues(episodeId: number) {
  const payload = await request<{ review_issues: Record<string, unknown>[] }>(`/api/episodes/${episodeId}/review-issues`);
  return { reviewIssues: payload.review_issues.map(normalizeReviewIssue) };
}

export async function createReviewIssue(data: {
  projectId: number;
  episodeId?: number | null;
  shotId?: number | null;
  generationTaskId?: number | null;
  issueType: string;
  severity?: string;
  description?: string;
  reworkTargetType?: string;
  resolutionStatus?: string;
}) {
  const payload = await request<{ review_issue: Record<string, unknown> }>("/api/review-issues", {
    method: "POST",
    body: JSON.stringify({
      project_id: data.projectId,
      episode_id: data.episodeId,
      shot_id: data.shotId,
      generation_task_id: data.generationTaskId,
      issue_type: data.issueType,
      severity: data.severity ?? "medium",
      description: data.description ?? "",
      rework_target_type: data.reworkTargetType ?? "shot_prompt",
      resolution_status: data.resolutionStatus ?? "open",
    }),
  });
  return { reviewIssue: normalizeReviewIssue(payload.review_issue) };
}

export async function resolveReviewIssue(issueId: number, resolutionStatus = "resolved") {
  const payload = await request<{ review_issue: Record<string, unknown> }>(`/api/review-issues/${issueId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ resolution_status: resolutionStatus }),
  });
  return { reviewIssue: normalizeReviewIssue(payload.review_issue) };
}

export async function listEpisodeExports(episodeId: number) {
  const payload = await request<{ exports: Record<string, unknown>[] }>(`/api/episodes/${episodeId}/exports`);
  return { exports: payload.exports.map(normalizeEpisodeExport) };
}

export async function createEpisodeExport(episodeId: number, data: Partial<EpisodeExport> = {}) {
  const payload = await request<{ export: Record<string, unknown> }>(`/api/episodes/${episodeId}/exports`, {
    method: "POST",
    body: JSON.stringify({
      selected_task_ids: data.selectedTaskIds ?? [],
      timeline_data: data.timelineData ?? {},
      subtitle_data: data.subtitleData ?? {},
      audio_data: data.audioData ?? {},
      preview_url: data.previewUrl ?? "",
      export_url: data.exportUrl ?? "",
      status: data.status ?? "draft",
    }),
  });
  return { export: normalizeEpisodeExport(payload.export) };
}

export async function renderEpisodeExport(exportId: number, data: { previewUrl?: string; exportUrl?: string; status?: string }) {
  const payload = await request<{ export: Record<string, unknown> }>(`/api/exports/${exportId}/render`, {
    method: "POST",
    body: JSON.stringify({
      preview_url: data.previewUrl ?? "",
      export_url: data.exportUrl ?? "",
      status: data.status ?? "exported",
    }),
  });
  return { export: normalizeEpisodeExport(payload.export) };
}

export async function streamCopilot(
  requestPayload: CopilotStreamRequest,
  handlers: {
    onDelta?: (event: CopilotDeltaEvent) => void;
    onProposal?: (event: CopilotProposalEvent<CopilotProposal>) => void;
    onError?: (error: string) => void;
    onDone?: () => void;
  },
) {
  const response = await fetch(`${API_BASE}/api/copilot/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      module_type: requestPayload.moduleType,
      project_id: requestPayload.projectId,
      entity_id: requestPayload.entityId ?? null,
      intent: requestPayload.intent,
      messages: requestPayload.messages,
      context: requestPayload.context,
    }),
  });

  if (!response.ok) {
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json() : null;
    throw new Error((payload as { error?: string } | null)?.error || `Copilot request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response body");

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        const event = JSON.parse(raw) as {
          type?: string;
          content?: string;
          proposal?: Record<string, unknown>;
          error?: string;
        };
        if (event.type === "delta") {
          handlers.onDelta?.({ type: "delta", content: event.content ?? "" });
        } else if (event.type === "proposal" && event.proposal) {
          let normalizedProposal: CopilotProposal;
          if (requestPayload.moduleType === "scene") {
            normalizedProposal = normalizeSceneCollectionProposal(event.proposal);
          } else if (requestPayload.moduleType === "character") {
            normalizedProposal = Array.isArray((event.proposal as Record<string, unknown>).variants)
              ? normalizeCharacterVariantCollectionProposal(event.proposal)
              : normalizeCharacterCollectionProposal(event.proposal);
          } else if (requestPayload.moduleType === "episode") {
            normalizedProposal = normalizeEpisodeCollectionProposal(event.proposal);
          } else if (requestPayload.moduleType === "shot") {
            normalizedProposal = normalizeShotCollectionProposal(event.proposal);
          } else if (requestPayload.moduleType === "screenplay") {
            normalizedProposal = normalizeScreenplayProposal(event.proposal);
          } else {
            normalizedProposal = normalizeBriefProposal(event.proposal);
          }
          handlers.onProposal?.({ type: "proposal", proposal: normalizedProposal });
        } else if (event.type === "error") {
          handlers.onError?.(event.error ?? "Unknown copilot error");
        } else if (event.type === "done") {
          handlers.onDone?.();
          return;
        }
      } catch {
        // Ignore malformed SSE events.
      }
    }
  }
  // Process any remaining data in the buffer
  if (buffer.trim()) {
    const remaining = buffer.split("\n");
    for (const line of remaining) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        const event = JSON.parse(raw) as {
          type?: string;
          content?: string;
          proposal?: Record<string, unknown>;
          error?: string;
        };
        if (event.type === "delta") {
          handlers.onDelta?.({ type: "delta", content: event.content ?? "" });
        } else if (event.type === "proposal" && event.proposal) {
          let normalizedProposal: CopilotProposal;
          if (requestPayload.moduleType === "scene") {
            normalizedProposal = normalizeSceneCollectionProposal(event.proposal);
          } else if (requestPayload.moduleType === "character") {
            normalizedProposal = Array.isArray((event.proposal as Record<string, unknown>).variants)
              ? normalizeCharacterVariantCollectionProposal(event.proposal)
              : normalizeCharacterCollectionProposal(event.proposal);
          } else if (requestPayload.moduleType === "episode") {
            normalizedProposal = normalizeEpisodeCollectionProposal(event.proposal);
          } else if (requestPayload.moduleType === "shot") {
            normalizedProposal = normalizeShotCollectionProposal(event.proposal);
          } else if (requestPayload.moduleType === "screenplay") {
            normalizedProposal = normalizeScreenplayProposal(event.proposal);
          } else {
            normalizedProposal = normalizeBriefProposal(event.proposal);
          }
          handlers.onProposal?.({ type: "proposal", proposal: normalizedProposal });
        } else if (event.type === "error") {
          handlers.onError?.(event.error ?? "Unknown copilot error");
        }
      } catch {
        // Ignore malformed SSE events.
      }
    }
  }
  handlers.onDone?.();
}

// Legacy / tooling exports kept for non-project utility pages
export function listDeletedProjects(): Promise<{ projects: DeletedProject[] }> {
  return request("/api/projects/deleted");
}
export function restoreProject(projectId: number): Promise<{ project: DeletedProject }> {
  return request(`/api/projects/${projectId}/restore`, { method: "POST" });
}
export function permanentDeleteProject(projectId: number): Promise<{ ok: boolean }> {
  return request(`/api/projects/${projectId}/permanent`, { method: "DELETE" });
}
export function getConfig(): Promise<{ config: AppConfig }> {
  return request("/api/config");
}
export function updateConfig(data: unknown): Promise<{ config: AppConfig }> {
  return request("/api/config", { method: "PUT", body: JSON.stringify(data) });
}
export function getModels(): Promise<{ models: Record<string, ModelItem[]> }> {
  return request("/api/models");
}
export function addModel(category: string, id: string, label: string): Promise<{ models: ModelItem[] }> {
  return request(`/api/models/${category}`, { method: "PUT", body: JSON.stringify({ id, label: label || id }) });
}
export function deleteModel(category: string, id: string): Promise<{ models: ModelItem[] }> {
  return request(`/api/models/${category}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
export function getPrompts(): Promise<PromptsData> {
  return request("/api/prompts");
}
export function updatePrompts(data: unknown): Promise<PromptsData> {
  return request("/api/prompts", { method: "PUT", body: JSON.stringify(data) });
}
export async function streamChat(
  messages: ChatMessage[],
  onDelta?: (content: string) => void,
  onExtracted?: (projectParams: JsonObject) => void,
  onDone?: () => void,
  onError?: (error: unknown) => void,
  systemPromptKey = "",
) {
  try {
    const response = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, system_prompt_key: systemPromptKey }),
    });
    if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing response body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") {
          onDone?.();
          return;
        }
        try {
          const event = JSON.parse(data) as { type?: string; content?: string; project_params?: unknown };
          if (event.type === "delta") onDelta?.(event.content ?? "");
          if (event.type === "extracted") onExtracted?.(event.project_params as JsonObject);
        } catch {
          // Ignore malformed events.
        }
      }
    }
    onDone?.();
  } catch (error) {
    onError?.(error);
  }
}
export function generateQuickVideo(input: unknown): Promise<{ task_id: number }> {
  return request("/api/generate-video", { method: "POST", body: JSON.stringify(input) });
}
export function getQuickVideoStatus(taskId: number): Promise<{ status: string; video_url?: string; error_message?: string }> {
  return request(`/api/generate-video/status?task_id=${taskId}`);
}
export function listQuickVideoTasks(): Promise<{ tasks: VideoGenerationTask[] }> {
  return request("/api/generate-video/tasks");
}
export function generateImage(input: { prompt: string; aspect_ratio?: string; reference_image?: string; reference_images?: string[] }): Promise<{ image_url: string }> {
  return request("/api/generate-image", { method: "POST", body: JSON.stringify(input) });
}
export function getSeedanceConfig(): Promise<{ config: SeedanceConfig }> {
  return request("/api/seedance/config");
}
export function updateSeedanceConfig(data: unknown): Promise<{ config: SeedanceConfig }> {
  return request("/api/seedance/config", { method: "PUT", body: JSON.stringify(data) });
}
export function seedanceT2V(input: unknown): Promise<{ task_id: number }> {
  return request("/api/seedance/t2v", { method: "POST", body: JSON.stringify(input) });
}
export function seedanceI2V(input: unknown): Promise<{ task_id: number }> {
  return request("/api/seedance/i2v", { method: "POST", body: JSON.stringify(input) });
}
export function seedanceCharacter(input: unknown): Promise<{ task_id: number }> {
  return request("/api/seedance/character", { method: "POST", body: JSON.stringify(input) });
}
export function getSeedanceStatus(taskId: number): Promise<{ task_id: number; status: string; video_url: string | null; error_message: string | null }> {
  return request(`/api/seedance/status?task_id=${taskId}`);
}
export function listSeedanceTasks(): Promise<{ tasks: VideoGenerationTask[] }> {
  return request("/api/seedance/tasks");
}
export function getKlingConfig(): Promise<{ config: KlingConfig }> {
  return request("/api/kling/config");
}
export function updateKlingConfig(data: unknown): Promise<{ config: KlingConfig }> {
  return request("/api/kling/config", { method: "PUT", body: JSON.stringify(data) });
}
export function klingT2V(input: unknown): Promise<{ task_id: number }> {
  return request("/api/kling/t2v", { method: "POST", body: JSON.stringify(input) });
}
export function klingI2V(input: unknown): Promise<{ task_id: number }> {
  return request("/api/kling/i2v", { method: "POST", body: JSON.stringify(input) });
}
export function klingGenerateImage(input: unknown): Promise<{ task_id: number }> {
  return request("/api/kling/image", { method: "POST", body: JSON.stringify(input) });
}
export function klingOmniImage(input: unknown): Promise<{ task_id: number }> {
  return request("/api/kling/omni-image", { method: "POST", body: JSON.stringify(input) });
}
export function klingOmniVideo(input: unknown): Promise<{ task_id: number }> {
  return request("/api/kling/omni-video", { method: "POST", body: JSON.stringify(input) });
}
export function getKlingStatus(taskId: number): Promise<{ task_id: number; status: string; video_url: string | null; error_message: string | null }> {
  return request(`/api/kling/status?task_id=${taskId}`);
}
export function listKlingTasks(): Promise<{ tasks: VideoGenerationTask[] }> {
  return request("/api/kling/tasks");
}
