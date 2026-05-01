"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listEpisodeExports, listReviewIssues } from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatCard, StatusPill } from "@/src/components/project/project-ui";

export default function ProjectOverviewPage() {
  const { project, loading } = useProjectWorkspace();
  const [reviewCount, setReviewCount] = useState(0);
  const [exportCount, setExportCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!project?.episodes.length) {
        setReviewCount(0);
        setExportCount(0);
        return;
      }
      const reviewPayloads = await Promise.all(project.episodes.map((episode) => listReviewIssues(episode.id).catch(() => ({ reviewIssues: [] }))));
      const exportPayloads = await Promise.all(project.episodes.map((episode) => listEpisodeExports(episode.id).catch(() => ({ exports: [] }))));
      if (!cancelled) {
        setReviewCount(reviewPayloads.reduce((sum, item) => sum + item.reviewIssues.length, 0));
        setExportCount(exportPayloads.reduce((sum, item) => sum + item.exports.length, 0));
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [project]);

  if (loading && !project) return null;

  if (!project) {
    return (
      <SectionCard title="项目不存在" description="当前项目无法加载。">
        <EmptyState title="未找到项目" description="请返回首页重新选择项目。" />
      </SectionCard>
    );
  }
  const currentProject = project;

  const latestTasks = currentProject.tasks.slice(0, 6);

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="计划集数" value={String(currentProject.episodeCountPlanned)} meta="planned episodes" tone="purple" />
        <StatCard label="角色资产" value={String(currentProject.characters.length)} meta="character assets" tone="blue" />
        <StatCard label="审核问题" value={String(reviewCount)} meta="review issues" tone="amber" />
        <StatCard label="导出版本" value={String(exportCount)} meta="episode exports" tone="green" />
      </section>

      <SectionCard title="Brief 摘要" description="项目级约束会持续影响后续角色、场景、镜头和 Prompt。">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-panel2 px-5 py-4">
            <p className="text-xs font-medium text-slate-500">一句话钩子</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{currentProject.brief.logline || "未填写"}</p>
          </div>
          <div className="rounded-2xl bg-panel2 px-5 py-4">
            <p className="text-xs font-medium text-slate-500">主冲突</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{currentProject.brief.mainConflict || "未填写"}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="最近任务" description="查看项目级最近生成任务，快速定位出错批次和当前活跃阶段。">
        {latestTasks.length ? (
          <div className="grid gap-3">
            {latestTasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-line bg-panel2 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{task.modelName || task.provider || "Generation Task"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Task #{task.id}
                      {task.episodeId ? ` · Episode ${task.episodeId}` : ""}
                      {task.shotId ? ` · Shot ${task.shotId}` : ""}
                    </p>
                  </div>
                  <StatusPill value={task.status} tone={task.status === "failed" ? "amber" : task.status === "succeeded" ? "green" : "blue"} />
                </div>
                {task.errorMessage ? <p className="mt-3 text-sm text-rose-500">{task.errorMessage}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="还没有任务" description="进入分镜和 Prompt 页面后，才能开始提交生成任务。" />
        )}
      </SectionCard>

      <SectionCard title="快速入口" description="跳到当前最常用的工作区。">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <QuickLink href={`/projects/${currentProject.id}/brief`} title="完善 Brief" description="补齐创意约束、受众和题材标签" />
          <QuickLink href={`/projects/${currentProject.id}/characters`} title="角色资产" description="维护角色设定、语言风格和限制" />
          <QuickLink href={`/projects/${currentProject.id}/episodes`} title="分集管理" description="新增分集并进入镜头生产" />
          <QuickLink href={`/projects/${currentProject.id}/tasks`} title="任务面板" description="查看生成任务状态与重试入口" />
        </div>
      </SectionCard>
    </div>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-[22px] border border-line bg-panel2 px-4 py-4 transition hover:border-mint/40 hover:bg-white/80">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </Link>
  );
}
