"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import {
  klingT2V, klingI2V, klingGenerateImage, klingOmniImage, klingOmniVideo,
  listKlingTasks, getKlingStatus, getApiBase,
} from "../../src/api";
import { ActionButton, ImageViewer } from "../../src/components/ui-legacy";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../src/components/ui/dialog";
import { Textarea } from "../../src/components/ui/textarea";
import VideoPlayer from "../../src/components/VideoPlayer";
import {
  IconWand, IconX, IconRefresh,
  IconDownload, IconUpload, IconPlus, IconClock, IconEye, IconSparkles,
} from "@tabler/icons-react";

const MODES = [
  { id: "t2v", label: "文生视频", desc: "输入提示词，直接生成视频" },
  { id: "i2v", label: "图生视频", desc: "上传首帧图片，生成视频" },
  { id: "omni-video", label: "Omni 视频", desc: "多图引用，AI 生成视频" },
  { id: "image", label: "图片生成", desc: "输入提示词，生成图片" },
];

const RATIOS = ["16:9", "9:16", "1:1"];
const MODES_KLING = ["std", "pro", "4k"];
const MODE_LABELS: Record<string, string> = { std: "标准", pro: "专家", "4k": "4K" };

const VIDEO_MODELS = [
  { id: "kling-v1", label: "V1" },
  { id: "kling-v1-5", label: "V1.5" },
  { id: "kling-v1-6", label: "V1.6" },
  { id: "kling-v2-1", label: "V2.1" },
  { id: "kling-v2-master", label: "V2 Master" },
  { id: "kling-v2-1-master", label: "V2.1 Master" },
  { id: "kling-v2-5-turbo", label: "V2.5 Turbo" },
  { id: "kling-v2-6", label: "V2.6" },
  { id: "kling-v3", label: "V3" },
  { id: "kling-v3-omni", label: "V3 Omni" },
  { id: "kling-video-o1", label: "Video O1 (Omni)" },
];

const IMAGE_MODELS = [
  { id: "kling-v1", label: "V1" },
  { id: "kling-v1-5", label: "V1.5" },
  { id: "kling-v2", label: "V2" },
  { id: "kling-v2-new", label: "V2 New" },
  { id: "kling-v2-1", label: "V2.1" },
  { id: "kling-v3", label: "V3" },
];

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
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

export default function KlingPage() {
  const [mode, setMode] = useState("t2v");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [modelName, setModelName] = useState("kling-v1-6");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [klingMode, setKlingMode] = useState("std");
  const [duration, setDuration] = useState("5");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [firstFramePrompt, setFirstFramePrompt] = useState("");
  const [generatingFirstFrame, setGeneratingFirstFrame] = useState(false);
  const [imageTailFile, setImageTailFile] = useState<File | null>(null);
  const [imageTailPreview, setImageTailPreview] = useState<string>("");

  // Omni video images
  const [omniVideoImages, setOmniVideoImages] = useState<string[]>([]);
  const omniVideoFileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [viewTask, setViewTask] = useState<any>(null);

  // Reference images (生成图片模块)
  const [refImages, setRefImages] = useState<any[]>([]);
  const [generatingRefIdx, setGeneratingRefIdx] = useState<number | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const refFileInputIdx = useRef<number | null>(null);
  const refFileInput = useRef<HTMLInputElement>(null);

  // Task feed
  const [tasks, setTasks] = useState<any[]>([]);
  const feedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTailInputRef = useRef<HTMLInputElement>(null);

  const refreshTasks = useCallback(async () => {
    try {
      const data = await listKlingTasks();
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

  function handleFileSelect(e: any, type: "start" | "tail") {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (type === "start") {
        setImageFile(file);
        setImagePreview(reader.result as string);
      } else {
        setImageTailFile(file);
        setImageTailPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
    if (type === "start" && fileInputRef.current) fileInputRef.current.value = "";
    if (type === "tail" && fileTailInputRef.current) fileTailInputRef.current.value = "";
  }

  function removeFile(type: "start" | "tail") {
    if (type === "start") {
      setImageFile(null);
      setImagePreview("");
    } else {
      setImageTailFile(null);
      setImageTailPreview("");
    }
  }

  function resetForm() {
    setPrompt("");
    setNegativePrompt("");
    setImageFile(null);
    setImagePreview("");
    setFirstFramePrompt("");
    setImageTailFile(null);
    setImageTailPreview("");
    setOmniVideoImages([]);
  }

  function addRefImage() {
    setRefImages((prev) => [...prev, { name: "", prompt: "", negativePrompt: "", images: [], imageUrl: "" }]);
  }

  function updateRefImage(index: number, field: string, value: any) {
    setRefImages((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }

  function removeRefImage(index: number) {
    setRefImages((prev) => prev.filter((_, i) => i !== index));
  }

  function addRefImageFile(cardIdx: number, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setRefImages((prev) => prev.map((c, i) => {
        if (i !== cardIdx) return c;
        return { ...c, images: [...(c.images || []), reader.result as string] };
      }));
    };
    reader.readAsDataURL(file);
  }

  function removeRefImageAt(cardIdx: number, imgIdx: number) {
    setRefImages((prev) => prev.map((c, i) => {
      if (i !== cardIdx) return c;
      return { ...c, images: c.images.filter((_: any, j: number) => j !== imgIdx) };
    }));
  }

  async function handleGenerateRefImage(index: number) {
    const ref = refImages[index];
    if (!ref.prompt?.trim()) {
      toast.error("请先填写提示词");
      return;
    }
    setGeneratingRefIdx(index);
    try {
      const image_list = (ref.images || []).map((img: string) => {
        if (img.startsWith("data:")) return img.split(",")[1];
        return img;
      });
      const data = await klingOmniImage({
        prompt: ref.prompt.trim(),
        negative_prompt: (ref.negativePrompt || "").trim(),
        image_list,
        model_name: "kling-image-o1",
        aspect_ratio: "9:16",
        resolution: "1k",
        n: 1,
      });
      const taskId = data.task_id;
      if (!taskId) {
        toast.error("未获取到任务 ID");
        return;
      }
      // Poll for completion
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const status = await getKlingStatus(taskId);
        if (status.status === "succeeded") {
          const outputUrl = status.video_url ? `${getApiBase()}${status.video_url}` : "";
          if (outputUrl) {
            updateRefImage(index, "imageUrl", outputUrl);
            toast.success("图片已生成");
            refreshTasks();
          } else {
            toast.error("生成成功但未获取到图片地址");
          }
          return;
        }
        if (status.status === "failed") {
          toast.error(status.error_message || "生成失败");
          return;
        }
      }
      toast.error("生成超时");
    } catch (err: any) {
      toast.error(String(err.message || err));
    } finally {
      setGeneratingRefIdx(null);
    }
  }

  function switchMode(m: string) {
    setMode(m);
    resetForm();
    if (m === "image") {
      setModelName("kling-v2-1");
    } else if (m === "omni-video") {
      setModelName("kling-video-o1");
    } else {
      setModelName("kling-v1-6");
    }
  }

  async function handleRetry(task: any) {
    const p = task.params || {};
    const method = p.method || "";
    try {
      if (task.task_type === "kling_t2v" || (task.task_type === "kling" && method === "generate_t2v")) {
        await klingT2V({
          prompt: p.prompt || "",
          model_name: p.model_name || "kling-v1-6",
          aspect_ratio: p.aspect_ratio || "16:9",
          duration: p.duration || "5",
          mode: p.mode || "std",
          negative_prompt: p.negative_prompt || "",
        });
      } else if (task.task_type === "kling_i2v" || (task.task_type === "kling" && method === "generate_i2v")) {
        await klingI2V({
          prompt: p.prompt || "",
          image: p.image || "",
          image_tail: p.image_tail || "",
          model_name: p.model_name || "kling-v1-6",
          aspect_ratio: p.aspect_ratio || "16:9",
          duration: p.duration || "5",
          mode: p.mode || "std",
          negative_prompt: p.negative_prompt || "",
          sound: p.sound || "on",
        });
      } else if (task.task_type === "kling_image" || (task.task_type === "kling" && method === "generate_image")) {
        await klingGenerateImage({
          prompt: p.prompt || "",
          model_name: p.model_name || "kling-v2-1",
          aspect_ratio: p.aspect_ratio || "16:9",
          negative_prompt: p.negative_prompt || "",
        });
      } else if (task.task_type === "kling" && method === "generate_omni_video") {
        await klingOmniVideo({
          prompt: p.prompt || "",
          image_list: p.image_list || [],
          model_name: p.model_name || "kling-video-o1",
          aspect_ratio: p.aspect_ratio || "16:9",
          duration: p.duration || "5",
          mode: p.mode || "std",
        });
      } else if (task.task_type === "kling" && method === "generate_omni_image") {
        await klingOmniImage({
          prompt: p.prompt || "",
          image_list: p.image_list || [],
          model_name: p.model_name || "kling-image-o1",
          aspect_ratio: p.aspect_ratio || "16:9",
          resolution: p.resolution || "1k",
          n: p.n || 1,
        });
      }
      toast.success("已重新提交");
      refreshTasks();
    } catch (err: any) {
      toast.error(String(err.message || err));
    }
  }

  async function handleGenerateFirstFrame() {
    if (!firstFramePrompt.trim()) {
      toast.error("请输入首帧图描述");
      return;
    }
    setGeneratingFirstFrame(true);
    try {
      const data = await klingGenerateImage({
        prompt: firstFramePrompt.trim(),
        model_name: modelName.startsWith("kling") && !IMAGE_MODELS.find(m => m.id === modelName) ? "kling-v2-1" : modelName,
        aspect_ratio: aspectRatio,
        negative_prompt: "",
      });
      // The backend returns the saved asset path; build full URL
      const outputUrl = data.output_path ? `${getApiBase()}/assets/${data.output_path}` : "";
      if (outputUrl) {
        setImagePreview(outputUrl);
        setImageFile(null); // clear file, use URL instead
        toast.success("首帧图已生成");
      } else {
        toast.error("生成成功但未获取到图片地址");
      }
    } catch (err: any) {
      toast.error(String(err.message || err));
    } finally {
      setGeneratingFirstFrame(false);
    }
  }

  async function handleSubmit() {
    if (!prompt.trim() && !imageFile) {
      toast.error("请输入提示词或上传图片");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "t2v") {
        await klingT2V({
          prompt: prompt.trim(),
          model_name: modelName,
          aspect_ratio: aspectRatio,
          duration,
          mode: klingMode,
          negative_prompt: negativePrompt.trim(),
        });
      } else if (mode === "i2v") {
        let image = "";
        let image_tail = "";
        if (imageFile) {
          const b64 = await fileToBase64(imageFile);
          image = `data:image/png;base64,${b64}`;
        } else if (imagePreview && imagePreview.startsWith("http")) {
          // Generated first frame URL
          image = imagePreview;
        }
        if (imageTailFile) {
          const b64 = await fileToBase64(imageTailFile);
          image_tail = `data:image/png;base64,${b64}`;
        }
        await klingI2V({
          prompt: prompt.trim(),
          image,
          image_tail,
          model_name: modelName,
          aspect_ratio: aspectRatio,
          duration,
          mode: klingMode,
          negative_prompt: negativePrompt.trim(),
          sound: "on",
        });
      } else if (mode === "omni-video") {
        const image_list = omniVideoImages.map((img) => {
          if (img.startsWith("data:")) return img.split(",")[1];
          return img;
        });
        await klingOmniVideo({
          prompt: prompt.trim(),
          image_list,
          model_name: modelName,
          aspect_ratio: aspectRatio,
          duration,
          mode: klingMode,
        });
      } else {
        await klingGenerateImage({
          prompt: prompt.trim(),
          model_name: modelName,
          aspect_ratio: aspectRatio,
          negative_prompt: negativePrompt.trim(),
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

  const activeTask = tasks.find((t) => t.status === "queued" || t.status === "running");

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-panel px-5 py-4 shadow-glow">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-mint">Kling 可灵</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-100">可灵视频生成</h1>
        </div>
        {activeTask ? (
          <div className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <span className="text-[11px] font-medium text-amber-700">生成中 #{activeTask.id}</span>
          </div>
        ) : null}
      </div>

      {/* 生成图片模块 */}
      <section className="rounded-lg border border-line bg-panel p-5 shadow-glow">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <label className="text-xs font-medium text-gray-500">生成图片</label>
            <span className="ml-2 text-[11px] text-gray-500">
              使用可灵图片模型生成，可作为视频首帧
            </span>
          </div>
          <button
            className="inline-flex items-center gap-1 rounded-full bg-panel2 px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:text-gray-100"
            onClick={addRefImage}
            disabled={refImages.length >= 4}
          >
            <IconPlus size={14} stroke={2} />
            添加图片
          </button>
        </div>

        {refImages.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-500">
            使用可灵 Image Omni 模型生成图片，支持上传引用图。提示词中用 <code className="rounded bg-panel2 px-1 text-[10px]">{"<<<image_1>>>"}</code> 引用上传的图片
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {refImages.map((ref, i) => (
              <div key={i} className="rounded-xl border border-line bg-panel2 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-transparent text-xs font-medium outline-none placeholder:text-gray-500"
                    placeholder="名称（可选）"
                    value={ref.name}
                    onChange={(e) => updateRefImage(i, "name", e.target.value)}
                  />
                  <button
                    className="text-gray-500 transition hover:text-red-400"
                    onClick={() => removeRefImage(i)}
                  >
                    <IconX size={14} stroke={2} />
                  </button>
                </div>
                <textarea
                  className="mb-2 w-full resize-y rounded-lg border border-line bg-panel px-3 py-1.5 text-xs outline-none placeholder:text-gray-500 focus:border-mint"
                  rows={2}
                  placeholder={"提示词，用 <<<image_1>>> 引用图片"}
                  value={ref.prompt}
                  onChange={(e) => updateRefImage(i, "prompt", e.target.value)}
                />
                <textarea
                  className="mb-2 w-full resize-y rounded-lg border border-line bg-panel px-3 py-1.5 text-[11px] outline-none placeholder:text-gray-500 focus:border-mint"
                  rows={1}
                  placeholder="反向提示词（可选）"
                  value={ref.negativePrompt || ""}
                  onChange={(e) => updateRefImage(i, "negativePrompt", e.target.value)}
                />

                {/* Reference images */}
                <div className="mb-2">
                  <label className="mb-1 block text-[10px] text-gray-500">
                    引用图（{((ref.images || []).length)} 张）
                  </label>
                  {(ref.images || []).length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {ref.images.map((img: string, j: number) => (
                        <div key={j} className="group relative h-[48px] w-[48px] shrink-0">
                          <img src={img} alt={`ref ${j + 1}`} className="h-full w-full rounded-lg object-cover" />
                          <button
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                            onClick={() => removeRefImageAt(i, j)}
                          >
                            <IconX size={8} stroke={2} />
                          </button>
                          <span className="absolute bottom-0 left-0 rounded-br-lg rounded-tl-lg bg-black/50 px-1 text-[8px] text-white">
                            {j + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="flex h-[28px] w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-line text-gray-500 transition hover:border-mint/40 hover:text-gray-400"
                    onClick={() => { refFileInputIdx.current = i; refFileInput.current?.click(); }}
                  >
                    <IconUpload size={10} stroke={1.5} />
                    <span className="text-[9px]">上传引用图</span>
                  </button>
                </div>

                {/* Generated output */}
                {ref.imageUrl ? (
                  <div className="group relative">
                    <img
                      src={ref.imageUrl}
                      alt={ref.name || "generated"}
                      className="h-[120px] w-full cursor-zoom-in rounded-lg object-cover"
                      onClick={() => setViewerSrc(ref.imageUrl)}
                    />
                    <button
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                      onClick={() => updateRefImage(i, "imageUrl", "")}
                    >
                      <IconX size={10} stroke={2} />
                    </button>
                    <button
                      className="absolute bottom-1 left-1 rounded-full bg-mint/90 px-2 py-0.5 text-[9px] font-medium text-white opacity-0 transition group-hover:opacity-100"
                      onClick={() => {
                        setImagePreview(ref.imageUrl);
                        setImageFile(null);
                        setMode("i2v");
                      }}
                    >
                      用作首帧
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={generatingRefIdx === i || !ref.prompt?.trim()}
                    className="flex h-[60px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-line text-gray-500 transition hover:border-mint/40 hover:text-gray-400 disabled:opacity-50"
                    onClick={() => handleGenerateRefImage(i)}
                  >
                    {generatingRefIdx === i ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-mint border-t-transparent" />
                    ) : (
                      <IconSparkles size={18} stroke={1.5} />
                    )}
                    <span className="mt-1 text-[10px]">{generatingRefIdx === i ? "生成中..." : "AI 生成图片"}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* Left: Form */}
        <section className="rounded-lg border border-line bg-panel p-6 shadow-glow">
          {/* Mode tabs */}
          <div className="mb-5 flex gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`flex-1 rounded-xl border px-3 py-3 text-left transition ${mode === m.id
                  ? "border-mint bg-mint/10"
                  : "border-line bg-panel2 hover:border-mint/40"
                  }`}
                onClick={() => switchMode(m.id)}
              >
                <p className={`text-sm font-medium ${mode === m.id ? "text-mint" : "text-gray-300"}`}>{m.label}</p>
                <p className="mt-0.5 text-[11px] text-gray-500">{m.desc}</p>
              </button>
            ))}
          </div>

          {/* Prompt */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs text-gray-500">
              {mode === "image" ? "图片描述提示词" : "视频描述提示词"}
            </label>
            <Textarea
              className="min-h-[100px] resize-y"
              placeholder={
                mode === "t2v"
                  ? "描述你希望生成的视频内容..."
                  : mode === "i2v"
                    ? "描述你希望图片如何动起来..."
                    : "描述你希望生成的图片内容..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {/* Negative prompt (image mode) */}
          {mode !== "omni-video" && (
            <div className="mb-4">
              <label className="mb-1.5 block text-xs text-gray-500">反向提示词（可选）</label>
              <Textarea
                className="min-h-[60px] resize-y"
                placeholder="描述不希望出现的内容..."
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
              />
            </div>
          )}

          {/* Image upload (for i2v) */}
          {mode === "i2v" && (
            <div className="mb-4">
              {/* Generate first frame */}
              <div className="mb-3">
                <label className="mb-1.5 block text-xs text-gray-500">AI 生成首帧图</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-xl border border-line bg-panel2 px-3 py-1.5 text-xs outline-none placeholder:text-gray-500 focus:border-mint"
                    placeholder="描述首帧画面，例如：一个穿红色连衣裙的女孩站在雨中街道上"
                    value={firstFramePrompt}
                    onChange={(e) => setFirstFramePrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleGenerateFirstFrame(); }}
                  />
                  <button
                    type="button"
                    disabled={generatingFirstFrame || !firstFramePrompt.trim()}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-mint/10 px-3 py-1.5 text-xs font-medium text-mint transition hover:bg-mint/20 disabled:opacity-50"
                    onClick={handleGenerateFirstFrame}
                  >
                    {generatingFirstFrame ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-mint border-t-transparent" />
                    ) : (
                      <IconSparkles size={14} stroke={2} />
                    )}
                    {generatingFirstFrame ? "生成中..." : "生成首帧"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Start frame */}
                <div>
                  <label className="mb-1.5 block text-xs text-gray-500">首帧图片</label>
                  {imagePreview ? (
                    <div className="group relative">
                      <img src={imagePreview} alt="首帧" className="h-[120px] w-full rounded-xl object-cover" />
                      <button
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                        onClick={() => removeFile("start")}
                      >
                        <IconX size={12} stroke={2} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex h-[120px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-line text-gray-500 transition hover:border-mint/40"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <IconUpload size={20} stroke={1.5} />
                      <span className="mt-1 text-xs">上传首帧</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, "start")} />
                </div>
                {/* End frame */}
                <div>
                  <label className="mb-1.5 block text-xs text-gray-500">尾帧图片（可选）</label>
                  {imageTailPreview ? (
                    <div className="group relative">
                      <img src={imageTailPreview} alt="尾帧" className="h-[120px] w-full rounded-xl object-cover" />
                      <button
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                        onClick={() => removeFile("tail")}
                      >
                        <IconX size={12} stroke={2} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex h-[120px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-line text-gray-500 transition hover:border-mint/40"
                      onClick={() => fileTailInputRef.current?.click()}
                    >
                      <IconUpload size={20} stroke={1.5} />
                      <span className="mt-1 text-xs">上传尾帧</span>
                    </button>
                  )}
                  <input ref={fileTailInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, "tail")} />
                </div>
              </div>
            </div>
          )}

          {/* Omni video images */}
          {mode === "omni-video" && (
            <div className="mb-4">
              <label className="mb-1.5 block text-xs text-gray-500">
                引用图片（可选）
                <span className="ml-2 text-[10px] text-gray-500">提示词中用 <code className="rounded bg-panel2 px-1">{"<<<image_1>>>"}</code> 引用</span>
              </label>
              {omniVideoImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {omniVideoImages.map((img, i) => (
                    <div key={i} className="group relative h-[72px] w-[72px] shrink-0">
                      <img src={img} alt={`ref ${i + 1}`} className="h-full w-full rounded-xl object-cover" />
                      <button
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                        onClick={() => setOmniVideoImages((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <IconX size={10} stroke={2} />
                      </button>
                      <span className="absolute bottom-0 left-0 rounded-br-xl rounded-tl-xl bg-black/50 px-1.5 py-0.5 text-[9px] text-white">
                        {i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="flex h-[48px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line text-gray-500 transition hover:border-mint/40 hover:text-gray-400"
                onClick={() => omniVideoFileRef.current?.click()}
                disabled={omniVideoImages.length >= 5}
              >
                <IconUpload size={16} stroke={1.5} />
                <span className="text-xs">上传引用图（最多 5 张）</span>
              </button>
              <input
                ref={omniVideoFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setOmniVideoImages((prev) => [...prev, reader.result as string]);
                    reader.readAsDataURL(file);
                  }
                  if (omniVideoFileRef.current) omniVideoFileRef.current.value = "";
                }}
              />
            </div>
          )}

          {/* Parameters */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Model */}
            <div>
              <label className="mb-1.5 block text-xs text-gray-500">模型</label>
              <select
                className="w-full rounded-xl border border-line bg-panel2 px-3 py-1.5 text-xs outline-none focus:border-mint"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
              >
                {(mode === "image" ? IMAGE_MODELS : VIDEO_MODELS).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Aspect ratio */}
            <div>
              <label className="mb-1.5 block text-xs text-gray-500">画面比例</label>
              <div className="flex gap-1.5">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${aspectRatio === r
                      ? "border-mint bg-mint/10 text-mint"
                      : "border-line bg-panel2 text-gray-500 hover:text-gray-200"
                      }`}
                    onClick={() => setAspectRatio(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode (std/pro/4k) - only for video */}
            {mode !== "image" && (
              <div>
                <label className="mb-1.5 block text-xs text-gray-500">画质</label>
                <div className="flex gap-1.5">
                  {MODES_KLING.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${klingMode === m
                        ? "border-mint bg-mint/10 text-mint"
                        : "border-line bg-panel2 text-gray-500 hover:text-gray-200"
                        }`}
                      onClick={() => setKlingMode(m)}
                    >
                      {MODE_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Duration - only for video */}
            {mode !== "image" && (
              <div>
                <label className="mb-1.5 block text-xs text-gray-500">时长（秒）</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-16 rounded-xl border border-line bg-panel2 py-1.5 text-center text-xs outline-none focus:border-mint"
                    min={3}
                    max={15}
                    value={duration}
                    onChange={(e) => {
                      const v = Math.max(3, Math.min(15, Number(e.target.value) || 3));
                      setDuration(String(v));
                    }}
                  />
                  <div className="flex gap-1">
                    {[5, 10, 15].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`rounded-md border px-2 py-1 text-[10px] transition ${duration === String(d) ? "border-mint/40 bg-mint/10 text-mint" : "border-line text-gray-500"
                          }`}
                        onClick={() => setDuration(String(d))}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
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
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tasks.map((task: any) => (
                <KlingTaskCard key={task.id} task={task} allTasks={tasks} onRefresh={refreshTasks} onView={setViewTask} onRetry={handleRetry} />
              ))}
            </div>
          )}
        </section>
      </div>

      <KlingTaskDetailDialog task={viewTask} onClose={() => setViewTask(null)} />
      <ImageViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />
      <input
        ref={refFileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && refFileInputIdx.current !== null) {
            addRefImageFile(refFileInputIdx.current, file);
          }
          if (refFileInput.current) refFileInput.current.value = "";
        }}
      />
      <style>{`
        @keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
      `}</style>
    </>
  );
}

function estimateAvgDuration(tasks: any[], currentTask: any): number | null {
  const type = currentTask.task_type;
  const completed = tasks.filter(
    (t: any) => t.status === "succeeded" && t.created_at && t.updated_at && t.task_type === type
  );
  if (completed.length === 0) return null;

  const total = completed.reduce(
    (sum: number, t: any) => sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 1000,
    0
  );
  return total / completed.length;
}

function taskTypeLabel(taskType: string, params?: any): string {
  if (taskType === "kling_t2v") return "文生视频";
  if (taskType === "kling_i2v") return "图生视频";
  if (taskType === "kling_image") return "图片生成";
  if (taskType === "kling") {
    const method = params?.method || "";
    if (method === "generate_t2v") return "文生视频";
    if (method === "generate_i2v") return "图生视频";
    if (method === "generate_image") return "图片生成";
    if (method === "generate_omni_image") return "Omni 图片";
    if (method === "generate_omni_video") return "Omni 视频";
  }
  return taskType;
}

function KlingTaskCard({ task, allTasks, onRefresh, onView, onRetry }: { task: any; allTasks: any[]; onRefresh: any; onView: any; onRetry: any }) {
  const params = task.params || {};
  const promptText = params.prompt || task.story_prompt || "";
  const dur = params.duration || "";
  const ratio = params.aspect_ratio || task.aspect_ratio || "16:9";
  const modeVal = params.mode || "";
  const isActive = task.status === "queued" || task.status === "running";
  const isDone = task.status === "succeeded";
  const isFailed = task.status === "failed";
  const isImage = task.task_type === "kling_image" || (task.task_type === "kling" && (task.params?.method === "generate_image" || task.params?.method === "generate_omni_image"));
  const outputUrl = task.output_path ? `${getApiBase()}/assets/${task.output_path}` : "";

  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(onRefresh, 5000);
    return () => clearInterval(iv);
  }, [isActive, onRefresh]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [isActive]);

  const elapsed = task.created_at
    ? Math.floor((now - new Date(task.created_at).getTime()) / 1000)
    : 0;

  const avgDuration = isActive ? estimateAvgDuration(allTasks, task) : null;
  const progressPercent = avgDuration && elapsed > 0
    ? Math.min(Math.round((elapsed / avgDuration) * 100), 95)
    : null;

  // Completed card
  if (isDone) {
    const totalDuration = task.created_at && task.updated_at
      ? formatElapsed(Math.floor((new Date(task.updated_at).getTime() - new Date(task.created_at).getTime()) / 1000))
      : "";
    return (
      <div className="rounded-[20px] border border-line bg-panel p-4 shadow-glow transition hover:border-mint/40">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/100" />
          <span className="text-[11px] font-medium text-emerald-400">已完成</span>
          {totalDuration && <span className="text-[10px] text-gray-500">耗时 {totalDuration}</span>}
          <span className="ml-auto text-[10px] text-gray-500">#{task.id}</span>
        </div>
        <p className="mb-2 line-clamp-2 text-sm text-gray-200">{promptText}</p>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{taskTypeLabel(task.task_type, task.params)}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{ratio}</span>
          {modeVal && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{MODE_LABELS[modeVal] || modeVal}</span>}
          {dur && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{dur}s</span>}
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

  // Active / Failed / Queued
  const failedDuration = isFailed && task.created_at && task.updated_at
    ? formatElapsed(Math.floor((new Date(task.updated_at).getTime() - new Date(task.created_at).getTime()) / 1000))
    : "";

  return (
    <div className={`rounded-[20px] border bg-panel p-4 shadow-glow transition ${isActive ? "border-amber-300 ring-1 ring-amber-200" : "border-line"
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
          </>
        ) : isFailed ? (
          <>
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/100" />
            <span className="text-[11px] font-medium text-red-400">失败</span>
            {failedDuration && <span className="text-[10px] text-rose-400">耗时 {failedDuration}</span>}
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
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{taskTypeLabel(task.task_type, task.params)}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{ratio}</span>
        {modeVal && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{MODE_LABELS[modeVal] || modeVal}</span>}
        {dur && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-500">{dur}s</span>}
        {task.created_at ? (
          <span className="ml-auto text-[10px] text-gray-500">{timeAgo(task.created_at)}</span>
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
              <span className="shrink-0 text-[10px] font-medium text-gray-500">{progressPercent}%</span>
            </div>
          ) : (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/3 rounded-full bg-mint" style={{ animation: "indeterminate 2s ease-in-out infinite" }} />
            </div>
          )}
        </div>
      )}

      {isFailed && task.error_message ? (
        <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{task.error_message}</div>
      ) : null}

      {isFailed ? (
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-500/10 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
          onClick={() => onRetry(task)}
        >
          <IconRefresh size={14} stroke={2} />
          重试
        </button>
      ) : null}
    </div>
  );
}

function KlingTaskDetailDialog({ task, onClose }: { task: any; onClose: any }) {
  if (!task) return null;

  const params = task.params || {};
  const promptText = params.prompt || task.story_prompt || "";
  const dur = params.duration || "";
  const ratio = params.aspect_ratio || task.aspect_ratio || "16:9";
  const modeVal = params.mode || "";
  const isImage = task.task_type === "kling_image" || (task.task_type === "kling" && (task.params?.method === "generate_image" || task.params?.method === "generate_omni_image"));
  const outputUrl = task.output_path ? `${getApiBase()}/assets/${task.output_path}` : "";

  return (
    <Dialog open={!!task} onOpenChange={(open: any) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-[#1a1a2e] p-6 text-white ring-white/10"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Kling 任务详情</DialogTitle>
          <DialogDescription>查看 Kling 任务输出、提示词和参数。</DialogDescription>
        </DialogHeader>
        {/* Header */}
        <div className="mb-5 flex items-center">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/100" />
            <span className="text-sm font-semibold text-white">任务 #{task.id}</span>
            <span className="rounded-full bg-emerald-500/100/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">已完成</span>
          </div>
        </div>

        {/* Output */}
        {outputUrl ? (
          <div className="mb-5">
            {isImage ? (
              <img src={outputUrl} alt="Generated" className="w-full rounded-xl" />
            ) : (
              <VideoPlayer src={outputUrl} aspectRatio={ratio.replace(":", " / ")} />
            )}
          </div>
        ) : null}
        {!outputUrl ? (
          <div className="mb-5 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            输出下载失败，请重试
          </div>
        ) : null}

        {/* Prompt */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/40">提示词</label>
          <p className="rounded-xl bg-panel/5 px-4 py-3 text-sm leading-6 text-white/90">{promptText || "—"}</p>
        </div>

        {/* Meta */}
        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-panel/10 px-3 py-1 text-xs text-white/70">{taskTypeLabel(task.task_type, task.params)}</span>
          <span className="rounded-full bg-panel/10 px-3 py-1 text-xs text-white/70">比例: {ratio}</span>
          {modeVal && <span className="rounded-full bg-panel/10 px-3 py-1 text-xs text-white/70">画质: {MODE_LABELS[modeVal] || modeVal}</span>}
          {dur && <span className="rounded-full bg-panel/10 px-3 py-1 text-xs text-white/70">时长: {dur}s</span>}
          {task.created_at ? (
            <span className="rounded-full bg-panel/10 px-3 py-1 text-xs text-white/70">{timeAgo(task.created_at)}</span>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {outputUrl ? (
            <ActionButton icon={IconDownload} label={isImage ? "下载图片" : "下载视频"} onClick={() => window.open(outputUrl, "_blank")} variant="primary" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
