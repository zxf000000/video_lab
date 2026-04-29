"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import {
  seedanceT2V, seedanceI2V, seedanceCharacter,
  listSeedanceTasks, getApiBase,
} from "../../src/api";
import { ActionButton } from "../../src/components/ui-legacy";
import { Textarea } from "../../src/components/ui/textarea";
import VideoPlayer from "../../src/components/VideoPlayer";
import {
  IconWand, IconX, IconRefresh,
  IconDownload, IconUpload, IconPlus, IconClock, IconEye,
} from "@tabler/icons-react";

const MODES = [
  { id: "i2v", label: "首帧生成视频", desc: "上传首帧图片，生成视频" },
  { id: "character", label: "参考图生成视频", desc: "上传参考图，生成视频" },
];

const RATIOS = ["16:9", "9:16", "1:1"];
const RESOLUTIONS = ["480p", "720p", "1080p"];

function fileToBase64(file: File) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function timeAgo(iso: any) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}min${s > 0 ? `${s}s` : ""}`;
}

export default function Seedance2Page() {
  const [mode, setMode] = useState("i2v");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [duration, setDuration] = useState(5);
  const [removeWatermark, setRemoveWatermark] = useState(false);
  const [imageFiles, setImageFiles] = useState<any[]>([]);
  const [imagePreviews, setImagePreviews] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [viewTask, setViewTask] = useState<any>(null);

  // Task feed
  const [tasks, setTasks] = useState<any[]>([]);
  const feedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshTasks = useCallback(async () => {
    try {
      const data = await listSeedanceTasks();
      setTasks(data.tasks || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshTasks();
    feedTimerRef.current = setInterval(refreshTasks, 5000);
    return () => { if (feedTimerRef.current) clearInterval(feedTimerRef.current); };
  }, [refreshTasks]);

  useEffect(() => {
    const hasActive = tasks.some((t) => t.status === "queued" || t.status === "running");
    if (!hasActive && feedTimerRef.current) {
      clearInterval(feedTimerRef.current);
      feedTimerRef.current = null;
    } else if (hasActive && !feedTimerRef.current) {
      feedTimerRef.current = setInterval(refreshTasks, 5000);
    }
  }, [tasks, refreshTasks]);

  function handleFilesSelect(e: any) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setImageFiles((prev: any) => [...prev, ...files]);
    files.forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = () => setImagePreviews((prev: any) => [...prev, { name: file.name, url: reader.result as string }]);
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: any) {
    setImageFiles((prev: any) => prev.filter((_: any, i: any) => i !== index));
    setImagePreviews((prev: any) => prev.filter((_: any, i: any) => i !== index));
  }

  function resetForm() {
    setPrompt("");
    setImageFiles([]);
    setImagePreviews([]);
  }

  async function handleRetry(task: any) {
    const p = task.params || {};
    try {
      if (task.task_type === "seedance_t2v") {
        await seedanceT2V({
          prompt: p.prompt || "",
          aspect_ratio: p.aspect_ratio || "16:9",
          resolution: p.resolution || "720p",
          duration: p.duration || 5,
          remove_watermark: p.remove_watermark || false,
        });
      } else if (task.task_type === "seedance_i2v") {
        await seedanceI2V({
          prompt: p.prompt || "",
          images_list: p.images_list || [],
          aspect_ratio: p.aspect_ratio || "16:9",
          resolution: p.resolution || "720p",
          duration: p.duration || 5,
          remove_watermark: p.remove_watermark || false,
        });
      } else if (task.task_type === "seedance_character") {
        await seedanceCharacter({
          images_list: p.images_list || [],
          prompt: p.prompt || "",
        });
      }
      toast.success("已重新提交");
      refreshTasks();
    } catch (err: any) {
      toast.error(String(err.message || err));
    }
  }

  async function handleSubmit() {
    if (!prompt.trim() && imageFiles.length === 0) {
      toast.error("请输入提示词或上传图片");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "i2v") {
        const images_list = imageFiles.length > 0
          ? (await Promise.all(imageFiles.map((f: any) => fileToBase64(f)))).map((b: any) => `data:image/png;base64,${b}`)
          : [];
        await seedanceI2V({
          prompt: prompt.trim(),
          images_list,
          aspect_ratio: aspectRatio,
          resolution,
          duration,
          remove_watermark: removeWatermark,
        });
      } else {
        const b64s = await Promise.all(imageFiles.map((f: any) => fileToBase64(f)));
        const images_list = b64s.map((b: any) => `data:image/png;base64,${b}`);
        await seedanceCharacter({
          images_list,
          prompt: prompt.trim(),
          aspect_ratio: aspectRatio,
          resolution,
          duration,
          remove_watermark: removeWatermark,
        });
      }
      toast.success("任务已提交");
      refreshTasks();
    } catch (err: any) {
      toast.error(String(err.message || err));
    } finally {
      setSubmitting(false);
    }
  }

  const activeTask = tasks.find((t: any) => t.status === "queued" || t.status === "running");

  return (
    <>
        <div className="flex flex-wrap items-center gap-4 rounded-[28px] border border-line bg-panel px-5 py-4 shadow-glow">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-mint">Seedance 2.0</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Seedance 视频生成</h1>
          </div>
          {activeTask ? (
            <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <span className="text-[11px] font-medium text-amber-700">生成中 #{activeTask.id}</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            {/* Left: Form */}
            <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
              {/* Mode tabs */}
              <div className="mb-5 flex gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`flex-1 rounded-xl border px-3 py-3 text-left transition ${
                      mode === m.id
                        ? "border-mint bg-mint/10"
                        : "border-line bg-panel2 hover:border-mint/40"
                    }`}
                    onClick={() => { setMode(m.id); resetForm(); }}
                  >
                    <p className={`text-sm font-medium ${mode === m.id ? "text-mint" : "text-slate-700"}`}>{m.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{m.desc}</p>
                  </button>
                ))}
              </div>

              {/* Prompt */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs text-slate-500">
                  {mode === "i2v" ? "首帧描述提示词" : "参考图描述提示词"}
                </label>
                <Textarea
                  className="min-h-[100px] resize-y"
                  placeholder={
                    mode === "i2v"
                      ? "描述你希望图片如何动起来，例如：镜头缓慢推进，人物转身微笑..."
                      : "描述角色的服装、动作、风格..."
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              {/* Image upload (for i2v and character) */}
              {(mode === "i2v" || mode === "character") && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs text-slate-500">
                    {mode === "i2v" ? "首帧图片（1-3张）" : "参考图片（1-3张）"}
                  </label>
                  {imagePreviews.length > 0 ? (
                    <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {imagePreviews.map((img, i) => (
                        <div key={i} className="group relative">
                          <img src={img.url} alt={img.name} className="h-[100px] w-full rounded-xl object-cover" />
                          <button
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                            onClick={() => removeFile(i)}
                          >
                            <IconX size={12} stroke={2} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="flex h-[100px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-line text-slate-400 transition hover:border-mint/40"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <IconPlus size={18} stroke={2} />
                        <span className="mt-1 text-[10px]">添加</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mb-2 flex h-[100px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-line text-slate-400 transition hover:border-mint/40"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <IconUpload size={20} stroke={1.5} />
                      <span className="mt-1 text-xs">点击上传图片</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelect} />
                </div>
              )}

              {/* Parameters */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs text-slate-500">画面比例</label>
                  <div className="flex gap-1.5">
                    {RATIOS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          aspectRatio === r
                            ? "border-mint bg-mint/10 text-mint"
                            : "border-line bg-panel2 text-slate-500 hover:text-slate-800"
                        }`}
                        onClick={() => setAspectRatio(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-500">分辨率</label>
                  <div className="flex gap-1.5">
                    {RESOLUTIONS.map((res) => (
                      <button
                        key={res}
                        type="button"
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          resolution === res
                            ? "border-mint bg-mint/10 text-mint"
                            : "border-line bg-panel2 text-slate-500 hover:text-slate-800"
                        }`}
                        onClick={() => setResolution(res)}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-500">时长（秒）</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-16 rounded-xl border border-line bg-panel2 py-1.5 text-center text-xs outline-none focus:border-mint"
                      min={1}
                      max={15}
                      value={duration}
                      onChange={(e) => setDuration(Math.max(1, Math.min(15, Number(e.target.value) || 1)))}
                    />
                    <div className="flex gap-1">
                      {[3, 5, 10].map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`rounded-md border px-2 py-1 text-[10px] transition ${
                            duration === d ? "border-mint/40 bg-mint/10 text-mint" : "border-line text-slate-400"
                          }`}
                          onClick={() => setDuration(d)}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-mint"
                  checked={removeWatermark}
                  onChange={(e) => setRemoveWatermark(e.target.checked)}
                />
                <span className="text-xs text-slate-600">去水印</span>
              </div>

              <div className="mt-5">
                <ActionButton
                  icon={IconWand}
                  label={submitting ? "提交中..." : "开始生成"}
                  onClick={handleSubmit}
                  variant="primary"
                  disabled={submitting}
                />
              </div>
            </section>

            {/* Right: Task Feed */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">生成记录</h2>
                <button
                  className="rounded-full bg-panel2 p-2 text-slate-400 transition hover:text-slate-700"
                  onClick={refreshTasks}
                >
                  <IconRefresh size={14} stroke={2} />
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="rounded-[24px] border border-line bg-panel p-8 text-center shadow-glow">
                  <IconClock size={32} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">还没有生成记录</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {tasks.map((task: any) => (
                    <SeedanceTaskCard key={task.id} task={task} allTasks={tasks} onRefresh={refreshTasks} onView={setViewTask} onRetry={handleRetry} />
                  ))}
                </div>
              )}
            </section>
          </div>

      <SeedanceTaskDetailDialog task={viewTask} onClose={() => setViewTask(null)} />
      <style>{`
        @keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
      `}</style>
    </>
  );
}

function estimateAvgDuration(tasks: any[], currentTask: any): number | null {
  const p = currentTask.params || {};
  const type = currentTask.task_type;
  const dur = p.duration || 5;
  const res = p.resolution || "720p";

  const completed = tasks.filter(
    (t: any) => t.status === "succeeded" && t.created_at && t.updated_at && t.task_type === type
  );
  if (completed.length === 0) return null;

  const exact = completed.filter((t: any) => {
    const tp = t.params || {};
    return (tp.duration || 5) === dur && (tp.resolution || "720p") === res;
  });
  const pool = exact.length >= 2 ? exact : completed;

  const total = pool.reduce(
    (sum: number, t: any) => sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 1000,
    0
  );
  return total / pool.length;
}

function SeedanceTaskCard({ task, allTasks, onRefresh, onView, onRetry }: { task: any; allTasks: any[]; onRefresh: any; onView: any; onRetry: any }) {
  const params = task.params || {};
  const promptText = params.prompt || task.story_prompt || "";
  const dur = params.duration || task.target_duration || 5;
  const ratio = params.aspect_ratio || task.aspect_ratio || "16:9";
  const res = params.resolution || task.resolution || "";
  const isActive = task.status === "queued" || task.status === "running";
  const isDone = task.status === "succeeded";
  const isFailed = task.status === "failed";
  const videoUrl = task.output_path ? `${getApiBase()}/assets/${task.output_path}` : "";

  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(onRefresh, 5000);
    return () => clearInterval(iv);
  }, [isActive, onRefresh]);

  // Real-time elapsed counter for active tasks
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [isActive]);

  const elapsed = task.created_at
    ? Math.floor((now - new Date(task.created_at).getTime()) / 1000)
    : 0;
  const stalled = isActive && task.status === "running" && task.updated_at
    ? (now - new Date(task.updated_at).getTime()) > 60000
    : false;

  // Estimated progress based on historical avg duration
  const avgDuration = isActive ? estimateAvgDuration(allTasks, task) : null;
  const progressPercent = avgDuration && elapsed > 0
    ? Math.min(Math.round((elapsed / avgDuration) * 100), 95)
    : null;

  // Completed: compact card with view button
  if (isDone) {
    const totalDuration = task.created_at && task.updated_at
      ? formatElapsed(Math.floor((new Date(task.updated_at).getTime() - new Date(task.created_at).getTime()) / 1000))
      : "";
    return (
      <div className="rounded-[20px] border border-line bg-panel p-4 shadow-glow transition hover:border-mint/40">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-medium text-emerald-600">已完成</span>
          {totalDuration && <span className="text-[10px] text-slate-400">耗时 {totalDuration}</span>}
          <span className="ml-auto text-[10px] text-slate-400">#{task.id}</span>
        </div>
        <p className="mb-2 line-clamp-2 text-sm text-slate-800">{promptText}</p>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
            {task.task_type === "seedance_t2v" ? "文生视频" : task.task_type === "seedance_i2v" ? "首帧生成视频" : "参考图生成视频"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{ratio}</span>
          {res && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{res}</span>}
          {dur > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{dur}s</span>}
          {task.created_at ? (
            <span className="ml-auto text-[10px] text-slate-400">{timeAgo(task.created_at)}</span>
          ) : null}
        </div>
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-mint/10 py-2 text-xs font-medium text-mint transition hover:bg-mint/20"
          onClick={() => onView(task)}
        >
          <IconEye size={14} stroke={2} />
          查看
        </button>
      </div>
    );
  }

  // Active / Failed / Queued: inline display
  const failedDuration = isFailed && task.created_at && task.updated_at
    ? formatElapsed(Math.floor((new Date(task.updated_at).getTime() - new Date(task.created_at).getTime()) / 1000))
    : "";

  return (
    <div className={`rounded-[20px] border bg-panel p-4 shadow-glow transition ${
      isActive ? "border-amber-300 ring-1 ring-amber-200" : "border-line"
    }`}>
      <div className="mb-3 flex items-center gap-2">
        {isActive ? (
          <>
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <span className="text-[11px] font-medium text-amber-600">
              {task.status === "queued" ? "排队中" : "生成中"}
            </span>
            {elapsed > 0 && (
              <span className="text-[10px] text-amber-500">已用 {formatElapsed(elapsed)}</span>
            )}
            {stalled && <span className="text-[10px] text-amber-400">连接中...</span>}
          </>
        ) : isFailed ? (
          <>
            <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span className="text-[11px] font-medium text-rose-600">失败</span>
            {failedDuration && <span className="text-[10px] text-rose-400">耗时 {failedDuration}</span>}
          </>
        ) : (
          <>
            <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="text-[11px] font-medium text-slate-500">排队中</span>
          </>
        )}
        <span className="ml-auto text-[10px] text-slate-400">#{task.id}</span>
      </div>

      <p className="mb-2 line-clamp-2 text-sm text-slate-800">{promptText}</p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
          {task.task_type === "seedance_t2v" ? "文生视频" : task.task_type === "seedance_i2v" ? "首帧生成视频" : "参考图生成视频"}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{ratio}</span>
        {res && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{res}</span>}
        {dur > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{dur}s</span>}
        {task.created_at ? (
          <span className="ml-auto text-[10px] text-slate-400">{timeAgo(task.created_at)}</span>
        ) : null}
      </div>

      {isActive && task.status === "running" && task.params?.progress_step && (
        <p className="mb-1 text-[11px] text-amber-600">{task.params.progress_step}</p>
      )}

      {isActive && (
        <div className="mt-2">
          {progressPercent !== null ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-mint transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="shrink-0 text-[10px] font-medium text-slate-500">{progressPercent}%</span>
            </div>
          ) : (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/3 rounded-full bg-mint" style={{ animation: "indeterminate 2s ease-in-out infinite" }} />
            </div>
          )}
        </div>
      )}

      {isFailed && task.error_message ? (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{task.error_message}</div>
      ) : null}

      {isFailed ? (
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-50 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
          onClick={() => onRetry(task)}
        >
          <IconRefresh size={14} stroke={2} />
          重试
        </button>
      ) : null}
    </div>
  );
}

function SeedanceTaskDetailDialog({ task, onClose }: { task: any; onClose: any }) {
  useEffect(() => {
    if (!task) return;
    const handler = (e: any) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [task, onClose]);

  if (!task) return null;

  const params = task.params || {};
  const promptText = params.prompt || task.story_prompt || "";
  const dur = params.duration || task.target_duration || 5;
  const ratio = params.aspect_ratio || task.aspect_ratio || "16:9";
  const res = params.resolution || task.resolution || "";
  const videoUrl = task.output_path ? `${getApiBase()}/assets/${task.output_path}` : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#1a1a2e] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold text-white">任务 #{task.id}</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">已完成</span>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
            onClick={onClose}
          >
            <IconX size={16} stroke={2} />
          </button>
        </div>

        {/* Video */}
        {videoUrl ? (
          <div className="mb-5">
            <VideoPlayer src={videoUrl} aspectRatio={ratio.replace(":", " / ")} />
          </div>
        ) : null}
        {!videoUrl ? (
          <div className="mb-5 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            视频下载失败，请重试
          </div>
        ) : null}

        {/* Prompt */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/40">提示词</label>
          <p className="rounded-xl bg-white/5 px-4 py-3 text-sm leading-6 text-white/90">{promptText || "—"}</p>
        </div>

        {/* Meta */}
        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
            {task.task_type === "seedance_t2v" ? "文生视频" : task.task_type === "seedance_i2v" ? "首帧生成视频" : "参考图生成视频"}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">比例: {ratio}</span>
          {res && <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">分辨率: {res}</span>}
          {dur > 0 && <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">时长: {dur}s</span>}
          {task.created_at ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">{timeAgo(task.created_at)}</span>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {videoUrl ? (
            <ActionButton icon={IconDownload} label="下载视频" onClick={() => window.open(videoUrl, "_blank")} variant="primary" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
