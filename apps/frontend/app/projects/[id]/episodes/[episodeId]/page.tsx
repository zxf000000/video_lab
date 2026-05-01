"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatCard, StatusPill } from "@/src/components/project/project-ui";

export default function EpisodeDetailPage() {
  const params = useParams<{ episodeId: string; id: string }>();
  const { project } = useProjectWorkspace();
  if (!project) return null;
  const currentProject = project;
  const episode = currentProject.episodes.find((item) => item.id === Number(params.episodeId));

  if (!episode) {
    return (
      <SectionCard title="分集不存在" description="当前分集无法加载。">
        <EmptyState title="未找到分集" description="请返回分集列表重新选择。" />
      </SectionCard>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="集数" value={String(episode.episodeNo)} meta="episode no" tone="purple" />
        <StatCard label="状态" value={episode.status} meta="workflow status" tone="blue" />
        <StatCard label="已创建镜头" value="进入镜头页查看" meta="shot production" tone="green" />
        <StatCard label="审核 / 导出" value="详情页入口" meta="review and export" tone="amber" />
      </section>

      <SectionCard title={`第 ${episode.episodeNo} 集概览`} description="先确认这一集的目标、冲突和钩子，再进入镜头生产。">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-panel2 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">{episode.title || "未命名分集"}</h3>
              <StatusPill value={episode.status} tone="purple" />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{episode.summary || "未填写分集摘要"}</p>
          </div>
          <div className="rounded-2xl bg-panel2 px-5 py-4 text-sm leading-7 text-slate-600">
            <p><span className="font-semibold text-slate-900">目标：</span>{episode.goal || "未填写"}</p>
            <p><span className="font-semibold text-slate-900">核心冲突：</span>{episode.coreConflict || "未填写"}</p>
            <p><span className="font-semibold text-slate-900">开场钩子：</span>{episode.openingHook || "未填写"}</p>
            <p><span className="font-semibold text-slate-900">高潮：</span>{episode.climax || "未填写"}</p>
            <p><span className="font-semibold text-slate-900">集尾钩子：</span>{episode.endingHook || "未填写"}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="下一步" description="从这一集进入镜头、审核和导出节点。">
        <div className="grid gap-3 md:grid-cols-3">
          <Link href={`/projects/${currentProject.id}/episodes/${episode.id}/shots`} className="rounded-[24px] border border-line bg-panel2 px-4 py-4 transition hover:border-mint/40 hover:bg-white/80">
            <p className="text-sm font-semibold text-slate-900">镜头列表</p>
            <p className="mt-2 text-xs text-slate-500">创建镜头、编辑镜头信息、进入 Prompt 页面。</p>
          </Link>
          <Link href={`/projects/${currentProject.id}/episodes/${episode.id}/review`} className="rounded-[24px] border border-line bg-panel2 px-4 py-4 transition hover:border-mint/40 hover:bg-white/80">
            <p className="text-sm font-semibold text-slate-900">审核问题</p>
            <p className="mt-2 text-xs text-slate-500">记录生成问题，驱动返工闭环。</p>
          </Link>
          <Link href={`/projects/${currentProject.id}/episodes/${episode.id}/export`} className="rounded-[24px] border border-line bg-panel2 px-4 py-4 transition hover:border-mint/40 hover:bg-white/80">
            <p className="text-sm font-semibold text-slate-900">导出版本</p>
            <p className="mt-2 text-xs text-slate-500">维护单集版本和成片交付记录。</p>
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
