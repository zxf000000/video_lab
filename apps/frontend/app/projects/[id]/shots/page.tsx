"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import {
  activateShotPrompt,
  createShot,
  createShotPrompt,
  deleteShot,
  generateEpisodeBatch,
  generatePromptFrame,
  generatePromptVideo,
  generateShot,
  generateShotPromptFromShot,
  getApiBase,
  getShot,
  listBatchShots,
  listShotBatches,
  listShotPrompts,
  listShots,
  retryTask,
  updateShot,
  updateShotPromptVersion,
  type GenerationTask,
  type ScreenplayScene,
  type Shot,
  type ShotBatch,
  type ShotPrompt,
} from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";
import ImagePreview from "@/src/components/project/ImagePreview";
import VideoPreview from "@/src/components/project/VideoPreview";
import { AnimatePresence, motion } from "framer-motion";

type EpisodeShots = {
  episodeId: number;
  episodeNo: number;
  title: string;
  shots: Shot[];
  tasks: GenerationTask[];
  screenplayScenes: ScreenplayScene[];
};

type ShotFormState = {
  id?: number;
  episodeId: number;
  sceneBlock: string;
  shotNo: number;
  visualGoal: string;
  characterIds: string;
  scenePresetId: string;
  shotSize: string;
  cameraAngle: string;
  composition: string;
  actionDescription: string;
  facialEmotion: string;
  cameraMotion: string;
  dialogueExcerpt: string;
  estimatedDurationMs: number;
  status: string;
};

const emptyForm = (episodeId: number, shotNo: number): ShotFormState => ({
  episodeId,
  sceneBlock: "",
  shotNo,
  visualGoal: "",
  characterIds: "",
  scenePresetId: "",
  shotSize: "",
  cameraAngle: "",
  composition: "",
  actionDescription: "",
  facialEmotion: "",
  cameraMotion: "",
  dialogueExcerpt: "",
  estimatedDurationMs: 3000,
  status: "draft",
});

function matchScreenplayScene(
  sceneBlock: string,
  scenes: ScreenplayScene[]
): ScreenplayScene | null {
  if (!sceneBlock || !scenes.length) return null;
  const m = sceneBlock.match(/\d+/);
  if (!m) return null;
  const targetNo = Number(m[0]);
  return scenes.find((s) => s.sceneNo === targetNo) ?? null;
}

function parseCsvNumbers(value: string) {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function toForm(shot: Shot): ShotFormState {
  return {
    id: shot.id,
    episodeId: shot.episodeId,
    sceneBlock: shot.sceneBlock,
    shotNo: shot.shotNo,
    visualGoal: shot.visualGoal,
    characterIds: shot.characterIds.join(", "),
    scenePresetId: shot.scenePresetId ? String(shot.scenePresetId) : "",
    shotSize: shot.shotSize,
    cameraAngle: shot.cameraAngle,
    composition: shot.composition,
    actionDescription: shot.actionDescription,
    facialEmotion: shot.facialEmotion,
    cameraMotion: shot.cameraMotion,
    dialogueExcerpt: shot.dialogueExcerpt,
    estimatedDurationMs: shot.estimatedDurationMs,
    status: shot.status,
  };
}

export default function ProjectPromptsPage() {
  const params = useParams<{ id: string }>();
  const { project, refresh } = useProjectWorkspace();
  const [episodeShots, setEpisodeShots] = useState<EpisodeShots[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingEpisode, setGeneratingEpisode] = useState<number | null>(null);
  const [generatingShot, setGeneratingShot] = useState<number | null>(null);
  const [retryingTask, setRetryingTask] = useState<number | null>(null);

  // Shot form
  const [editing, setEditing] = useState<ShotFormState | null>(null);
  const [saving, setSaving] = useState(false);

  // Batch history
  const [batchDialogEpId, setBatchDialogEpId] = useState<number | null>(null);
  const [batches, setBatches] = useState<ShotBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [viewingBatchId, setViewingBatchId] = useState<number | null>(null);
  const [batchShots, setBatchShots] = useState<Shot[]>([]);
  const [expandedSceneShotId, setExpandedSceneShotId] = useState<number | null>(null);
  const [detailShotId, setDetailShotId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<"prompt" | "edit">("edit");
  const [shotPromptCache, setShotPromptCache] = useState<Record<number, ShotPrompt[]>>({});
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  // Prompt create form
  const [firstFramePrompt, setFirstFramePrompt] = useState("");
  const [firstFrameNegative, setFirstFrameNegative] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoNegative, setVideoNegative] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [promptStatus, setPromptStatus] = useState("draft");
  // Prompt edit mode
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);
  const [editFirstFrame, setEditFirstFrame] = useState("");
  const [editFirstFrameNeg, setEditFirstFrameNeg] = useState("");
  const [editVideo, setEditVideo] = useState("");
  const [editVideoNeg, setEditVideoNeg] = useState("");
  const [editNegative, setEditNegative] = useState("");
  // AI generation
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [promptRhythmLevel, setPromptRhythmLevel] = useState("");
  const [withFirstFrame, setWithFirstFrame] = useState(false);
  // Duration / aspect ratio / quality
  const [durationSeconds, setDurationSeconds] = useState(3);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  // 抖音项目默认竖屏
  useEffect(() => {
    if (project?.targetPlatform === "抖音") {
      setAspectRatio("9:16");
    }
  }, [project?.targetPlatform]);
  const [resolution, setResolution] = useState("720p");
  // Per-prompt generation
  const [generatingFrame, setGeneratingFrame] = useState<number | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState<number | null>(null);
  // Shot detail for prompt tab
  const [detailShot, setDetailShot] = useState<Shot | null>(null);

  const projectId = Number(params.id);
  const sceneOptions = useMemo(() => project?.scenes ?? [], [project]);

  async function loadAllShots() {
    if (!project?.episodes.length) {
      setLoading(false);
      return;
    }
    try {
      const results = await Promise.all(
        project.episodes.map(async (ep) => {
          const payload = await listShots(ep.id);
          return {
            episodeId: ep.id,
            episodeNo: ep.episodeNo,
            title: ep.title,
            shots: payload.shots,
            tasks: project.tasks.filter((t) => t.episodeId === ep.id),
            screenplayScenes: ep.screenplayScenes ?? [],
          };
        })
      );
      setEpisodeShots(results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllShots();
  }, [project?.episodes.length]);

  const totalShots = useMemo(() => episodeShots.reduce((sum, e) => sum + e.shots.length, 0), [episodeShots]);

  async function handleBatchGenerate(episodeId: number) {
    setGeneratingEpisode(episodeId);
    try {
      const payload = await generateEpisodeBatch(episodeId);
      toast.success(`已提交 ${payload.tasks.length} 个生成任务`);
      await refresh();
      await loadAllShots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingEpisode(null);
    }
  }

  async function handleGenerateShot(shotId: number) {
    setGeneratingShot(shotId);
    try {
      await generateShot(shotId, {});
      toast.success("生成任务已提交");
      await refresh();
      await loadAllShots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingShot(null);
    }
  }

  async function handleRetryTask(taskId: number) {
    setRetryingTask(taskId);
    try {
      await retryTask(taskId);
      await refresh();
      await loadAllShots();
      toast.success("任务已重新排队");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRetryingTask(null);
    }
  }

  async function handleViewBatches(episodeId: number) {
    setBatchDialogEpId(episodeId);
    setLoadingBatches(true);
    try {
      const { batches: list } = await listShotBatches(episodeId);
      setBatches(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingBatches(false);
    }
  }

  async function handleViewBatchShots(batchId: number) {
    setViewingBatchId(batchId);
    try {
      const { shots } = await listBatchShots(batchId);
      setBatchShots(shots);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function openDetailDrawer(shot: Shot) {
    setEditing(toForm(shot));
    setDetailShotId(shot.id);
    setDetailTab("edit");
    const sec = shot.estimatedDurationMs > 0 ? Math.max(2, Math.min(8, Math.round(shot.estimatedDurationMs / 1000))) : 3;
    setDurationSeconds(sec);
    // Fetch shot detail for prompt tab
    getShot(shot.id).then(({ shot: s }) => setDetailShot(s)).catch(() => {});
    if (!shotPromptCache[shot.id]) {
      setLoadingPrompts(true);
      try {
        const { prompts } = await listShotPrompts(shot.id);
        setShotPromptCache((prev) => ({ ...prev, [shot.id]: prompts }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingPrompts(false);
      }
    }
  }

  function closeDetailDrawer() {
    setDetailShotId(null);
    setEditing(null);
    setDetailShot(null);
    setEditingPromptId(null);
    setFirstFramePrompt("");
    setFirstFrameNegative("");
    setVideoPrompt("");
    setVideoNegative("");
    setNegativePrompt("");
  }

  // Auto-refresh prompts when drawer is open
  useEffect(() => {
    if (!detailShotId) return;
    const timer = window.setInterval(() => {
      listShotPrompts(detailShotId).then(({ prompts }) => {
        setShotPromptCache((prev) => ({ ...prev, [detailShotId]: prompts }));
      }).catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [detailShotId]);

  async function handleDeleteShot(shot: Shot) {
    try {
      await deleteShot(shot.id);
      await loadAllShots();
      toast.success("镜头已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSaveShot() {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        sceneBlock: editing.sceneBlock,
        shotNo: editing.shotNo,
        visualGoal: editing.visualGoal,
        characterIds: parseCsvNumbers(editing.characterIds),
        scenePresetId: editing.scenePresetId ? Number(editing.scenePresetId) : null,
        shotSize: editing.shotSize,
        cameraAngle: editing.cameraAngle,
        composition: editing.composition,
        actionDescription: editing.actionDescription,
        facialEmotion: editing.facialEmotion,
        cameraMotion: editing.cameraMotion,
        dialogueExcerpt: editing.dialogueExcerpt,
        estimatedDurationMs: editing.estimatedDurationMs,
        status: editing.status,
      };
      if (editing.id) {
        await updateShot(editing.id, payload);
      } else {
        await createShot(editing.episodeId, payload);
      }
      closeDetailDrawer();
      await loadAllShots();
      toast.success("镜头已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function getModelParam<T>(prompt: ShotPrompt, key: string, fallback: T): T {
    const mp = (prompt.modelParams || {}) as Record<string, unknown>;
    const val = mp[key];
    if (val === undefined || val === null || val === "" || val === 0) return fallback;
    return val as T;
  }

  async function handleGeneratePrompt() {
    if (!detailShotId) return;
    setGeneratingPrompt(true);
    try {
      const result = await generateShotPromptFromShot(detailShotId, { rhythmLevel: promptRhythmLevel || undefined });
      setFirstFramePrompt(result.firstFramePrompt);
      setFirstFrameNegative(result.firstFrameNegativePrompt);
      setVideoPrompt(result.videoPrompt);
      setVideoNegative(result.videoNegativePrompt);
      setNegativePrompt(result.negativePrompt);
      if (result.durationSeconds) setDurationSeconds(result.durationSeconds);
      toast.success("AI 已生成 Prompt，请确认后保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingPrompt(false);
    }
  }

  async function handleCreatePrompt() {
    if (!detailShotId) return;
    try {
      await createShotPrompt(detailShotId, {
        promptText: firstFramePrompt,
        firstFramePrompt,
        firstFrameNegativePrompt: firstFrameNegative,
        videoPrompt,
        videoNegativePrompt: videoNegative,
        negativePrompt,
        modelParams: { duration_seconds: durationSeconds, aspect_ratio: aspectRatio, resolution },
        status: promptStatus,
        isActive: (shotPromptCache[detailShotId] || []).length === 0,
      });
      setFirstFramePrompt("");
      setFirstFrameNegative("");
      setVideoPrompt("");
      setVideoNegative("");
      setNegativePrompt("");
      setPromptStatus("draft");
      const { prompts } = await listShotPrompts(detailShotId);
      setShotPromptCache((prev) => ({ ...prev, [detailShotId]: prompts }));
      toast.success("Prompt 版本已创建");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleActivatePrompt(promptId: number) {
    if (!detailShotId) return;
    try {
      await activateShotPrompt(promptId);
      const { prompts } = await listShotPrompts(detailShotId);
      setShotPromptCache((prev) => ({ ...prev, [detailShotId]: prompts }));
      toast.success("Prompt 已激活");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function startEditPrompt(prompt: ShotPrompt) {
    setEditingPromptId(prompt.id);
    setEditFirstFrame(prompt.firstFramePrompt);
    setEditFirstFrameNeg(prompt.firstFrameNegativePrompt);
    setEditVideo(prompt.videoPrompt);
    setEditVideoNeg(prompt.videoNegativePrompt);
    setEditNegative(prompt.negativePrompt);
  }

  function cancelEditPrompt() {
    setEditingPromptId(null);
    setEditFirstFrame("");
    setEditFirstFrameNeg("");
    setEditVideo("");
    setEditVideoNeg("");
    setEditNegative("");
  }

  async function handleSaveEditPrompt(promptId: number) {
    if (!detailShotId) return;
    setSaving(true);
    try {
      await updateShotPromptVersion(promptId, {
        promptText: editFirstFrame,
        firstFramePrompt: editFirstFrame,
        firstFrameNegativePrompt: editFirstFrameNeg,
        videoPrompt: editVideo,
        videoNegativePrompt: editVideoNeg,
        negativePrompt: editNegative,
        modelParams: { duration_seconds: durationSeconds, aspect_ratio: aspectRatio, resolution },
      });
      cancelEditPrompt();
      const { prompts } = await listShotPrompts(detailShotId);
      setShotPromptCache((prev) => ({ ...prev, [detailShotId]: prompts }));
      toast.success("Prompt 已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateFrame(prompt: ShotPrompt) {
    setGeneratingFrame(prompt.id);
    try {
      const ar = getModelParam(prompt, "aspect_ratio", aspectRatio);
      const { task } = await generatePromptFrame(prompt.id, [], ar);
      toast.info("首帧生成任务已提交");
      if (task.status === "failed") toast.error(task.errorMessage || "首帧生成失败");
      if (detailShotId) {
        const { prompts } = await listShotPrompts(detailShotId);
        setShotPromptCache((prev) => ({ ...prev, [detailShotId]: prompts }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingFrame(null);
    }
  }

  async function handleGenerateVideo(prompt: ShotPrompt) {
    setGeneratingVideo(prompt.id);
    try {
      const ar = getModelParam(prompt, "aspect_ratio", aspectRatio);
      const dur = getModelParam(prompt, "duration_seconds", durationSeconds);
      const res = getModelParam(prompt, "resolution", resolution);
      const { task } = await generatePromptVideo(prompt.id, { withFirstFrame, aspectRatio: ar, duration: dur, resolution: res });
      toast.info("视频生成任务已提交");
      if (task.status === "failed") toast.error(task.errorMessage || "视频生成失败");
      if (detailShotId) {
        const { prompts } = await listShotPrompts(detailShotId);
        setShotPromptCache((prev) => ({ ...prev, [detailShotId]: prompts }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingVideo(null);
    }
  }

  if (!project) return null;

  function getLatestTaskStatus(shotId: number, tasks: GenerationTask[]) {
    const shotTasks = tasks.filter((t) => t.shotId === shotId);
    return shotTasks.length ? shotTasks[0] : null;
  }

  return (
    <SectionCard
      title="镜头管理"
      description={`按分集分组管理所有镜头、Prompt 和生成任务。共 ${episodeShots.length} 集，${totalShots} 个镜头。`}
    >
      {loading ? (
        <div className="text-sm text-gray-500">镜头加载中...</div>
      ) : episodeShots.length && totalShots > 0 ? (
        <div className="grid gap-5">
          {episodeShots.map((ep) => (
            <div key={ep.episodeId} className="rounded-lg border border-line bg-panel2/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-100">
                    第 {ep.episodeNo} 集 · {ep.title || "未命名"}
                  </h3>
                  <span className="text-xs text-gray-500">{ep.shots.length} 个镜头</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={generatingEpisode === ep.episodeId || !ep.shots.length}
                    onClick={() => handleBatchGenerate(ep.episodeId)}
                  >
                    {generatingEpisode === ep.episodeId ? "提交中..." : "批量生成"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setEditing(emptyForm(ep.episodeId, ep.shots.length + 1))}
                  >
                    新增镜头
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleViewBatches(ep.episodeId)}
                  >
                    历史版本
                  </Button>
                </div>
              </div>

              {viewingBatchId ? (
                <div className="mb-3 flex items-center gap-2 rounded-md bg-mint/10 border border-mint/30 px-3 py-1.5">
                  <span className="text-xs text-mint">
                    正在查看版本 #{batches.find((b) => b.id === viewingBatchId)?.versionNo ?? "?"}
                  </span>
                  <button
                    className="text-xs text-mint/70 underline hover:text-mint"
                    onClick={() => { setViewingBatchId(null); setBatchShots([]); }}
                  >
                    返回当前版本
                  </button>
                </div>
              ) : null}

              {ep.shots.length ? (
                <div className="grid gap-2">
                  {(viewingBatchId ? batchShots : ep.shots).map((shot) => {
                    const latestTask = getLatestTaskStatus(shot.id, ep.tasks);
                    const apiBase = getApiBase();
                    const imageUrl = shot.firstFrameUrl
                      ? (shot.firstFrameUrl.startsWith("http") ? shot.firstFrameUrl : `${apiBase}/assets/${shot.firstFrameUrl}`)
                      : null;
                    const videoUrl = shot.videoUrl
                      ? (shot.videoUrl.startsWith("http") ? shot.videoUrl : `${apiBase}/assets/${shot.videoUrl}`)
                      : null;
                    return (
                      <div key={shot.id}>
                        <div className="flex items-center gap-3 rounded-md border border-line/50 bg-panel px-4 py-3">
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-[120px] h-[68px] rounded-md bg-panel2 border border-line/50 overflow-hidden flex-shrink-0">
                            {imageUrl ? (
                              <ImagePreview src={imageUrl} alt={`Shot ${shot.shotNo}`} className="w-full h-full" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600">无首帧</div>
                            )}
                          </div>
                          <div className="w-[120px] h-[68px] rounded-md bg-panel2 border border-line/50 overflow-hidden flex-shrink-0">
                            {videoUrl ? (
                              <VideoPreview
                                src={videoUrl}
                                poster={imageUrl ?? undefined}
                                className="w-full h-full"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600">无视频</div>
                            )}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-200">Shot {shot.shotNo}</span>
                            <StatusPill value={shot.status} tone="purple" />
                            {latestTask ? (
                              <StatusPill
                                value={latestTask.status}
                                tone={
                                  latestTask.status === "succeeded"
                                    ? "green"
                                    : latestTask.status === "failed"
                                    ? "amber"
                                    : "blue"
                                }
                              />
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-gray-400 line-clamp-1">
                            {shot.visualGoal || shot.sceneBlock || "未填写"}
                          </p>
                          {matchScreenplayScene(shot.sceneBlock, ep.screenplayScenes) ? (
                            <div className="mt-1">
                              <button
                                className="text-[10px] text-gray-500 hover:text-mint transition"
                                onClick={() =>
                                  setExpandedSceneShotId(
                                    expandedSceneShotId === shot.id ? null : shot.id
                                  )
                                }
                              >
                                {expandedSceneShotId === shot.id ? "收起剧本" : "查看剧本"}
                              </button>
                              {expandedSceneShotId === shot.id ? (
                                <div className="mt-1 rounded-md bg-panel2/70 border border-line/30 px-3 py-2 max-h-32 overflow-y-auto">
                                  <p className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap">
                                    {matchScreenplayScene(shot.sceneBlock, ep.screenplayScenes)?.content || "无剧本内容"}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {latestTask?.errorMessage ? (
                            <p className="mt-1 text-xs text-red-400 line-clamp-1">{latestTask.errorMessage}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {!viewingBatchId ? (
                            <>
                              <Link
                                href={`/projects/${projectId}/shots/${shot.id}`}
                                className="inline-flex items-center justify-center h-7 px-2.5 text-[11px] rounded-md border border-line/60 bg-panel2/80 text-gray-300 hover:bg-panel2 hover:text-mint transition"
                              >
                                详情
                              </Link>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-7 px-2.5 text-[11px]"
                                disabled={generatingShot === shot.id}
                                onClick={() => handleGenerateShot(shot.id)}
                              >
                                {generatingShot === shot.id ? "提交中" : "生成"}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 px-2.5 text-[11px]"
                                onClick={() => handleDeleteShot(shot)}
                              >
                                删除
                              </Button>
                              {latestTask?.status === "failed" ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 px-2.5 text-[11px]"
                                  disabled={retryingTask === latestTask.id}
                                  onClick={() => handleRetryTask(latestTask.id)}
                                >
                                  {retryingTask === latestTask.id ? "重试中" : "重试"}
                                </Button>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-xs text-gray-600">历史版本（只读）</span>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500">该分集暂无镜头。</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="还没有镜头"
          description="先在分集页面生成大纲，再回到这里创建和管理镜头。"
        />
      )}

      <AnimatePresence>
        {editing !== null && (
          <motion.div
            key={detailShotId ?? "new-shot"}
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeDetailDrawer}
            />
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-[min(52rem,100vw)] bg-panel border-l border-line flex flex-col shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
            <div className="flex items-center justify-between border-b border-line px-6 py-4 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-100">
                  {editing.id ? `Shot ${editing.shotNo}` : "新增镜头"}
                </h2>
                {editing.id && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {editing.sceneBlock}{editing.visualGoal ? ` · ${editing.visualGoal.slice(0, 60)}` : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="secondary" size="sm" onClick={closeDetailDrawer}>
                  关闭
                </Button>
              </div>
            </div>

            {editing.id && detailShotId ? (
              <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "prompt" | "edit")} className="flex flex-col min-h-0 flex-1">
                <div className="border-b border-line px-6">
                  <TabsList>
                    <TabsTrigger value="edit">编辑</TabsTrigger>
                    <TabsTrigger value="prompt">Prompt</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="edit" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">镜头号</Label>
                      <Input type="number" value={String(editing.shotNo)} onChange={(e) => setEditing((prev) => prev ? { ...prev, shotNo: Number(e.target.value || 1) } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">状态</Label>
                      <Input value={editing.status} onChange={(e) => setEditing((prev) => prev ? { ...prev, status: e.target.value } : prev)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-2 block text-xs text-gray-500">场次块</Label>
                      <Input value={editing.sceneBlock} onChange={(e) => setEditing((prev) => prev ? { ...prev, sceneBlock: e.target.value } : prev)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-2 block text-xs text-gray-500">镜头目标</Label>
                      <Textarea value={editing.visualGoal} onChange={(e) => setEditing((prev) => prev ? { ...prev, visualGoal: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">角色 ID 列表</Label>
                      <Input value={editing.characterIds} onChange={(e) => setEditing((prev) => prev ? { ...prev, characterIds: e.target.value } : prev)} placeholder="1, 2" />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">场景模板</Label>
                      <select
                        className="w-full rounded-xl border border-line bg-panel2 px-4 py-3 text-sm"
                        value={editing.scenePresetId}
                        onChange={(e) => setEditing((prev) => prev ? { ...prev, scenePresetId: e.target.value } : prev)}
                      >
                        <option value="">未绑定</option>
                        {sceneOptions.map((scene) => (
                          <option key={scene.id} value={scene.id}>{scene.name}</option>
                        ))}
                      </select>
                    </div>
                    <div><Label className="mb-2 block text-xs text-gray-500">景别</Label><Input value={editing.shotSize} onChange={(e) => setEditing((prev) => prev ? { ...prev, shotSize: e.target.value } : prev)} /></div>
                    <div><Label className="mb-2 block text-xs text-gray-500">角度</Label><Input value={editing.cameraAngle} onChange={(e) => setEditing((prev) => prev ? { ...prev, cameraAngle: e.target.value } : prev)} /></div>
                    <div><Label className="mb-2 block text-xs text-gray-500">运镜</Label><Input value={editing.cameraMotion} onChange={(e) => setEditing((prev) => prev ? { ...prev, cameraMotion: e.target.value } : prev)} /></div>
                    <div><Label className="mb-2 block text-xs text-gray-500">构图</Label><Input value={editing.composition} onChange={(e) => setEditing((prev) => prev ? { ...prev, composition: e.target.value } : prev)} /></div>
                    <div><Label className="mb-2 block text-xs text-gray-500">镜头时长(ms)</Label><Input type="number" value={String(editing.estimatedDurationMs)} onChange={(e) => setEditing((prev) => prev ? { ...prev, estimatedDurationMs: Number(e.target.value || 0) } : prev)} /></div>
                    <div className="md:col-span-2"><Label className="mb-2 block text-xs text-gray-500">动作描述</Label><Textarea value={editing.actionDescription} onChange={(e) => setEditing((prev) => prev ? { ...prev, actionDescription: e.target.value } : prev)} /></div>
                    <div><Label className="mb-2 block text-xs text-gray-500">表情 / 情绪</Label><Input value={editing.facialEmotion} onChange={(e) => setEditing((prev) => prev ? { ...prev, facialEmotion: e.target.value } : prev)} /></div>
                    <div className="md:col-span-2"><Label className="mb-2 block text-xs text-gray-500">对白摘要</Label><Textarea value={editing.dialogueExcerpt} onChange={(e) => setEditing((prev) => prev ? { ...prev, dialogueExcerpt: e.target.value } : prev)} /></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <Button variant="secondary" onClick={closeDetailDrawer} disabled={saving}>取消</Button>
                    <Button onClick={handleSaveShot} disabled={saving}>{saving ? "保存中..." : "保存镜头"}</Button>
                  </div>
                </TabsContent>
                <TabsContent value="prompt" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                  <div className="grid gap-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-500">填写或使用 AI 自动填充提示词</span>
                      <select
                        className="h-7 rounded border border-input bg-background px-1.5 text-[11px]"
                        value={promptRhythmLevel}
                        onChange={(e) => setPromptRhythmLevel(e.target.value)}
                      >
                        <option value="">默认</option>
                        <option value="fast">快节奏</option>
                        <option value="ultra_fast">极快</option>
                        <option value="frenzy">癫狂</option>
                      </select>
                      <Button variant="secondary" size="sm" onClick={handleGeneratePrompt} disabled={generatingPrompt}>
                        {generatingPrompt ? "AI 生成中..." : "AI 生成 Prompt"}
                      </Button>
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">首帧图片提示词 (First Frame Prompt)</Label>
                      <Textarea size="1" className="min-h-[96px] text-xs leading-5" value={firstFramePrompt} onChange={(e) => setFirstFramePrompt(e.target.value)} placeholder="描述镜头第一帧的静态画面，包含场景环境、角色外观、光线氛围..." />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">首帧负向提示词 (First Frame Negative)</Label>
                      <Textarea size="1" className="min-h-[52px] text-xs leading-5" value={firstFrameNegative} onChange={(e) => setFirstFrameNegative(e.target.value)} placeholder="blurry, low quality, deformed face, extra limbs..." />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">视频提示词 (Video Prompt)</Label>
                      <Textarea size="1" className="min-h-[84px] text-xs leading-5" value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} placeholder="描述从首帧生成视频的运镜方式、人物动作、画面变化..." />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">视频负向提示词 (Video Negative)</Label>
                      <Textarea size="1" className="min-h-[52px] text-xs leading-5" value={videoNegative} onChange={(e) => setVideoNegative(e.target.value)} placeholder="flickering, jittering, artifacts, distortion..." />
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">通用 Negative Prompt</Label>
                        <Textarea size="1" className="min-h-[52px] text-xs leading-5" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-gray-500">状态</Label>
                        <Input value={promptStatus} onChange={(e) => setPromptStatus(e.target.value)} />
                      </div>
                    </div>
                    <div className="pt-4 border-t border-line/60">
                      <p className="mb-3 text-[11px] text-gray-500">生成参数 <span className="text-gray-600">— 保存到 Prompt 版本，用于首帧/视频生成</span></p>
                      <div className="grid gap-5 md:grid-cols-3">
                        <div>
                          <Label className="mb-2 block text-xs text-gray-500">镜头时长(秒)</Label>
                          <Input type="number" min={2} max={8} value={durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} />
                        </div>
                        <div>
                          <Label className="mb-2 block text-xs text-gray-500">画面比例</Label>
                          <select className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-gray-100" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                            <option value="16:9">16:9 (横屏)</option>
                            <option value="9:16">9:16 (竖屏)</option>
                            <option value="1:1">1:1 (方形)</option>
                            <option value="4:3">4:3</option>
                            <option value="3:4">3:4</option>
                          </select>
                        </div>
                        <div>
                          <Label className="mb-2 block text-xs text-gray-500">画质</Label>
                          <select className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-gray-100" value={resolution} onChange={(e) => setResolution(e.target.value)}>
                            <option value="480p">480p</option>
                            <option value="720p">720p</option>
                            <option value="1080p">1080p</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleCreatePrompt} disabled={!firstFramePrompt.trim()}>
                        新建 Prompt 版本
                      </Button>
                    </div>

                    {/* Version list */}
                    <div className="pt-4 border-t border-line">
                      <div className="flex items-center gap-4 mb-3">
                        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
                          <input type="checkbox" checked={withFirstFrame} onChange={(e) => setWithFirstFrame(e.target.checked)} className="rounded" />
                          视频引用首帧
                        </label>
                      </div>
                      {loadingPrompts ? (
                        <p className="text-sm text-gray-500">Prompt 加载中...</p>
                      ) : (() => {
                        const prompts = shotPromptCache[detailShotId];
                        if (!prompts?.length) return <p className="text-sm text-gray-500">暂无 Prompt 版本，请先创建。</p>;
                        return (
                          <div className="grid gap-3">
                            {prompts.map((prompt) => {
                              const isEditing = editingPromptId === prompt.id;
                              const apiBase = getApiBase();
                              return (
                                <div key={prompt.id} className="rounded-lg border border-line bg-panel2 px-4 py-3">
                                  {isEditing ? (
                                    <div className="grid gap-3">
                                      <div>
                                        <Label className="mb-1 block text-xs text-gray-500">首帧图片提示词</Label>
                                        <Textarea size="1" className="min-h-[96px] text-xs leading-5" value={editFirstFrame} onChange={(e) => setEditFirstFrame(e.target.value)} />
                                      </div>
                                      <div>
                                        <Label className="mb-1 block text-xs text-gray-500">首帧负向提示词</Label>
                                        <Textarea size="1" className="min-h-[52px] text-xs leading-5" value={editFirstFrameNeg} onChange={(e) => setEditFirstFrameNeg(e.target.value)} />
                                      </div>
                                      <div>
                                        <Label className="mb-1 block text-xs text-gray-500">视频提示词</Label>
                                        <Textarea size="1" className="min-h-[84px] text-xs leading-5" value={editVideo} onChange={(e) => setEditVideo(e.target.value)} />
                                      </div>
                                      <div>
                                        <Label className="mb-1 block text-xs text-gray-500">视频负向提示词</Label>
                                        <Textarea size="1" className="min-h-[52px] text-xs leading-5" value={editVideoNeg} onChange={(e) => setEditVideoNeg(e.target.value)} />
                                      </div>
                                      <div>
                                        <Label className="mb-1 block text-xs text-gray-500">通用 Negative Prompt</Label>
                                        <Textarea size="1" className="min-h-[52px] text-xs leading-5" value={editNegative} onChange={(e) => setEditNegative(e.target.value)} />
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <Button variant="secondary" size="sm" onClick={cancelEditPrompt} disabled={saving}>取消</Button>
                                        <Button size="sm" onClick={() => handleSaveEditPrompt(prompt.id)} disabled={saving || !editFirstFrame.trim()}>{saving ? "保存中..." : "保存"}</Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="flex gap-4">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-semibold text-gray-100">Version {prompt.versionNo}</h3>
                                            <StatusPill value={prompt.status} tone="purple" />
                                            {prompt.isActive ? <StatusPill value="active" tone="green" /> : null}
                                            {prompt.firstFrameStatus ? <StatusPill value={`首帧:${prompt.firstFrameStatus}`} tone={prompt.firstFrameStatus === "succeeded" ? "green" : prompt.firstFrameStatus === "failed" ? "amber" : "blue"} /> : null}
                                            {prompt.videoStatus ? <StatusPill value={`视频:${prompt.videoStatus}`} tone={prompt.videoStatus === "succeeded" ? "green" : prompt.videoStatus === "failed" ? "amber" : "blue"} /> : null}
                                          </div>
                                          {(() => {
                                            const mp = prompt.modelParams || {};
                                            const dur = mp.duration_seconds as number | undefined;
                                            const ar = mp.aspect_ratio as string | undefined;
                                            const res = mp.resolution as string | undefined;
                                            if (!dur && !ar && !res) return null;
                                            const parts = [];
                                            if (dur) parts.push(`${dur}s`);
                                            if (ar) parts.push(ar);
                                            if (res) parts.push(res);
                                            return <p className="mt-1.5 text-[11px] text-gray-500">生成参数: {parts.join(" · ")}</p>;
                                          })()}
                                          {prompt.firstFramePrompt ? (
                                            <div className="mt-2">
                                              <span className="text-[11px] font-medium text-gray-500">首帧图片</span>
                                              <p className="mt-1 text-xs leading-5 text-gray-400 whitespace-pre-wrap line-clamp-6">{prompt.firstFramePrompt}</p>
                                            </div>
                                          ) : null}
                                          {prompt.videoPrompt ? (
                                            <div className="mt-2">
                                              <span className="text-[11px] font-medium text-gray-500">视频</span>
                                              <p className="mt-1 text-xs leading-5 text-gray-400 whitespace-pre-wrap line-clamp-6">{prompt.videoPrompt}</p>
                                            </div>
                                          ) : null}
                                        </div>
                                        <div className="flex flex-col gap-2 shrink-0 w-[160px]">
                                          {prompt.firstFrameUrl ? (
                                            <ImagePreview
                                              src={prompt.firstFrameUrl.startsWith("http") ? prompt.firstFrameUrl : `${apiBase}/assets/${prompt.firstFrameUrl}`}
                                              alt="首帧预览"
                                              className="w-full aspect-video rounded-md border border-line/50 overflow-hidden"
                                            />
                                          ) : (
                                            <div className="w-full aspect-video rounded-md border border-line/50 bg-panel flex items-center justify-center">
                                              <span className="text-[10px] text-gray-500">暂无首帧</span>
                                            </div>
                                          )}
                                          {prompt.videoUrl && prompt.videoStatus === "succeeded" ? (
                                            <VideoPreview
                                              src={prompt.videoUrl.startsWith("http") ? prompt.videoUrl : `${apiBase}/assets/${prompt.videoUrl}`}
                                              poster={prompt.firstFrameUrl ? (prompt.firstFrameUrl.startsWith("http") ? prompt.firstFrameUrl : `${apiBase}/assets/${prompt.firstFrameUrl}`) : undefined}
                                              className="w-full aspect-video rounded-md border border-line/50 overflow-hidden"
                                            />
                                          ) : (
                                            <div className="w-full aspect-video rounded-md border border-line/50 bg-panel flex items-center justify-center">
                                              <span className="text-[10px] text-gray-500">暂无视频</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 mt-3">
                                        {!prompt.isActive ? (
                                          <Button variant="secondary" size="sm" onClick={() => handleActivatePrompt(prompt.id)}>激活</Button>
                                        ) : null}
                                        <Button variant="secondary" size="sm" onClick={() => startEditPrompt(prompt)}>编辑</Button>
                                        <Button
                                          size="sm"
                                          disabled={generatingFrame === prompt.id || prompt.firstFrameStatus === "queued" || prompt.firstFrameStatus === "generating" || !prompt.isActive}
                                          onClick={() => handleGenerateFrame(prompt)}
                                        >
                                          {generatingFrame === prompt.id || prompt.firstFrameStatus === "queued" ? "排队中..." : prompt.firstFrameStatus === "generating" ? "生成中..." : "生成首帧"}
                                        </Button>
                                        <Button
                                          size="sm"
                                          disabled={generatingVideo === prompt.id || prompt.videoStatus === "queued" || prompt.videoStatus === "generating" || prompt.videoStatus === "downloading" || !prompt.isActive}
                                          onClick={() => handleGenerateVideo(prompt)}
                                        >
                                          {generatingVideo === prompt.id || prompt.videoStatus === "queued" ? "排队中..." : prompt.videoStatus === "downloading" ? "下载中..." : prompt.videoStatus === "generating" ? "生成中..." : "生成视频"}
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">镜头号</Label>
                      <Input type="number" value={String(editing.shotNo)} onChange={(e) => setEditing((prev) => prev ? { ...prev, shotNo: Number(e.target.value || 1) } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">状态</Label>
                      <Input value={editing.status} onChange={(e) => setEditing((prev) => prev ? { ...prev, status: e.target.value } : prev)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-2 block text-xs text-gray-500">场次块</Label>
                      <Input value={editing.sceneBlock} onChange={(e) => setEditing((prev) => prev ? { ...prev, sceneBlock: e.target.value } : prev)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-2 block text-xs text-gray-500">镜头目标</Label>
                      <Textarea value={editing.visualGoal} onChange={(e) => setEditing((prev) => prev ? { ...prev, visualGoal: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">角色 ID 列表</Label>
                      <Input value={editing.characterIds} onChange={(e) => setEditing((prev) => prev ? { ...prev, characterIds: e.target.value } : prev)} placeholder="1, 2" />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-gray-500">场景模板</Label>
                      <select
                        className="w-full rounded-xl border border-line bg-panel2 px-4 py-3 text-sm"
                        value={editing.scenePresetId}
                        onChange={(e) => setEditing((prev) => prev ? { ...prev, scenePresetId: e.target.value } : prev)}
                      >
                        <option value="">未绑定</option>
                        {sceneOptions.map((scene) => (
                          <option key={scene.id} value={scene.id}>{scene.name}</option>
                        ))}
                      </select>
                    </div>
                    <div><Label className="mb-2 block text-xs text-gray-500">景别</Label><Input value={editing.shotSize} onChange={(e) => setEditing((prev) => prev ? { ...prev, shotSize: e.target.value } : prev)} /></div>
                    <div><Label className="mb-2 block text-xs text-gray-500">角度</Label><Input value={editing.cameraAngle} onChange={(e) => setEditing((prev) => prev ? { ...prev, cameraAngle: e.target.value } : prev)} /></div>
                    <div><Label className="mb-2 block text-xs text-gray-500">运镜</Label><Input value={editing.cameraMotion} onChange={(e) => setEditing((prev) => prev ? { ...prev, cameraMotion: e.target.value } : prev)} /></div>
                    <div><Label className="mb-2 block text-xs text-gray-500">构图</Label><Input value={editing.composition} onChange={(e) => setEditing((prev) => prev ? { ...prev, composition: e.target.value } : prev)} /></div>
                    <div><Label className="mb-2 block text-xs text-gray-500">镜头时长(ms)</Label><Input type="number" value={String(editing.estimatedDurationMs)} onChange={(e) => setEditing((prev) => prev ? { ...prev, estimatedDurationMs: Number(e.target.value || 0) } : prev)} /></div>
                    <div className="md:col-span-2"><Label className="mb-2 block text-xs text-gray-500">动作描述</Label><Textarea value={editing.actionDescription} onChange={(e) => setEditing((prev) => prev ? { ...prev, actionDescription: e.target.value } : prev)} /></div>
                    <div><Label className="mb-2 block text-xs text-gray-500">表情 / 情绪</Label><Input value={editing.facialEmotion} onChange={(e) => setEditing((prev) => prev ? { ...prev, facialEmotion: e.target.value } : prev)} /></div>
                    <div className="md:col-span-2"><Label className="mb-2 block text-xs text-gray-500">对白摘要</Label><Textarea value={editing.dialogueExcerpt} onChange={(e) => setEditing((prev) => prev ? { ...prev, dialogueExcerpt: e.target.value } : prev)} /></div>
                  </div>
                </div>
                <div className="shrink-0 border-t border-line bg-panel2/60 px-6 py-3 flex justify-end gap-2">
                  <Button variant="secondary" onClick={closeDetailDrawer} disabled={saving}>取消</Button>
                  <Button onClick={handleSaveShot} disabled={saving}>{saving ? "保存中..." : "保存镜头"}</Button>
                </div>
              </>
            )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={batchDialogEpId !== null} onOpenChange={(open) => !open && setBatchDialogEpId(null)}>
        <DialogContent className="max-w-lg bg-panel p-0">
          <DialogHeader className="border-b border-line px-5 py-4">
            <DialogTitle>镜头历史版本</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loadingBatches ? (
              <p className="text-sm text-gray-500">加载中...</p>
            ) : batches.length === 0 ? (
              <p className="text-sm text-gray-500">暂无历史版本</p>
            ) : (
              <div className="grid gap-2">
                {batches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between rounded-md border border-line/50 bg-panel2/50 px-4 py-3"
                  >
                    <div>
                      <span className="text-sm font-semibold text-gray-200">
                        版本 #{batch.versionNo}
                      </span>
                      <span className="ml-3 text-xs text-gray-500">
                        {new Date(batch.createdAt).toLocaleString("zh-CN")}
                      </span>
                      <span className="ml-3 text-xs text-gray-500">
                        {batch.shotCount} 个镜头
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setBatchDialogEpId(null);
                        handleViewBatchShots(batch.id);
                      }}
                    >
                      查看
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t border-line bg-panel2/60 px-5 py-3">
            <Button variant="secondary" onClick={() => setBatchDialogEpId(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
