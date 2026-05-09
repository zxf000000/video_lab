"use client";

import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { retryTask } from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { IconRefresh } from "@tabler/icons-react";

export default function ProjectTasksPage() {
  const { project, refresh } = useProjectWorkspace();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!project) return null;
  const currentProject = project;

  const hasActive = currentProject.tasks.some(
    (t) => t.status === "queued" || t.status === "running"
  );

  useEffect(() => {
    if (hasActive && !timerRef.current) {
      timerRef.current = setInterval(refresh, 5000);
    } else if (!hasActive && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hasActive, refresh]);

  async function handleRetry(taskId: number) {
    try {
      await retryTask(taskId);
      await refresh();
      toast.success("任务已重新排队");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  const activeCount = currentProject.tasks.filter(
    (t) => t.status === "queued" || t.status === "running"
  ).length;

  return (
    <SectionCard
      title="任务面板"
      description={
        activeCount > 0
          ? `进行中 ${activeCount} 个任务 · 每 5 秒自动刷新`
          : "这里展示当前项目下的所有任务，支持失败任务重试。"
      }
      action={
        <Button size="sm" variant="outline" onClick={refresh} className="shrink-0 gap-1">
          <IconRefresh size={14} stroke={2} className={hasActive ? "animate-spin" : ""} />
          刷新
        </Button>
      }
    >
      {currentProject.tasks.length ? (
        <div className="grid gap-3">
          {currentProject.tasks.map((task) => (
            <div key={task.id} className="rounded-lg border border-line bg-panel2 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-100">{task.modelName || task.provider || "Generation Task"}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Task #{task.id}
                    {task.episodeId ? ` · Episode ${task.episodeId}` : ""}
                    {task.shotId ? ` · Shot ${task.shotId}` : ""}
                  </p>
                  {task.errorMessage ? <p className="mt-3 text-sm text-red-400">{task.errorMessage}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill value={task.status} tone={task.status === "failed" ? "amber" : task.status === "succeeded" ? "green" : "blue"} />
                  {task.status === "failed" ? (
                    <Button variant="secondary" size="sm" onClick={() => handleRetry(task.id)}>
                      重试
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="还没有任务" description="进入镜头和 Prompt 页面后，才能开始提交生成任务。" />
      )}
    </SectionCard>
  );
}
