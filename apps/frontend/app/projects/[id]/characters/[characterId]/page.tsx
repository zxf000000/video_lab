"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { IconArrowLeft, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import {
  generateCharacterAnchor,
  generateCharacterImage,
  getApiBase,
  optimizeCharacterPrompt,
  regenerateCharacter,
  updateCharacter,
  type CharacterAsset,
} from "@/src/api";
import ImagePreview from "@/src/components/project/ImagePreview";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";
import { motion } from "framer-motion";
import {
  CharacterFormState,
  CharacterVariantDraft,
  DEFAULT_VARIANT_ID,
  buildVisualProfile,
  createVariantDraft,
  emptyForm,
  getActiveVariant,
  getActiveVariantValue,
  mergeVariantImageSpec,
  parseCsv,
  resolveAssetUrl,
  toCharacterForm,
  updateActiveVariantValue,
  updateImagePath,
  updateVariantMeta,
  variantLabel,
} from "@/src/components/project/CharacterEditDrawer";

const CARD_DEFAULT_VARIANT_ID = "default";

function getCharacterVariantSummary(character: CharacterAsset) {
  const visualProfile = (character.visualProfile ?? {}) as Record<string, unknown>;
  const activeVariantId = typeof visualProfile.activeVariantId === "string" ? visualProfile.activeVariantId : CARD_DEFAULT_VARIANT_ID;
  const rawVariants = Array.isArray(visualProfile.variants) ? visualProfile.variants : [];
  const variants = rawVariants.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  const activeVariant = activeVariantId === CARD_DEFAULT_VARIANT_ID
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

export default function CharacterDetailPage() {
  const params = useParams<{ id: string; characterId: string }>();
  const router = useRouter();
  const { project, refresh } = useProjectWorkspace();
  const characterId = Number(params.characterId);
  const projectId = Number(params.id);

  const characters = project?.characters ?? [];
  const currentCharacter = characters.find((c) => c.id === characterId) ?? null;

  const [editing, setEditing] = useState<CharacterFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [cardLoading, setCardLoading] = useState<Record<string, boolean>>({});

  // Init form when character changes
  useEffect(() => {
    if (currentCharacter) {
      setEditing(toCharacterForm(currentCharacter));
    }
  }, [characterId]);

  // Flat character list for prev/next
  const currentIndex = characters.findIndex((c) => c.id === characterId);
  const prevChar = currentIndex > 0 ? characters[currentIndex - 1] : null;
  const nextChar = currentIndex < characters.length - 1 ? characters[currentIndex + 1] : null;

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft" && prevChar) {
        router.push(`/projects/${projectId}/characters/${prevChar.id}`);
      } else if (e.key === "ArrowRight" && nextChar) {
        router.push(`/projects/${projectId}/characters/${nextChar.id}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevChar, nextChar, projectId, router]);

  // Auto-refresh
  useEffect(() => {
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  // Save
  async function handleSave() {
    if (!editing?.id) return;
    setSaving(true);
    try {
      const resolvedImageSpec = mergeVariantImageSpec(editing, editing.activeVariantId);
      const selectedVariant = getActiveVariant(editing);
      await updateCharacter(editing.id, projectId, {
        name: editing.name,
        roleType: editing.roleType,
        species: editing.species,
        identitySummary: editing.identitySummary,
        appearanceSummary: editing.appearanceSummary,
        personalityTags: parseCsv(editing.personalityTags),
        speechStyle: editing.speechStyle,
        negativeConstraints: editing.negativeConstraints,
        visualProfile: buildVisualProfile(editing),
        imagePrompt: resolvedImageSpec.imagePrompt,
        negativePrompt: resolvedImageSpec.negativePrompt,
        imagePath: selectedVariant?.imagePath ?? editing.imagePath,
        status: editing.status,
      });
      await refresh();
      toast.success("角色已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateImage() {
    if (!editing?.id) return;
    try {
      await generateCharacterImage(editing.id);
      await refresh();
      toast.success("角色主图生成任务已提交");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCardAction(action: string, fn: (id: number) => Promise<unknown>) {
    if (!currentCharacter) return;
    setCardLoading((prev) => ({ ...prev, [action]: true }));
    try {
      await fn(currentCharacter.id);
      await refresh();
      toast.success(`${action} 任务已提交`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setCardLoading((prev) => ({ ...prev, [action]: false }));
    }
  }

  if (!project) return null;

  const activeVariant = editing ? getActiveVariant(editing) : null;
  const apiBase = getApiBase();

  function getCharImageUrl(char: CharacterAsset) {
    const vp = (char.visualProfile ?? {}) as Record<string, unknown>;
    const defaultImg = typeof vp.defaultImagePath === "string" ? vp.defaultImagePath : "";
    const path = defaultImg || char.imagePath;
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${apiBase}/assets/${path}`;
  }

  return (
    <div className="flex gap-0 flex-1 min-h-0 items-start">
      {/* ================================================================
          FILMSTRIP SIDEBAR — character list
          ================================================================ */}
      <aside
        className="w-[272px] shrink-0 sticky top-0 h-screen border-r border-line/60 bg-abyss/80 flex flex-col overflow-hidden"
        style={{ boxShadow: "inset -4px 0 20px rgba(0,0,0,0.3)" }}
      >
        {/* Sidebar header */}
        <div className="shrink-0 border-b border-line/50 px-4 py-3">
          <Link
            href={`/projects/${projectId}/characters`}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-gray-500 hover:text-mint transition"
          >
            <IconArrowLeft size={14} stroke={2.5} />
            返回角色列表
          </Link>
          <div className="mt-2 flex items-center justify-between">
            <span
              className="text-xs font-bold tracking-[0.12em] text-gray-300"
              style={{ fontFamily: "var(--font-mono), monospace" }}
            >
              全部角色
            </span>
            <span className="text-[10px] text-gray-600">{characters.length} chars</span>
          </div>
        </div>

        {/* Character list */}
        <div className="flex-1 overflow-y-auto">
          {characters.map((char) => {
            const isActive = char.id === characterId;
            const imageUrl = getCharImageUrl(char);
            return (
              <Link
                key={char.id}
                href={`/projects/${projectId}/characters/${char.id}`}
                className={`group flex items-start gap-3 px-4 py-2.5 border-b border-line/20 transition-all duration-150 ${
                  isActive
                    ? "bg-mint/5 border-l-[3px] border-l-mint border-b-mint/20"
                    : "border-l-[3px] border-l-transparent hover:bg-panel2/50"
                }`}
                style={isActive ? { boxShadow: "inset 0 0 20px rgba(0,240,255,0.03)" } : undefined}
              >
                {/* Thumbnail */}
                <div className="w-[72px] h-[40px] rounded-sm bg-panel2 border border-line/30 overflow-hidden shrink-0">
                  {imageUrl ? (
                    <img src={imageUrl} alt={char.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-700">
                      no img
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[11px] font-semibold ${
                        isActive ? "text-mint" : "text-gray-300 group-hover:text-gray-200"
                      }`}
                    >
                      {char.name || "未命名"}
                    </span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isActive ? "bg-mint shadow-[0_0_6px_rgba(0,240,255,0.6)]" : "bg-gray-700"
                      }`}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] leading-4 text-gray-500 line-clamp-1">
                    {char.roleType || "—"}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <StatusPill value={char.status} tone="purple" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Sidebar footer */}
        <div className="shrink-0 border-t border-line/50 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[9px] text-gray-600 tracking-wider">← → 切换角色</span>
          <span className="text-[9px] text-gray-600">
            {currentIndex >= 0 ? `${currentIndex + 1}/${characters.length}` : ""}
          </span>
        </div>
      </aside>

      {/* ================================================================
          MAIN CONTENT — character edit (3 tabs)
          ================================================================ */}
      <main className="flex-1 min-w-0 flex flex-col bg-panel">
        {!currentCharacter || !editing ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm text-gray-600">角色加载中...</span>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="shrink-0 border-b border-line/60 px-6 py-3.5 flex items-center justify-between">
              <div className="min-w-0 flex items-center gap-4">
                <div>
                  <h2 className="text-base font-bold text-gray-100" style={{ fontFamily: "var(--font-mono), monospace" }}>
                    {currentCharacter.name || "未命名角色"}
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-md">
                    {currentCharacter.roleType || "未设定角色类型"}
                    {currentCharacter.species ? ` · ${currentCharacter.species}` : ""}
                  </p>
                </div>
              </div>

              {/* Prev/Next + save */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-0.5 mr-3">
                  <button
                    disabled={!prevChar}
                    onClick={() => prevChar && router.push(`/projects/${projectId}/characters/${prevChar.id}`)}
                    className="p-1.5 text-gray-500 hover:text-mint disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="上一个角色 (←)"
                  >
                    <IconChevronLeft size={18} stroke={2} />
                  </button>
                  <span className="text-[10px] text-gray-600 w-14 text-center select-none">
                    {currentIndex >= 0 ? `${currentIndex + 1}/${characters.length}` : ""}
                  </span>
                  <button
                    disabled={!nextChar}
                    onClick={() => nextChar && router.push(`/projects/${projectId}/characters/${nextChar.id}`)}
                    className="p-1.5 text-gray-500 hover:text-mint disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="下一个角色 (→)"
                  >
                    <IconChevronRight size={18} stroke={2} />
                  </button>
                </div>
                <Button variant="secondary" size="sm" onClick={handleGenerateImage} disabled={saving}>
                  生成角色图
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "保存中..." : "保存角色"}
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="card" className="flex flex-col min-h-0 flex-1">
              <div className="border-b border-line/50 px-6 shrink-0">
                <TabsList>
                  <TabsTrigger value="card">角色卡片</TabsTrigger>
                  <TabsTrigger value="basic">基础角色卡</TabsTrigger>
                  <TabsTrigger value="visual">视觉设定</TabsTrigger>
                  <TabsTrigger value="image">图片资产</TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* ── Tab: 基础角色卡 ── */}
                <TabsContent value="basic" className="px-6 py-4">
                  <motion.div
                    key={characterId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid gap-4 md:grid-cols-2"
                  >
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">角色名</Label>
                      <Input value={editing.name} onChange={(e) => setEditing((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">角色类型</Label>
                      <Input value={editing.roleType} onChange={(e) => setEditing((prev) => prev ? { ...prev, roleType: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">物种</Label>
                      <Input value={editing.species} onChange={(e) => setEditing((prev) => prev ? { ...prev, species: e.target.value } : prev)} placeholder="人类、外星人、机器人..." />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-2 block text-xs text-gray-500">角色定位</Label>
                      <Textarea value={editing.identitySummary} onChange={(e) => setEditing((prev) => prev ? { ...prev, identitySummary: e.target.value } : prev)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-2 block text-xs text-gray-500">外观描述</Label>
                      <Textarea value={editing.appearanceSummary} onChange={(e) => setEditing((prev) => prev ? { ...prev, appearanceSummary: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">性格标签</Label>
                      <Input value={editing.personalityTags} onChange={(e) => setEditing((prev) => prev ? { ...prev, personalityTags: e.target.value } : prev)} placeholder="冷静, 阴狠, 傲慢" />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">说话风格</Label>
                      <Input value={editing.speechStyle} onChange={(e) => setEditing((prev) => prev ? { ...prev, speechStyle: e.target.value } : prev)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-2 block text-xs text-gray-500">负面约束</Label>
                      <Textarea value={editing.negativeConstraints} onChange={(e) => setEditing((prev) => prev ? { ...prev, negativeConstraints: e.target.value } : prev)} />
                    </div>
                  </motion.div>
                </TabsContent>

                {/* ── Tab: 视觉设定 ── */}
                <TabsContent value="visual" className="px-6 py-4">
                  <motion.div
                    key={characterId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="rounded-lg border border-line bg-panel2/60 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-100">视觉设定</h3>
                          <p className="mt-1 text-xs text-gray-500">先维护默认形态，再在下面扩展多个受控变体。</p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            if (!editing) return;
                            const nextVariant = createVariantDraft();
                            setEditing({
                              ...editing,
                              activeVariantId: nextVariant.id,
                              variants: [...editing.variants, nextVariant],
                            });
                          }}
                        >
                          新增变体
                        </Button>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                        {/* Variant sidebar */}
                        <div className="space-y-3 rounded-2xl border border-line bg-panel/70 p-3">
                          <button
                            type="button"
                            onClick={() => setEditing((prev) => prev ? { ...prev, activeVariantId: DEFAULT_VARIANT_ID } : prev)}
                            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                              editing.activeVariantId === DEFAULT_VARIANT_ID
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
                          {editing.variants.map((variant) => (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => setEditing((prev) => prev ? { ...prev, activeVariantId: variant.id } : prev)}
                              className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                editing.activeVariantId === variant.id
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
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setEditing((prev) => prev ? {
                                  ...prev,
                                  activeVariantId: DEFAULT_VARIANT_ID,
                                  variants: prev.variants.filter((v) => v.id !== prev.activeVariantId),
                                } : prev)}
                              >
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
                                  onChange={(e) => setEditing((prev) => prev ? updateVariantMeta(prev, { variantName: e.target.value }) : prev)}
                                />
                              </div>
                              <div>
                                <Label className="mb-2 block text-xs text-gray-500">变体类型</Label>
                                <Input
                                  value={activeVariant.variantType}
                                  onChange={(e) => setEditing((prev) => prev ? updateVariantMeta(prev, { variantType: e.target.value }) : prev)}
                                  placeholder="wedding / disguise / injured"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Label className="mb-2 block text-xs text-gray-500">触发场景</Label>
                                <Input
                                  value={activeVariant.triggerReason}
                                  onChange={(e) => setEditing((prev) => prev ? updateVariantMeta(prev, { triggerReason: e.target.value }) : prev)}
                                  placeholder="第12集婚礼对峙 / 第8集受伤后"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Label className="mb-2 block text-xs text-gray-500">视觉变化摘要</Label>
                                <Textarea
                                  value={activeVariant.visualChangesSummary}
                                  onChange={(e) => setEditing((prev) => prev ? updateVariantMeta(prev, { visualChangesSummary: e.target.value }) : prev)}
                                />
                              </div>
                            </div>
                          ) : null}

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <Label className="mb-2 block text-xs text-gray-500">性别呈现</Label>
                              <Input
                                value={getActiveVariantValue(editing, "genderPresentation")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "genderPresentation", e.target.value) : prev)}
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block text-xs text-gray-500">年龄区间</Label>
                              <Input
                                value={getActiveVariantValue(editing, "ageRange")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "ageRange", e.target.value) : prev)}
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block text-xs text-gray-500">体型</Label>
                              <Input
                                value={getActiveVariantValue(editing, "bodyType")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "bodyType", e.target.value) : prev)}
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block text-xs text-gray-500">眼神/眼型</Label>
                              <Input
                                value={getActiveVariantValue(editing, "eyeStyle")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "eyeStyle", e.target.value) : prev)}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label className="mb-2 block text-xs text-gray-500">脸部特征</Label>
                              <Textarea
                                value={getActiveVariantValue(editing, "faceFeatures")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "faceFeatures", e.target.value) : prev)}
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block text-xs text-gray-500">发型</Label>
                              <Input
                                value={getActiveVariantValue(editing, "hairStyle")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "hairStyle", e.target.value) : prev)}
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block text-xs text-gray-500">发色</Label>
                              <Input
                                value={getActiveVariantValue(editing, "hairColor")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "hairColor", e.target.value) : prev)}
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block text-xs text-gray-500">标志表情</Label>
                              <Input
                                value={getActiveVariantValue(editing, "signatureExpression")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "signatureExpression", e.target.value) : prev)}
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block text-xs text-gray-500">标志姿态</Label>
                              <Input
                                value={getActiveVariantValue(editing, "signaturePose")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "signaturePose", e.target.value) : prev)}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label className="mb-2 block text-xs text-gray-500">服装风格</Label>
                              <Textarea
                                value={getActiveVariantValue(editing, "clothingStyle")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "clothingStyle", e.target.value) : prev)}
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block text-xs text-gray-500">色板</Label>
                              <Input
                                value={getActiveVariantValue(editing, "colorPalette")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "colorPalette", e.target.value) : prev)}
                                placeholder="black, charcoal, deep gold"
                              />
                            </div>
                            <div>
                              <Label className="mb-2 block text-xs text-gray-500">视觉关键词</Label>
                              <Input
                                value={getActiveVariantValue(editing, "visualKeywords")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "visualKeywords", e.target.value) : prev)}
                                placeholder="wealthy mystery man, restrained menace"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label className="mb-2 block text-xs text-gray-500">视觉负面约束</Label>
                              <Textarea
                                value={getActiveVariantValue(editing, "negativeVisualConstraints")}
                                onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "negativeVisualConstraints", e.target.value) : prev)}
                                placeholder="no cartoon styling, no teenage appearance"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </TabsContent>

                {/* ── Tab: 图片资产 ── */}
                <TabsContent value="image" className="px-6 py-4">
                  <motion.div
                    key={characterId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="rounded-lg border border-line bg-panel2/60 px-4 py-3">
                      <h3 className="text-sm font-semibold text-gray-100">角色图片资产</h3>
                      <p className="mt-1 text-xs text-gray-500">当前对选中形态维护 prompt 与主图；默认形态和各变体都可分别出图。</p>
                      <div className="mt-3 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-4">
                          <div>
                            <Label className="mb-2 block text-xs text-gray-500">标准出图 Prompt</Label>
                            <Textarea
                              value={getActiveVariantValue(editing, "imagePrompt")}
                              onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "imagePrompt", e.target.value) : prev)}
                              className="min-h-[128px]"
                            />
                          </div>
                          <div>
                            <Label className="mb-2 block text-xs text-gray-500">负面 Prompt</Label>
                            <Textarea
                              value={getActiveVariantValue(editing, "negativePrompt")}
                              onChange={(e) => setEditing((prev) => prev ? updateActiveVariantValue(prev, "negativePrompt", e.target.value) : prev)}
                              className="min-h-[96px]"
                            />
                          </div>
                          <div>
                            <Label className="mb-2 block text-xs text-gray-500">当前形态主图路径</Label>
                            <Input
                              value={activeVariant?.imagePath ?? editing.imagePath}
                              onChange={(e) => setEditing((prev) => prev ? updateImagePath(prev, e.target.value) : prev)}
                              placeholder="后续由出图服务回填"
                            />
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-dashed border-line bg-panel/70 p-3">
                          {(activeVariant?.imagePath || editing.imagePath) ? (
                            <div className="space-y-3">
                              <div className="overflow-hidden rounded-[16px] border border-line bg-panel2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={resolveAssetUrl(activeVariant?.imagePath || editing.imagePath)}
                                  alt={editing.name || "角色图片"}
                                  className="h-[260px] w-full object-cover"
                                />
                              </div>
                              <p className="text-xs text-gray-500">当前形态已有主图。</p>
                            </div>
                          ) : (
                            <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[16px] bg-panel2 px-4 text-center">
                              <p className="text-sm font-medium text-gray-300">还没有角色图片</p>
                              <p className="mt-2 text-xs leading-6 text-gray-500">
                                先用 Copilot 生成完整角色卡和视觉设定。
                                <br />
                                点击「生成角色图」按钮开始出图。
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </TabsContent>

                {/* ── Tab: 角色卡片 ── */}
                <TabsContent value="card" className="px-6 py-4">
                  <motion.div
                    key={characterId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="rounded-lg border border-line bg-panel2/60 px-5 py-4">
                      <h3 className="text-sm font-semibold text-gray-100">角色卡片概览</h3>
                      <p className="mt-1 text-xs text-gray-500">卡片上的完整信息与快捷操作。</p>

                      <div className="mt-4 flex gap-5 items-start">
                        {/* Left: image preview */}
                        <div className="shrink-0 w-[280px]">
                          {(() => {
                            const imageUrl = currentCharacter.imagePath
                              ? `${getApiBase()}/assets/${currentCharacter.imagePath}`
                              : null;
                            return imageUrl ? (
                              <ImagePreview src={imageUrl} alt={currentCharacter.name} className="rounded-xl overflow-hidden border border-line">
                                <img
                                  src={imageUrl}
                                  alt={currentCharacter.name}
                                  className="w-full h-auto object-contain rounded-xl"
                                />
                              </ImagePreview>
                            ) : (
                              <div className="w-full aspect-[3/4] rounded-xl bg-panel border border-dashed border-line flex items-center justify-center">
                                <p className="text-xs text-gray-500">暂无角色图片</p>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Right: info + actions */}
                        <div className="min-w-0 flex-1">
                          {/* Appearance summary */}
                          <div>
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">外观描述</p>
                            <p className="mt-1 text-sm leading-6 text-gray-300">
                              {currentCharacter.appearanceSummary || "未填写外观描述"}
                            </p>
                          </div>

                          {/* Appearance anchor */}
                          {currentCharacter.appearancePrompt ? (
                            <div className="mt-3 rounded-lg bg-mint/5 border border-mint/20 px-3 py-2">
                              <p className="text-[10px] font-medium text-mint/70 uppercase tracking-wider">外观锚定词</p>
                              <p className="mt-0.5 text-xs leading-5 text-gray-300 line-clamp-4">{currentCharacter.appearancePrompt}</p>
                            </div>
                          ) : null}

                          {/* Personality tags */}
                          <div className="mt-3">
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">性格标签</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {currentCharacter.personalityTags.length ? (
                                currentCharacter.personalityTags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-panel px-2.5 py-0.5 text-[11px] text-gray-400 shadow-sm">
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-600">未填写</span>
                              )}
                            </div>
                          </div>

                          {/* Variant summary + identity info */}
                          <div className="mt-3 grid gap-2 grid-cols-2">
                            {(() => {
                              const vs = getCharacterVariantSummary(currentCharacter);
                              return (
                                <>
                                  <StatusPill value={vs.activeVariantLabel} tone="blue" />
                                  <StatusPill value={`${vs.variantCount} 个变体`} tone="slate" />
                                  <StatusPill
                                    value={`${vs.imageReadyCount} 个形态有图`}
                                    tone={vs.imageReadyCount ? "green" : "amber"}
                                  />
                                </>
                              );
                            })()}
                          </div>

                          <div className="mt-2 grid gap-2 grid-cols-2">
                            <div className="rounded-lg bg-panel px-3 py-2 shadow-sm">
                              <p className="text-[10px] font-medium text-gray-500">角色定位</p>
                              <p className="mt-0.5 text-xs text-gray-300">{currentCharacter.identitySummary || "未填写"}</p>
                            </div>
                            {(() => {
                              const vs = getCharacterVariantSummary(currentCharacter);
                              return (
                                <div className="rounded-lg bg-panel px-3 py-2 shadow-sm">
                                  <p className="text-[10px] font-medium text-gray-500">当前激活形态</p>
                                  <p className="mt-0.5 text-xs text-gray-300">{vs.activeVariantLabel}</p>
                                  <p className="mt-0.5 text-[10px] text-gray-500">
                                    {vs.activeImagePath ? "当前形态已有主图" : "当前形态尚未出图"}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Card action buttons */}
                          <div className="mt-4">
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">快捷操作</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleCardAction("重新生成", regenerateCharacter)}
                                disabled={cardLoading["重新生成"] || currentCharacter.regenerateStatus === "running"}
                              >
                                {cardLoading["重新生成"] || currentCharacter.regenerateStatus === "running" ? "重新生成中..." : "重新生成"}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleCardAction("生成当前形态主图", generateCharacterImage)}
                                disabled={cardLoading["生成当前形态主图"] || currentCharacter.imageStatus === "generating"}
                              >
                                {cardLoading["生成当前形态主图"] || currentCharacter.imageStatus === "generating" ? "生成中..." : "生成当前形态主图"}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleCardAction("优化 Prompt", optimizeCharacterPrompt)}
                                disabled={cardLoading["优化 Prompt"] || currentCharacter.promptStatus === "running"}
                              >
                                {cardLoading["优化 Prompt"] || currentCharacter.promptStatus === "running" ? "优化中..." : "优化 Prompt"}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleCardAction("生成外观锚定词", generateCharacterAnchor)}
                                disabled={cardLoading["生成外观锚定词"] || currentCharacter.anchorStatus === "running"}
                              >
                                {cardLoading["生成外观锚定词"] || currentCharacter.anchorStatus === "running" ? "生成中..." : "生成外观锚定词"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
