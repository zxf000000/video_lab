"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import {
  createShot,
  deleteShot,
  generateEpisodeBatch,
  generateShot,
  getApiBase,
  listBatchShots,
  listShotBatches,
  listShots,
  retryTask,
  updateShot,
  type GenerationTask,
  type ScreenplayScene,
  type Shot,
  type ShotBatch,
} from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import ImagePreview from "@/src/components/project/ImagePreview";
import VideoPreview from "@/src/components/project/VideoPreview";

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
      setEditing(null);
      await loadAllShots();
      toast.success("镜头已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
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
                      <div key={shot.id} className="flex items-center gap-3 rounded-md border border-line/50 bg-panel px-4 py-3">
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
                              <a
                                href={`/projects/${projectId}/shots/${shot.id}/prompts`}
                                className="inline-flex rounded-lg border border-line bg-panel2 px-2.5 py-1 text-[11px] font-medium text-gray-400 transition hover:border-mint hover:text-mint"
                              >
                                Prompt
                              </a>
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
                                variant="secondary"
                                size="sm"
                                className="h-7 px-2.5 text-[11px]"
                                onClick={() => setEditing(toForm(shot))}
                              >
                                编辑
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

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-4xl bg-panel p-0">
          <DialogHeader className="border-b border-line px-5 py-4">
            <DialogTitle>{editing?.id ? "编辑镜头" : "新增镜头"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
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
              <DialogFooter className="shrink-0 border-t border-line bg-panel2/60 px-5 py-3">
                <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                  取消
                </Button>
                <Button onClick={handleSaveShot} disabled={saving}>
                  {saving ? "保存中..." : "保存镜头"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

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
