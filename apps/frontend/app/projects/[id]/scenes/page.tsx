"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useProgressiveGeneration } from "@/src/hooks/useProgressiveGeneration";
import { toast } from "react-toastify";
import {
  createScene,
  deleteScene,
  streamCopilot,
  updateScene,
  type CopilotProposal,
  type SceneCollectionProposal,
  type ScenePreset,
  type SceneProposal,
} from "@/src/api";
import ProjectCopilotButton from "@/src/components/copilot/ProjectCopilotButton";
import {
  useProjectCopilot,
  useProjectCopilotModule,
} from "@/src/components/copilot/ProjectCopilotContext";
import type {
  CopilotFieldDescriptor,
  CopilotModuleAdapter,
} from "@/src/components/copilot/types";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import {
  EmptyState,
  SectionCard,
  StatusPill,
} from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SceneFormState = {
  id?: number;
  name: string;
  sceneType: string;
  spaceDescription: string;
  lightingStyle: string;
  timeOfDay: string;
  weather: string;
  propList: string;
  negativeConstraints: string;
  imagePrompt: string;
  negativePrompt: string;
  status: string;
};

const emptyForm: SceneFormState = {
  name: "",
  sceneType: "",
  spaceDescription: "",
  lightingStyle: "",
  timeOfDay: "",
  weather: "",
  propList: "",
  negativeConstraints: "",
  imagePrompt: "",
  negativePrompt: "",
  status: "draft",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toForm(scene?: ScenePreset): SceneFormState {
  if (!scene) return emptyForm;
  return {
    id: scene.id,
    name: scene.name,
    sceneType: scene.sceneType,
    spaceDescription: scene.spaceDescription,
    lightingStyle: scene.lightingStyle,
    timeOfDay: scene.timeOfDay,
    weather: scene.weather,
    propList: scene.propList.join(", "),
    negativeConstraints: scene.negativeConstraints,
    imagePrompt: scene.imagePrompt,
    negativePrompt: scene.negativePrompt,
    status: scene.status,
  };
}

function proposalToForm(
  proposal: SceneProposal,
  base?: SceneFormState | null
): SceneFormState {
  return {
    id: base?.id,
    name: proposal.name,
    sceneType: proposal.sceneType,
    spaceDescription: proposal.spaceDescription,
    lightingStyle: proposal.lightingStyle,
    timeOfDay: proposal.timeOfDay,
    weather: proposal.weather,
    propList: proposal.propList.join(", "),
    negativeConstraints: proposal.negativeConstraints,
    imagePrompt: proposal.imagePrompt,
    negativePrompt: proposal.negativePrompt,
    status: base?.status ?? "draft",
  };
}

// ---------------------------------------------------------------------------
// Copilot field descriptors
// ---------------------------------------------------------------------------

const SCENE_FIELD_LABELS: CopilotFieldDescriptor[] = [
  { key: "name", label: "场景名" },
  { key: "sceneType", label: "场景类型" },
  { key: "spaceDescription", label: "空间描述" },
  { key: "lightingStyle", label: "光线风格" },
  { key: "timeOfDay", label: "时间段" },
  { key: "weather", label: "天气" },
  { key: "propList", label: "道具列表" },
  { key: "negativeConstraints", label: "负面约束" },
  { key: "imagePrompt", label: "图片 Prompt" },
  { key: "negativePrompt", label: "负面 Prompt" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScenesPage() {
  const { project, refresh } = useProjectWorkspace();
  const searchParams = useSearchParams();
  const episodeFilterId = searchParams.get("episode") ? Number(searchParams.get("episode")) : null;
  const { adapter } = useProjectCopilot();
  const [editing, setEditing] = useState<SceneFormState | null>(null);
  const [saving, setSaving] = useState(false);

  // Batch generation state
  const [batchStreaming, setBatchStreaming] = useState(false);
  const [batchStreamText, setBatchStreamText] = useState("");


  // Regenerate dialog
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateInput, setRegenerateInput] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateScene, setRegenerateScene] = useState<SceneFormState | null>(
    null
  );

  // Variant expand state
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(
    new Set()
  );

  if (!project) return null;
  const currentProject = project;

  const filteredScenes = episodeFilterId
    ? currentProject.scenes.filter((s) => s.episodeId === episodeFilterId)
    : currentProject.scenes;
  const filterEpisode = episodeFilterId
    ? currentProject.episodes?.find((e) => e.id === episodeFilterId)
    : null;

  // ---------------------------------------------------------------------------
  // Copilot adapter
  // ---------------------------------------------------------------------------

  const sceneAdapter = useMemo<CopilotModuleAdapter | null>(() => {
    if (!currentProject) return null;
    return {
      moduleType: "scene",
      title: "场景",
      description: "根据项目 Brief 生成场景模板，再进入逐个精修。",
      entityId: editing?.id ?? null,
      composer: {
        inputLabel: editing ? "场景精修目标" : "场景生成目标",
        inputPlaceholder: editing
          ? "例如：把光线改成暖黄色调，增加雨天氛围，空间更开阔。"
          : "例如：根据当前 Brief 生成 5 个核心场景模板，覆盖室内、室外、关键转折点。",
        emptyConversationTitle: editing
          ? "还没有场景精修对话"
          : "还没有场景设计对话",
        emptyConversationDescription: editing
          ? "输入一句场景精修目标，Copilot 会返回可回填的修改建议。"
          : "输入一句场景设计目标，Copilot 会返回一组可加入场景库的候选场景。",
        intentLabels: editing
          ? {
              generate: "生成场景方案",
              rewrite: "改写场景方案",
              expand: "丰富场景细节",
              compress: "收敛场景方案",
              fill_missing: "补全场景字段",
              regenerate: "重新生成",
            }
          : {
              generate: "生成场景组",
              rewrite: "重构场景组",
              expand: "丰富场景组",
              compress: "收敛场景组",
              fill_missing: "补全场景组",
              regenerate: "重新生成",
            },
      },
      proposalStyle: "custom",
      buildContext: () => ({
        current_mode: editing ? "single_refine" : "collection",
        generation_mode: "batch",
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
        current_scene: editing
          ? {
              name: editing.name,
              scene_type: editing.sceneType,
              space_description: editing.spaceDescription,
              lighting_style: editing.lightingStyle,
              time_of_day: editing.timeOfDay,
              weather: editing.weather,
              prop_list: parseCsv(editing.propList),
              negative_constraints: editing.negativeConstraints,
              image_prompt: editing.imagePrompt,
              negative_prompt: editing.negativePrompt,
            }
          : null,
        existing_scenes: currentProject.scenes.map((s) => ({
          name: s.name,
          scene_type: s.sceneType,
          space_description: s.spaceDescription,
          lighting_style: s.lightingStyle,
          time_of_day: s.timeOfDay,
          weather: s.weather,
          prop_list: s.propList,
        })),
        locked_rules: {
          project_id: currentProject.id,
          must_follow_brief: true,
        },
      }),
      renderContextSummary: () => (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-gray-500">项目名</span>{" "}
            <span className="text-gray-200">{currentProject.name}</span>
          </div>
          <div>
            <span className="text-gray-500">题材</span>{" "}
            <span className="text-gray-200">
              {currentProject.genre || "未填写"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">目标平台</span>{" "}
            <span className="text-gray-200">
              {currentProject.targetPlatform || "未填写"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">已有场景数</span>{" "}
            <span className="text-gray-200">
              {currentProject.scenes.length}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">当前阶段</span>{" "}
            <span className="text-gray-200">
              {editing ? "单场景精修" : "场景组批量生成"}
            </span>
          </div>
        </div>
      ),
      getSupportedIntents: () => [
        "generate",
        "rewrite",
        "expand",
        "compress",
        "fill_missing",
        "regenerate",
      ],
      getProposalFields: () => SCENE_FIELD_LABELS,
      renderProposal: ({ proposal }) => {
        const sceneProposal = proposal as SceneCollectionProposal;
        const scenes = sceneProposal.scenes ?? [];
        return (
          <div className="space-y-4">
            <div className="rounded-[20px] border border-dashed border-line bg-panel2 px-4 py-3 text-sm text-gray-400">
              {editing
                ? "当前是单场景精修模式。下面的建议只负责当前场景的修改。"
                : `当前生成了 ${scenes.length} 个候选场景。先确认场景模板，再逐个进入精修阶段。`}
            </div>
            <div className="grid gap-3">
              {scenes.map((scene, index) => (
                <div
                  key={`${scene.name}-${index}`}
                  className="rounded-lg border border-line bg-panel px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-100">
                        {scene.name || `候选场景 ${index + 1}`}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {scene.sceneType || "未定义场景类型"}
                      </p>
                    </div>
                    <span className="rounded-full bg-purple-500/10 px-3 py-1 text-[11px] font-semibold text-mint">
                      {editing ? "精修方案" : `候选 ${index + 1}`}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-panel2 px-4 py-3">
                      <p className="text-xs font-medium text-gray-500">
                        空间描述
                      </p>
                      <p className="mt-2 text-sm text-gray-300">
                        {scene.spaceDescription || "未提供"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-panel2 px-4 py-3">
                      <p className="text-xs font-medium text-gray-500">
                        光线 / 时间 / 天气
                      </p>
                      <p className="mt-2 text-sm text-gray-300">
                        {[
                          scene.lightingStyle,
                          scene.timeOfDay,
                          scene.weather,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "未填写"}
                      </p>
                    </div>
                  </div>
                  {scene.propList.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {scene.propList.map((prop) => (
                        <span
                          key={prop}
                          className="rounded-full bg-panel2 px-3 py-1 text-xs text-gray-400"
                        >
                          {prop}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(proposalToForm(scene, emptyForm))}
                    >
                      载入编辑器
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await createScene(currentProject.id, {
                            name: scene.name,
                            sceneType: scene.sceneType,
                            spaceDescription: scene.spaceDescription,
                            lightingStyle: scene.lightingStyle,
                            timeOfDay: scene.timeOfDay,
                            weather: scene.weather,
                            propList: scene.propList,
                            status: "draft",
                          });
                          await refresh();
                          toast.success(
                            `场景「${scene.name || `候选 ${index + 1}`}」已加入场景库`
                          );
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : String(err)
                          );
                        }
                      }}
                    >
                      加入场景库
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      },
      applyProposal: (
        proposal: CopilotProposal,
        options: { mode: "all" | "fields"; fields: string[] }
      ) => {
        const sceneCollection = proposal as SceneCollectionProposal;
        const firstScene = sceneCollection.scenes?.[0];
        if (!firstScene) return;
        const allowed =
          options.mode === "all"
            ? SCENE_FIELD_LABELS.map((f) => f.key)
            : options.fields;
        setEditing((prev) => {
          const base = prev ?? proposalToForm(firstScene);
          const next = { ...base };
          for (const key of allowed) {
            if (key === "name") next.name = firstScene.name;
            else if (key === "sceneType") next.sceneType = firstScene.sceneType;
            else if (key === "spaceDescription")
              next.spaceDescription = firstScene.spaceDescription;
            else if (key === "lightingStyle")
              next.lightingStyle = firstScene.lightingStyle;
            else if (key === "timeOfDay")
              next.timeOfDay = firstScene.timeOfDay;
            else if (key === "weather") next.weather = firstScene.weather;
            else if (key === "propList")
              next.propList = firstScene.propList.join(", ");
            else if (key === "negativeConstraints")
              next.negativeConstraints = firstScene.negativeConstraints;
            else if (key === "imagePrompt")
              next.imagePrompt = firstScene.imagePrompt;
            else if (key === "negativePrompt")
              next.negativePrompt = firstScene.negativePrompt;
          }
          return next;
        });
        toast.success(
          options.mode === "all"
            ? "Copilot 建议已回填到场景表单"
            : "已按字段回填到场景表单"
        );
      },
    };
  }, [currentProject, editing]);

  useProjectCopilotModule(sceneAdapter);

  // ---------------------------------------------------------------------------
  // Copilot context helpers
  // ---------------------------------------------------------------------------

  function buildSceneCopilotContext(
    mode: "collection" | "single_refine",
    targetScene: SceneFormState | null
  ) {
    return {
      current_mode: mode,
      generation_mode: mode === "collection" ? "batch" : "single",
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
      current_scene: targetScene
        ? {
            name: targetScene.name,
            scene_type: targetScene.sceneType,
            space_description: targetScene.spaceDescription,
            lighting_style: targetScene.lightingStyle,
            time_of_day: targetScene.timeOfDay,
            weather: targetScene.weather,
            prop_list: parseCsv(targetScene.propList),
            negative_constraints: targetScene.negativeConstraints,
            image_prompt: targetScene.imagePrompt,
            negative_prompt: targetScene.negativePrompt,
          }
        : null,
      existing_scenes: currentProject.scenes.map((s) => ({
        name: s.name,
        scene_type: s.sceneType,
        space_description: s.spaceDescription,
        lighting_style: s.lightingStyle,
        time_of_day: s.timeOfDay,
        weather: s.weather,
        prop_list: s.propList,
      })),
      locked_rules: {
        project_id: currentProject.id,
        must_follow_brief: true,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Progressive generation
  // ---------------------------------------------------------------------------

  async function handleProgressiveConfirm(proposal: CopilotProposal) {
    const scenes = (proposal as SceneCollectionProposal).scenes;
    const scene = scenes?.[0];
    if (!scene || !currentProject) return;
    await createScene(currentProject.id, {
      name: scene.name,
      sceneType: scene.sceneType,
      spaceDescription: scene.spaceDescription,
      lightingStyle: scene.lightingStyle,
      timeOfDay: scene.timeOfDay,
      weather: scene.weather,
      propList: scene.propList,
      negativeConstraints: scene.negativeConstraints,
      imagePrompt: scene.imagePrompt,
      negativePrompt: scene.negativePrompt,
      status: "draft",
    });
    await refresh();
    toast.success(`场景「${scene.name || "候选场景"}」已加入场景库`);
  }

  const progressive = useProgressiveGeneration({
    projectId: currentProject.id,
    moduleType: "scene",
    userMessage: "请为这个短剧项目生成 1 个关键场景。分析已有场景的覆盖范围，填补空间类型的空缺，确保场景服务于短剧的世界观和主冲突。只输出一个场景。",
    buildContext: () => buildSceneCopilotContext("single_refine", null),
    onConfirm: handleProgressiveConfirm,
  });

  // ---------------------------------------------------------------------------
  // CRUD handlers
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await updateScene(editing.id, currentProject.id, {
          name: editing.name,
          sceneType: editing.sceneType,
          spaceDescription: editing.spaceDescription,
          lightingStyle: editing.lightingStyle,
          timeOfDay: editing.timeOfDay,
          weather: editing.weather,
          propList: parseCsv(editing.propList),
          negativeConstraints: editing.negativeConstraints,
          imagePrompt: editing.imagePrompt,
          negativePrompt: editing.negativePrompt,
          status: editing.status,
        });
      } else {
        await createScene(currentProject.id, {
          name: editing.name,
          sceneType: editing.sceneType,
          spaceDescription: editing.spaceDescription,
          lightingStyle: editing.lightingStyle,
          timeOfDay: editing.timeOfDay,
          weather: editing.weather,
          propList: parseCsv(editing.propList),
          negativeConstraints: editing.negativeConstraints,
          imagePrompt: editing.imagePrompt,
          negativePrompt: editing.negativePrompt,
          status: editing.status,
        });
      }
      setEditing(null);
      await refresh();
      toast.success("场景已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(scene: ScenePreset) {
    try {
      await deleteScene(scene.id);
      await refresh();
      toast.success("场景已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  // ---------------------------------------------------------------------------
  // Batch generation ("AI 生成场景组")
  // ---------------------------------------------------------------------------

  async function handleBatchGenerate() {
    setBatchStreaming(true);
    setBatchStreamText("");
    try {
      const context = buildSceneCopilotContext("collection", null);
      let streamText = "";
      let proposal: CopilotProposal | null = null;

      await streamCopilot(
        {
          moduleType: "scene",
          projectId: currentProject.id,
          intent: "generate",
          messages: [
            {
              role: "user",
              content:
                "请根据当前项目 Brief 生成一组核心场景模板。每个场景包含场景类型、空间描述、光线风格、时间段、天气和道具列表。",
            },
          ],
          context,
        },
        {
          onDelta: (event) => {
            streamText += event.content;
            setBatchStreamText(streamText);
          },
          onProposal: (event) => {
            proposal = event.proposal;
          },
          onError: (err) => {
            throw err;
          },
          onDone: () => {},
        }
      );

      if (proposal && "scenes" in proposal) {
        const scenes = (proposal as SceneCollectionProposal).scenes ?? [];
        if (scenes.length > 0) {
          for (const scene of scenes) {
            await createScene(currentProject.id, {
              name: scene.name,
              sceneType: scene.sceneType,
              spaceDescription: scene.spaceDescription,
              lightingStyle: scene.lightingStyle,
              timeOfDay: scene.timeOfDay,
              weather: scene.weather,
              propList: scene.propList,
              negativeConstraints: scene.negativeConstraints,
              imagePrompt: scene.imagePrompt,
              negativePrompt: scene.negativePrompt,
              status: "draft",
            });
          }
          await refresh();
          toast.success(`已根据 Copilot 建议创建 ${scenes.length} 个场景`);
        } else {
          toast.error("Copilot 未返回有效的场景");
        }
      } else {
        toast.error("未能解析 Copilot 返回结果");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBatchStreaming(false);
      setBatchStreamText("");
    }
  }


  // ---------------------------------------------------------------------------
  // Regenerate ("重新生成")
  // ---------------------------------------------------------------------------

  async function handleRegenerate() {
    if (!regenerateScene || !regenerateInput.trim()) return;
    setRegenerating(true);
    try {
      const context = buildSceneCopilotContext("single_refine", regenerateScene);
      let streamText = "";
      let proposal: CopilotProposal | null = null;

      await streamCopilot(
        {
          moduleType: "scene",
          projectId: currentProject.id,
          entityId: regenerateScene.id ?? null,
          intent: "regenerate",
          messages: [
            { role: "user", content: regenerateInput.trim() },
          ],
          context,
        },
        {
          onDelta: (event) => {
            streamText += event.content;
          },
          onProposal: (event) => {
            proposal = event.proposal;
          },
          onError: (err) => {
            throw err;
          },
          onDone: () => {},
        }
      );

      if (proposal && "scenes" in proposal) {
        const scenes = (proposal as SceneCollectionProposal).scenes ?? [];
        if (scenes.length > 0) {
          setEditing({
            ...proposalToForm(scenes[0], regenerateScene),
            id: regenerateScene.id,
            status: regenerateScene.status,
          });
          toast.success("场景已根据你的要求重新生成，请检查后保存");
          setRegenerateOpen(false);
          setRegenerateInput("");
          setRegenerateScene(null);
        } else {
          toast.error("未能解析重新生成的结果");
        }
      } else {
        toast.error("未能解析重新生成的结果，请重试");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Variant expand toggle
  // ---------------------------------------------------------------------------

  function toggleVariants(sceneId: number) {
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Regenerate Dialog                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={regenerateOpen}
        onOpenChange={(open) => {
          setRegenerateOpen(open);
          if (!open) {
            setRegenerateInput("");
            setRegenerateScene(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>重新生成场景</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              当前场景:{" "}
              <span className="font-medium text-gray-200">
                {regenerateScene?.name || "未命名"}
              </span>
              {regenerateScene?.sceneType && (
                <span className="ml-2 text-gray-500">
                  ({regenerateScene.sceneType})
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500">
              描述你的修改要求，例如：&quot;改为夜间城市街头&quot;
              &quot;增加雾气氛围&quot; &quot;道具换成办公桌和电脑&quot;
            </p>
            <Textarea
              className="min-h-[80px] text-sm"
              placeholder="请描述重新生成的要求..."
              value={regenerateInput}
              onChange={(e) => setRegenerateInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRegenerateOpen(false);
                setRegenerateInput("");
                setRegenerateScene(null);
              }}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleRegenerate()}
              disabled={regenerating || !regenerateInput.trim()}
            >
              {regenerating ? "生成中..." : "重新生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Edit Dialog                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-w-3xl bg-panel p-0">
          <DialogHeader className="border-b border-line px-5 py-4">
            <DialogTitle>
              {editing?.id ? "编辑场景" : "新增场景"}
            </DialogTitle>
          </DialogHeader>
          {editing ? (
            <>
              <Tabs
                defaultValue="basic"
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <div className="shrink-0 border-b border-line px-5">
                  <TabsList variant="line">
                    <TabsTrigger value="basic">基础场景</TabsTrigger>
                    <TabsTrigger value="visual">视觉设定</TabsTrigger>
                    <TabsTrigger value="image">图片资产</TabsTrigger>
                  </TabsList>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  <TabsContent value="basic" className="p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">
                          场景名
                        </Label>
                        <Input
                          value={editing.name}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev ? { ...prev, name: e.target.value } : prev
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">
                          场景类型
                        </Label>
                        <Input
                          value={editing.sceneType}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? { ...prev, sceneType: e.target.value }
                                : prev
                            )
                          }
                          placeholder="室内 / 室外 / 虚拟空间"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="mb-2 block text-xs text-gray-500">
                          空间描述
                        </Label>
                        <Textarea
                          value={editing.spaceDescription}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    spaceDescription: e.target.value,
                                  }
                                : prev
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">
                          光线风格
                        </Label>
                        <Input
                          value={editing.lightingStyle}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? { ...prev, lightingStyle: e.target.value }
                                : prev
                            )
                          }
                          placeholder="暖光 / 冷光 / 自然光 / 霓虹灯"
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">
                          时间段
                        </Label>
                        <Input
                          value={editing.timeOfDay}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? { ...prev, timeOfDay: e.target.value }
                                : prev
                            )
                          }
                          placeholder="清晨 / 正午 / 黄昏 / 深夜"
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">
                          天气
                        </Label>
                        <Input
                          value={editing.weather}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? { ...prev, weather: e.target.value }
                                : prev
                            )
                          }
                          placeholder="晴天 / 阴天 / 雨天 / 雪天"
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">
                          道具列表
                        </Label>
                        <Input
                          value={editing.propList}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? { ...prev, propList: e.target.value }
                                : prev
                            )
                          }
                          placeholder="门禁, 雨伞, 沙发"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="visual" className="p-5">
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">
                          负面约束
                        </Label>
                        <Textarea
                          value={editing.negativeConstraints}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    negativeConstraints: e.target.value,
                                  }
                                : prev
                            )
                          }
                          placeholder="例如：不要出现过于明亮的色彩，避免卡通风格..."
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="image" className="p-5">
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">
                          图片 Prompt
                        </Label>
                        <Textarea
                          value={editing.imagePrompt}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? { ...prev, imagePrompt: e.target.value }
                                : prev
                            )
                          }
                          className="min-h-[128px]"
                          placeholder="详细的图片生成提示词..."
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">
                          负面 Prompt
                        </Label>
                        <Textarea
                          value={editing.negativePrompt}
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev
                                ? { ...prev, negativePrompt: e.target.value }
                                : prev
                            )
                          }
                          className="min-h-[96px]"
                          placeholder="不希望出现的元素..."
                        />
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
              <DialogFooter className="shrink-0 border-t border-line bg-panel2/60 px-5 py-3">
                <Button
                  variant="secondary"
                  onClick={() => setEditing(null)}
                  disabled={saving}
                >
                  取消
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "保存中..." : "保存场景"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Main Section                                                        */}
      {/* ------------------------------------------------------------------ */}
      <SectionCard
        title="场景模板"
        description={filterEpisode ? `筛选：第 ${filterEpisode.episodeNo} 集「${filterEpisode.title}」· ${filteredScenes.length} 个场景` : `场景模板会被镜头、Prompt 和视觉生成反复复用。共 ${currentProject.scenes.length} 个场景。`}
        action={
          <div className="flex flex-wrap gap-2">
            <ProjectCopilotButton
              label={editing ? "精修场景" : "场景 Copilot"}
            />
            {!progressive.active ? (
              <Button variant="secondary" onClick={progressive.start}>
                渐进式生成
              </Button>
            ) : (
              <Button variant="destructive" onClick={progressive.stop}>
                停止生成
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setEditing(emptyForm)}
            >
              手动新增
            </Button>
            <Button
              onClick={() => void handleBatchGenerate()}
              disabled={batchStreaming}
            >
              {batchStreaming ? "生成中..." : "AI 生成场景组"}
            </Button>
          </div>
        }
      >
        {/* Batch streaming text display */}
        {batchStreaming && batchStreamText && (
          <div className="mb-4 rounded-lg border border-dashed border-mint/40 bg-mint/5 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-100">
                  批量生成中
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Copilot 正在基于项目 Brief 生成场景模板...
                </p>
              </div>
              <span className="rounded-full bg-mint/10 px-3 py-1 text-[11px] font-semibold text-mint">
                生成中...
              </span>
            </div>
            <div className="mt-3 rounded-lg border border-line bg-panel2/50 px-3 py-2.5">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">
                Copilot
              </p>
              <div className="whitespace-pre-wrap text-[13px] leading-5 text-gray-300">
                {batchStreamText}
              </div>
            </div>
          </div>
        )}

        {filteredScenes.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredScenes.map((scene) => {
              const isExpanded = expandedVariants.has(scene.id);
              const hasVariants =
                scene.variants && scene.variants.length > 0;
              return (
                <div
                  key={scene.id}
                  className="rounded-lg border border-line bg-panel2 px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-100">
                        {scene.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {scene.sceneType || "未填写场景类型"}
                      </p>
                    </div>
                    <StatusPill value={scene.status} tone="purple" />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-gray-400">
                    {scene.spaceDescription || "未填写空间描述"}
                  </p>

                  {/* Lighting / Time / Weather summary */}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {scene.lightingStyle && (
                      <div className="rounded-xl bg-panel px-3 py-2">
                        <p className="text-[10px] font-medium text-gray-500">
                          光线
                        </p>
                        <p className="mt-0.5 text-xs text-gray-300">
                          {scene.lightingStyle}
                        </p>
                      </div>
                    )}
                    {scene.timeOfDay && (
                      <div className="rounded-xl bg-panel px-3 py-2">
                        <p className="text-[10px] font-medium text-gray-500">
                          时间
                        </p>
                        <p className="mt-0.5 text-xs text-gray-300">
                          {scene.timeOfDay}
                        </p>
                      </div>
                    )}
                    {scene.weather && (
                      <div className="rounded-xl bg-panel px-3 py-2">
                        <p className="text-[10px] font-medium text-gray-500">
                          天气
                        </p>
                        <p className="mt-0.5 text-xs text-gray-300">
                          {scene.weather}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Props */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {scene.propList.map((prop) => (
                      <span
                        key={prop}
                        className="rounded-full bg-panel px-3 py-1 text-xs text-gray-400 shadow-sm"
                      >
                        {prop}
                      </span>
                    ))}
                  </div>

                  {/* Variants expand/collapse */}
                  {hasVariants && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => toggleVariants(scene.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-mint hover:underline"
                      >
                        <span>{isExpanded ? "▼" : "▶"}</span>
                        <span>
                          {scene.variants.length} 个变体
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="mt-2 space-y-2 pl-2">
                          {scene.variants.map(
                            (
                              variant: {
                                id?: string;
                                variantName?: string;
                                variantType?: string;
                                [key: string]: unknown;
                              },
                              vIdx: number
                            ) => (
                              <div
                                key={variant.id || vIdx}
                                className="rounded-lg border border-line bg-panel px-3 py-2"
                              >
                                <p className="text-xs font-medium text-gray-300">
                                  {variant.variantName ||
                                    variant.variantType ||
                                    `变体 ${vIdx + 1}`}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="mt-5 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditing(toForm(scene))}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setRegenerateScene(toForm(scene));
                        setRegenerateOpen(true);
                      }}
                    >
                      重新生成
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(scene)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="还没有场景模板"
            description="先沉淀高频场景，后续镜头和 Prompt 复用效率会更高。你可以用 AI 自动生成，也可以手动新增。"
            action={
              <div className="flex gap-2">
                <Button onClick={() => void handleBatchGenerate()}>
                  AI 生成场景组
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setEditing(emptyForm)}
                >
                  手动新增
                </Button>
              </div>
            }
          />
        )}
      </SectionCard>

      {/* ------------------------------------------------------------------ */}
      {/* Progressive Generation Panel                                       */}
      {/* ------------------------------------------------------------------ */}
      {progressive.active && (
        <div className="mt-4 rounded-lg border border-dashed border-mint/40 bg-mint/5 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-100">渐进式场景生成</h3>
              <p className="mt-1 text-xs text-gray-500">
                已有 {currentProject.scenes.length} 个场景。每次生成 1 个新场景，确认后加入场景库。
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

          {progressive.proposal && (() => {
            const sceneCollection = progressive.proposal as SceneCollectionProposal;
            const scene = sceneCollection.scenes?.[0];
            if (!scene) return null;
            return (
              <div className="mt-3 rounded-lg border border-line bg-panel px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-100">{scene.name || "候选场景"}</h3>
                    <p className="mt-1 text-sm text-gray-500">{scene.sceneType || "未定义场景类型"}</p>
                  </div>
                  <span className="rounded-full bg-mint/10 px-3 py-1 text-[11px] font-semibold text-mint">渐进式候选</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-panel2 px-4 py-3">
                    <p className="text-xs font-medium text-gray-500">空间描述</p>
                    <p className="mt-2 text-sm text-gray-300">{scene.spaceDescription || "未提供"}</p>
                  </div>
                  <div className="rounded-2xl bg-panel2 px-4 py-3">
                    <p className="text-xs font-medium text-gray-500">光线 / 时间 / 天气</p>
                    <p className="mt-2 text-sm text-gray-300">
                      {[scene.lightingStyle, scene.timeOfDay, scene.weather].filter(Boolean).join(" / ") || "未填写"}
                    </p>
                  </div>
                </div>
                {scene.propList.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {scene.propList.map((prop) => (
                      <span key={prop} className="rounded-full bg-panel2 px-3 py-1 text-xs text-gray-400">{prop}</span>
                    ))}
                  </div>
                )}
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
                    setEditing(proposalToForm(scene));
                  }}>
                    载入编辑器
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
