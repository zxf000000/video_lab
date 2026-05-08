"use client";

import { API_BASE, type CharacterAsset } from "@/src/api";
import { StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";

const DEFAULT_VARIANT_ID = "default";

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

export interface CharacterCardLoadingStates {
  generatingImage: boolean;
  optimizingPrompt: boolean;
  generatingAnchor: boolean;
  regenerating: boolean;
}

export interface CharacterCardProps {
  character: CharacterAsset;
  onEdit: (c: CharacterAsset) => void;
  onRegenerate: (c: CharacterAsset) => void;
  onGenerateImage: (c: CharacterAsset) => void;
  onOptimizePrompt: (c: CharacterAsset) => void;
  onGenerateAppearanceAnchor: (c: CharacterAsset) => void;
  onDelete: (c: CharacterAsset) => void;
  loadingStates: CharacterCardLoadingStates;
}

export function CharacterCard({
  character,
  onEdit,
  onRegenerate,
  onGenerateImage,
  onOptimizePrompt,
  onGenerateAppearanceAnchor,
  onDelete,
  loadingStates,
}: CharacterCardProps) {
  const variantSummary = getCharacterVariantSummary(character);
  const imageUrl = character.imagePath ? `${API_BASE}/assets/${character.imagePath}` : null;

  return (
    <div className="rounded-lg border border-line bg-panel2 overflow-hidden">
      {/* Image thumbnail */}
      <div className="relative h-48 w-full bg-panel md:h-44">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={character.name}
            className="w-full h-full object-cover cursor-zoom-in transition hover:opacity-85"
            onClick={() => window.open(imageUrl, "_blank")}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center border-b border-line">
            <p className="text-sm text-gray-500">待生成</p>
          </div>
        )}
      </div>
      {/* Text content */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-100">{character.name}</h3>
            <p className="mt-1 text-sm text-gray-500">{character.roleType || "未填写角色类型"}</p>
          </div>
          <StatusPill value={character.status} tone="purple" />
          {character.imageStatus ? (
            <StatusPill
              value={`图片:${character.imageStatus}`}
              tone={
                character.imageStatus === "succeeded" ? "green"
                : character.imageStatus === "failed" ? "amber"
                : "blue"
              }
            />
          ) : null}
        </div>
        <p className="mt-4 text-sm leading-6 text-gray-400">
          {character.appearanceSummary || "未填写外观描述"}
        </p>
        {character.appearancePrompt ? (
          <div className="mt-3 rounded-lg bg-mint/5 border border-mint/20 px-3 py-2">
            <p className="text-[10px] font-medium text-mint/70 uppercase tracking-wider">外观锚定词</p>
            <p className="mt-1 text-xs leading-5 text-gray-300">{character.appearancePrompt}</p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {character.personalityTags.map((tag) => (
            <span key={tag} className="rounded-full bg-panel2 px-3 py-1 text-xs text-gray-400 shadow-sm">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusPill value={variantSummary.activeVariantLabel} tone="blue" />
          <StatusPill value={`${variantSummary.variantCount} 个变体`} tone="slate" />
          <StatusPill
            value={`${variantSummary.imageReadyCount} 个形态有图`}
            tone={variantSummary.imageReadyCount ? "green" : "amber"}
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-panel2 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-gray-500">角色定位</p>
            <p className="mt-2 text-sm text-gray-300">{character.identitySummary || "未填写"}</p>
          </div>
          <div className="rounded-2xl bg-panel2 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-gray-500">当前激活形态</p>
            <p className="mt-2 text-sm text-gray-300">{variantSummary.activeVariantLabel}</p>
            <p className="mt-1 text-xs text-gray-500">
              {variantSummary.activeImagePath ? "当前形态已有主图" : "当前形态尚未出图"}
            </p>
          </div>
        </div>
        {/* Action buttons */}
        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => onEdit(character)}>
            编辑
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onRegenerate(character)}
            disabled={loadingStates.regenerating}
          >
            {loadingStates.regenerating ? "重新生成中..." : "重新生成"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onGenerateImage(character)}
            disabled={loadingStates.generatingImage}
          >
            {loadingStates.generatingImage ? "生成中..." : "生成当前形态主图"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOptimizePrompt(character)}
            disabled={loadingStates.optimizingPrompt}
          >
            {loadingStates.optimizingPrompt ? "优化中..." : "优化 Prompt"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onGenerateAppearanceAnchor(character)}
            disabled={loadingStates.generatingAnchor}
          >
            {loadingStates.generatingAnchor ? "生成中..." : "生成外观锚定词"}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(character)}>
            删除
          </Button>
        </div>
      </div>
    </div>
  );
}
