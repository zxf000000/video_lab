"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { IconArrowLeft, IconArrowRight, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import {
  activateShotPrompt,
  createShotPrompt,
  generatePromptFrame,
  generatePromptVideo,
  generateShotPromptFromShot,
  getApiBase,
  getShot,
  listShotPrompts,
  listShots,
  updateShot,
  updateShotPromptVersion,
  type GenerationTask,
  type ScreenplayScene,
  type Shot,
  type ShotPrompt,
} from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";
import ImagePreview from "@/src/components/project/ImagePreview";
import VideoPreview from "@/src/components/project/VideoPreview";
import { motion } from "framer-motion";

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

function parseCsvNumbers(value: string) {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

type FlatShot = { shot: Shot; episodeId: number; episodeNo: number; episodeTitle: string };

export default function ShotDetailPage() {
  const params = useParams<{ id: string; shotId: string }>();
  const router = useRouter();
  const { project, refresh } = useProjectWorkspace();
  const shotId = Number(params.shotId);
  const projectId = Number(params.id);

  const [episodeShots, setEpisodeShots] = useState<EpisodeShots[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailShot, setDetailShot] = useState<Shot | null>(null);

  // Edit form
  const [editing, setEditing] = useState<ShotFormState | null>(null);
  const [saving, setSaving] = useState(false);

  // Prompt state
  const [detailTab, setDetailTab] = useState<"prompt" | "edit">("edit");
  const [shotPromptCache, setShotPromptCache] = useState<Record<number, ShotPrompt[]>>({});
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  const [firstFramePrompt, setFirstFramePrompt] = useState("");
  const [firstFrameNegative, setFirstFrameNegative] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoNegative, setVideoNegative] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [promptStatus, setPromptStatus] = useState("draft");
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);
  const [editFirstFrame, setEditFirstFrame] = useState("");
  const [editFirstFrameNeg, setEditFirstFrameNeg] = useState("");
  const [editVideo, setEditVideo] = useState("");
  const [editVideoNeg, setEditVideoNeg] = useState("");
  const [editNegative, setEditNegative] = useState("");
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [promptRhythmLevel, setPromptRhythmLevel] = useState("");
  const [withFirstFrame, setWithFirstFrame] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(3);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [generatingFrame, setGeneratingFrame] = useState<number | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState<number | null>(null);

  useEffect(() => {
    if (project?.targetPlatform === "抖音") {
      setAspectRatio("9:16");
    }
  }, [project?.targetPlatform]);

  const sceneOptions = useMemo(() => project?.scenes ?? [], [project]);

  // ── Load all shots for filmstrip ──
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

  // ── Load current shot detail ──
  useEffect(() => {
    if (!shotId) return;
    getShot(shotId)
      .then(({ shot }) => {
        setDetailShot(shot);
        setEditing(toForm(shot));
        const sec = shot.estimatedDurationMs > 0
          ? Math.max(2, Math.min(8, Math.round(shot.estimatedDurationMs / 1000)))
          : 3;
        setDurationSeconds(sec);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : String(err)));

    setLoadingPrompts(true);
    listShotPrompts(shotId)
      .then(({ prompts }) => setShotPromptCache((prev) => ({ ...prev, [shotId]: prompts })))
      .catch(() => {})
      .finally(() => setLoadingPrompts(false));
  }, [shotId]);

  // Auto-refresh prompts
  useEffect(() => {
    if (!shotId) return;
    const timer = window.setInterval(() => {
      listShotPrompts(shotId)
        .then(({ prompts }) => setShotPromptCache((prev) => ({ ...prev, [shotId]: prompts })))
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [shotId]);

  // ── Flat shot list for prev/next ──
  const allShots: FlatShot[] = useMemo(() => {
    const flat: FlatShot[] = [];
    episodeShots.forEach((ep) => {
      ep.shots.forEach((shot) => {
        flat.push({ shot, episodeId: ep.episodeId, episodeNo: ep.episodeNo, episodeTitle: ep.title });
      });
    });
    return flat;
  }, [episodeShots]);

  const currentIndex = allShots.findIndex((s) => s.shot.id === shotId);
  const prevShot = currentIndex > 0 ? allShots[currentIndex - 1] : null;
  const nextShot = currentIndex < allShots.length - 1 ? allShots[currentIndex + 1] : null;

  // ── Keyboard navigation ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft" && prevShot) {
        router.push(`/projects/${projectId}/shots/${prevShot.shot.id}`);
      } else if (e.key === "ArrowRight" && nextShot) {
        router.push(`/projects/${projectId}/shots/${nextShot.shot.id}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevShot, nextShot, projectId, router]);

  // ── Save shot ──
  async function handleSaveShot() {
    if (!editing?.id) return;
    setSaving(true);
    try {
      await updateShot(editing.id, {
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
      });
      toast.success("镜头已保存");
      await loadAllShots();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  // ── Prompt: generate ──
  async function handleGeneratePrompt() {
    if (!shotId) return;
    setGeneratingPrompt(true);
    try {
      const result = await generateShotPromptFromShot(shotId, { rhythmLevel: promptRhythmLevel || undefined });
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
    if (!shotId) return;
    try {
      await createShotPrompt(shotId, {
        promptText: firstFramePrompt,
        firstFramePrompt,
        firstFrameNegativePrompt: firstFrameNegative,
        videoPrompt,
        videoNegativePrompt: videoNegative,
        negativePrompt,
        modelParams: { duration_seconds: durationSeconds, aspect_ratio: aspectRatio, resolution },
        status: promptStatus,
        isActive: (shotPromptCache[shotId] || []).length === 0,
      });
      setFirstFramePrompt("");
      setFirstFrameNegative("");
      setVideoPrompt("");
      setVideoNegative("");
      setNegativePrompt("");
      setPromptStatus("draft");
      const { prompts } = await listShotPrompts(shotId);
      setShotPromptCache((prev) => ({ ...prev, [shotId]: prompts }));
      toast.success("Prompt 版本已创建");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleActivatePrompt(promptId: number) {
    if (!shotId) return;
    try {
      await activateShotPrompt(promptId);
      const { prompts } = await listShotPrompts(shotId);
      setShotPromptCache((prev) => ({ ...prev, [shotId]: prompts }));
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
    if (!shotId) return;
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
      const { prompts } = await listShotPrompts(shotId);
      setShotPromptCache((prev) => ({ ...prev, [shotId]: prompts }));
      toast.success("Prompt 已更新");
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

  async function handleGenerateFrame(prompt: ShotPrompt) {
    setGeneratingFrame(prompt.id);
    try {
      const ar = getModelParam(prompt, "aspect_ratio", aspectRatio);
      const { task } = await generatePromptFrame(prompt.id, [], ar);
      toast.info("首帧生成任务已提交");
      if (task.status === "failed") toast.error(task.errorMessage || "首帧生成失败");
      if (shotId) {
        const { prompts } = await listShotPrompts(shotId);
        setShotPromptCache((prev) => ({ ...prev, [shotId]: prompts }));
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
      const { task } = await generatePromptVideo(prompt.id, {
        withFirstFrame,
        aspectRatio: ar,
        duration: dur,
        resolution: res,
      });
      toast.info("视频生成任务已提交");
      if (task.status === "failed") toast.error(task.errorMessage || "视频生成失败");
      if (shotId) {
        const { prompts } = await listShotPrompts(shotId);
        setShotPromptCache((prev) => ({ ...prev, [shotId]: prompts }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingVideo(null);
    }
  }

  if (!project) return null;

  const currentEpisode = episodeShots.find((ep) => ep.shots.some((s) => s.id === shotId));
  const apiBase = getApiBase();
  const prompts = shotPromptCache[shotId];

  return (
    <div className="flex gap-0 flex-1 min-h-0 items-start">
      {/* ================================================================
          FILMSTRIP SIDEBAR — sticky, always visible when scrolling
          ================================================================ */}
      <aside
        className="w-[272px] shrink-0 sticky top-0 h-screen border-r border-line/60 bg-abyss/80 flex flex-col overflow-hidden"
        style={{ boxShadow: "inset -4px 0 20px rgba(0,0,0,0.3)" }}
      >
        {/* Sidebar header */}
        <div className="shrink-0 border-b border-line/50 px-4 py-3">
          <Link
            href={`/projects/${projectId}/shots`}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-gray-500 hover:text-mint transition"
          >
            <IconArrowLeft size={14} stroke={2.5} />
            返回镜头列表
          </Link>
          <div className="mt-2 flex items-center justify-between">
            <span
              className="text-xs font-bold tracking-[0.12em] text-gray-300"
              style={{ fontFamily: "var(--font-mono), monospace" }}
            >
              全部镜头
            </span>
            <span className="text-[10px] text-gray-600">{allShots.length} shots</span>
          </div>
        </div>

        {/* Filmstrip list */}
        <div className="flex-1 overflow-y-auto">
          {episodeShots.map((ep) => (
            <div key={ep.episodeId}>
              {/* Episode header */}
              <div className="sticky top-0 z-10 bg-abyss/95 backdrop-blur-sm border-b border-line/30 px-4 py-2">
                <span className="text-[10px] font-bold tracking-[0.15em] text-gray-500 uppercase">
                  第 {ep.episodeNo} 集 · {ep.title || "未命名"}
                </span>
                <span className="ml-2 text-[10px] text-gray-600">{ep.shots.length}</span>
              </div>

              {ep.shots.map((shot) => {
                const isActive = shot.id === shotId;
                const imageUrl = shot.firstFrameUrl
                  ? (shot.firstFrameUrl.startsWith("http") ? shot.firstFrameUrl : `${apiBase}/assets/${shot.firstFrameUrl}`)
                  : null;

                return (
                  <Link
                    key={shot.id}
                    href={`/projects/${projectId}/shots/${shot.id}`}
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
                        <img src={imageUrl} alt={`Shot ${shot.shotNo}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-700">
                          no frame
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
                          Shot {shot.shotNo}
                        </span>
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isActive ? "bg-mint shadow-[0_0_6px_rgba(0,240,255,0.6)]" : "bg-gray-700"
                          }`}
                        />
                      </div>
                      <p className="mt-0.5 text-[10px] leading-4 text-gray-500 line-clamp-1">
                        {shot.visualGoal || shot.sceneBlock || "—"}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <StatusPill value={shot.status} tone="purple" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}

          {loading && (
            <div className="px-4 py-8 text-center">
              <span className="text-[11px] text-gray-600 tracking-wider">加载中...</span>
            </div>
          )}
        </div>

        {/* Sidebar footer — keyboard hint */}
        <div className="shrink-0 border-t border-line/50 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[9px] text-gray-600 tracking-wider">← → 切换镜头</span>
          <span className="text-[9px] text-gray-600">
            {currentIndex >= 0 ? `${currentIndex + 1}/${allShots.length}` : ""}
          </span>
        </div>
      </aside>

      {/* ================================================================
          MAIN CONTENT — shot detail (edit + prompt tabs)
          ================================================================ */}
      <main className="flex-1 min-w-0 flex flex-col bg-panel">
        {!detailShot || !editing ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm text-gray-600">镜头加载中...</span>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="shrink-0 border-b border-line/60 px-6 py-3.5 flex items-center justify-between">
              <div className="min-w-0 flex items-center gap-4">
                <div>
                  <h2 className="text-base font-bold text-gray-100" style={{ fontFamily: "var(--font-mono), monospace" }}>
                    Shot {detailShot.shotNo}
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-md">
                    {currentEpisode
                      ? `第 ${currentEpisode.episodeNo} 集 · ${currentEpisode.title}`
                      : ""}
                    {detailShot.sceneBlock ? ` · ${detailShot.sceneBlock}` : ""}
                  </p>
                </div>
              </div>

              {/* Prev/Next + save */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-0.5 mr-3">
                  <button
                    disabled={!prevShot}
                    onClick={() => prevShot && router.push(`/projects/${projectId}/shots/${prevShot.shot.id}`)}
                    className="p-1.5 text-gray-500 hover:text-mint disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="上一个镜头 (←)"
                  >
                    <IconChevronLeft size={18} stroke={2} />
                  </button>
                  <span className="text-[10px] text-gray-600 w-14 text-center select-none">
                    {currentIndex >= 0 ? `${currentIndex + 1}/${allShots.length}` : ""}
                  </span>
                  <button
                    disabled={!nextShot}
                    onClick={() => nextShot && router.push(`/projects/${projectId}/shots/${nextShot.shot.id}`)}
                    className="p-1.5 text-gray-500 hover:text-mint disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="下一个镜头 (→)"
                  >
                    <IconChevronRight size={18} stroke={2} />
                  </button>
                </div>
                <Button variant="secondary" size="sm" onClick={handleSaveShot} disabled={saving}>
                  {saving ? "保存中..." : "保存镜头"}
                </Button>
              </div>
            </div>

            {/* Tabs content */}
            <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "prompt" | "edit")} className="flex flex-col">
              <div className="border-b border-line/50 px-6 shrink-0">
                <TabsList>
                  <TabsTrigger value="edit">编辑</TabsTrigger>
                  <TabsTrigger value="prompt">Prompt</TabsTrigger>
                </TabsList>
              </div>

              {/* ── Edit Tab ── */}
              <TabsContent value="edit" className="px-6 py-4">
                <motion.div
                  key={shotId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="grid gap-4 md:grid-cols-2"
                >
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
                </motion.div>
              </TabsContent>

              {/* ── Prompt Tab ── */}
              <TabsContent value="prompt" className="px-6 py-4">
                <motion.div
                  key={shotId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="grid gap-5"
                >
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
                    <Textarea size="1" className="min-h-[96px] text-xs leading-5" value={firstFramePrompt} onChange={(e) => setFirstFramePrompt(e.target.value)} placeholder="描述镜头第一帧的静态画面..." />
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs text-gray-500">首帧负向提示词 (First Frame Negative)</Label>
                    <Textarea size="1" className="min-h-[52px] text-xs leading-5" value={firstFrameNegative} onChange={(e) => setFirstFrameNegative(e.target.value)} placeholder="blurry, low quality, deformed face..." />
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs text-gray-500">视频提示词 (Video Prompt)</Label>
                    <Textarea size="1" className="min-h-[84px] text-xs leading-5" value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} placeholder="描述运镜方式、人物动作、画面变化..." />
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs text-gray-500">视频负向提示词 (Video Negative)</Label>
                    <Textarea size="1" className="min-h-[52px] text-xs leading-5" value={videoNegative} onChange={(e) => setVideoNegative(e.target.value)} placeholder="flickering, jittering, artifacts..." />
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

                  {/* Params */}
                  <div className="pt-4 border-t border-line/60">
                    <p className="mb-3 text-[11px] text-gray-500">生成参数 <span className="text-gray-600">— 保存到 Prompt 版本</span></p>
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

                  {/* Prompt version list */}
                  <div className="pt-4 border-t border-line">
                    <div className="flex items-center gap-4 mb-3">
                      <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
                        <input type="checkbox" checked={withFirstFrame} onChange={(e) => setWithFirstFrame(e.target.checked)} className="rounded" />
                        视频引用首帧
                      </label>
                    </div>
                    {loadingPrompts ? (
                      <p className="text-sm text-gray-500">Prompt 加载中...</p>
                    ) : !prompts?.length ? (
                      <p className="text-sm text-gray-500">暂无 Prompt 版本，请先创建。</p>
                    ) : (
                      <div className="grid gap-3">
                        {prompts.map((prompt) => {
                          const isEditing = editingPromptId === prompt.id;
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
                    )}
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
