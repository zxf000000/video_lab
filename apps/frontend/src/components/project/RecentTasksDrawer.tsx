"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { IconClock, IconPlayerTrackNext, IconRefresh } from "@tabler/icons-react";
import { retryTask, type GenerationTask } from "@/src/api";
import { StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";

const TASK_TYPE_LABELS: Record<string, string> = {
  screenplay: "剧本生成",
  scenes: "场景提取",
  shots: "镜头拆解",
  kling: "Kling 图片",
  seedance: "Seedance 视频",
  chatfire: "LLM 任务",
  "character-image": "角色出图",
  "optimize-prompt": "优化 Prompt",
  "generate-anchor": "外观锚定",
  "regenerate-character": "重新生成",
};

function taskLabel(task: GenerationTask): string {
  if (task.taskType) return TASK_TYPE_LABELS[task.taskType] || task.taskType;
  if (task.provider) return TASK_TYPE_LABELS[task.provider] || task.provider;
  if (task.modelName) return task.modelName;
  return "未知任务";
}

function taskSource(task: GenerationTask): string {
  const parts: string[] = [];
  if (task.episodeId) parts.push(`集 #${task.episodeId}`);
  if (task.shotId) parts.push(`镜头 #${task.shotId}`);
  if (task.shotPromptId) parts.push(`Prompt #${task.shotPromptId}`);
  return parts.length ? parts.join(" · ") : "项目级";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  return `${day}天前`;
}

function statusTone(status: string) {
  if (status === "succeeded") return "green" as const;
  if (status === "failed" || status === "error") return "amber" as const;
  if (status === "queued" || status === "running") return "blue" as const;
  return "slate" as const;
}

export default function RecentTasksDrawer({
  tasks,
  activeCount,
  refresh,
}: {
  tasks: GenerationTask[];
  activeCount: number;
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hoverRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (activeCount > 0 && !timerRef.current) {
      timerRef.current = setInterval(refresh, 5000);
    } else if (activeCount === 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, activeCount, refresh]);

  function handleMouseEnter() {
    if (hoverRef.current) clearTimeout(hoverRef.current);
    setOpen(true);
  }

  function handleMouseLeave() {
    hoverRef.current = setTimeout(() => setOpen(false), 200);
  }

  async function handleRetry(taskId: number) {
    try {
      await retryTask(taskId);
      await refresh();
      toast.success("任务已重新排队");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Floating button */}
      <button
        className="flex size-14 items-center justify-center rounded-2xl border border-mint/30 bg-panel text-mint shadow-[0_0_24px_rgba(0,240,255,0.15)] transition-all hover:scale-105 hover:shadow-[0_0_36px_rgba(0,240,255,0.25)] active:scale-95"
        aria-label="最近任务"
        style={{ backdropFilter: "blur(12px)" } as React.CSSProperties}
      >
        <span className="relative flex items-center justify-center">
          <IconPlayerTrackNext size={22} stroke={2} />
          {activeCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-mint text-[10px] font-bold text-black">
              {activeCount > 9 ? "9+" : activeCount}
            </span>
          ) : null}
        </span>
      </button>

      {/* Hover panel — positioned to the left of the button */}
      {open ? (
        <div
          className="absolute bottom-0 right-16 w-[380px] max-w-[88vw]"
          style={{ animation: "fadeInRight 0.15s ease-out" }}
        >
          <div
            className="rounded-2xl border border-line/60 bg-panel overflow-hidden"
            style={{ boxShadow: "0 0 40px rgba(0,0,0,0.5), 0 0 80px rgba(0,240,255,0.08)" } as React.CSSProperties}
          >
            {/* Header */}
            <div className="shrink-0 border-b border-line/60 px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-100" style={{ fontFamily: "var(--font-mono), monospace" }}>
                  最近任务
                </h3>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {tasks.length} 条记录
                  {activeCount > 0 ? ` · ${activeCount} 个进行中 · 每 5 秒自动刷新` : ""}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={refresh} className="size-8 p-0">
                <IconRefresh size={14} stroke={2} className={activeCount > 0 ? "animate-spin" : ""} />
              </Button>
            </div>

            {/* Task list */}
            <div className="max-h-[60vh] overflow-y-auto px-4 py-3 space-y-2">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <IconClock size={24} stroke={1.5} className="text-gray-600" />
                  <p className="mt-2 text-sm text-gray-400">暂无任务记录</p>
                  <p className="mt-1 text-xs text-gray-600">进入分镜或角色页面提交任务后，这里会出现记录。</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-line/50 bg-panel2/60 px-4 py-3 transition hover:border-line/80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-gray-200">{taskLabel(task)}</span>
                      <StatusPill value={task.status} tone={statusTone(task.status)} />
                    </div>

                    {task.modelName && task.modelName !== taskLabel(task) ? (
                      <p className="mt-0.5 text-[11px] text-gray-500">{task.modelName}</p>
                    ) : null}

                    <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500">
                      <span className="inline-flex items-center gap-1 rounded bg-panel px-1.5 py-0.5 text-gray-400">
                        {taskSource(task)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <IconClock size={11} stroke={1.5} />
                        {relativeTime(task.submittedAt || task.createdAt)}
                      </span>
                    </div>

                    {task.provider ? (
                      <div className="mt-1.5">
                        <span className="rounded-full bg-mint/10 border border-mint/20 px-2 py-0.5 text-[9px] font-medium text-mint/70">
                          {task.provider}
                          {task.modelName ? ` / ${task.modelName}` : ""}
                        </span>
                      </div>
                    ) : null}

                    {task.errorMessage ? (
                      <p className="mt-2 rounded-lg bg-red-500/5 border border-red-500/15 px-2.5 py-1.5 text-[11px] leading-5 text-red-400">
                        {task.errorMessage}
                      </p>
                    ) : null}
                    {task.status === "failed" ? (
                      <div className="mt-2">
                        <Button variant="secondary" size="sm" onClick={() => handleRetry(task.id)}>
                          重试
                        </Button>
                      </div>
                    ) : null}

                    {task.durationMs ? (
                      <p className="mt-1.5 text-[10px] text-gray-600">耗时 {(task.durationMs / 1000).toFixed(1)}s</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
