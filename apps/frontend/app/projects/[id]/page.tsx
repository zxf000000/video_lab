"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listEpisodeExports, listReviewIssues } from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatusPill } from "@/src/components/project/project-ui";

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
    <div className="grid gap-4">
      {/* 顶部统计 + Brief 压缩行 */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <CompactStat label="计划集数" value={String(currentProject.episodeCountPlanned)} tone="purple" />
        <CompactStat label="角色资产" value={String(currentProject.characters.length)} tone="blue" />
        <CompactStat label="审核问题" value={String(reviewCount)} tone="amber" />
        <CompactStat label="导出版本" value={String(exportCount)} tone="green" />
        <div className="rounded-lg border border-line bg-panel px-3 py-2 flex items-center gap-3 sm:col-span-2 lg:col-span-1">
          <p className="text-[11px] font-medium text-gray-500 shrink-0">Brief</p>
          <p className="text-xs text-gray-300 truncate">{currentProject.brief.logline || "未填写"}</p>
        </div>
      </section>

      <SectionCard title="最近任务" description="查看项目级最近生成任务，快速定位出错批次和当前活跃阶段。">
        {latestTasks.length ? (
          <div className="grid gap-3">
            {latestTasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-line bg-panel2 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-100">{task.modelName || task.provider || "Generation Task"}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Task #{task.id}
                      {task.episodeId ? ` · Episode ${task.episodeId}` : ""}
                      {task.shotId ? ` · Shot ${task.shotId}` : ""}
                    </p>
                  </div>
                  <StatusPill value={task.status} tone={task.status === "failed" ? "amber" : task.status === "succeeded" ? "green" : "blue"} />
                </div>
                {task.errorMessage ? <p className="mt-3 text-sm text-red-400">{task.errorMessage}</p> : null}
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

function CompactStat({ label, value, tone = "purple" }: { label: string; value: string; tone?: "purple" | "green" | "amber" | "blue" }) {
  const toneMap: Record<string, string> = {
    purple: "bg-purple-500/10 text-purple-400",
    green: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    blue: "bg-cyan-500/10 text-cyan-400",
  };
  return (
    <article className="rounded-lg border border-line bg-panel px-3 py-2 flex items-center gap-2">
      <span className={`shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-semibold ${toneMap[tone]}`}>{label}</span>
      <span className="text-base font-semibold tracking-tight text-gray-100">{value}</span>
    </article>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-[22px] border border-line bg-panel2 px-4 py-4 transition hover:border-mint/40 hover:bg-panel/5">
      <p className="text-sm font-semibold text-gray-100">{title}</p>
      <p className="mt-2 text-xs leading-5 text-gray-500">{description}</p>
    </Link>
  );
}
