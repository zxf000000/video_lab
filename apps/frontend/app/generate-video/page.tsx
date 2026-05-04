"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { generateQuickVideo, getQuickVideoStatus, listQuickVideoTasks, generateImage, getApiBase, getModels, type ModelItem, type VideoGenerationTask } from "../../src/api";
import { ActionButton, ImageViewer } from "../../src/components/ui-legacy";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../src/components/ui/dialog";
import { Textarea } from "../../src/components/ui/textarea";
import VideoPlayer from "../../src/components/VideoPlayer";
import {
  IconUpload,
  IconWand,
  IconX,
  IconRefresh,
  IconDownload,
  IconPlus,
  IconLink,
  IconMinus,
  IconClock,
  IconEye,
  IconSparkles,
} from "@tabler/icons-react";

const RATIOS = ["16:9", "9:16", "1:1", "4:3"];
const RESOLUTIONS = ["480p", "720p", "1080p"];

const STYLE_PRESETS = [
  { id: "cinematic", label: "电影感", emoji: "🎬" },
  { id: "anime", label: "动漫风", emoji: "🎨" },
  { id: "documentary", label: "纪录片", emoji: "📹" },
  { id: "neo-noir", label: "赛博朋克", emoji: "🌃" },
  { id: "watercolor", label: "水彩画", emoji: "🖼" },
  { id: "realistic", label: "写实风", emoji: "📷" },
];

const STYLE_LABEL_MAP = Object.fromEntries(STYLE_PRESETS.map((s) => [s.id, s.label]));

interface ModelConfig {
  durationRange: [number, number];
  durationPresets: number[];
  resolutions: string[];
  resLabels: Record<string, string>;
  ratios: string[];
  maxRefImages: number;
  refAspect: string;
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  kling: {
    durationRange: [3, 15],
    durationPresets: [5, 10, 15],
    resolutions: ["std", "pro", "4k"],
    resLabels: { std: "标准", pro: "专家", "4k": "4K" },
    ratios: ["16:9", "9:16", "1:1"],
    maxRefImages: 4,
    refAspect: "3:4",
  },
  seedance: {
    durationRange: [1, 300],
    durationPresets: [5, 10, 30, 60, 120],
    resolutions: ["480p", "720p", "1080p"],
    resLabels: { "480p": "480p", "720p": "720p", "1080p": "1080p" },
    ratios: ["16:9", "9:16", "1:1", "4:3"],
    maxRefImages: 4,
    refAspect: "9:16",
  },
  default: {
    durationRange: [1, 300],
    durationPresets: [10, 30, 60, 120, 300],
    resolutions: ["480p", "720p", "1080p"],
    resLabels: { "480p": "480p", "720p": "720p", "1080p": "1080p" },
    ratios: ["16:9", "9:16", "1:1", "4:3"],
    maxRefImages: 4,
    refAspect: "9:16",
  },
};

function getModelConfig(model: string): ModelConfig {
  if (model.startsWith("kling")) return MODEL_CONFIGS.kling;
  if (model.startsWith("doubao-seedance")) return MODEL_CONFIGS.seedance;
  return MODEL_CONFIGS.default;
}

const STORAGE_KEY = "quick_generate_state";

function loadState() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function fileToBase64(file: File) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type CharacterCard = { name: string; description: string; imageUrl: string; refImage: string; referenced?: boolean };
type ImagePreview = { name: string; url: string };

function timeAgo(iso: string) {
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

export default function GenerateVideoPage() {
  const saved = useRef((() => {
    const s = loadState();
    // Migrate old character data without referenced field
    if (s.characters) {
      s.characters = (s.characters as CharacterCard[]).map((c) => ({
        ...c,
        referenced: c.referenced ?? false,
        refImage: c.refImage ?? "",
      }));
    }
    return s;
  })()).current;

  const [prompt, setPrompt] = useState(saved.prompt ?? "");
  const [style, setStyle] = useState(saved.style ?? "cinematic");
  const [aspectRatio, setAspectRatio] = useState(saved.aspectRatio ?? "16:9");
  const [resolution, setResolution] = useState(saved.resolution ?? "720p");
  const [duration, setDuration] = useState(saved.duration ?? 8);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>(saved.imagePreviews ?? []);
  const [imageUrls, setImageUrls] = useState<string[]>((saved.imageUrls as string[]) ?? [""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video model selection
  const [videoModels, setVideoModels] = useState<ModelItem[]>([]);
  const [videoModel, setVideoModel] = useState(saved.videoModel ?? "");
  const modelConfig = getModelConfig(videoModel);

  // Reference images
  const [characters, setCharacters] = useState<CharacterCard[]>(saved.characters ?? []);
  const [generatingIdx, setGeneratingIdx] = useState<number | null>(null);
  const [refImageHistory, setRefImageHistory] = useState<string[]>((saved.refImageHistory as string[]) ?? []);

  // Image viewer
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  // Ref image picker modal (index of character to pick for, or null)
  const [refPickerIdx, setRefPickerIdx] = useState<number | null>(null);

  // Task detail dialog
  const [viewTask, setViewTask] = useState<VideoGenerationTask | null>(null);

  // Persist state to localStorage
  useEffect(() => {
    const state = { prompt, style, aspectRatio, resolution, duration, imagePreviews, imageUrls, characters, refImageHistory, videoModel };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [prompt, style, aspectRatio, resolution, duration, imagePreviews, imageUrls, characters, refImageHistory, videoModel]);

  // Fetch available video models
  useEffect(() => {
    getModels().then((data) => {
      const models = data?.models?.video || [];
      setVideoModels(models);
      if (!videoModel && models.length > 0) {
        setVideoModel(models[0].id);
      }
    }).catch(() => {});
  }, []);

  // Task feed
  const [tasks, setTasks] = useState<VideoGenerationTask[]>([]);
  const feedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshTasks = useCallback(async () => {
    try {
      const data = await listQuickVideoTasks();
      setTasks(data.tasks || []);
    } catch {
      /* ignore */
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    refreshTasks();
    feedTimerRef.current = setInterval(refreshTasks, 5000);
    return () => { if (feedTimerRef.current) clearInterval(feedTimerRef.current); };
  }, [refreshTasks]);

  // Stop polling when no active tasks
  useEffect(() => {
    const hasActive = tasks.some((t) => t.status === "queued" || t.status === "running");
    if (!hasActive && feedTimerRef.current) {
      clearInterval(feedTimerRef.current);
      feedTimerRef.current = null;
    } else if (hasActive && !feedTimerRef.current) {
      feedTimerRef.current = setInterval(refreshTasks, 5000);
    }
  }, [tasks, refreshTasks]);

  function handleFilesSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`${f.name} 超过 20MB`);
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;

    setImageFiles((prev) => [...prev, ...valid]);
    valid.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreviews((prev) => [...prev, { name: file.name, url: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function updateUrl(index: number, value: string) {
    setImageUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addUrl() {
    setImageUrls((prev) => [...prev, ""]);
  }

  function removeUrl(index: number) {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setPrompt("");
    setStyle("cinematic");
    setDuration(modelConfig.durationRange[0]);
    setImageFiles([]);
    setImagePreviews([]);
    setImageUrls([""]);
    setCharacters([]);
    setError("");
    localStorage.removeItem(STORAGE_KEY);
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("请输入提示词");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const image_b64s = await Promise.all(imageFiles.map((f) => fileToBase64(f)));
      const image_urls = imageUrls.map((u) => u.trim()).filter(Boolean);
      // Collect reference images from reference image cards
      const reference_image_urls = characters
        .filter((c) => c.imageUrl && c.imageUrl.trim())
        .map((c) => c.imageUrl.trim());
      await generateQuickVideo({
        prompt: prompt.trim(),
        style,
        aspect_ratio: aspectRatio,
        target_duration: duration,
        image_urls,
        image_b64s,
        reference_image_urls,
        resolution,
        video_model: videoModel,
      });
      toast.success("任务已提交");
      resetForm();
      refreshTasks();
    } catch (err: unknown) {
      setError(String((err as Error).message || err));
      toast.error(String((err as Error).message || err));
    } finally {
      setSubmitting(false);
    }
  }

  function addCharacter() {
    setCharacters((prev) => [...prev, { name: "", description: "", imageUrl: "", refImage: "" }]);
  }

  function updateCharacter(index: number, field: string, value: string) {
    setCharacters((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }

  function removeCharacter(index: number) {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
  }

  function addToRefHistory(url: string) {
    if (!url) return;
    setRefImageHistory((prev) => {
      if (prev.includes(url)) return prev;
      return [url, ...prev].slice(0, 20);
    });
  }

  function setRefImage(index: number, url: string) {
    updateCharacter(index, "refImage", url);
    addToRefHistory(url);
  }

  async function handleGenerateRefImage(index: number) {
    const char = characters[index];
    if (!char.description?.trim()) {
      toast.error("请先填写描述");
      return;
    }
    setGeneratingIdx(index);
    try {
      const data = await generateImage({ prompt: char.description.trim(), aspect_ratio: modelConfig.refAspect, reference_image: char.refImage || undefined });
      if (data.image_url) {
        updateCharacter(index, "imageUrl", data.image_url);
        addToRefHistory(data.image_url);
        toast.success("引用图已生成");
      }
    } catch (err: unknown) {
      toast.error(String((err as Error).message || err));
    } finally {
      setGeneratingIdx(null);
    }
  }

  const refImageCount = characters.filter((c) => c.imageUrl && c.imageUrl.trim()).length;

  const activeTask = tasks.find((t) => t.status === "queued" || t.status === "running");

  return (
    <>
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-panel px-5 py-4 shadow-glow">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-mint">Quick Generate</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-100">快速生成视频</h1>
            </div>
            {activeTask ? (
              <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                <span className="text-[11px] font-medium text-amber-700">生成中 #{activeTask.id}</span>
              </div>
            ) : null}
          </div>

          {/* Reference Images */}
          <section className="rounded-lg border border-line bg-panel p-5 shadow-glow">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <label className="text-xs font-medium text-gray-500">生成引用图</label>
                <span className="ml-2 text-[11px] text-gray-500">
                  最多 {modelConfig.maxRefImages} 张，比例 {modelConfig.refAspect}
                </span>
              </div>
              <button
                className="inline-flex items-center gap-1 rounded-full bg-panel2 px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:text-gray-100"
                onClick={addCharacter}
                disabled={characters.length >= 4}
              >
                <IconPlus size={14} stroke={2} />
                添加引用图
              </button>
            </div>

            {characters.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-500">添加引用图后，生成视频时会自动作为参考输入</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {characters.map((char, i) => (
                  <div key={i} className="rounded-xl border border-line bg-panel2 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-transparent text-xs font-medium outline-none placeholder:text-gray-500"
                        placeholder="引用图名称（可选）"
                        value={char.name}
                        onChange={(e) => updateCharacter(i, "name", e.target.value)}
                      />
                      <button
                        className="text-gray-500 transition hover:text-red-400"
                        onClick={() => removeCharacter(i)}
                      >
                        <IconX size={14} stroke={2} />
                      </button>
                    </div>
                    <input
                      type="text"
                      className="mb-2 w-full rounded-lg border border-line bg-panel px-3 py-1.5 text-xs outline-none placeholder:text-gray-500 focus:border-mint"
                      placeholder="描述（可选）"
                      value={char.description}
                      onChange={(e) => updateCharacter(i, "description", e.target.value)}
                    />
                    {/* Reference image for generation */}
                    <div className="mb-2">
                      {char.refImage ? (
                        <div className="group relative">
                          <img src={char.refImage} alt="参考图" className="h-[60px] w-full rounded-lg object-cover" />
                          <button
                            className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                            onClick={() => updateCharacter(i, "refImage", "")}
                          >
                            <IconX size={8} stroke={2} />
                          </button>
                          <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 py-0.5 text-[8px] text-white">生成参考图</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex h-[32px] w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-line text-gray-500 transition hover:border-mint/40 hover:text-gray-400"
                          onClick={() => setRefPickerIdx(i)}
                        >
                          <IconUpload size={10} stroke={1.5} />
                          <span className="text-[9px]">上传参考图</span>
                        </button>
                      )}
                    </div>
                    {!char.imageUrl && char.description?.trim() && (
                      <button
                        type="button"
                        disabled={generatingIdx === i}
                        className="mb-2 flex w-full items-center justify-center gap-1 rounded-lg bg-mint/10 py-1.5 text-[11px] font-medium text-mint transition hover:bg-mint/20 disabled:opacity-50"
                        onClick={() => handleGenerateRefImage(i)}
                      >
                        {generatingIdx === i ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-mint border-t-transparent" />
                        ) : (
                          <IconSparkles size={12} stroke={2} />
                        )}
                        {generatingIdx === i ? "生成中..." : "AI 生成图片"}
                      </button>
                    )}
                    {char.imageUrl ? (
                      <div className="group relative">
                        <img src={char.imageUrl} alt={char.name} className="h-[100px] w-full cursor-zoom-in rounded-lg object-cover" onClick={() => setViewerSrc(char.imageUrl)} />
                        <button
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                          onClick={() => updateCharacter(i, "imageUrl", "")}
                        >
                          <IconX size={10} stroke={2} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id={`ref-upload-${i}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => updateCharacter(i, "imageUrl", reader.result as string);
                            reader.readAsDataURL(file);
                          }}
                        />
                        <label
                          htmlFor={`ref-upload-${i}`}
                          className="mb-1.5 flex h-[60px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line text-gray-500 transition hover:border-mint/40 hover:text-gray-400"
                        >
                          <IconUpload size={16} stroke={1.5} />
                          <span className="mt-0.5 text-[10px]">本地上传</span>
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            className="flex-1 rounded-lg border border-line bg-panel px-2 py-1.5 text-[10px] outline-none placeholder:text-gray-500 focus:border-mint"
                            placeholder="或粘贴图片 URL"
                            id={`ref-url-${i}`}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                                updateCharacter(i, "imageUrl", (e.target as HTMLInputElement).value.trim());
                              }
                            }}
                          />
                          <button
                            className="shrink-0 rounded-lg bg-mint/10 px-2 py-1.5 text-[10px] text-mint transition hover:bg-mint/20"
                            onClick={() => {
                              const input = document.getElementById(`ref-url-${i}`);
                              if (input && (input as HTMLInputElement).value.trim()) {
                                updateCharacter(i, "imageUrl", (input as HTMLInputElement).value.trim());
                              }
                            }}
                          >
                            <IconPlus size={12} stroke={2} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {refImageCount > 0 ? (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500">
                <span>已设置 {refImageCount} 张引用图，生成视频时将自动作为参考</span>
              </div>
            ) : null}
          </section>

          <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
            {/* Left: Form */}
            <section className="rounded-lg border border-line bg-panel p-6 shadow-glow">
              <h2 className="mb-4 text-lg font-semibold text-gray-100">生成参数</h2>
              <div className="flex flex-col gap-5">
                <div>
                  <label className="mb-1.5 block text-xs text-gray-500">视频描述提示词</label>
                  <Textarea
                    className="min-h-[120px] resize-y"
                    placeholder="描述你想要生成的视频内容，例如：一只猫在城市屋顶上奔跑，夕阳西下，电影感光影..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>

                {/* Model selector */}
                {videoModels.length > 0 ? (
                  <div>
                    <label className="mb-2 block text-xs text-gray-500">视频模型</label>
                    <div className="flex flex-wrap gap-2">
                      {videoModels.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            videoModel === m.id
                              ? "border-mint bg-mint/10 text-mint"
                              : "border-line bg-panel2 text-gray-400 hover:border-mint/40 hover:text-gray-100"
                          }`}
                          onClick={() => {
                            setVideoModel(m.id);
                            const cfg = getModelConfig(m.id);
                            if (duration < cfg.durationRange[0]) setDuration(cfg.durationRange[0]);
                            if (duration > cfg.durationRange[1]) setDuration(cfg.durationRange[1]);
                            if (!cfg.resolutions.includes(resolution)) setResolution(cfg.resolutions[1] || cfg.resolutions[0]);
                            if (!cfg.ratios.includes(aspectRatio)) setAspectRatio(cfg.ratios[0]);
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Style presets */}
                <div>
                  <label className="mb-2 block text-xs text-gray-500">风格</label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {STYLE_PRESETS.map((s) => {
                      const active = style === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                            active
                              ? "border-mint bg-mint/10 text-mint"
                              : "border-line bg-panel2 text-gray-400 hover:border-mint/40 hover:text-gray-100"
                          }`}
                          onClick={() => setStyle(s.id)}
                        >
                          <span className="text-base">{s.emoji}</span>
                          <span className="font-medium">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="mb-2 block text-xs text-gray-500">视频时长（秒）</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-2xl border border-line bg-panel2 text-gray-400 transition hover:border-mint/40 hover:text-gray-100"
                      onClick={() => setDuration(Math.max(modelConfig.durationRange[0], duration - 1))}
                    >
                      <IconMinus size={16} stroke={2} />
                    </button>
                    <input
                      type="number"
                      className="w-20 rounded-2xl border border-line bg-panel2 py-2 text-center text-sm outline-none focus:border-mint"
                      min={modelConfig.durationRange[0]}
                      max={modelConfig.durationRange[1]}
                      value={duration}
                      onChange={(e) => setDuration(Math.max(modelConfig.durationRange[0], Math.min(modelConfig.durationRange[1], Number(e.target.value) || modelConfig.durationRange[0])))}
                    />
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-2xl border border-line bg-panel2 text-gray-400 transition hover:border-mint/40 hover:text-gray-100"
                      onClick={() => setDuration(Math.min(modelConfig.durationRange[1], duration + 1))}
                    >
                      <IconPlus size={16} stroke={2} />
                    </button>
                    <span className="text-xs text-gray-500">秒（{modelConfig.durationRange[0]}-{modelConfig.durationRange[1]}）</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {modelConfig.durationPresets.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`rounded-lg border px-3 py-1 text-[11px] transition ${
                          duration === d
                            ? "border-mint/40 bg-mint/10 text-mint"
                            : "border-line text-gray-500 hover:text-gray-200"
                        }`}
                        onClick={() => setDuration(d)}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs text-gray-500">画面比例</label>
                  <div className="flex gap-2">
                    {modelConfig.ratios.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                          aspectRatio === r
                            ? "border-mint bg-mint/10 text-mint"
                            : "border-line bg-panel2 text-gray-400 hover:border-mint/40 hover:text-gray-100"
                        }`}
                        onClick={() => setAspectRatio(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs text-gray-500">画质</label>
                  <div className="flex gap-2">
                    {modelConfig.resolutions.map((res) => (
                      <button
                        key={res}
                        type="button"
                        className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                          resolution === res
                            ? "border-mint bg-mint/10 text-mint"
                            : "border-line bg-panel2 text-gray-400 hover:border-mint/40 hover:text-gray-100"
                        }`}
                        onClick={() => setResolution(res)}
                      >
                        {modelConfig.resLabels[res] || res}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reference Images */}
                <div>
                  <label className="mb-2 block text-xs text-gray-500">引用图片（可选，支持多张）</label>

                  {imagePreviews.length > 0 ? (
                    <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {imagePreviews.map((img, i) => (
                        <div key={i} className="group relative">
                          <img src={img.url} alt={img.name} className="h-[120px] w-full rounded-xl object-cover" />
                          <button
                            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                            onClick={() => removeFile(i)}
                          >
                            <IconX size={14} stroke={2} />
                          </button>
                          <p className="mt-1 truncate text-[11px] text-gray-500">{img.name}</p>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="flex h-[120px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-line text-gray-500 transition hover:border-mint/40 hover:text-gray-400"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <IconPlus size={20} stroke={2} />
                        <span className="mt-1 text-xs">继续添加</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mb-3 flex h-[120px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-line text-gray-500 transition hover:border-mint/40 hover:text-gray-400"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <IconUpload size={24} stroke={1.5} />
                      <span className="mt-1 text-xs">点击上传图片（可多选）</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFilesSelect}
                  />

                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] text-gray-500">或填写图片链接</label>
                    {imageUrls.map((url, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel2 text-gray-500">
                          <IconLink size={16} stroke={2} />
                        </div>
                        <input
                          type="text"
                          className="flex-1 rounded-xl border border-line bg-panel2 px-4 text-sm outline-none placeholder:text-gray-500 focus:border-mint"
                          placeholder="https://example.com/image.png"
                          value={url}
                          onChange={(e) => updateUrl(i, e.target.value)}
                        />
                        {imageUrls.length > 1 ? (
                          <button
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-red-500/10 hover:text-red-400"
                            onClick={() => removeUrl(i)}
                          >
                            <IconX size={16} stroke={2} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-mint transition hover:opacity-80"
                      onClick={addUrl}
                    >
                      <IconPlus size={14} stroke={2} />
                      添加更多链接
                    </button>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
              ) : null}

              <div className="mt-5">
                <ActionButton icon={IconWand} label={submitting ? "提交中..." : "开始生成"} onClick={handleGenerate} variant="primary" disabled={submitting} />
              </div>
            </section>

            {/* Right: Task Feed */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-100">生成记录</h2>
                <button
                  className="rounded-full bg-panel2 p-2 text-gray-500 transition hover:text-gray-300"
                  onClick={refreshTasks}
                >
                  <IconRefresh size={14} stroke={2} />
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="rounded-lg border border-line bg-panel p-8 text-center shadow-glow">
                  <IconClock size={32} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm text-gray-500">还没有生成记录</p>
                  <p className="mt-1 text-xs text-gray-500">提交任务后将在此显示</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} onRefresh={refreshTasks} onView={setViewTask} />
                  ))}
                </div>
              )}
            </section>
          </div>
      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
      <TaskDetailDialog task={viewTask} onClose={() => setViewTask(null)} />
      <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
      <RefPickerModal
        open={refPickerIdx !== null}
        history={refImageHistory}
        onClose={() => setRefPickerIdx(null)}
        onSelect={(url) => {
          if (refPickerIdx !== null) {
            setRefImage(refPickerIdx, url);
          }
          setRefPickerIdx(null);
        }}
        onUpload={(url) => {
          if (refPickerIdx !== null) {
            setRefImage(refPickerIdx, url);
          }
          setRefPickerIdx(null);
        }}
        onRemoveHistory={(idx) => {
          setRefImageHistory((prev) => prev.filter((_, i) => i !== idx));
        }}
        onView={setViewerSrc}
      />
    </>
  );
}

function TaskCard({ task, onRefresh, onView }: {
  task: VideoGenerationTask;
  onRefresh: () => void;
  onView: (t: VideoGenerationTask) => void;
}) {
  const params = (task.params || {}) as Record<string, string | number | undefined>;
  const promptText = String(params.prompt || task.story_prompt || "");
  const styleKey = String(params.style || "");
  const styleLabel = STYLE_LABEL_MAP[styleKey] || styleKey || "";
  const dur = Number(params.target_duration || task.target_duration || 5);
  const ratio = String(params.aspect_ratio || task.aspect_ratio || "16:9");
  const isActive = task.status === "queued" || task.status === "running";
  const isDone = task.status === "succeeded";
  const isFailed = task.status === "failed";
  const videoUrl = task.video_url ? `${getApiBase()}${task.video_url}` : "";

  // Elapsed time counter for active tasks
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [isActive]);

  // Poll active tasks
  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(onRefresh, 5000);
    return () => clearInterval(iv);
  }, [isActive, onRefresh]);

  const elapsed = task.created_at ? Math.floor((now - new Date(task.created_at).getTime()) / 1000) : 0;
  const totalDuration = task.created_at && task.updated_at
    ? Math.floor((new Date(task.updated_at).getTime() - new Date(task.created_at).getTime()) / 1000)
    : 0;
  const isStalling = task.status === "running" && task.updated_at && (now - new Date(task.updated_at).getTime() > 60000);
  const progressStep = params.progress_step;

  // Completed: compact card with view button
  if (isDone) {
    return (
      <div className="rounded-[20px] border border-line bg-panel p-4 shadow-glow transition hover:border-mint/40">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/100" />
          <span className="text-[11px] font-medium text-emerald-400">已完成</span>
          {totalDuration > 0 ? (
            <span className="text-[10px] text-gray-500">耗时 {formatElapsed(totalDuration)}</span>
          ) : null}
          <span className="ml-auto text-[10px] text-gray-500">#{task.id}</span>
        </div>
        <p className="mb-2 line-clamp-2 text-sm text-gray-200">{promptText}</p>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {styleLabel ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{styleLabel}</span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{ratio}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{dur}s</span>
          {task.created_at ? (
            <span className="ml-auto text-[10px] text-gray-500">{timeAgo(task.created_at)}</span>
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
            {isStalling ? (
              <span className="text-[10px] text-amber-500">连接中...</span>
            ) : null}
          </>
        ) : isFailed ? (
          <>
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/100" />
            <span className="text-[11px] font-medium text-red-400">失败</span>
          </>
        ) : (
          <>
            <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="text-[11px] font-medium text-gray-500">排队中</span>
          </>
        )}
        <span className="ml-auto text-[10px] text-gray-500">#{task.id}</span>
      </div>

      <p className="mb-2 line-clamp-2 text-sm text-gray-200">{promptText}</p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {styleLabel ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{styleLabel}</span>
        ) : null}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{ratio}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{dur}s</span>
        {task.created_at ? (
          <span className="ml-auto text-[10px] text-gray-500">{timeAgo(task.created_at)}</span>
        ) : null}
      </div>

      {isActive ? (
        <div className="mt-1">
          {progressStep ? (
            <p className="mb-1 text-[11px] text-gray-500">{progressStep}</p>
          ) : null}
          <p className="text-[11px] text-gray-500">已用 {formatElapsed(elapsed)}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full w-1/3 rounded-full bg-mint"
              style={{ animation: "indeterminate 2s ease-in-out infinite" }}
            />
          </div>
        </div>
      ) : null}

      {isFailed && task.error_message ? (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{task.error_message}</div>
      ) : null}
      {isFailed && totalDuration > 0 ? (
        <p className="mt-2 text-[10px] text-gray-500">耗时 {formatElapsed(totalDuration)}</p>
      ) : null}
    </div>
  );
}

function TaskDetailDialog({ task, onClose }: { task: VideoGenerationTask | null; onClose: () => void }) {
  if (!task) return null;

  const params = (task.params || {}) as Record<string, string | number | undefined>;
  const promptText = String(params.prompt || task.story_prompt || "");
  const styleKey = String(params.style || "");
  const styleLabel = STYLE_LABEL_MAP[styleKey] || styleKey || "";
  const dur = Number(params.target_duration || task.target_duration || 5);
  const ratio = String(params.aspect_ratio || task.aspect_ratio || "16:9");
  const videoUrl = task.video_url ? `${getApiBase()}${task.video_url}` : "";

  return (
    <Dialog open={!!task} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-[#1a1a2e] p-6 text-white ring-white/10"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>任务详情</DialogTitle>
          <DialogDescription>查看生成任务的视频、提示词和元数据。</DialogDescription>
        </DialogHeader>
        {/* Header */}
        <div className="mb-5 flex items-center">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/100" />
            <span className="text-sm font-semibold text-white">任务 #{task.id}</span>
            <span className="rounded-full bg-emerald-500/100/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">已完成</span>
          </div>
        </div>

        {/* Video */}
        {videoUrl ? (
          <div className="mb-5">
            <VideoPlayer src={videoUrl} aspectRatio={ratio.replace(":", " / ")} />
          </div>
        ) : null}

        {/* Prompt */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/40">提示词</label>
          <p className="rounded-xl bg-panel/5 px-4 py-3 text-sm leading-6 text-white/90">{promptText}</p>
        </div>

        {/* Meta */}
        <div className="mb-5 flex flex-wrap gap-2">
          {styleLabel ? (
            <span className="rounded-full bg-panel/10 px-3 py-1 text-xs text-white/70">风格: {styleLabel}</span>
          ) : null}
          <span className="rounded-full bg-panel/10 px-3 py-1 text-xs text-white/70">比例: {ratio}</span>
          <span className="rounded-full bg-panel/10 px-3 py-1 text-xs text-white/70">时长: {dur}s</span>
          {task.created_at ? (
            <span className="rounded-full bg-panel/10 px-3 py-1 text-xs text-white/70">{timeAgo(task.created_at)}</span>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {videoUrl ? (
            <ActionButton icon={IconDownload} label="下载视频" onClick={() => window.open(videoUrl, "_blank")} variant="primary" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RefPickerModal({ open, history, onClose, onSelect, onUpload, onRemoveHistory, onView }: {
  open: boolean;
  history: string[];
  onClose: () => void;
  onSelect: (url: string) => void;
  onUpload: (url: string) => void;
  onRemoveHistory: (idx: number) => void;
  onView: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpload(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="max-h-[80vh] max-w-lg overflow-y-auto rounded-lg border border-line bg-panel p-5"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>选择参考图</DialogTitle>
          <DialogDescription>上传或选择历史参考图。</DialogDescription>
        </DialogHeader>
        {/* Header */}
        <div className="mb-4 flex items-center">
          <h3 className="text-sm font-semibold text-gray-100">选择参考图</h3>
        </div>

        {/* Upload button */}
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="flex h-[80px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-line text-gray-500 transition hover:border-mint/40 hover:text-gray-400"
            onClick={() => fileInputRef.current?.click()}
          >
            <IconUpload size={20} stroke={1.5} />
            <span className="mt-1 text-xs">本地上传图片</span>
          </button>
        </div>

        {/* History */}
        {history.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] text-gray-500">历史参考图</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {history.map((url, idx) => (
                <div key={idx} className="group relative">
                  <img
                    src={url}
                    alt={`历史 ${idx + 1}`}
                    className="aspect-square w-full cursor-pointer rounded-lg border border-line object-cover transition hover:border-mint"
                    onClick={() => onSelect(url)}
                    onDoubleClick={() => onView(url)}
                  />
                  <button
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveHistory(idx);
                    }}
                  >
                    <IconX size={8} stroke={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-gray-500">暂无历史参考图</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
