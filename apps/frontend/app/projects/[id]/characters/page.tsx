"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { API_BASE, createCharacter, deleteCharacter, generateCharacterImage, generateCharacterAnchor, optimizeCharacterPrompt, regenerateCharacter, streamCopilot, type CharacterAsset, type CharacterCollectionProposal, type CharacterProposal, type CharacterVariantCollectionProposal, type CharacterVariantProposal, type CopilotProposal, updateCharacter } from "@/src/api";
import ProjectCopilotButton from "@/src/components/copilot/ProjectCopilotButton";
import { useProjectCopilot, useProjectCopilotModule } from "@/src/components/copilot/ProjectCopilotContext";
import type { CopilotFieldDescriptor, CopilotModuleAdapter } from "@/src/components/copilot/types";
import { useProgressiveGeneration } from "@/src/hooks/useProgressiveGeneration";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, KeyValueGrid, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { ImageViewer } from "@/src/components/ui-legacy";
import { CharacterCard } from "@/src/components/project/CharacterCard";
import { CharacterEditDrawer, CharacterFormState, CharacterVariantDraft, VariantVisualDraft, DEFAULT_VARIANT_ID, getActiveVariant, getActiveVariantValue, updateActiveVariantValue, variantLabel, createVariantDraft, emptyForm, resolveAssetUrl } from "@/src/components/project/CharacterEditDrawer";

const CHARACTER_FIELD_LABELS: CopilotFieldDescriptor[] = [
  { key: "name", label: "角色名" },
  { key: "roleType", label: "角色类型" },
  { key: "species", label: "物种" },
  { key: "appearanceSummary", label: "外观描述" },
  { key: "personalityTags", label: "性格标签" },
  { key: "speechStyle", label: "说话风格" },
  { key: "negativeConstraints", label: "负面约束" },
];

function buildBaseImageSpec(form: CharacterFormState) {
  return {
    genderPresentation: form.genderPresentation,
    ageRange: form.ageRange,
    bodyType: form.bodyType,
    faceFeatures: form.faceFeatures,
    hairStyle: form.hairStyle,
    hairColor: form.hairColor,
    eyeStyle: form.eyeStyle,
    signatureExpression: form.signatureExpression,
    signaturePose: form.signaturePose,
    clothingStyle: form.clothingStyle,
    colorPalette: parseCsv(form.colorPalette),
    visualKeywords: parseCsv(form.visualKeywords),
    negativeVisualConstraints: parseCsv(form.negativeVisualConstraints),
    imagePrompt: form.imagePrompt,
    negativePrompt: form.negativePrompt,
  };
}

function buildVariantOverridePayload(variant: CharacterVariantDraft) {
  return {
    genderPresentation: variant.override.genderPresentation,
    ageRange: variant.override.ageRange,
    bodyType: variant.override.bodyType,
    faceFeatures: variant.override.faceFeatures,
    hairStyle: variant.override.hairStyle,
    hairColor: variant.override.hairColor,
    eyeStyle: variant.override.eyeStyle,
    signatureExpression: variant.override.signatureExpression,
    signaturePose: variant.override.signaturePose,
    clothingStyle: variant.override.clothingStyle,
    colorPalette: parseCsv(variant.override.colorPalette),
    visualKeywords: parseCsv(variant.override.visualKeywords),
    negativeVisualConstraints: parseCsv(variant.override.negativeVisualConstraints),
    imagePrompt: variant.override.imagePrompt,
    negativePrompt: variant.override.negativePrompt,
  };
}

function mergeVariantImageSpec(form: CharacterFormState, variantId: string) {
  const base = buildBaseImageSpec(form);
  if (variantId === DEFAULT_VARIANT_ID) return base;
  const variant = form.variants.find((item) => item.id === variantId);
  if (!variant) return base;
  const override = buildVariantOverridePayload(variant);
  return {
    genderPresentation: override.genderPresentation || base.genderPresentation,
    ageRange: override.ageRange || base.ageRange,
    bodyType: override.bodyType || base.bodyType,
    faceFeatures: override.faceFeatures || base.faceFeatures,
    hairStyle: override.hairStyle || base.hairStyle,
    hairColor: override.hairColor || base.hairColor,
    eyeStyle: override.eyeStyle || base.eyeStyle,
    signatureExpression: override.signatureExpression || base.signatureExpression,
    signaturePose: override.signaturePose || base.signaturePose,
    clothingStyle: override.clothingStyle || base.clothingStyle,
    colorPalette: override.colorPalette.length ? override.colorPalette : base.colorPalette,
    visualKeywords: override.visualKeywords.length ? override.visualKeywords : base.visualKeywords,
    negativeVisualConstraints: override.negativeVisualConstraints.length
      ? override.negativeVisualConstraints
      : base.negativeVisualConstraints,
    imagePrompt: override.imagePrompt || base.imagePrompt,
    negativePrompt: override.negativePrompt || base.negativePrompt,
  };
}

function parseVariantVisual(raw: Record<string, unknown>): VariantVisualDraft {
  return {
    genderPresentation: typeof raw.genderPresentation === "string" ? raw.genderPresentation : "",
    ageRange: typeof raw.ageRange === "string" ? raw.ageRange : "",
    bodyType: typeof raw.bodyType === "string" ? raw.bodyType : "",
    faceFeatures: typeof raw.faceFeatures === "string" ? raw.faceFeatures : "",
    hairStyle: typeof raw.hairStyle === "string" ? raw.hairStyle : "",
    hairColor: typeof raw.hairColor === "string" ? raw.hairColor : "",
    eyeStyle: typeof raw.eyeStyle === "string" ? raw.eyeStyle : "",
    signatureExpression: typeof raw.signatureExpression === "string" ? raw.signatureExpression : "",
    signaturePose: typeof raw.signaturePose === "string" ? raw.signaturePose : "",
    clothingStyle: typeof raw.clothingStyle === "string" ? raw.clothingStyle : "",
    colorPalette: Array.isArray(raw.colorPalette) ? raw.colorPalette.join(", ") : "",
    visualKeywords: Array.isArray(raw.visualKeywords) ? raw.visualKeywords.join(", ") : "",
    negativeVisualConstraints: Array.isArray(raw.negativeVisualConstraints) ? raw.negativeVisualConstraints.join(", ") : "",
    imagePrompt: typeof raw.imagePrompt === "string" ? raw.imagePrompt : "",
    negativePrompt: typeof raw.negativePrompt === "string" ? raw.negativePrompt : "",
  };
}

function getCharacterVariantSummary(character: CharacterAsset) {
  const visualProfile = character.visualProfile ?? {};
  const activeVariantId = typeof visualProfile.activeVariantId === "string" ? visualProfile.activeVariantId : DEFAULT_VARIANT_ID;
  const rawVariants = Array.isArray(visualProfile.variants) ? visualProfile.variants : [];
  const variants = rawVariants.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  const activeVariant = activeVariantId === DEFAULT_VARIANT_ID
    ? null
    : variants.find((item) => {
      const variantId = typeof item.id === "string" ? item.id : (typeof item.variantId === "string" ? item.variantId : "");
      return variantId === activeVariantId;
    }) ?? null;
  const activeVariantLabel = activeVariant
    ? (typeof activeVariant.variantName === "string" && activeVariant.variantName)
    || (typeof activeVariant.variantType === "string" && activeVariant.variantType)
    || "未命名变体"
    : "默认形态";
  const activeImagePath = activeVariant
    ? (typeof activeVariant.imagePath === "string" ? activeVariant.imagePath : (typeof activeVariant.image_path === "string" ? activeVariant.image_path : ""))
    : (typeof visualProfile.defaultImagePath === "string" ? visualProfile.defaultImagePath : character.imagePath);
  const imageReadyCount = variants.filter((item) => {
    const imagePath = typeof item.imagePath === "string" ? item.imagePath : (typeof item.image_path === "string" ? item.image_path : "");
    return Boolean(imagePath);
  }).length + ((typeof visualProfile.defaultImagePath === "string" ? visualProfile.defaultImagePath : character.imagePath) ? 1 : 0);
  return {
    variantCount: variants.length,
    activeVariantLabel,
    activeImagePath,
    imageReadyCount,
  };
}

function proposalToForm(role: CharacterProposal, base?: CharacterFormState | null): CharacterFormState {
  const profile = role.characterProfile;
  const imageSpec = role.imageSpec;
  return {
    id: base?.id,
    name: profile.name,
    roleType: profile.roleType,
    species: profile.species,
    identitySummary: profile.identitySummary,
    appearanceSummary: profile.appearanceSummary,
    personalityTags: profile.personalityTags.join(", "),
    speechStyle: profile.speechStyle,
    negativeConstraints: profile.negativeConstraints,
    genderPresentation: imageSpec.genderPresentation,
    ageRange: imageSpec.ageRange,
    bodyType: imageSpec.bodyType,
    faceFeatures: imageSpec.faceFeatures,
    hairStyle: imageSpec.hairStyle,
    hairColor: imageSpec.hairColor,
    eyeStyle: imageSpec.eyeStyle,
    signatureExpression: imageSpec.signatureExpression,
    signaturePose: imageSpec.signaturePose,
    clothingStyle: imageSpec.clothingStyle,
    colorPalette: imageSpec.colorPalette.join(", "),
    visualKeywords: imageSpec.visualKeywords.join(", "),
    negativeVisualConstraints: imageSpec.negativeVisualConstraints.join(", "),
    imagePrompt: imageSpec.imagePrompt,
    negativePrompt: imageSpec.negativePrompt,
    imagePath: base?.imagePath ?? "",
    variants: base?.variants ?? [],
    activeVariantId: base?.activeVariantId ?? DEFAULT_VARIANT_ID,
    status: base?.status ?? "draft",
  };
}

function applyVisualSpecToForm(base: CharacterFormState, role: CharacterProposal): CharacterFormState {
  const imageSpec = role.imageSpec;
  if (base.activeVariantId === DEFAULT_VARIANT_ID) {
    return {
      ...base,
      genderPresentation: imageSpec.genderPresentation,
      ageRange: imageSpec.ageRange,
      bodyType: imageSpec.bodyType,
      faceFeatures: imageSpec.faceFeatures,
      hairStyle: imageSpec.hairStyle,
      hairColor: imageSpec.hairColor,
      eyeStyle: imageSpec.eyeStyle,
      signatureExpression: imageSpec.signatureExpression,
      signaturePose: imageSpec.signaturePose,
      clothingStyle: imageSpec.clothingStyle,
      colorPalette: imageSpec.colorPalette.join(", "),
      visualKeywords: imageSpec.visualKeywords.join(", "),
      negativeVisualConstraints: imageSpec.negativeVisualConstraints.join(", "),
      imagePrompt: imageSpec.imagePrompt,
      negativePrompt: imageSpec.negativePrompt,
    };
  }
  return {
    ...base,
    variants: base.variants.map((variant) => (
      variant.id === base.activeVariantId
        ? {
          ...variant,
          override: {
            genderPresentation: imageSpec.genderPresentation,
            ageRange: imageSpec.ageRange,
            bodyType: imageSpec.bodyType,
            faceFeatures: imageSpec.faceFeatures,
            hairStyle: imageSpec.hairStyle,
            hairColor: imageSpec.hairColor,
            eyeStyle: imageSpec.eyeStyle,
            signatureExpression: imageSpec.signatureExpression,
            signaturePose: imageSpec.signaturePose,
            clothingStyle: imageSpec.clothingStyle,
            colorPalette: imageSpec.colorPalette.join(", "),
            visualKeywords: imageSpec.visualKeywords.join(", "),
            negativeVisualConstraints: imageSpec.negativeVisualConstraints.join(", "),
            imagePrompt: imageSpec.imagePrompt,
            negativePrompt: imageSpec.negativePrompt,
          },
        }
        : variant
    )),
  };
}

function toForm(character?: CharacterAsset): CharacterFormState {
  if (!character) return emptyForm;
  const visualProfile = character.visualProfile ?? {};
  const rawBaseImageSpec = typeof visualProfile.baseImageSpec === "object" && visualProfile.baseImageSpec !== null
    ? visualProfile.baseImageSpec as Record<string, unknown>
    : visualProfile;
  const rawVariants = Array.isArray(visualProfile.variants) ? visualProfile.variants : [];
  return {
    id: character.id,
    name: character.name,
    roleType: character.roleType,
    species: typeof rawBaseImageSpec.species === "string" ? rawBaseImageSpec.species : (typeof character.species === "string" ? character.species : ""),
    identitySummary: character.identitySummary,
    appearanceSummary: character.appearanceSummary,
    personalityTags: character.personalityTags.join(", "),
    speechStyle: character.speechStyle,
    negativeConstraints: character.negativeConstraints,
    genderPresentation: typeof rawBaseImageSpec.genderPresentation === "string" ? rawBaseImageSpec.genderPresentation : "",
    ageRange: typeof rawBaseImageSpec.ageRange === "string" ? rawBaseImageSpec.ageRange : "",
    bodyType: typeof rawBaseImageSpec.bodyType === "string" ? rawBaseImageSpec.bodyType : "",
    faceFeatures: typeof rawBaseImageSpec.faceFeatures === "string" ? rawBaseImageSpec.faceFeatures : "",
    hairStyle: typeof rawBaseImageSpec.hairStyle === "string" ? rawBaseImageSpec.hairStyle : "",
    hairColor: typeof rawBaseImageSpec.hairColor === "string" ? rawBaseImageSpec.hairColor : "",
    eyeStyle: typeof rawBaseImageSpec.eyeStyle === "string" ? rawBaseImageSpec.eyeStyle : "",
    signatureExpression: typeof rawBaseImageSpec.signatureExpression === "string" ? rawBaseImageSpec.signatureExpression : "",
    signaturePose: typeof rawBaseImageSpec.signaturePose === "string" ? rawBaseImageSpec.signaturePose : "",
    clothingStyle: typeof rawBaseImageSpec.clothingStyle === "string" ? rawBaseImageSpec.clothingStyle : "",
    colorPalette: Array.isArray(rawBaseImageSpec.colorPalette) ? rawBaseImageSpec.colorPalette.join(", ") : "",
    visualKeywords: Array.isArray(rawBaseImageSpec.visualKeywords) ? rawBaseImageSpec.visualKeywords.join(", ") : "",
    negativeVisualConstraints: Array.isArray(rawBaseImageSpec.negativeVisualConstraints)
      ? rawBaseImageSpec.negativeVisualConstraints.join(", ")
      : "",
    imagePrompt: typeof rawBaseImageSpec.imagePrompt === "string" ? rawBaseImageSpec.imagePrompt : character.imagePrompt,
    negativePrompt: typeof rawBaseImageSpec.negativePrompt === "string" ? rawBaseImageSpec.negativePrompt : character.negativePrompt,
    imagePath: typeof visualProfile.defaultImagePath === "string" ? visualProfile.defaultImagePath : character.imagePath,
    variants: rawVariants
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => createVariantDraft({
        id: typeof item.id === "string" ? item.id : (typeof item.variantId === "string" ? item.variantId : undefined),
        variantName: typeof item.variantName === "string" ? item.variantName : (typeof item.variant_name === "string" ? item.variant_name : ""),
        variantType: typeof item.variantType === "string" ? item.variantType : (typeof item.variant_type === "string" ? item.variant_type : ""),
        triggerReason: typeof item.triggerReason === "string" ? item.triggerReason : (typeof item.trigger_reason === "string" ? item.trigger_reason : ""),
        visualChangesSummary:
          typeof item.visualChangesSummary === "string" ? item.visualChangesSummary : (typeof item.visual_changes_summary === "string" ? item.visual_changes_summary : ""),
        inheritRules: typeof item.inheritRules === "object" && item.inheritRules !== null
          ? {
            keepFaceIdentity: Boolean((item.inheritRules as Record<string, unknown>).keepFaceIdentity ?? (item.inheritRules as Record<string, unknown>).keep_face_identity),
            keepAgeRange: Boolean((item.inheritRules as Record<string, unknown>).keepAgeRange ?? (item.inheritRules as Record<string, unknown>).keep_age_range),
            keepBodyType: Boolean((item.inheritRules as Record<string, unknown>).keepBodyType ?? (item.inheritRules as Record<string, unknown>).keep_body_type),
            keepCoreTemperament: Boolean((item.inheritRules as Record<string, unknown>).keepCoreTemperament ?? (item.inheritRules as Record<string, unknown>).keep_core_temperament),
          }
          : {
            keepFaceIdentity: true,
            keepAgeRange: true,
            keepBodyType: true,
            keepCoreTemperament: true,
          },
        override: parseVariantVisual(
          typeof item.imageSpecOverride === "object" && item.imageSpecOverride !== null
            ? item.imageSpecOverride as Record<string, unknown>
            : (typeof item.image_spec_override === "object" && item.image_spec_override !== null
              ? item.image_spec_override as Record<string, unknown>
              : {})
        ),
        imagePath: typeof item.imagePath === "string" ? item.imagePath : (typeof item.image_path === "string" ? item.image_path : ""),
      })),
    activeVariantId: typeof visualProfile.activeVariantId === "string" ? visualProfile.activeVariantId : DEFAULT_VARIANT_ID,
    status: character.status,
  };
}

function parseCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function buildVisualProfile(form: CharacterFormState) {
  const baseImageSpec = buildBaseImageSpec(form);
  const activeImageSpec = mergeVariantImageSpec(form, form.activeVariantId);
  return {
    ...activeImageSpec,
    baseImageSpec,
    defaultImagePath: form.imagePath,
    activeVariantId: form.activeVariantId,
    variants: form.variants.map((variant) => ({
      id: variant.id,
      variantName: variant.variantName,
      variantType: variant.variantType,
      triggerReason: variant.triggerReason,
      visualChangesSummary: variant.visualChangesSummary,
      inheritRules: variant.inheritRules,
      imageSpecOverride: buildVariantOverridePayload(variant),
      imagePath: variant.imagePath,
    })),
  };
}

function updateVariantMeta(form: CharacterFormState, patch: Partial<CharacterVariantDraft>) {
  return {
    ...form,
    variants: form.variants.map((variant) => (
      variant.id === form.activeVariantId ? { ...variant, ...patch } : variant
    )),
  };
}

function isVariantProposal(proposal: CopilotProposal): proposal is CharacterVariantCollectionProposal {
  return (proposal as CharacterVariantCollectionProposal).mode === "character_variant";
}

function applyVariantProposalToForm(base: CharacterFormState, variantProposal: CharacterVariantProposal): CharacterFormState {
  if (base.activeVariantId === DEFAULT_VARIANT_ID) return base;
  return {
    ...base,
    variants: base.variants.map((variant) => (
      variant.id === base.activeVariantId
        ? {
          ...variant,
          variantName: variantProposal.variantName || variant.variantName,
          variantType: variantProposal.variantType || variant.variantType,
          triggerReason: variantProposal.triggerReason || variant.triggerReason,
          visualChangesSummary: variantProposal.visualChangesSummary || variant.visualChangesSummary,
          inheritRules: {
            keepFaceIdentity: variantProposal.inheritRules.keepFaceIdentity,
            keepAgeRange: variantProposal.inheritRules.keepAgeRange,
            keepBodyType: variantProposal.inheritRules.keepBodyType,
            keepCoreTemperament: variantProposal.inheritRules.keepCoreTemperament,
          },
          override: {
            ...variant.override,
            ...(variantProposal.imageSpecOverride.genderPresentation !== undefined ? { genderPresentation: variantProposal.imageSpecOverride.genderPresentation } : {}),
            ...(variantProposal.imageSpecOverride.ageRange !== undefined ? { ageRange: variantProposal.imageSpecOverride.ageRange } : {}),
            ...(variantProposal.imageSpecOverride.bodyType !== undefined ? { bodyType: variantProposal.imageSpecOverride.bodyType } : {}),
            ...(variantProposal.imageSpecOverride.faceFeatures !== undefined ? { faceFeatures: variantProposal.imageSpecOverride.faceFeatures } : {}),
            ...(variantProposal.imageSpecOverride.hairStyle !== undefined ? { hairStyle: variantProposal.imageSpecOverride.hairStyle } : {}),
            ...(variantProposal.imageSpecOverride.hairColor !== undefined ? { hairColor: variantProposal.imageSpecOverride.hairColor } : {}),
            ...(variantProposal.imageSpecOverride.eyeStyle !== undefined ? { eyeStyle: variantProposal.imageSpecOverride.eyeStyle } : {}),
            ...(variantProposal.imageSpecOverride.signatureExpression !== undefined ? { signatureExpression: variantProposal.imageSpecOverride.signatureExpression } : {}),
            ...(variantProposal.imageSpecOverride.signaturePose !== undefined ? { signaturePose: variantProposal.imageSpecOverride.signaturePose } : {}),
            ...(variantProposal.imageSpecOverride.clothingStyle !== undefined ? { clothingStyle: variantProposal.imageSpecOverride.clothingStyle } : {}),
            ...(variantProposal.imageSpecOverride.colorPalette !== undefined ? { colorPalette: variantProposal.imageSpecOverride.colorPalette.join(", ") } : {}),
            ...(variantProposal.imageSpecOverride.visualKeywords !== undefined ? { visualKeywords: variantProposal.imageSpecOverride.visualKeywords.join(", ") } : {}),
            ...(variantProposal.imageSpecOverride.negativeVisualConstraints !== undefined ? { negativeVisualConstraints: variantProposal.imageSpecOverride.negativeVisualConstraints.join(", ") } : {}),
            ...(variantProposal.imageSpecOverride.imagePrompt !== undefined ? { imagePrompt: variantProposal.imageSpecOverride.imagePrompt } : {}),
            ...(variantProposal.imageSpecOverride.negativePrompt !== undefined ? { negativePrompt: variantProposal.imageSpecOverride.negativePrompt } : {}),
          },
        }
        : variant
    )),
  };
}

function applyMultiVariantProposalToForm(base: CharacterFormState, variants: CharacterVariantProposal[]): CharacterFormState {
  if (!variants.length) return base;
  const newVariantDrafts = variants.map((v) => createVariantDraft({
    variantName: v.variantName,
    variantType: v.variantType,
    triggerReason: v.triggerReason,
    visualChangesSummary: v.visualChangesSummary,
    inheritRules: {
      keepFaceIdentity: v.inheritRules.keepFaceIdentity,
      keepAgeRange: v.inheritRules.keepAgeRange,
      keepBodyType: v.inheritRules.keepBodyType,
      keepCoreTemperament: v.inheritRules.keepCoreTemperament,
    },
    override: parseVariantVisual(v.imageSpecOverride as unknown as Record<string, unknown>),
  }));
  return {
    ...base,
    variants: [...base.variants, ...newVariantDrafts],
    activeVariantId: newVariantDrafts[0].id,
  };
}

export default function CharactersPage() {
  const { project, refresh } = useProjectWorkspace();
  const { adapter } = useProjectCopilot();
  const [editing, setEditing] = useState<CharacterFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingImageSpec, setGeneratingImageSpec] = useState(false);
  const [creatingFromProposal, setCreatingFromProposal] = useState<string>("");
  const [regenerating, setRegenerating] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const currentProject = project;
  const isVisualStage = editing !== null;
  const activeVariant = editing ? getActiveVariant(editing) : null;

  // Progressive generation: context builder and confirm handler
  function buildProgressiveContext() {
    if (!currentProject) return {};
    return {
      current_mode: "collection",
      generation_stage: "profile_collection",
      project_summary: {
        name: currentProject.name,
        genre: currentProject.genre,
        target_platform: currentProject.targetPlatform,
        episode_count_planned: currentProject.episodeCountPlanned,
      },
      brief_summary: {
        logline: currentProject.brief.logline,
        target_audience: currentProject.brief.targetAudience,
        genre_tags: currentProject.brief.genreTags,
        style_keywords: currentProject.brief.styleKeywords,
        world_rules: currentProject.brief.worldRules,
        main_conflict: currentProject.brief.mainConflict,
        relationship_summary: currentProject.brief.relationshipSummary,
        reversal_rules: currentProject.brief.reversalRules,
        forbidden_rules: currentProject.brief.forbiddenRules,
      },
      current_character: null,
      existing_characters: currentProject.characters.map((character) => ({
        character_profile: {
          name: character.name,
          role_type: character.roleType,
          species: character.species,
          identity_summary: character.identitySummary,
          appearance_summary: character.appearanceSummary,
          personality_tags: character.personalityTags,
          speech_style: character.speechStyle,
        },
        image_spec: {
          ...(character.visualProfile ?? {}),
          image_prompt: character.imagePrompt,
          negative_prompt: character.negativePrompt,
        },
      })),
      locked_rules: {
        project_id: currentProject.id,
        must_follow_brief: true,
      },
    };
  }

  async function handleProgressiveConfirm(proposal: CopilotProposal) {
    const roles = (proposal as CharacterCollectionProposal).roles;
    const role = roles?.[0];
    if (!role || !currentProject) return;
    const form = proposalToForm(role, emptyForm);
    await persistCharacter(form);
    await refresh();
    toast.success(`角色「${role.characterProfile.name}」已加入角色库`);
  }

  const progressive = useProgressiveGeneration({
    projectId: currentProject?.id ?? 0,
    moduleType: "character",
    userMessage: "请为这个短剧项目生成下一个关键角色。严格遵循 brief 中的世界规则、主冲突和人物关系，分析已有角色的功能覆盖，填补空缺。",
    buildContext: buildProgressiveContext,
    onConfirm: handleProgressiveConfirm,
  });

  const characterAdapter = useMemo<CopilotModuleAdapter | null>(() => {
    if (!currentProject) return null;
    return ({
      moduleType: "character",
      title: "角色",
      description: "先生成角色卡，再进入单角色视觉设定和角色图阶段。",
      entityId: editing?.id ?? null,
      composer: {
        inputLabel: editing ? (activeVariant ? "变体设计目标" : "视觉设定目标") : "角色设计目标",
        inputPlaceholder: editing
          ? (activeVariant
            ? "例如：把这个变体做成婚礼形态，只改礼服、妆发、表情和仪式场压迫感，不要改变这个人本身。"
            : "例如：为这个角色补一版稳定的视觉设定，突出年龄感、脸部特征和服装风格。")
          : "例如：根据当前 Brief 生成这部短剧最关键的 5 个角色，覆盖主角、反派、盟友和关键配角。",
        emptyConversationTitle: editing ? (activeVariant ? "还没有变体对话" : "还没有视觉设定对话") : "还没有角色设计对话",
        emptyConversationDescription: editing
          ? (activeVariant ? "先选中一个变体，再让 Copilot 只补这个变体的 override。" : "先选中一个角色，再让 Copilot 补视觉设定和出图 prompt。")
          : "输入一句角色设计目标，Copilot 会返回一组可加入角色库的候选角色。",
        intentLabels: editing
          ? {
            generate: activeVariant ? "生成变体方案" : "生成视觉设定",
            rewrite: activeVariant ? "改写变体方案" : "改写视觉方案",
            expand: activeVariant ? "丰富变体细节" : "丰富视觉细节",
            compress: activeVariant ? "收敛变体方案" : "收敛视觉方案",
            fill_missing: activeVariant ? "补全变体字段" : "补全视觉字段",
            regenerate: "重新生成",
          }
          : {
            generate: "生成角色组",
            rewrite: "重构角色组",
            expand: "丰富角色组",
            compress: "收敛角色组",
            fill_missing: "补全角色组",
            regenerate: "重新生成",
          },
      },
      proposalStyle: "custom",
      buildContext: () => ({
        current_mode: editing ? "single_refine" : "collection",
        generation_stage: editing ? "visual_refine" : "profile_collection",
        project_summary: {
          name: currentProject.name,
          genre: currentProject.genre,
          target_platform: currentProject.targetPlatform,
          episode_count_planned: currentProject.episodeCountPlanned,
        },
        brief_summary: {
          logline: currentProject.brief.logline,
          target_audience: currentProject.brief.targetAudience,
          genre_tags: currentProject.brief.genreTags,
          style_keywords: currentProject.brief.styleKeywords,
          world_rules: currentProject.brief.worldRules,
          main_conflict: currentProject.brief.mainConflict,
          relationship_summary: currentProject.brief.relationshipSummary,
          reversal_rules: currentProject.brief.reversalRules,
          forbidden_rules: currentProject.brief.forbiddenRules,
        },
        current_character: editing ? {
          character_profile: {
            name: editing.name,
            role_type: editing.roleType,
            species: editing.species,
            identity_summary: editing.identitySummary,
            appearance_summary: editing.appearanceSummary,
            personality_tags: parseCsv(editing.personalityTags),
            speech_style: editing.speechStyle,
            negative_constraints: editing.negativeConstraints,
          },
          image_spec: mergeVariantImageSpec(editing, editing.activeVariantId),
          current_variant: editing.activeVariantId === DEFAULT_VARIANT_ID ? null : {
            variant_name: activeVariant?.variantName ?? "",
            variant_type: activeVariant?.variantType ?? "",
            trigger_reason: activeVariant?.triggerReason ?? "",
            visual_changes_summary: activeVariant?.visualChangesSummary ?? "",
          },
          status: editing.status,
        } : null,
        existing_characters: currentProject.characters.map((character) => ({
          character_profile: {
            name: character.name,
            role_type: character.roleType,
            species: character.species,
            identity_summary: character.identitySummary,
            appearance_summary: character.appearanceSummary,
            personality_tags: character.personalityTags,
            speech_style: character.speechStyle,
          },
          image_spec: {
            ...(character.visualProfile ?? {}),
            image_prompt: character.imagePrompt,
            negative_prompt: character.negativePrompt,
          },
        })),
        locked_rules: {
          project_id: currentProject.id,
          must_follow_brief: true,
        },
      }),
      renderContextSummary: () => (
        <KeyValueGrid
          items={[
            { label: "项目名", value: currentProject.name },
            { label: "题材", value: currentProject.genre || "未填写" },
            { label: "当前钩子", value: currentProject.brief.logline || "未填写" },
            { label: "已有角色数", value: String(currentProject.characters.length) },
            { label: "当前阶段", value: editing ? "阶段二：视觉设定" : "阶段一：角色卡组" },
            { label: "当前编辑角色", value: editing?.name || "尚未进入单角色阶段" },
            { label: "当前形态", value: editing ? (activeVariant ? variantLabel(activeVariant) : "默认形态") : "未进入形态编辑" },
            { label: "主冲突", value: currentProject.brief.mainConflict || "未填写" },
          ]}
        />
      ),
      getSupportedIntents: () => ["generate", "rewrite", "expand", "compress", "fill_missing", "regenerate"],
      getProposalFields: () => CHARACTER_FIELD_LABELS,
      renderProposal: ({ proposal, selectedFields, toggleField }) => {
        if (isVariantProposal(proposal)) {
          const variants = proposal.variants ?? [];
          return (
            <div className="space-y-4">
              <div className="rounded-[20px] border border-dashed border-line bg-panel2 px-4 py-3 text-sm text-gray-400">
                当前是变体模式。下面的建议只会作用于当前选中的形态 override，不改动基础角色身份。
              </div>
              <div className="grid gap-3">
                {variants.map((variant, index) => (
                  <div key={`${variant.variantName}-${index}`} className="rounded-lg border border-line bg-panel px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-100">{variant.variantName || `变体 ${index + 1}`}</h3>
                        <p className="mt-1 text-sm text-gray-500">{variant.variantType || "未定义变体类型"}</p>
                      </div>
                      <span className="rounded-full bg-purple-500/10 px-3 py-1 text-[11px] font-semibold text-mint">变体提案</span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-panel2 px-4 py-3">
                        <p className="text-xs font-medium text-gray-500">触发场景</p>
                        <p className="mt-2 text-sm text-gray-300">{variant.triggerReason || "未填写"}</p>
                      </div>
                      <div className="rounded-2xl bg-panel2 px-4 py-3">
                        <p className="text-xs font-medium text-gray-500">视觉变化摘要</p>
                        <p className="mt-2 text-sm text-gray-300">{variant.visualChangesSummary || "未填写"}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-panel2 px-3 py-1 text-xs text-gray-400">
                        保持脸型: {variant.inheritRules.keepFaceIdentity ? "是" : "否"}
                      </span>
                      <span className="rounded-full bg-panel2 px-3 py-1 text-xs text-gray-400">
                        保持年龄感: {variant.inheritRules.keepAgeRange ? "是" : "否"}
                      </span>
                      <span className="rounded-full bg-panel2 px-3 py-1 text-xs text-gray-400">
                        保持体态: {variant.inheritRules.keepBodyType ? "是" : "否"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-panel2 px-4 py-3">
                        <p className="text-xs font-medium text-gray-500">发型 / 表情 / 服装</p>
                        <p className="mt-2 text-sm text-gray-300">
                          {[
                            variant.imageSpecOverride.hairStyle,
                            variant.imageSpecOverride.signatureExpression,
                            variant.imageSpecOverride.clothingStyle,
                          ].filter(Boolean).join(" / ") || "未填写"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-panel2 px-4 py-3">
                        <p className="text-xs font-medium text-gray-500">视觉关键词</p>
                        <p className="mt-2 text-sm text-gray-300">
                          {variant.imageSpecOverride.visualKeywords?.join(", ") || "未填写"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditing((prev) => prev ? applyVariantProposalToForm(prev, variant) : prev)}
                      >
                        回填当前变体
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        const characterProposal = proposal as CharacterCollectionProposal;
        const roles = characterProposal.roles ?? [];
        return (
          <div className="space-y-4">
            <div className="rounded-[20px] border border-dashed border-line bg-panel2 px-4 py-3 text-sm text-gray-400">
              {editing
                ? (activeVariant
                  ? "当前是阶段二：变体模式。下面的建议只负责当前变体的 override，不会重写整套角色基础视觉。"
                  : "当前是阶段二：视觉设定模式。下面的建议只负责补齐单个角色的视觉设定和出图 prompt。")
                : `当前生成了 ${roles.length} 个候选角色。先确定角色卡，再逐个进入视觉设定阶段。`}
            </div>
            <div className="grid gap-3">
              {roles.map((role, index) => (
                <div key={`${role.characterProfile.name}-${index}`} className="rounded-lg border border-line bg-panel px-5 py-4">
                  {(() => {
                    const profile = role.characterProfile;
                    const imageSpec = role.imageSpec;
                    return (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-gray-100">{profile.name || `候选角色 ${index + 1}`}</h3>
                            <p className="mt-1 text-sm text-gray-500">{profile.roleType || "未定义角色定位"}</p>
                          </div>
                          <span className="rounded-full bg-purple-500/10 px-3 py-1 text-[11px] font-semibold text-mint">
                            {editing ? (activeVariant ? "变体方案" : "单角色方案") : `候选 ${index + 1}`}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl bg-panel2 px-4 py-3">
                            <p className="text-xs font-medium text-gray-500">角色定位</p>
                            <p className="mt-2 text-sm text-gray-300">{profile.identitySummary || "未提供角色定位"}</p>
                          </div>
                          <div className="rounded-2xl bg-panel2 px-4 py-3">
                            <p className="text-xs font-medium text-gray-500">外观摘要</p>
                            <p className="mt-2 text-sm text-gray-300">{profile.appearanceSummary || "未提供外观描述"}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {profile.personalityTags.map((tag) => (
                            <span key={tag} className="rounded-full bg-panel2 px-3 py-1 text-xs text-gray-400">{tag}</span>
                          ))}
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl bg-panel2 px-4 py-3">
                            <p className="text-xs font-medium text-gray-500">说话风格</p>
                            <p className="mt-2 text-sm text-gray-300">{profile.speechStyle || "未填写"}</p>
                          </div>
                          <div className="rounded-2xl bg-panel2 px-4 py-3">
                            <p className="text-xs font-medium text-gray-500">负面约束</p>
                            <p className="mt-2 text-sm text-gray-300">{profile.negativeConstraints || "未填写"}</p>
                          </div>
                        </div>
                        {editing && !activeVariant ? (
                          <div className="mt-4 rounded-2xl border border-dashed border-line bg-panel/70 px-4 py-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">视觉设定</p>
                              <span className="rounded-full bg-panel2 px-3 py-1 text-[11px] text-gray-400">
                                {imageSpec.genderPresentation || "未设定"} / {imageSpec.ageRange || "年龄未设定"}
                              </span>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-medium text-gray-500">脸部与发型</p>
                                <p className="mt-2 text-sm text-gray-300">
                                  {[imageSpec.faceFeatures, imageSpec.hairStyle, imageSpec.hairColor].filter(Boolean).join(" / ") || "未填写"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-500">姿态与服装</p>
                                <p className="mt-2 text-sm text-gray-300">
                                  {[imageSpec.signatureExpression, imageSpec.signaturePose, imageSpec.clothingStyle].filter(Boolean).join(" / ") || "未填写"}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {imageSpec.visualKeywords.map((tag) => (
                                <span key={tag} className="rounded-full bg-panel2 px-3 py-1 text-xs text-gray-400">{tag}</span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-5 flex flex-wrap gap-2">
                          {editing ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setEditing((prev) => {
                                if (!prev) return proposalToForm(role);
                                if (activeVariant) return prev;
                                return applyVisualSpecToForm(prev, role);
                              })}
                            >
                              {activeVariant ? "当前为变体模式" : "回填视觉设定"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setEditing(proposalToForm(role, emptyForm))}
                            >
                              载入编辑器并进入视觉设定
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={async () => {
                              const token = `${profile.name}-${index}`;
                              try {
                                setCreatingFromProposal(token);
                                await createCharacter(currentProject.id, {
                                  name: profile.name,
                                  roleType: profile.roleType,
                                  identitySummary: profile.identitySummary,
                                  appearanceSummary: profile.appearanceSummary,
                                  personalityTags: profile.personalityTags,
                                  speechStyle: profile.speechStyle,
                                  negativeConstraints: profile.negativeConstraints,
                                  status: "draft",
                                });
                                await refresh();
                                toast.success(`角色「${profile.name || `候选 ${index + 1}`}」已加入角色库`);
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : String(err));
                              } finally {
                                setCreatingFromProposal("");
                              }
                            }}
                            disabled={creatingFromProposal === `${profile.name}-${index}`}
                          >
                            {creatingFromProposal === `${profile.name}-${index}` ? "加入中..." : "加入角色库"}
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        );
      },
      applyProposal: (proposal: CopilotProposal, options: { mode: "all" | "fields"; fields: string[] }) => {
        if (isVariantProposal(proposal)) {
          const allVariants = proposal.variants ?? [];
          if (!allVariants.length) return;
          if (allVariants.length === 1) {
            setEditing((prev) => prev ? applyVariantProposalToForm(prev, allVariants[0]) : prev);
            toast.success("Copilot 建议已回填到当前变体");
          } else {
            setEditing((prev) => prev ? applyMultiVariantProposalToForm(prev, allVariants) : prev);
            toast.success(`Copilot 生成了 ${allVariants.length} 个新变体，已全部加入变体列表`);
          }
          return;
        }
        const characterProposal = (proposal as CharacterCollectionProposal).roles?.[0];
        if (!characterProposal) return;
        const allowed = options.mode === "all" ? CHARACTER_FIELD_LABELS.map((field) => field.key) : options.fields;
        setEditing((prev) => {
          const base = prev ?? { ...proposalToForm(characterProposal) };
          const next = { ...base };
          const profile = characterProposal.characterProfile;
          for (const key of allowed) {
            if (key === "name") next.name = profile.name;
            else if (key === "roleType") next.roleType = profile.roleType;
            else if (key === "species") next.species = profile.species;
            else if (key === "appearanceSummary") next.appearanceSummary = profile.appearanceSummary;
            else if (key === "personalityTags") next.personalityTags = profile.personalityTags.join(", ");
            else if (key === "speechStyle") next.speechStyle = profile.speechStyle;
            else if (key === "negativeConstraints") next.negativeConstraints = profile.negativeConstraints;
          }
          return next;
        });
        toast.success(options.mode === "all" ? "Copilot 建议已回填到角色表单" : "已按字段回填到角色表单");
      },
    });
  }, [currentProject, editing, activeVariant]);

  useProjectCopilotModule(characterAdapter);

  if (!currentProject) return null;
  const readyProject = currentProject;

  async function persistCharacter(form: CharacterFormState) {
    const resolvedImageSpec = mergeVariantImageSpec(form, form.activeVariantId);
    const selectedVariant = getActiveVariant(form);
    const payload = {
      name: form.name,
      roleType: form.roleType,
      species: form.species,
      identitySummary: form.identitySummary,
      appearanceSummary: form.appearanceSummary,
      personalityTags: parseCsv(form.personalityTags),
      speechStyle: form.speechStyle,
      negativeConstraints: form.negativeConstraints,
      visualProfile: buildVisualProfile(form),
      imagePrompt: resolvedImageSpec.imagePrompt,
      negativePrompt: resolvedImageSpec.negativePrompt,
      imagePath: selectedVariant?.imagePath ?? form.imagePath,
      status: form.status,
    };
    if (form.id) {
      const { character } = await updateCharacter(form.id, readyProject.id, payload);
      return character;
    }
    const { character } = await createCharacter(readyProject.id, payload);
    return character;
  }

  function buildCharacterCopilotContext(form: CharacterFormState) {
    return {
      current_mode: "single_refine",
      generation_stage: "visual_refine",
      project_summary: {
        name: readyProject.name,
        genre: readyProject.genre,
        target_platform: readyProject.targetPlatform,
        episode_count_planned: readyProject.episodeCountPlanned,
      },
      brief_summary: {
        logline: readyProject.brief.logline,
        target_audience: readyProject.brief.targetAudience,
        genre_tags: readyProject.brief.genreTags,
        style_keywords: readyProject.brief.styleKeywords,
        world_rules: readyProject.brief.worldRules,
        main_conflict: readyProject.brief.mainConflict,
        relationship_summary: readyProject.brief.relationshipSummary,
        reversal_rules: readyProject.brief.reversalRules,
        forbidden_rules: readyProject.brief.forbiddenRules,
      },
      current_character: {
        character_profile: {
          name: form.name,
          role_type: form.roleType,
          species: form.species,
          identity_summary: form.identitySummary,
          appearance_summary: form.appearanceSummary,
          personality_tags: parseCsv(form.personalityTags),
          speech_style: form.speechStyle,
          negative_constraints: form.negativeConstraints,
        },
        image_spec: mergeVariantImageSpec(form, form.activeVariantId),
        current_variant: form.activeVariantId === DEFAULT_VARIANT_ID ? null : {
          variant_name: getActiveVariant(form)?.variantName ?? "",
          variant_type: getActiveVariant(form)?.variantType ?? "",
          trigger_reason: getActiveVariant(form)?.triggerReason ?? "",
          visual_changes_summary: getActiveVariant(form)?.visualChangesSummary ?? "",
        },
        status: form.status,
      },
      existing_characters: readyProject.characters.map((character) => ({
        character_profile: {
          name: character.name,
          role_type: character.roleType,
          species: character.species,
          identity_summary: character.identitySummary,
          appearance_summary: character.appearanceSummary,
          personality_tags: character.personalityTags,
          speech_style: character.speechStyle,
        },
        image_spec: {
          ...(character.visualProfile ?? {}),
          image_prompt: character.imagePrompt,
          negative_prompt: character.negativePrompt,
        },
      })),
      locked_rules: {
        project_id: readyProject.id,
        must_follow_brief: true,
      },
    };
  }

  async function handleGenerateImageSpec() {
    if (!editing) return;
    setGeneratingImageSpec(true);
    try {
      let proposal: CopilotProposal | null = null;
      await streamCopilot(
        {
          moduleType: "character",
          projectId: readyProject.id,
          entityId: editing.id ?? null,
          intent: "fill_missing",
          messages: [
            {
              role: "user",
              content:
                "请基于当前角色设定补全 image_spec，并生成可直接用于角色出图的 image_prompt 与 negative_prompt。不要改动角色剧情定位，只生成视觉设定。",
            },
          ],
          context: buildCharacterCopilotContext(editing),
        },
        {
          onProposal: (event) => {
            proposal = event.proposal;
          },
          onError: (error) => {
            throw new Error(error);
          },
        },
      );
      if (!proposal) {
        throw new Error("没有生成可用的 image_spec");
      }
      if (isVariantProposal(proposal)) {
        const variantProposal = proposal as CharacterVariantCollectionProposal;
        const allVariants = variantProposal.variants ?? [];
        if (!allVariants.length) throw new Error("没有生成可用的变体 override");
        if (allVariants.length === 1) {
          setEditing((prev) => (prev ? applyVariantProposalToForm(prev, allVariants[0]) : prev));
          toast.success("已根据当前变体补全 override");
        } else {
          setEditing((prev) => (prev ? applyMultiVariantProposalToForm(prev, allVariants) : prev));
          toast.success(`已生成 ${allVariants.length} 个新变体`);
        }
      } else {
        const role = (proposal as CharacterCollectionProposal).roles?.[0] ?? null;
        if (!role) throw new Error("没有生成可用的 image_spec");
        setEditing((prev) => (prev ? applyVisualSpecToForm(prev, role as CharacterProposal) : prev));
        toast.success("已根据当前角色设定补全 image_spec");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingImageSpec(false);
    }
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await persistCharacter(editing);
      setEditing(null);
      await refresh();
      toast.success("角色已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateCharacterImage(target?: CharacterFormState | CharacterAsset | null) {
    const source = target ?? editing;
    if (!source) return;
    try {
      const isFormSource = typeof (source as CharacterFormState).personalityTags === "string";
      let characterId: number | undefined;
      if (isFormSource) {
        const saved = await persistCharacter(source as CharacterFormState);
        characterId = saved.id;
        setEditing(toForm(saved));
      } else if ("id" in source && source.id) {
        characterId = source.id;
      }
      if (!characterId) {
        const saved = await persistCharacter(source as CharacterFormState);
        characterId = saved.id;
        setEditing(toForm(saved));
      }
      await generateCharacterImage(characterId);
      await refresh();
      toast.success("角色主图生成任务已提交");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(character: CharacterAsset) {
    try {
      await deleteCharacter(character.id);
      await refresh();
      toast.success("角色已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOptimizePrompt(character: CharacterAsset) {
    try {
      await optimizeCharacterPrompt(character.id);
      toast.success("Prompt 优化任务已提交");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleGenerateAppearancePrompt(character: CharacterAsset) {
    try {
      await generateCharacterAnchor(character.id);
      toast.success("外观锚定词生成任务已提交");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRegenerate(character: CharacterAsset) {
    const input = window.prompt("请描述重新生成的要求：");
    if (!input?.trim()) return;
    try {
      await regenerateCharacter(character.id, input.trim());
      toast.success("重新生成任务已提交");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <ImageViewer src={previewImage} alt="角色图片预览" onClose={() => setPreviewImage(null)} />
      <SectionCard
        title="角色资产"
        description="角色卡是视觉生成和剧本一致性的关键事实源，先稳定角色，再扩剧情。"
        action={
          <div className="flex gap-2">
            <ProjectCopilotButton label={editing ? "补视觉设定" : "生成角色组"} />
            {!progressive.active ? (
              <Button variant="secondary" onClick={progressive.start}>渐进式生成</Button>
            ) : (
              <Button variant="destructive" onClick={progressive.stop}>停止生成</Button>
            )}
            <Button variant="secondary" onClick={() => setEditing(emptyForm)}>新增角色</Button>
            <Button onClick={() => setEditing(emptyForm)}>新增并用 Copilot 精修</Button>
          </div>
        }
      >
        {currentProject.characters.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {currentProject.characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onEdit={(c) => setEditing(toForm(c))}
                onRegenerate={handleRegenerate}
                onGenerateImage={handleGenerateCharacterImage}
                onOptimizePrompt={handleOptimizePrompt}
                onGenerateAppearanceAnchor={handleGenerateAppearancePrompt}
                onDelete={handleDelete}
                loadingStates={{
                  generatingImage: character.imageStatus === "generating",
                  optimizingPrompt: character.promptStatus === "running",
                  generatingAnchor: character.anchorStatus === "running",
                  regenerating: character.regenerateStatus === "running",
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="还没有角色资产" description="先创建主角、反派和关键配角，后续分集和场景才能稳定生成。" action={<Button onClick={() => setEditing(emptyForm)}>新增角色</Button>} />
        )}

        {progressive.active && (
          <div className="mt-4 rounded-lg border border-dashed border-mint/40 bg-mint/5 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-100">渐进式角色生成</h3>
                <p className="mt-1 text-xs text-gray-500">
                  已有 {readyProject.characters.length} 个角色。每次生成 1 个新角色，确认后加入角色库。
                </p>
              </div>
              {progressive.loading && (
                <span className="rounded-full bg-mint/10 px-3 py-1 text-[11px] font-semibold text-mint">
                  生成中...
                </span>
              )}
            </div>

            {progressive.streamText && !progressive.proposal && (
              <div className="mt-3 rounded-lg border border-line bg-panel2/50 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">Copilot</p>
                <div className="whitespace-pre-wrap text-[13px] leading-5 text-gray-300">{progressive.streamText}</div>
              </div>
            )}

            {progressive.proposal && (progressive.proposal as CharacterCollectionProposal).roles && (progressive.proposal as CharacterCollectionProposal).roles.length > 0 && (() => {
              const role = (progressive.proposal as CharacterCollectionProposal).roles[0];
              const profile = role.characterProfile;
              return (
                <div className="mt-3 rounded-lg border border-line bg-panel px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-100">{profile.name || "候选角色"}</h3>
                      <p className="mt-1 text-sm text-gray-500">{profile.roleType || "未定义角色定位"}</p>
                    </div>
                    <span className="rounded-full bg-mint/10 px-3 py-1 text-[11px] font-semibold text-mint">渐进式候选</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-panel2 px-4 py-3">
                      <p className="text-xs font-medium text-gray-500">角色定位</p>
                      <p className="mt-2 text-sm text-gray-300">{profile.identitySummary || "未提供"}</p>
                    </div>
                    <div className="rounded-2xl bg-panel2 px-4 py-3">
                      <p className="text-xs font-medium text-gray-500">外观摘要</p>
                      <p className="mt-2 text-sm text-gray-300">{profile.appearanceSummary || "未提供"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.personalityTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-panel2 px-3 py-1 text-xs text-gray-400">{tag}</span>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-panel2 px-4 py-3">
                      <p className="text-xs font-medium text-gray-500">说话风格</p>
                      <p className="mt-2 text-sm text-gray-300">{profile.speechStyle || "未填写"}</p>
                    </div>
                    <div className="rounded-2xl bg-panel2 px-4 py-3">
                      <p className="text-xs font-medium text-gray-500">负面约束</p>
                      <p className="mt-2 text-sm text-gray-300">{profile.negativeConstraints || "未填写"}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void progressive.confirmAndNext()}>
                      确认并生成下一个
                    </Button>
                    <Button size="sm" variant="secondary" onClick={progressive.skip}>
                      跳过，生成下一个
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void progressive.confirmAndStop()}>
                      完成
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditing(proposalToForm(role, emptyForm));
                    }}>
                      载入编辑器
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <CharacterEditDrawer
          open={editing !== null}
          onClose={() => setEditing(null)}
          form={editing ?? emptyForm}
          onChange={(f) => setEditing(f)}
          onSave={handleSave}
          onGenerateImage={async () => {
            if (!editing) return;
            const isFormSource = typeof editing.personalityTags === "string";
            let characterId = editing.id;
            if (isFormSource || !characterId) {
              const saved = await persistCharacter(editing);
              characterId = saved.id;
              setEditing(toForm(saved));
            }
            await generateCharacterImage(characterId);
            await refresh();
            toast.success("角色主图生成任务已提交");
          }}
          onGenerateImageSpec={handleGenerateImageSpec}
          onAddVariant={() => {
            if (!editing) return;
            const nextVariant = createVariantDraft();
            setEditing({
              ...editing,
              activeVariantId: nextVariant.id,
              variants: [...editing.variants, nextVariant],
            });
          }}
          onDeleteVariant={(variantId) => {
            if (!editing) return;
            setEditing({
              ...editing,
              activeVariantId: DEFAULT_VARIANT_ID,
              variants: editing.variants.filter((v) => v.id !== variantId),
            });
          }}
          onSelectVariant={(variantId) => {
            if (!editing) return;
            setEditing({ ...editing, activeVariantId: variantId });
          }}
          loadingStates={{
            saving,
            generatingImage: false,
            generatingImageSpec,
          }}
        />
      </SectionCard>
    </>
  );
}
