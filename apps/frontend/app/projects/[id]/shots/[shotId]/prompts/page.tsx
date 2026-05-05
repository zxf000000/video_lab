"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import ImagePreview from "@/src/components/project/ImagePreview";
import {
  activateShotPrompt,
  createShotPrompt,
  generatePromptFrame,
  generatePromptVideo,
  generateShotPromptFromShot,
  getApiBase,
  getShot,
  getTask,
  listShotPrompts,
  retryTask,
  type GenerationTask,
  type Shot,
  type ShotPrompt,
  updateShotPromptVersion,
} from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

export default function ShotPromptsPage() {
  const params = useParams<{ shotId: string; id: string }>();
  const { project } = useProjectWorkspace();
  const [shot, setShot] = useState<Shot | null>(null);
  const [prompts, setPrompts] = useState<ShotPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [firstFramePrompt, setFirstFramePrompt] = useState("");
  const [firstFrameNegative, setFirstFrameNegative] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoNegative, setVideoNegative] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [status, setStatus] = useState("draft");

  // Edit mode
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFirstFrame, setEditFirstFrame] = useState("");
  const [editFirstFrameNeg, setEditFirstFrameNeg] = useState("");
  const [editVideo, setEditVideo] = useState("");
  const [editVideoNeg, setEditVideoNeg] = useState("");
  const [editNegative, setEditNegative] = useState("");
  const [saving, setSaving] = useState(false);

  // AI generation
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [withFirstFrame, setWithFirstFrame] = useState(false);

  // Generate
  const [generatingFrame, setGeneratingFrame] = useState<number | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState<number | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);

  const shotId = Number(params.shotId);

  async function refresh() {
    try {
      const [shotPayload, promptsPayload] = await Promise.all([getShot(shotId), listShotPrompts(shotId)]);
      setShot(shotPayload.shot);
      setPrompts(promptsPayload.prompts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [shotId]);

  if (!project) return null;

  const episodeTasks = project.tasks.filter((t) => t.shotId === shotId);

  async function handleGeneratePrompt() {
    setGeneratingPrompt(true);
    try {
      const result = await generateShotPromptFromShot(shotId, { withFirstFrame });
      setFirstFramePrompt(result.firstFramePrompt);
      setFirstFrameNegative(result.firstFrameNegativePrompt);
      setVideoPrompt(result.videoPrompt);
      setVideoNegative(result.videoNegativePrompt);
      setNegativePrompt(result.negativePrompt);
      toast.success("AI 已生成 Prompt，请确认后保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingPrompt(false);
    }
  }

  async function handleCreatePrompt() {
    try {
      await createShotPrompt(shotId, {
        promptText: firstFramePrompt,
        firstFramePrompt,
        firstFrameNegativePrompt: firstFrameNegative,
        videoPrompt,
        videoNegativePrompt: videoNegative,
        negativePrompt,
        status,
        isActive: prompts.length === 0,
      });
      setFirstFramePrompt("");
      setFirstFrameNegative("");
      setVideoPrompt("");
      setVideoNegative("");
      setNegativePrompt("");
      setStatus("draft");
      await refresh();
      toast.success("Prompt 版本已创建");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleActivate(promptId: number) {
    try {
      await activateShotPrompt(promptId);
      await refresh();
      toast.success("Prompt 已激活");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function startEdit(prompt: ShotPrompt) {
    setEditingId(prompt.id);
    setEditFirstFrame(prompt.firstFramePrompt);
    setEditFirstFrameNeg(prompt.firstFrameNegativePrompt);
    setEditVideo(prompt.videoPrompt);
    setEditVideoNeg(prompt.videoNegativePrompt);
    setEditNegative(prompt.negativePrompt);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFirstFrame("");
    setEditFirstFrameNeg("");
    setEditVideo("");
    setEditVideoNeg("");
    setEditNegative("");
  }

  async function handleSaveEdit(promptId: number) {
    setSaving(true);
    try {
      await updateShotPromptVersion(promptId, {
        promptText: editFirstFrame,
        firstFramePrompt: editFirstFrame,
        firstFrameNegativePrompt: editFirstFrameNeg,
        videoPrompt: editVideo,
        videoNegativePrompt: editVideoNeg,
        negativePrompt: editNegative,
      });
      cancelEdit();
      await refresh();
      toast.success("Prompt 已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateFrame(prompt: ShotPrompt) {
    if (!project) return;
    setGeneratingFrame(prompt.id);
    try {
      const assetIds = (prompt.referenceAssetIds ?? []) as number[];
      const apiBase = getApiBase();
      const refImages: string[] = [];
      for (const id of assetIds) {
        const char = project.characters.find((c) => c.id === id);
        if (char?.imagePath) {
          refImages.push(`${apiBase}/assets/${char.imagePath}`);
          continue;
        }
        const scene = project.scenes.find((s) => s.id === id);
        if (scene) {
          const sceneImage = (scene.variants as { imagePath?: string }[] | undefined)
            ?.find((v) => v.imagePath)?.imagePath;
          if (sceneImage) refImages.push(`${apiBase}/assets/${sceneImage}`);
        }
      }
      const { task } = await generatePromptFrame(prompt.id, refImages);
      toast.info("首帧生成任务已提交");
      // Poll until complete
      let currentTask = task;
      while (currentTask.status !== "succeeded" && currentTask.status !== "failed") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const { task: updated } = await getTask(currentTask.id);
        currentTask = updated;
      }
      if (currentTask.status === "failed") {
        toast.error(currentTask.errorMessage || "首帧生成失败");
      } else {
        toast.success("首帧生成完成");
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingFrame(null);
    }
  }

  async function handleGenerateVideo(prompt: ShotPrompt) {
    if (!project) return;
    setGeneratingVideo(prompt.id);
    try {
      const { task } = await generatePromptVideo(prompt.id, { withFirstFrame });
      toast.info("视频生成任务已提交");
      let currentTask = task;
      while (currentTask.status !== "succeeded" && currentTask.status !== "failed") {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const { task: updated } = await getTask(currentTask.id);
        currentTask = updated;
      }
      if (currentTask.status === "failed") {
        toast.error(currentTask.errorMessage || "视频生成失败");
      } else {
        toast.success("视频生成完成");
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingVideo(null);
    }
  }

  function getLatestTask(): GenerationTask | undefined {
    return episodeTasks[0];
  }

  async function handleRetryTask(taskId: number) {
    setRetrying(taskId);
    try {
      await retryTask(taskId);
      await refresh();
      toast.success("任务已重新排队");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(null);
    }
  }

  const latestTask = getLatestTask();

  return (
    <div className="grid gap-4">
      {/* 面包屑导航 */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href={`/projects/${project.id}`} className="transition hover:text-gray-300">
          {project.name}
        </Link>
        <span className="text-gray-600">/</span>
        <Link href={`/projects/${project.id}/shots`} className="transition hover:text-gray-300">
          镜头列表
        </Link>
        {shot ? (
          <>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">Shot {shot.shotNo} Prompt</span>
          </>
        ) : null}
      </nav>

      <div className="grid gap-5">
      <SectionCard title={shot ? `Shot ${shot.shotNo} Prompt` : "Prompt"} description="Prompt 版本是镜头生成的正式输入，激活后才会被任务读取。">
        <div className="grid gap-5">
          <div>
            <Label className="mb-2 block text-xs text-gray-500">首帧图片提示词 (First Frame Prompt)</Label>
            <Textarea className="min-h-[120px]" value={firstFramePrompt} onChange={(e) => setFirstFramePrompt(e.target.value)} placeholder="描述镜头第一帧的静态画面，包含场景环境、角色外观、光线氛围..." />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-gray-500">首帧负向提示词 (First Frame Negative)</Label>
            <Textarea className="min-h-[60px]" value={firstFrameNegative} onChange={(e) => setFirstFrameNegative(e.target.value)} placeholder="blurry, low quality, deformed face, extra limbs..." />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-gray-500">视频提示词 (Video Prompt)</Label>
            <Textarea className="min-h-[100px]" value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} placeholder="描述从首帧生成视频的运镜方式、人物动作、画面变化..." />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-gray-500">视频负向提示词 (Video Negative)</Label>
            <Textarea className="min-h-[60px]" value={videoNegative} onChange={(e) => setVideoNegative(e.target.value)} placeholder="flickering, jittering, artifacts, distortion..." />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label className="mb-2 block text-xs text-gray-500">通用 Negative Prompt</Label>
              <Textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} />
            </div>
            <div>
              <Label className="mb-2 block text-xs text-gray-500">状态</Label>
              <Input value={status} onChange={(e) => setStatus(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 items-center">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={withFirstFrame} onChange={(e) => setWithFirstFrame(e.target.checked)} className="rounded" />
              视频引用首帧
            </label>
            <Button variant="secondary" onClick={handleGeneratePrompt} disabled={generatingPrompt}>
              {generatingPrompt ? "AI 生成中..." : "AI 生成 Prompt"}
            </Button>
            <Button onClick={handleCreatePrompt} disabled={!firstFramePrompt.trim()}>
              新建 Prompt 版本
            </Button>
          </div>
        </div>
      </SectionCard>

      {latestTask ? (
        <SectionCard title="最近生成任务" description="当前镜头的最新生成任务状态。">
          <div className="rounded-lg border border-line bg-panel2 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-100">Task #{latestTask.id}</span>
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
              <span className="text-xs text-gray-500">{latestTask.provider} / {latestTask.modelName}</span>
              {latestTask.status === "failed" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={retrying === latestTask.id}
                  onClick={() => handleRetryTask(latestTask.id)}
                >
                  {retrying === latestTask.id ? "重试中" : "重试"}
                </Button>
              ) : null}
            </div>
            {latestTask.errorMessage ? (
              <p className="mt-3 text-sm text-red-400">{latestTask.errorMessage}</p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Prompt 版本列表" description="为同一个镜头维护多版提示词，并激活其中一个参与生成。">
        {loading ? (
          <div className="text-sm text-gray-500">Prompt 加载中...</div>
        ) : prompts.length ? (
          <div className="grid gap-3">
            {prompts.map((prompt) => {
              const isEditing = editingId === prompt.id;
              return (
                <div key={prompt.id} className="rounded-lg border border-line bg-panel2 px-5 py-4">
                  {isEditing ? (
                    <div className="grid gap-3">
                      <div>
                        <Label className="mb-1 block text-xs text-gray-500">首帧图片提示词</Label>
                        <Textarea className="min-h-[100px]" value={editFirstFrame} onChange={(e) => setEditFirstFrame(e.target.value)} />
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs text-gray-500">首帧负向提示词</Label>
                        <Textarea className="min-h-[50px]" value={editFirstFrameNeg} onChange={(e) => setEditFirstFrameNeg(e.target.value)} />
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs text-gray-500">视频提示词</Label>
                        <Textarea className="min-h-[80px]" value={editVideo} onChange={(e) => setEditVideo(e.target.value)} />
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs text-gray-500">视频负向提示词</Label>
                        <Textarea className="min-h-[50px]" value={editVideoNeg} onChange={(e) => setEditVideoNeg(e.target.value)} />
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs text-gray-500">通用 Negative Prompt</Label>
                        <Textarea value={editNegative} onChange={(e) => setEditNegative(e.target.value)} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={cancelEdit} disabled={saving}>
                          取消
                        </Button>
                        <Button size="sm" onClick={() => handleSaveEdit(prompt.id)} disabled={saving || !editFirstFrame.trim()}>
                          {saving ? "保存中..." : "保存"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-sm font-semibold text-gray-100">Version {prompt.versionNo}</h3>
                          <StatusPill value={prompt.status} tone="purple" />
                          {prompt.isActive ? <StatusPill value="active" tone="green" /> : null}
                        </div>
                        {prompt.firstFramePrompt ? (
                          <div className="mt-3">
                            <span className="text-[11px] font-medium text-gray-500">首帧图片</span>
                            <div className="flex gap-3 mt-1">
                              <p className="text-sm leading-6 text-gray-400 whitespace-pre-wrap min-w-0 flex-1">{prompt.firstFramePrompt}</p>
                              {prompt.firstFrameUrl ? (
                                <ImagePreview
                                  src={prompt.firstFrameUrl.startsWith("http") ? prompt.firstFrameUrl : `${getApiBase()}/assets/${prompt.firstFrameUrl}`}
                                  alt="首帧预览"
                                  className="w-[160px] h-[90px] rounded-md border border-line/50 overflow-hidden shrink-0"
                                />
                              ) : null}
                            </div>
                            {prompt.firstFrameNegativePrompt ? <p className="mt-1 text-[11px] text-gray-500">Negative: {prompt.firstFrameNegativePrompt}</p> : null}
                          </div>
                        ) : null}
                        {prompt.videoPrompt ? (
                          <div className="mt-2">
                            <span className="text-[11px] font-medium text-gray-500">视频</span>
                            <p className="text-sm leading-6 text-gray-400 whitespace-pre-wrap">{prompt.videoPrompt}</p>
                            {prompt.videoNegativePrompt ? <p className="mt-1 text-[11px] text-gray-500">Negative: {prompt.videoNegativePrompt}</p> : null}
                          </div>
                        ) : null}
                        {!prompt.firstFramePrompt && prompt.promptText ? (
                          <p className="mt-3 text-sm leading-6 text-gray-400 whitespace-pre-wrap">{prompt.promptText}</p>
                        ) : null}
                        {prompt.negativePrompt ? <p className="mt-3 text-xs text-gray-500">通用 Negative: {prompt.negativePrompt}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!prompt.isActive ? (
                          <Button variant="secondary" size="sm" onClick={() => handleActivate(prompt.id)}>
                            激活
                          </Button>
                        ) : null}
                        <Button variant="secondary" size="sm" onClick={() => startEdit(prompt)}>
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          disabled={generatingFrame === prompt.id || !prompt.isActive}
                          onClick={() => handleGenerateFrame(prompt)}
                        >
                          {generatingFrame === prompt.id ? "生成中..." : "生成首帧"}
                        </Button>
                        <Button
                          size="sm"
                          disabled={generatingVideo === prompt.id || !prompt.isActive}
                          onClick={() => handleGenerateVideo(prompt)}
                        >
                          {generatingVideo === prompt.id ? "生成中..." : "生成视频"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="还没有 Prompt 版本" description="先创建至少一个 Prompt 版本，再提交生成任务。" />
        )}
      </SectionCard>
    </div>
    </div>
  );
}
