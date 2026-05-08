"use client";

import { API_BASE } from "@/src/api";
import { StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/src/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";

// ── Types ────────────────────────────────────────────────────────────────

export const DEFAULT_VARIANT_ID = "default";

export type VariantVisualFieldKey =
  | "genderPresentation"
  | "ageRange"
  | "bodyType"
  | "faceFeatures"
  | "hairStyle"
  | "hairColor"
  | "eyeStyle"
  | "signatureExpression"
  | "signaturePose"
  | "clothingStyle"
  | "colorPalette"
  | "visualKeywords"
  | "negativeVisualConstraints"
  | "imagePrompt"
  | "negativePrompt";

export type VariantVisualDraft = Record<VariantVisualFieldKey, string>;

export type CharacterVariantDraft = {
  id: string;
  variantName: string;
  variantType: string;
  triggerReason: string;
  visualChangesSummary: string;
  inheritRules: {
    keepFaceIdentity: boolean;
    keepAgeRange: boolean;
    keepBodyType: boolean;
    keepCoreTemperament: boolean;
  };
  override: VariantVisualDraft;
  imagePath: string;
};

export type CharacterFormState = {
  id?: number;
  name: string;
  roleType: string;
  species: string;
  identitySummary: string;
  appearanceSummary: string;
  personalityTags: string;
  speechStyle: string;
  negativeConstraints: string;
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
  colorPalette: string;
  visualKeywords: string;
  negativeVisualConstraints: string;
  imagePrompt: string;
  negativePrompt: string;
  imagePath: string;
  variants: CharacterVariantDraft[];
  activeVariantId: string;
  status: string;
};

// ── Defaults ─────────────────────────────────────────────────────────────

export const emptyVariantVisual: VariantVisualDraft = {
  genderPresentation: "",
  ageRange: "",
  bodyType: "",
  faceFeatures: "",
  hairStyle: "",
  hairColor: "",
  eyeStyle: "",
  signatureExpression: "",
  signaturePose: "",
  clothingStyle: "",
  colorPalette: "",
  visualKeywords: "",
  negativeVisualConstraints: "",
  imagePrompt: "",
  negativePrompt: "",
};

export const emptyForm: CharacterFormState = {
  name: "",
  roleType: "",
  species: "",
  identitySummary: "",
  appearanceSummary: "",
  personalityTags: "",
  speechStyle: "",
  negativeConstraints: "",
  genderPresentation: "",
  ageRange: "",
  bodyType: "",
  faceFeatures: "",
  hairStyle: "",
  hairColor: "",
  eyeStyle: "",
  signatureExpression: "",
  signaturePose: "",
  clothingStyle: "",
  colorPalette: "",
  visualKeywords: "",
  negativeVisualConstraints: "",
  imagePrompt: "",
  negativePrompt: "",
  imagePath: "",
  variants: [],
  activeVariantId: DEFAULT_VARIANT_ID,
  status: "draft",
};

// ── Helpers ──────────────────────────────────────────────────────────────

export function createVariantDraft(seed?: Partial<CharacterVariantDraft>): CharacterVariantDraft {
  return {
    id: seed?.id ?? `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    variantName: seed?.variantName ?? "",
    variantType: seed?.variantType ?? "",
    triggerReason: seed?.triggerReason ?? "",
    visualChangesSummary: seed?.visualChangesSummary ?? "",
    inheritRules: seed?.inheritRules ?? {
      keepFaceIdentity: true,
      keepAgeRange: true,
      keepBodyType: true,
      keepCoreTemperament: true,
    },
    override: seed?.override ?? { ...emptyVariantVisual },
    imagePath: seed?.imagePath ?? "",
  };
}

export function getActiveVariant(form: CharacterFormState) {
  return form.activeVariantId === DEFAULT_VARIANT_ID
    ? null
    : form.variants.find((variant) => variant.id === form.activeVariantId) ?? null;
}

export function getActiveVariantValue(form: CharacterFormState, key: VariantVisualFieldKey) {
  const activeVariant = getActiveVariant(form);
  return activeVariant ? activeVariant.override[key] : form[key];
}

export function updateActiveVariantValue(
  form: CharacterFormState,
  key: VariantVisualFieldKey,
  value: string,
): CharacterFormState {
  if (form.activeVariantId === DEFAULT_VARIANT_ID) {
    return { ...form, [key]: value };
  }
  return {
    ...form,
    variants: form.variants.map((variant) =>
      variant.id === form.activeVariantId
        ? { ...variant, override: { ...variant.override, [key]: value } }
        : variant,
    ),
  };
}

function updateVariantMeta(form: CharacterFormState, patch: Partial<CharacterVariantDraft>) {
  return {
    ...form,
    variants: form.variants.map((variant) =>
      variant.id === form.activeVariantId ? { ...variant, ...patch } : variant,
    ),
  };
}

function updateImagePath(form: CharacterFormState, value: string): CharacterFormState {
  if (form.activeVariantId === DEFAULT_VARIANT_ID) {
    return { ...form, imagePath: value };
  }
  return {
    ...form,
    variants: form.variants.map((variant) =>
      variant.id === form.activeVariantId ? { ...variant, imagePath: value } : variant,
    ),
  };
}

export function variantLabel(variant: CharacterVariantDraft) {
  return variant.variantName || variant.variantType || "未命名变体";
}

export function resolveAssetUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/assets/")) return `${API_BASE}${path}`;
  return `${API_BASE}/assets/${path}`;
}

// ── Props ────────────────────────────────────────────────────────────────

interface CharacterEditDrawerProps {
  open: boolean;
  onClose: () => void;
  form: CharacterFormState;
  onChange: (form: CharacterFormState) => void;
  onSave: () => void;
  onGenerateImage: () => void;
  onGenerateImageSpec: () => void;
  onAddVariant: () => void;
  onDeleteVariant: (variantId: string) => void;
  onSelectVariant: (variantId: string) => void;
  onPreviewImage?: (url: string) => void;
  loadingStates: {
    saving: boolean;
    generatingImage: boolean;
    generatingImageSpec: boolean;
  };
}

// ── Component ────────────────────────────────────────────────────────────

export function CharacterEditDrawer({
  open,
  onClose,
  form,
  onChange,
  onSave,
  onGenerateImage,
  onGenerateImageSpec,
  onAddVariant,
  onDeleteVariant,
  onSelectVariant,
  onPreviewImage,
  loadingStates,
}: CharacterEditDrawerProps) {
  const activeVariant = getActiveVariant(form);

  return (
    <Sheet open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-[45rem] max-w-[92vw] max-h-none gap-0 p-0"
      >
        <SheetHeader className="shrink-0 border-b border-line px-5 py-4">
          <SheetTitle>{form.id ? "编辑角色" : "新增角色"}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="basic" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-line px-5">
            <TabsList variant="line">
              <TabsTrigger value="basic">基础角色卡</TabsTrigger>
              <TabsTrigger value="visual">视觉设定</TabsTrigger>
              <TabsTrigger value="image">图片资产</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* ── Tab: 基础角色卡 ── */}
            <TabsContent value="basic" className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block text-xs text-gray-500">角色名</Label>
                  <Input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-gray-500">角色类型</Label>
                  <Input value={form.roleType} onChange={(e) => onChange({ ...form, roleType: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-gray-500">物种</Label>
                  <Input value={form.species} onChange={(e) => onChange({ ...form, species: e.target.value })} placeholder="人类、外星人、机器人..." />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-gray-500">角色定位</Label>
                  <Textarea value={form.identitySummary} onChange={(e) => onChange({ ...form, identitySummary: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-gray-500">外观描述</Label>
                  <Textarea value={form.appearanceSummary} onChange={(e) => onChange({ ...form, appearanceSummary: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-gray-500">性格标签</Label>
                  <Input value={form.personalityTags} onChange={(e) => onChange({ ...form, personalityTags: e.target.value })} placeholder="冷静, 阴狠, 傲慢" />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-gray-500">说话风格</Label>
                  <Input value={form.speechStyle} onChange={(e) => onChange({ ...form, speechStyle: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-gray-500">负面约束</Label>
                  <Textarea value={form.negativeConstraints} onChange={(e) => onChange({ ...form, negativeConstraints: e.target.value })} />
                </div>
              </div>
              <p className="mt-4 text-[11px] text-gray-500">服务剧情大纲、台词和角色一致性。</p>
            </TabsContent>

            {/* ── Tab: 视觉设定 ── */}
            <TabsContent value="visual" className="p-5">
              <div className="rounded-lg border border-line bg-panel2/60 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-100">视觉设定</h3>
                    <p className="mt-1 text-xs text-gray-500">先维护默认形态，再在下面扩展多个受控变体。</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={onAddVariant}>
                      新增变体
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={onGenerateImageSpec}
                      disabled={loadingStates.generatingImageSpec}
                    >
                      {loadingStates.generatingImageSpec
                        ? "生成 image_spec..."
                        : activeVariant
                          ? "补当前变体 image_spec"
                          : "补默认形态 image_spec"}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                  {/* Variant sidebar */}
                  <div className="space-y-3 rounded-2xl border border-line bg-panel/70 p-3">
                    <button
                      type="button"
                      onClick={() => onSelectVariant(DEFAULT_VARIANT_ID)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        form.activeVariantId === DEFAULT_VARIANT_ID
                          ? "border-mint bg-mint/10"
                          : "border-line bg-panel2 hover:border-mint/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-100">默认形态</p>
                          <p className="mt-1 text-xs text-gray-500">角色基础长相与气质</p>
                        </div>
                        <StatusPill value="base" tone="blue" />
                      </div>
                    </button>
                    {form.variants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => onSelectVariant(variant.id)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          form.activeVariantId === variant.id
                            ? "border-mint bg-mint/10"
                            : "border-line bg-panel2 hover:border-mint/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-100">{variantLabel(variant)}</p>
                            <p className="mt-1 truncate text-xs text-gray-500">{variant.variantType || "未定义变体类型"}</p>
                          </div>
                          <StatusPill value={variant.imagePath ? "有图" : "未出图"} tone={variant.imagePath ? "green" : "amber"} />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Detail panel */}
                  <div className="space-y-4 rounded-2xl border border-line bg-panel/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-100">
                          {activeVariant ? `${variantLabel(activeVariant)} 详情` : "默认形态详情"}
                        </h4>
                        <p className="mt-1 text-xs text-gray-500">
                          {activeVariant ? "当前变体会继承默认形态，再覆盖必要视觉字段。" : "默认形态定义这个角色最稳定的基础长相与气质。"}
                        </p>
                      </div>
                      {activeVariant ? (
                        <Button size="sm" variant="destructive" onClick={() => onDeleteVariant(form.activeVariantId)}>
                          删除变体
                        </Button>
                      ) : null}
                    </div>

                    {activeVariant ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label className="mb-2 block text-xs text-gray-500">变体名</Label>
                          <Input
                            value={activeVariant.variantName}
                            onChange={(e) => onChange(updateVariantMeta(form, { variantName: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label className="mb-2 block text-xs text-gray-500">变体类型</Label>
                          <Input
                            value={activeVariant.variantType}
                            onChange={(e) => onChange(updateVariantMeta(form, { variantType: e.target.value }))}
                            placeholder="wedding / disguise / injured"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="mb-2 block text-xs text-gray-500">触发场景</Label>
                          <Input
                            value={activeVariant.triggerReason}
                            onChange={(e) => onChange(updateVariantMeta(form, { triggerReason: e.target.value }))}
                            placeholder="第12集婚礼对峙 / 第8集受伤后"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="mb-2 block text-xs text-gray-500">视觉变化摘要</Label>
                          <Textarea
                            value={activeVariant.visualChangesSummary}
                            onChange={(e) => onChange(updateVariantMeta(form, { visualChangesSummary: e.target.value }))}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">性别呈现</Label>
                        <Input
                          value={getActiveVariantValue(form, "genderPresentation")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "genderPresentation", e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">年龄区间</Label>
                        <Input
                          value={getActiveVariantValue(form, "ageRange")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "ageRange", e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">体型</Label>
                        <Input
                          value={getActiveVariantValue(form, "bodyType")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "bodyType", e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">眼神/眼型</Label>
                        <Input
                          value={getActiveVariantValue(form, "eyeStyle")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "eyeStyle", e.target.value))}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="mb-2 block text-xs text-gray-500">脸部特征</Label>
                        <Textarea
                          value={getActiveVariantValue(form, "faceFeatures")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "faceFeatures", e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">发型</Label>
                        <Input
                          value={getActiveVariantValue(form, "hairStyle")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "hairStyle", e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">发色</Label>
                        <Input
                          value={getActiveVariantValue(form, "hairColor")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "hairColor", e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">标志表情</Label>
                        <Input
                          value={getActiveVariantValue(form, "signatureExpression")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "signatureExpression", e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">标志姿态</Label>
                        <Input
                          value={getActiveVariantValue(form, "signaturePose")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "signaturePose", e.target.value))}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="mb-2 block text-xs text-gray-500">服装风格</Label>
                        <Textarea
                          value={getActiveVariantValue(form, "clothingStyle")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "clothingStyle", e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">色板</Label>
                        <Input
                          value={getActiveVariantValue(form, "colorPalette")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "colorPalette", e.target.value))}
                          placeholder="black, charcoal, deep gold"
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">视觉关键词</Label>
                        <Input
                          value={getActiveVariantValue(form, "visualKeywords")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "visualKeywords", e.target.value))}
                          placeholder="wealthy mystery man, restrained menace"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="mb-2 block text-xs text-gray-500">视觉负面约束</Label>
                        <Textarea
                          value={getActiveVariantValue(form, "negativeVisualConstraints")}
                          onChange={(e) => onChange(updateActiveVariantValue(form, "negativeVisualConstraints", e.target.value))}
                          placeholder="no cartoon styling, no teenage appearance"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Tab: 图片资产 ── */}
            <TabsContent value="image" className="p-5">
              <div className="rounded-lg border border-line bg-panel2/60 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-100">角色图片资产</h3>
                <p className="mt-1 text-xs text-gray-500">当前对选中形态维护 prompt 与主图；默认形态和各变体都可分别出图。</p>
                <div className="mt-3 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">标准出图 Prompt</Label>
                      <Textarea
                        value={getActiveVariantValue(form, "imagePrompt")}
                        onChange={(e) => onChange(updateActiveVariantValue(form, "imagePrompt", e.target.value))}
                        className="min-h-[128px]"
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">负面 Prompt</Label>
                      <Textarea
                        value={getActiveVariantValue(form, "negativePrompt")}
                        onChange={(e) => onChange(updateActiveVariantValue(form, "negativePrompt", e.target.value))}
                        className="min-h-[96px]"
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">当前形态主图路径</Label>
                      <Input
                        value={activeVariant?.imagePath ?? form.imagePath}
                        onChange={(e) => onChange(updateImagePath(form, e.target.value))}
                        placeholder="后续由出图服务回填"
                      />
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-dashed border-line bg-panel/70 p-3">
                    {(activeVariant?.imagePath || form.imagePath) ? (
                      <div className="space-y-3">
                        <div className="overflow-hidden rounded-[16px] border border-line bg-panel2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolveAssetUrl(activeVariant?.imagePath || form.imagePath)}
                            alt={form.name || "角色图片"}
                            className="h-[260px] w-full cursor-pointer object-cover"
                            onClick={() => onPreviewImage?.(resolveAssetUrl(activeVariant?.imagePath || form.imagePath))}
                          />
                        </div>
                        <p className="text-xs text-gray-500">当前形态已有主图。后续这里可继续接"设为主图 / 基于主图微调 / 批量重生"。</p>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[16px] bg-panel2 px-4 text-center">
                        <p className="text-sm font-medium text-gray-300">还没有角色图片</p>
                        <p className="mt-2 text-xs leading-6 text-gray-500">
                          先用 Copilot 生成完整角色卡和视觉设定。
                          <br />
                          下一步这里会接"批量生成 4 张 / 设为主图 / 基于主图微调"。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <SheetFooter className="shrink-0 border-t border-line bg-panel2/60 px-5 py-3">
          <Button variant="secondary" onClick={onClose} disabled={loadingStates.saving}>
            取消
          </Button>
          <Button
            variant="secondary"
            onClick={onGenerateImage}
            disabled={loadingStates.saving || loadingStates.generatingImage}
          >
            {loadingStates.generatingImage
              ? "生成中..."
              : (activeVariant?.imagePath || form.imagePath)
                ? "保存并重生成主图"
                : "保存并生成角色图"}
          </Button>
          <Button onClick={onSave} disabled={loadingStates.saving}>
            {loadingStates.saving ? "保存中..." : "保存角色"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
