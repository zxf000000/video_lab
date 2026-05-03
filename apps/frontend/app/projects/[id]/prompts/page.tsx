"use client";

import Link from "next/link";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard } from "@/src/components/project/project-ui";

export default function ProjectPromptsPage() {
  const { project } = useProjectWorkspace();
  if (!project) return null;
  const currentProject = project;

  return (
    <SectionCard title="Prompt 入口" description="Prompt 版本是按镜头管理的。先选分集，再进入镜头级 Prompt 页面。">
      {currentProject.episodes.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {currentProject.episodes.map((episode) => (
            <Link key={episode.id} href={`/projects/${currentProject.id}/episodes/${episode.id}/shots`} className="rounded-lg border border-line bg-panel2 px-5 py-4 transition hover:border-mint/40 hover:bg-panel/5">
              <p className="text-sm font-semibold text-gray-100">第 {episode.episodeNo} 集 · {episode.title || "未命名分集"}</p>
              <p className="mt-2 text-xs leading-5 text-gray-500">先进入镜头列表，再按具体 shot 管理 Prompt 版本和激活状态。</p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="还没有分集" description="先创建分集，再进入镜头和 Prompt 生产。" />
      )}
    </SectionCard>
  );
}
