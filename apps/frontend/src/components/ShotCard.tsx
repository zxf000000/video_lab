"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { generateShotFrames, generateShotVideo, updateShotPrompts, updateShotDuration, deleteShot, generateSingleFrame } from "../api";
import AssetCard from "./AssetCard";
import { ActionButton } from "./ui-legacy";
import { Textarea } from "./ui/textarea";
import { useConfirm } from "../hooks/useConfirm";
import { IconMinus, IconPlus, IconTrash, IconPhoto, IconVideo, IconExternalLink, IconSparkles } from "@tabler/icons-react";
import RefineDrawer from "./RefineDrawer";

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-slate-100 text-slate-500",
  frames_ready: "bg-cyan-100 text-cyan-700",
  video_ready: "bg-emerald-100 text-cyan-700",
  prompt_updated: "bg-amber-100 text-amber-700",
  generating_frames: "bg-violet-100 text-violet-700",
  generating_video: "bg-violet-100 text-violet-700",
};

function isShotTaskRunning(tasks: any[], shotId: any, taskType: any) {
  return tasks.some((t: any) =>
    t.shot_id === shotId &&
    t.task_type === taskType &&
    (t.status === "queued" || t.status === "running")
  );
}

function buildPromptFields(shot: any) {
  return {
    shot_prompt: shot?.shot_prompt || "",
    start_frame_prompt: shot?.start_frame_prompt || "",
    end_frame_prompt: shot?.end_frame_prompt || "",
    video_prompt: shot?.video_prompt || "",
  };
}

export default function ShotCard({ shot, onRefresh, projectId, tasks = [] }: any) {
  const [localShot, setLocalShot] = useState(shot);
  const [promptFields, setPromptFields] = useState(() => buildPromptFields(shot));
  const [busyAction, setBusyAction] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [saveError, setSaveError] = useState("");
  const [refineField, setRefineField] = useState<{ field: string; label: string; content: string } | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const lastSavedRef = useRef(JSON.stringify(buildPromptFields(shot)));
  const saveRequestIdRef = useRef(0);

  useEffect(() => {
    setLocalShot(shot);
    const nextFields = buildPromptFields(shot);
    setPromptFields(nextFields);
    lastSavedRef.current = JSON.stringify(nextFields);
    setSaveState("saved");
    setSaveError("");
  }, [
    shot.id,
    shot.updated_at,
    shot.shot_prompt,
    shot.start_frame_prompt,
    shot.end_frame_prompt,
    shot.video_prompt,
    shot.status,
    shot.start_frame_url,
    shot.end_frame_url,
    shot.video_url,
  ]);

  useEffect(() => {
    const serializedFields = JSON.stringify(promptFields);
    if (serializedFields === lastSavedRef.current) {
      return undefined;
    }
    setSaveState("dirty");
    const requestId = ++saveRequestIdRef.current;
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      setSaveError("");
      try {
        const payload = await updateShotPrompts(localShot.id, promptFields);
        if (requestId !== saveRequestIdRef.current) {
          return;
        }
        const savedShot = payload.shot;
        const savedFields = buildPromptFields(savedShot);
        lastSavedRef.current = JSON.stringify(savedFields);
        setLocalShot(savedShot);
        setPromptFields((current: any) => (
          JSON.stringify(current) === serializedFields ? savedFields : current
        ));
        setSaveState("saved");
      } catch (error: any) {
        if (requestId !== saveRequestIdRef.current) {
          return;
        }
        setSaveState("error");
        setSaveError(String(error.message || error));
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [localShot.id, promptFields]);

  // Derive background-task loading from project tasks
  const generatingFrames = isShotTaskRunning(tasks, localShot.id, "generate_shot_frames");
  const generatingStartFrame = isShotTaskRunning(tasks, localShot.id, "generate_single_frame");
  const generatingVideo = isShotTaskRunning(tasks, localShot.id, "generate_shot_video");
  const hasRunningBgTask = generatingFrames || generatingStartFrame || generatingVideo;
  const saveLabel = useMemo(() => {
    if (saveState === "saving") return "自动保存中...";
    if (saveState === "error") return "保存失败";
    if (saveState === "dirty") return "待保存";
    return "已自动保存";
  }, [saveState]);

  async function run(action: any, actionKey: any) {
    setBusyAction(actionKey);
    try {
      await action(localShot.id);
      await onRefresh();
    } finally {
      setBusyAction("");
    }
  }

  async function updateDuration(newDuration: any) {
    if (newDuration < 1 || newDuration > 30) return;
    setBusyAction("update_duration");
    try {
      await updateShotDuration(localShot.id, newDuration);
      await onRefresh();
    } finally {
      setBusyAction("");
    }
  }

  async function handleDelete() {
    if (!await confirm(`确定要删除「${localShot.shot_title}」？`)) return;
    setBusyAction("delete");
    try {
      await deleteShot(localShot.id);
      await onRefresh();
    } finally {
      setBusyAction("");
    }
  }

  async function handleGenerateFrame(frameType: any) {
    setBusyAction(frameType === "start" ? "generate_start_frame" : "generate_end_frame");
    try {
      await generateSingleFrame(localShot.id, frameType);
      await onRefresh();
    } finally {
      setBusyAction("");
    }
  }

  const isPromptUpdated = localShot.status === "prompt_updated";
  const isBusy = Boolean(busyAction) || hasRunningBgTask;

  // For display: prefer task-based state, fall back to local busyAction
  const frameLabel = (generatingFrames || busyAction === "generate_frames") ? "生成首尾帧中..." : "生成首尾帧";
  const startFrameLabel = (generatingStartFrame || busyAction === "generate_start_frame") ? "生成首帧中..." : "生成首帧";
  const endFrameLabel = (generatingStartFrame || busyAction === "generate_end_frame") ? "生成尾帧中..." : "生成尾帧";
  const videoLabel = (generatingVideo || busyAction === "generate_video") ? "生成视频中..." : "生成视频";

  return (
    <article className={`rounded-[28px] border bg-panel2 p-5 shadow-[0_10px_30px_rgba(27,31,59,0.04)] ${isPromptUpdated ? "border-amber-200" : "border-line"}`}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Shot {localShot.order_index || localShot.id}
              </span>
              <h4 className="text-lg font-semibold text-slate-900">{localShot.shot_title}</h4>
            {projectId ? (
              <Link href={`/projects/${projectId}/shots/${localShot.id}`} className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-mint">
                <IconExternalLink size={12} stroke={2} />
                详情
              </Link>
            ) : null}
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{localShot.shot_description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {localShot.camera_movement && (
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
                  {localShot.camera_movement}
                </span>
              )}
              {localShot.emotion_keywords && (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-medium text-violet-700">
                  {localShot.emotion_keywords}
                </span>
              )}
              {localShot.character_action && (
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-medium text-cyan-700">
                  {localShot.character_action}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-line bg-white px-1 py-1">
              <button
                className="rounded-full px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
                onClick={() => updateDuration(localShot.duration_seconds - 1)}
                disabled={localShot.duration_seconds <= 1 || isBusy}
                type="button"
              >
                <IconMinus size={12} stroke={2} />
              </button>
              <span className="min-w-[3ch] text-center text-xs font-semibold text-slate-700">{localShot.duration_seconds}s</span>
              <button
                className="rounded-full px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
                onClick={() => updateDuration(localShot.duration_seconds + 1)}
                disabled={localShot.duration_seconds >= 30 || isBusy}
                type="button"
              >
                <IconPlus size={12} stroke={2} />
              </button>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[localShot.status] || "bg-slate-100 text-slate-500"}`}>
              {localShot.status}
            </span>
            <button
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-rose-500 transition hover:text-rose-700 disabled:opacity-50"
              onClick={handleDelete}
              disabled={isBusy}
              type="button"
            >
              {busyAction === "delete" ? "删除中..." : <><IconTrash size={12} stroke={2} /> 删除</>}
            </button>
          </div>
        </div>
      </div>

      {isPromptUpdated && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Prompt 已更新，已有产物已失效。请重新生成首尾帧和视频。
        </div>
      )}

        <div className="rounded-[24px] border border-line bg-panel px-4 py-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <label className="block text-sm font-medium text-slate-700">镜头 Prompt</label>
            <button
              className="shrink-0 rounded-lg bg-panel2 px-1.5 py-1 text-[11px] text-slate-400 transition hover:text-mint"
              onClick={() => setRefineField({ field: "shot_prompt", label: "镜头 Prompt", content: promptFields.shot_prompt })}
              title="AI 调整"
              type="button"
            >
              <IconSparkles size={12} stroke={2} />
            </button>
          </div>
          <span className={`text-xs ${saveState === "error" ? "text-rose-500" : "text-slate-500"}`}>{saveLabel}</span>
        </div>
        <Textarea
          className="min-h-32 rounded-3xl"
          value={promptFields.shot_prompt}
          onChange={(event: any) => setPromptFields((current: any) => ({ ...current, shot_prompt: event.target.value }))}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-line bg-panel px-4 py-4">
            <div className="mb-2 flex items-center gap-1.5">
              <label className="block text-sm font-medium text-slate-700">首帧 Prompt</label>
              <button
                className="shrink-0 rounded-lg bg-panel2 px-1.5 py-1 text-[11px] text-slate-400 transition hover:text-mint"
                onClick={() => setRefineField({ field: "start_frame_prompt", label: "首帧 Prompt", content: promptFields.start_frame_prompt })}
                title="AI 调整"
                type="button"
              >
                <IconSparkles size={12} stroke={2} />
              </button>
            </div>
            <Textarea
              className="min-h-28 rounded-3xl"
              value={promptFields.start_frame_prompt}
              onChange={(event: any) => setPromptFields((current: any) => ({ ...current, start_frame_prompt: event.target.value }))}
            />
          </div>
          <div className="rounded-[24px] border border-line bg-panel px-4 py-4">
            <div className="mb-2 flex items-center gap-1.5">
              <label className="block text-sm font-medium text-slate-700">尾帧 Prompt</label>
              <button
                className="shrink-0 rounded-lg bg-panel2 px-1.5 py-1 text-[11px] text-slate-400 transition hover:text-mint"
                onClick={() => setRefineField({ field: "end_frame_prompt", label: "尾帧 Prompt", content: promptFields.end_frame_prompt })}
                title="AI 调整"
                type="button"
              >
                <IconSparkles size={12} stroke={2} />
              </button>
            </div>
            <Textarea
              className="min-h-28 rounded-3xl"
              value={promptFields.end_frame_prompt}
              onChange={(event: any) => setPromptFields((current: any) => ({ ...current, end_frame_prompt: event.target.value }))}
            />
          </div>
      </div>

      <div className="rounded-[24px] border border-line bg-panel px-4 py-4">
        <div className="mb-2 flex items-center gap-1.5">
          <label className="block text-sm font-medium text-slate-700">视频 Prompt</label>
          <button
            className="shrink-0 rounded-lg bg-panel2 px-1.5 py-1 text-[11px] text-slate-400 transition hover:text-mint"
            onClick={() => setRefineField({ field: "video_prompt", label: "视频 Prompt", content: promptFields.video_prompt })}
            title="AI 调整"
            type="button"
          >
            <IconSparkles size={12} stroke={2} />
          </button>
        </div>
        <Textarea
          className="min-h-32 rounded-3xl"
          value={promptFields.video_prompt}
          placeholder="留空时默认跟随镜头 Prompt"
          onChange={(event: any) => setPromptFields((current: any) => ({ ...current, video_prompt: event.target.value }))}
        />
        {saveError ? <p className="mt-2 text-xs text-rose-500">{saveError}</p> : null}
      </div>

      <div className="rounded-[24px] border border-line bg-panel px-4 py-4">
        <p className="mb-3 text-sm font-medium text-slate-700">生成操作</p>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            icon={busyAction === "generate_frames" ? undefined : IconPhoto}
            disabled={isBusy}
            label={frameLabel}
            onClick={() => run(generateShotFrames, "generate_frames")}
          />
          <ActionButton
            icon={busyAction === "generate_start_frame" ? undefined : IconPhoto}
            disabled={isBusy}
            label={startFrameLabel}
            onClick={() => handleGenerateFrame("start")}
          />
          <ActionButton
            icon={busyAction === "generate_end_frame" ? undefined : IconPhoto}
            disabled={isBusy}
            label={endFrameLabel}
            onClick={() => handleGenerateFrame("end")}
          />
          <ActionButton
            icon={busyAction === "generate_video" ? undefined : IconVideo}
            disabled={isBusy}
            label={videoLabel}
            onClick={() => run(generateShotVideo, "generate_video")}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <AssetCard label="首帧" url={localShot.start_frame_url} kind="image" />
        <AssetCard label="尾帧" url={localShot.end_frame_url} kind="image" />
        <AssetCard label="视频结果" url={localShot.video_url} kind="video" />
      </div>

      <RefineDrawer
        open={!!refineField}
        onClose={() => setRefineField(null)}
        title={`调整${refineField?.label || ""}`}
        currentContent={refineField?.content || ""}
        onApply={(newContent) => {
          if (!refineField) return;
          setPromptFields((current: any) => ({
            ...current,
            [refineField.field]: newContent,
          }));
        }}
      />

      <ConfirmDialog />
    </article>
  );
}
