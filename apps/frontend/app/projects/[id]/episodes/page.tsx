"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  listEpisodes,
  createEpisode,
  updateEpisode,
  deleteEpisode,
  listCharacters,
  listScenes,
  getProject,
  streamCopilot,
  type Episode,
  type EpisodeProposal,
  type EpisodeCollectionProposal,
  type SceneCollectionProposal,
  type ProjectDetail,
} from "@/src/api";
import { useProgressiveGeneration } from "@/src/hooks/useProgressiveGeneration";
import { SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/components/ui/dialog";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

interface EpisodeFormState {
  id?: number;
  episodeNo: number;
  title: string;
  summary: string;
  goal: string;
  coreConflict: string;
  openingHook: string;
  climax: string;
  endingHook: string;
  sortOrder: number;
  status: string;
}

function toForm(ep: Episode): EpisodeFormState {
  return {
    id: ep.id,
    episodeNo: ep.episodeNo,
    title: ep.title,
    summary: ep.summary,
    goal: ep.goal,
    coreConflict: ep.coreConflict,
    openingHook: ep.openingHook,
    climax: ep.climax,
    endingHook: ep.endingHook,
    sortOrder: ep.sortOrder,
    status: ep.status,
  };
}

function emptyForm(episodeNo: number): EpisodeFormState {
  return {
    episodeNo,
    title: "",
    summary: "",
    goal: "",
    coreConflict: "",
    openingHook: "",
    climax: "",
    endingHook: "",
    sortOrder: episodeNo,
    status: "draft",
  };
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                               */
/* ------------------------------------------------------------------ */

export default function EpisodesPage() {
  const params = useParams();
  const projectId = Number(params.id);

  /* ---- state ---- */
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [characters, setCharacters] = useState<any[]>([]);
  const [scenes, setScenes] = useState<any[]>([]);
  const [editing, setEditing] = useState<EpisodeFormState | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<EpisodeFormState | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateInput, setRegenerateInput] = useState("");
  const [generatingScenes, setGeneratingScenes] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  /* ---- data fetch ---- */
  const refresh = useCallback(async () => {
    try {
      const [projectData, episodeData, charData, sceneData] = await Promise.all([
        getProject(projectId),
        listEpisodes(projectId),
        listCharacters(projectId),
        listScenes(projectId),
      ]);
      setProject(projectData.project);
      setEpisodes(episodeData.episodes);
      setCharacters(charData.characters);
      setScenes(sceneData.scenes);
    } catch (err) {
      console.error("Failed to load episode data:", err);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /* ---- context builder (NO scenes — story first) ---- */
  const buildEpisodeCopilotContext = useCallback(
    (mode: string, currentEpisode: Episode | null) => ({
      current_mode: mode,
      generation_mode: mode === "collection" ? "batch" : "single",
      project_summary: project
        ? {
            name: project.name,
            genre: project.genre,
            episode_count_planned: project.episodeCountPlanned,
          }
        : null,
      brief_summary: project?.brief
        ? {
            logline: project.brief.logline,
            world_rules: project.brief.worldRules,
            main_conflict: project.brief.mainConflict,
            reversal_rules: project.brief.reversalRules,
            relationship_summary: project.brief.relationshipSummary,
          }
        : null,
      existing_characters: characters.map((c: any) => ({
        name: c.name,
        role_type: c.roleType,
        identity_summary: c.identitySummary,
        personality_tags: c.personalityTags,
      })),
      current_episode: currentEpisode
        ? {
            episode_no: currentEpisode.episodeNo,
            title: currentEpisode.title,
            summary: currentEpisode.summary,
          }
        : null,
      existing_episodes: episodes.map((e) => ({
        episode_no: e.episodeNo,
        title: e.title,
        summary: e.summary,
      })),
      locked_rules: { project_id: projectId, must_follow_brief: true },
    }),
    [project, characters, episodes, projectId]
  );

  /* ---- progressive generation ---- */
  const progressive = useProgressiveGeneration({
    projectId,
    moduleType: "episode",
    userMessage: "请生成下一集分集大纲",
    buildContext: () => buildEpisodeCopilotContext("single_refine", null),
    onConfirm: async (proposal) => {
      const col = proposal as EpisodeCollectionProposal;
      const ep = col.episodes?.[0];
      if (ep) {
        await createEpisode(projectId, {
          episodeNo: episodes.length + 1,
          title: ep.title,
          summary: ep.summary,
          goal: ep.goal,
          coreConflict: ep.coreConflict,
          openingHook: ep.openingHook,
          climax: ep.climax,
          endingHook: ep.endingHook,
          sortOrder: episodes.length,
          status: "draft",
        });
        await refresh();
      }
    },
  });

  /* ---- batch generation ---- */
  const handleBatchGenerate = useCallback(async () => {
    const context = buildEpisodeCopilotContext("collection", null);
    const count = project?.episodeCountPlanned || 8;
    let collected: EpisodeProposal[] = [];

    await streamCopilot(
      {
        projectId,
        moduleType: "episode",
        intent: "generate",
        messages: [
          {
            role: "user",
            content: `请为项目生成全部 ${count} 集分集大纲`,
          },
        ],
        context,
      },
      {
        onProposal: (event) => {
          const col = event.proposal as EpisodeCollectionProposal;
          if (col?.episodes) {
            collected = col.episodes;
          }
        },
        onError: (error) => {
          console.error("Batch generation error:", error);
        },
      }
    );

    if (collected.length > 0) {
      for (const ep of collected) {
        await createEpisode(projectId, {
          episodeNo: ep.episodeNo,
          title: ep.title,
          summary: ep.summary,
          goal: ep.goal,
          coreConflict: ep.coreConflict,
          openingHook: ep.openingHook,
          climax: ep.climax,
          endingHook: ep.endingHook,
          sortOrder: ep.episodeNo,
          status: "draft",
        });
      }
      await refresh();
    }
  }, [buildEpisodeCopilotContext, project, projectId, episodes.length, refresh]);

  /* ---- edit save ---- */
  const handleSave = useCallback(async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await updateEpisode(editing.id, {
          episodeNo: editing.episodeNo,
          title: editing.title,
          summary: editing.summary,
          goal: editing.goal,
          coreConflict: editing.coreConflict,
          openingHook: editing.openingHook,
          climax: editing.climax,
          endingHook: editing.endingHook,
          sortOrder: editing.sortOrder,
          status: editing.status,
        });
      } else {
        await createEpisode(projectId, {
          episodeNo: editing.episodeNo,
          title: editing.title,
          summary: editing.summary,
          goal: editing.goal,
          coreConflict: editing.coreConflict,
          openingHook: editing.openingHook,
          climax: editing.climax,
          endingHook: editing.endingHook,
          sortOrder: editing.sortOrder,
          status: editing.status,
        });
      }
      setEditing(null);
      await refresh();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }, [editing, projectId, refresh]);

  /* ---- regenerate ---- */
  const handleRegenerate = useCallback(
    async (form: EpisodeFormState, userGoal: string) => {
      if (!form.id) return;
      const context = buildEpisodeCopilotContext("single_refine", {
        id: form.id,
        projectId,
        episodeNo: form.episodeNo,
        title: form.title,
        summary: form.summary,
        goal: form.goal,
        coreConflict: form.coreConflict,
        openingHook: form.openingHook,
        climax: form.climax,
        endingHook: form.endingHook,
        status: "draft",
        sortOrder: form.sortOrder,
        createdAt: "",
        updatedAt: "",
      });
      let result: EpisodeProposal | null = null;

      await streamCopilot(
        {
          projectId,
          moduleType: "episode",
          intent: "regenerate",
          messages: [{ role: "user", content: userGoal }],
          context,
        },
        {
          onProposal: (event) => {
            const col = event.proposal as EpisodeCollectionProposal;
            result = col?.episodes?.[0] ?? null;
          },
          onError: (error) => {
            console.error("Regenerate error:", error);
          },
        }
      );

      if (result) {
        await updateEpisode(form.id, {
          episodeNo: result.episodeNo || form.episodeNo,
          title: result.title,
          summary: result.summary,
          goal: result.goal,
          coreConflict: result.coreConflict,
          openingHook: result.openingHook,
          climax: result.climax,
          endingHook: result.endingHook,
        });
        await refresh();
      }
      setRegenerateOpen(false);
      setRegenerateInput("");
    },
    [buildEpisodeCopilotContext, projectId, refresh]
  );

  /* ---- per-episode scene generation ---- */
  const handleGenerateScenes = useCallback(
    async (episode: Episode) => {
      setGeneratingScenes(episode.id);
      try {
        let collected: any[] = [];

        await streamCopilot(
          {
            projectId,
            moduleType: "scene",
            intent: "generate",
            messages: [{ role: "user", content: "为此集生成需要的场景 preset" }],
            context: {
              current_mode: "episode_scene",
              generation_mode: "batch",
              project_summary: project
                ? { name: project.name, genre: project.genre }
                : null,
              brief_summary: project?.brief
                ? {
                    logline: project.brief.logline,
                    world_rules: project.brief.worldRules,
                    main_conflict: project.brief.mainConflict,
                  }
                : null,
              existing_characters: characters.map((c: any) => ({
                name: c.name,
                role_type: c.roleType,
              })),
              existing_scenes: scenes.map((s: any) => ({
                name: s.name,
                scene_type: s.sceneType,
                space_description: s.spaceDescription,
              })),
              current_episode: {
                episode_no: episode.episodeNo,
                title: episode.title,
                summary: episode.summary,
                goal: episode.goal,
                core_conflict: episode.coreConflict,
                opening_hook: episode.openingHook,
                climax: episode.climax,
                ending_hook: episode.endingHook,
              },
              locked_rules: { project_id: projectId, must_follow_brief: true },
            },
          },
          {
            onProposal: (event) => {
              const col = event.proposal as SceneCollectionProposal;
              if (col?.scenes) {
                collected = col.scenes;
              }
            },
            onError: (error) => {
              console.error("Scene generation error:", error);
            },
          }
        );

        if (collected.length > 0) {
          const { createScene } = await import("@/src/api");
          for (const scene of collected) {
            await createScene(projectId, scene);
          }
          await refresh();
        }
      } finally {
        setGeneratingScenes(null);
      }
    },
    [project, characters, scenes, projectId, refresh]
  );

  /* ---- delete episode ---- */
  const handleDelete = useCallback(
    async (ep: Episode) => {
      if (!confirm(`确定删除第 ${ep.episodeNo} 集「${ep.title}」？`)) return;
      await deleteEpisode(ep.id);
      await refresh();
    },
    [refresh]
  );

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  if (!project) return null;

  return (
    <div className="space-y-6">
      {/* ---- Episode List ---- */}
      <SectionCard
        title="分集大纲"
        description={`共 ${episodes.length} 集 · ${project.episodeCountPlanned ? `计划 ${project.episodeCountPlanned} 集` : "未设定集数"}`}
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleBatchGenerate()}
            >
              AI 生成分集大纲
            </Button>
            {!progressive.active ? (
              <Button size="sm" onClick={() => progressive.start()}>
                渐进式生成
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => progressive.stop()}
              >
                停止生成
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setEditing(emptyForm(episodes.length + 1))}
            >
              新增分集
            </Button>
          </div>
        }
      >
        {episodes.length === 0 && !progressive.active ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              暂无分集。点击「AI 生成分集大纲」或「渐进式生成」开始创建。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {episodes.map((ep) => (
              <div
                key={ep.id}
                className="flex items-start gap-3 rounded-md border border-line bg-panel2 p-3"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {ep.episodeNo}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-100">{ep.title || "未命名"}</h3>
                    <StatusPill value={ep.status} tone="purple" />
                  </div>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                    {ep.summary || "未填写摘要"}
                  </p>
                  {ep.coreConflict && (
                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                      <span>冲突: {ep.coreConflict.slice(0, 40)}...</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(toForm(ep))}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRegenerateTarget(toForm(ep));
                      setRegenerateOpen(true);
                    }}
                  >
                    重新生成
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleGenerateScenes(ep)}
                    disabled={generatingScenes === ep.id}
                  >
                    {generatingScenes === ep.id ? "生成中..." : "生成场景"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => void handleDelete(ep)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---- Progressive Generation Panel ---- */}
        {progressive.proposal && (
          <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4">
            <h4 className="font-medium text-sm text-primary mb-2">
              生成中 — 分集预览
            </h4>
            {progressive.loading && !progressive.proposal ? (
              <p className="text-sm text-muted-foreground">正在生成...</p>
            ) : (
              <>
                {(() => {
                  const col = progressive.proposal as EpisodeCollectionProposal;
                  const ep = col.episodes?.[0];
                  if (!ep) return null;
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">
                          第 {ep.episodeNo} 集
                        </span>
                        <span className="font-medium">{ep.title}</span>
                      </div>
                      <p className="text-gray-300">{ep.summary}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="text-gray-500">目标:</span> {ep.goal}
                        </div>
                        <div>
                          <span className="text-gray-500">冲突:</span>{" "}
                          {ep.coreConflict}
                        </div>
                        <div>
                          <span className="text-gray-500">开场:</span>{" "}
                          {ep.openingHook}
                        </div>
                        <div>
                          <span className="text-gray-500">结尾:</span>{" "}
                          {ep.endingHook}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={() => void progressive.confirmAndNext()}
                  >
                    确认并生成下一个
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => progressive.skip()}
                  >
                    跳过
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void progressive.confirmAndStop()}
                  >
                    确认并完成
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </SectionCard>

      {/* ---- Edit Dialog ---- */}
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing.id ? "编辑分集" : "新增分集"} — 第 {editing.episodeNo} 集
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>集数</Label>
                  <Input
                    type="number"
                    value={editing.episodeNo}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        episodeNo: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>标题</Label>
                  <Input
                    value={editing.title}
                    onChange={(e) =>
                      setEditing({ ...editing, title: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>剧情概要</Label>
                <Textarea
                  value={editing.summary}
                  rows={4}
                  onChange={(e) =>
                    setEditing({ ...editing, summary: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>本集目标</Label>
                <Textarea
                  value={editing.goal}
                  rows={2}
                  onChange={(e) =>
                    setEditing({ ...editing, goal: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>核心冲突</Label>
                <Textarea
                  value={editing.coreConflict}
                  rows={2}
                  onChange={(e) =>
                    setEditing({ ...editing, coreConflict: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>开场钩子</Label>
                <Textarea
                  value={editing.openingHook}
                  rows={2}
                  onChange={(e) =>
                    setEditing({ ...editing, openingHook: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>高潮时刻</Label>
                <Textarea
                  value={editing.climax}
                  rows={2}
                  onChange={(e) =>
                    setEditing({ ...editing, climax: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>结尾悬念</Label>
                <Textarea
                  value={editing.endingHook}
                  rows={2}
                  onChange={(e) =>
                    setEditing({ ...editing, endingHook: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                取消
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ---- Regenerate Dialog ---- */}
      {regenerateOpen && regenerateTarget && (
        <Dialog open onOpenChange={() => setRegenerateOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                重新生成 — 第 {regenerateTarget.episodeNo} 集「
                {regenerateTarget.title}」
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label>重新生成要求</Label>
              <Textarea
                placeholder="例如：加强冲突、改变结局走向、增加反转..."
                value={regenerateInput}
                rows={3}
                onChange={(e) => setRegenerateInput(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRegenerateOpen(false)}
              >
                取消
              </Button>
              <Button
                onClick={() =>
                  void handleRegenerate(regenerateTarget, regenerateInput)
                }
                disabled={!regenerateInput.trim()}
              >
                重新生成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}