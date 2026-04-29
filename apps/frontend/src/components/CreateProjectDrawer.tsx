"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { createProject } from "../api";
import { ActionButton, StatusBadge } from "./ui-legacy";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import { IconCheck, IconX, IconMinus, IconPlus } from "@tabler/icons-react";

const STYLE_PRESETS = [
  { id: "cinematic", label: "电影感", emoji: "🎬" },
  { id: "anime", label: "动漫风", emoji: "🎨" },
  { id: "documentary", label: "纪录片", emoji: "📹" },
  { id: "neo-noir", label: "赛博朋克", emoji: "🌃" },
  { id: "watercolor", label: "水彩画", emoji: "🖼" },
  { id: "realistic", label: "写实风", emoji: "📷" },
];

const RATIOS = ["16:9", "9:16", "1:1", "4:3"];

const CREATE_STEP_LABELS = ["基本信息", "生成参数", "确认创建"];
const REWRITE_STEP_LABELS = ["改写信息", "确认创建"];

const defaultForm = {
  title: "",
  story_prompt: "",
  style: "cinematic",
  aspect_ratio: "16:9",
  target_duration: 30,
  original_story: "",
  rewrite_direction: "",
};

export default function CreateProjectDrawer({ open, onClose }: any) {
  const router = useRouter();
  const [mode, setMode] = useState("create"); // "create" | "rewrite"
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(defaultForm);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setStep(1);
    setForm(defaultForm);
    setCreating(false);
    setError("");
  }

  function handleClose() {
    if (creating) return;
    reset();
    onClose();
  }

  function switchMode(newMode: any) {
    if (creating) return;
    setMode(newMode);
    setStep(1);
    setForm(defaultForm);
    setCreating(false);
    setError("");
  }

  function set(field: any, value: any) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const isRewrite = mode === "rewrite";
  const stepLabels = isRewrite ? REWRITE_STEP_LABELS : CREATE_STEP_LABELS;
  const maxStep = stepLabels.length;

  const canNext = isRewrite
    ? step === 1
      ? form.title.trim() && form.rewrite_direction.trim()
      : true
    : step === 1
      ? form.title.trim() && form.story_prompt.trim()
      : step === 2
        ? form.style.trim() && form.aspect_ratio && form.target_duration >= 5
        : true;

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const payload = await createProject({
        title: form.title,
        story_prompt: form.story_prompt || form.original_story || form.rewrite_direction,
        style: form.style,
        aspect_ratio: form.aspect_ratio,
        target_duration: Number(form.target_duration),
        ...(isRewrite && {
          original_story: form.original_story,
          rewrite_direction: form.rewrite_direction,
        }),
      });
      reset();
      onClose();
      toast.success("项目已创建，AI 正在生成中...");
      router.push(`/projects/${payload.project.id}?tab=overview`);
    } catch (err: any) {
      setError(String(err.message || err));
      setCreating(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o: any) => { if (!o) handleClose(); }}>
      <SheetContent side="right" showCloseButton={false} className="w-full max-w-3xl border-l border-line bg-panel p-0">
        <SheetTitle className="sr-only">
          {isRewrite ? "改写故事" : "新建视频项目"}
        </SheetTitle>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint">Create Project</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {isRewrite ? "改写故事" : "新建视频项目"}
            </h2>
          </div>
          {/* Mode tabs */}
          <div className="flex items-center gap-1 rounded-full bg-panel2 p-1">
            <button
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                !isRewrite ? "bg-mint text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
              onClick={() => switchMode("create")}
              disabled={creating}
            >
              新建
            </button>
            <button
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                isRewrite ? "bg-mint text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
              onClick={() => switchMode("rewrite")}
              disabled={creating}
            >
              改写
            </button>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {stepLabels.map((label: any, i: number) => {
              const num = i + 1;
              const done = step > num;
              const active = step === num;
              return (
                <div key={num} className="flex items-center gap-1">
                  {i > 0 && (
                    <div className={`h-px w-4 ${done ? "bg-mint/40" : "bg-line"}`} />
                  )}
                  <div className="flex items-center gap-1">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
                        done
                            ? "bg-mint/20 text-mint"
                            : active
                              ? "bg-mint text-white"
                              : "bg-line text-slate-500"
                      }`}
                    >
                      {done ? <IconCheck size={10} stroke={2.5} /> : num}
                    </span>
                    <span className={`hidden text-[11px] sm:inline ${active ? "text-mint" : done ? "text-mint/70" : "text-slate-500"}`}>
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            className="shrink-0 rounded-full bg-panel2 px-2.5 py-1 text-xs text-slate-500 transition hover:text-slate-900 disabled:opacity-30"
            onClick={handleClose}
            disabled={creating}
          >
            <IconX size={14} stroke={2} />
          </button>
        </div>

        {/* Error */}
        {error ? (
          <div className="mx-5 mt-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ====== CREATE MODE ====== */}

          {/* Create Step 1: Basic Info */}
          {!isRewrite && step === 1 && !creating && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs text-slate-500">项目名</label>
                <Input
                  className="rounded-xl"
                  type="text"
                  placeholder="例：雨夜追逐"
                  value={form.title}
                  onChange={(e: any) => set("title", e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-500">剧情需求</label>
                <Textarea
                  className="min-h-[180px] resize-y"
                  placeholder="描述你想要的剧情，越详细越好。例如：一个在雨夜城市中奔跑的年轻人，躲避无人机追踪，最终在霓虹灯巷口停下并回头..."
                  value={form.story_prompt}
                  onChange={(e: any) => set("story_prompt", e.target.value)}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                AI 将根据你的需求生成完整剧情，并自动拆分为多个镜头
              </p>
            </div>
          )}

          {/* Create Step 2: Parameters */}
          {!isRewrite && step === 2 && !creating && (
            <div className="flex flex-col gap-5">
              {/* Style presets */}
              <div>
                <label className="mb-2 block text-xs text-slate-500">风格</label>
                <div className="grid grid-cols-4 gap-2">
                  {STYLE_PRESETS.map((s) => {
                    const active = form.style === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                          active
                            ? "border-mint bg-mint/10 text-mint"
                            : "border-line bg-panel2 text-slate-600 hover:border-mint/40 hover:text-slate-900"
                        }`}
                        onClick={() => set("style", s.id)}
                      >
                        <span className="text-base">{s.emoji}</span>
                        <span className="font-medium">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
                <Input
                  className="mt-2 rounded-xl px-3 py-2 text-xs font-mono"
                  type="text"
                  placeholder="或输入自定义风格..."
                  value={STYLE_PRESETS.some((s) => s.id === form.style) ? "" : form.style}
                  onChange={(e: any) => set("style", e.target.value)}
                />
              </div>

              {/* Aspect ratio */}
              <div>
                <label className="mb-2 block text-xs text-slate-500">画面比例</label>
                <div className="flex gap-2">
                  {RATIOS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`flex-1 rounded-xl border py-2 text-sm font-medium transition ${
                        form.aspect_ratio === r
                          ? "border-mint bg-mint/10 text-mint"
                          : "border-line bg-panel2 text-slate-600 hover:border-mint/40 hover:text-slate-900"
                      }`}
                      onClick={() => set("aspect_ratio", r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="mb-2 block text-xs text-slate-500">目标时长（秒）</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-2xl border border-line bg-panel2 text-slate-600 transition hover:border-mint/40 hover:text-slate-900"
                    onClick={() => set("target_duration", Math.max(5, Number(form.target_duration) - 5))}
                  >
                    <IconMinus size={16} stroke={2} />
                  </button>
                  <Input
                    type="number"
                    className="w-20 rounded-2xl py-2 text-center"
                    min={5}
                    max={120}
                    value={form.target_duration}
                    onChange={(e: any) => set("target_duration", e.target.value)}
                  />
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-2xl border border-line bg-panel2 text-slate-600 transition hover:border-mint/40 hover:text-slate-900"
                    onClick={() => set("target_duration", Math.min(120, Number(form.target_duration) + 5))}
                  >
                    <IconPlus size={16} stroke={2} />
                  </button>
                  <span className="text-xs text-slate-500">秒（5-120）</span>
                </div>
                {/* Quick presets */}
                <div className="mt-2 flex gap-2">
                  {[15, 30, 60, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`rounded-lg border px-3 py-1 text-[11px] transition ${
                        Number(form.target_duration) === d
                          ? "border-mint/40 bg-mint/10 text-mint"
                          : "border-line text-slate-500 hover:text-slate-800"
                      }`}
                      onClick={() => set("target_duration", d)}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Create Step 3: Summary */}
          {!isRewrite && step === 3 && !creating && (
            <CreateSummary form={form} />
          )}

          {/* ====== REWRITE MODE ====== */}

          {/* Rewrite Step 1 */}
          {isRewrite && step === 1 && !creating && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs text-slate-500">项目名</label>
                <Input
                  className="rounded-xl"
                  type="text"
                  placeholder="例：雨夜追逐-喜剧版"
                  value={form.title}
                  onChange={(e: any) => set("title", e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs text-slate-500">原始故事（可选）</label>
                  <Textarea
                    className="min-h-[140px] resize-y"
                    placeholder="粘贴一段已有故事，或留空由 AI 根据改写方向从零创作..."
                    value={form.original_story}
                    onChange={(e: any) => set("original_story", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-500">改写方向</label>
                  <Textarea
                    className="min-h-[140px] resize-y"
                    placeholder="描述你希望如何改写。例如：改成喜剧风格、增加悬疑感、换一个温暖的结局、加入更多动作场面..."
                    value={form.rewrite_direction}
                    onChange={(e: any) => set("rewrite_direction", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs text-slate-500">视觉风格</label>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLE_PRESETS.map((s) => {
                      const active = form.style === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                            active
                              ? "border-mint bg-mint/10 text-mint"
                              : "border-line bg-panel2 text-slate-600 hover:border-mint/40 hover:text-slate-900"
                          }`}
                          onClick={() => set("style", s.id)}
                        >
                          <span className="text-base">{s.emoji}</span>
                          <span className="font-medium">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs text-slate-500">画面比例</label>
                  <div className="grid grid-cols-2 gap-2">
                    {RATIOS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`rounded-xl border py-2 text-sm font-medium transition ${
                          form.aspect_ratio === r
                            ? "border-mint bg-mint/10 text-mint"
                            : "border-line bg-panel2 text-slate-600 hover:border-mint/40 hover:text-slate-900"
                        }`}
                        onClick={() => set("aspect_ratio", r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rewrite Step 2: Summary */}
          {isRewrite && step === 2 && !creating && (
            <RewriteSummary form={form} />
          )}

          {/* Creating progress */}
          {creating && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-mint border-t-transparent" />
              <p className="text-sm text-mint">正在提交...</p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {!creating && (
          <div className="flex gap-3 border-t border-line px-5 py-3">
            {step > 1 ? (
              <ActionButton label="上一步" onClick={() => setStep((s) => s - 1)} />
            ) : (
              <div />
            )}
            {step < maxStep ? (
              <div className="ml-auto">
                <ActionButton label="下一步" disabled={!canNext} onClick={() => setStep((s) => s + 1)} variant="primary" />
              </div>
            ) : (
              <div className="ml-auto">
                <ActionButton label={isRewrite ? "开始改写" : "开始生成"} onClick={handleCreate} variant="primary" />
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CreateSummary({ form }: any) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">确认以下信息，点击开始生成</p>
        <StatusBadge status="ready" className="bg-[#f2efff] text-mint" />
      </div>
      <div className="flex flex-col gap-3 rounded-[24px] border border-line bg-panel2 p-4">
        <SummaryRow label="项目名" value={form.title} />
        <SummaryRow label="剧情需求" value={form.story_prompt} truncate />
        <SummaryRow label="风格" value={STYLE_PRESETS.find((s) => s.id === form.style)?.label || form.style} />
        <SummaryRow label="画面比例" value={form.aspect_ratio} />
        <SummaryRow label="目标时长" value={`${form.target_duration} 秒`} />
      </div>
      <p className="text-[11px] text-slate-500">
        AI 将依次生成剧情段落并拆分为镜头，整个过程可能需要 10-30 秒
      </p>
    </div>
  );
}

function RewriteSummary({ form }: any) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">确认以下信息，点击开始改写</p>
        <StatusBadge status="ready" className="bg-[#f2efff] text-mint" />
      </div>
      <div className="flex flex-col gap-3 rounded-[24px] border border-line bg-panel2 p-4">
        <SummaryRow label="项目名" value={form.title} />
        {form.original_story && <SummaryRow label="原始故事" value={form.original_story} truncate />}
        <SummaryRow label="改写方向" value={form.rewrite_direction} truncate />
        <SummaryRow label="风格" value={STYLE_PRESETS.find((s) => s.id === form.style)?.label || form.style} />
        <SummaryRow label="画面比例" value={form.aspect_ratio} />
        <SummaryRow label="目标时长" value="AI 根据段落数自动计算" />
      </div>
      <p className="text-[11px] text-slate-500">
        AI 将根据改写方向生成新故事，自动根据段落数量计算时长并拆分为镜头
      </p>
    </div>
  );
}

function SummaryRow({ label, value, truncate = false }: any) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 text-[11px] text-slate-500">{label}</span>
      <span className={`text-sm text-slate-700 ${truncate ? "line-clamp-3" : ""}`}>{value}</span>
    </div>
  );
}
