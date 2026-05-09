"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react";
import { getProject, type ProjectDetail } from "@/src/api";
import { ProjectCopilotProvider } from "@/src/components/copilot/ProjectCopilotContext";
import { Button } from "@/src/components/ui/button";
import { ProjectWorkspaceContext } from "@/src/components/project/ProjectWorkspaceContext";
import RecentTasksDrawer from "@/src/components/project/RecentTasksDrawer";
import { KeyValueGrid, ProjectStageNav, SectionCard, StatusPill } from "@/src/components/project/project-ui";

export default function ProjectWorkspaceLayout({ projectId, children }: { projectId: number; children: ReactNode }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const payload = await getProject(projectId);
      setProject(payload.project);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [projectId]);

  const navItems = useMemo(() => {
    const firstEpisodeId = project?.episodes[0]?.id;
    const episodesHref = `/projects/${projectId}/episodes`;
    return [
      { id: "overview", href: `/projects/${projectId}`, label: "总览", description: "摘要与近期动态" },
      { id: "brief", href: `/projects/${projectId}/brief`, label: "Brief", description: "立项信息与创作约束", matchPrefixes: [`/projects/${projectId}/brief`] },
      { id: "characters", href: `/projects/${projectId}/characters`, label: "角色", description: "角色资产与语言风格", matchPrefixes: [`/projects/${projectId}/characters`] },
      { id: "scenes", href: `/projects/${projectId}/scenes`, label: "场景", description: "场景模板与视觉设定", matchPrefixes: [`/projects/${projectId}/scenes`] },
      { id: "episodes", href: episodesHref, label: "分集", description: "分集结构与状态推进", matchPrefixes: [`/projects/${projectId}/episodes`] },
      { id: "shots", href: `/projects/${projectId}/shots`, label: "镜头", description: "镜头列表与生成管理", matchPrefixes: [`/projects/${projectId}/shots`] },
      { id: "tasks", href: `/projects/${projectId}/tasks`, label: "任务", description: "生成任务与重试", matchPrefixes: [`/projects/${projectId}/tasks`] },
      {
        id: "review",
        href: firstEpisodeId ? `/projects/${projectId}/episodes/${firstEpisodeId}/review` : undefined,
        label: "审核",
        description: "问题记录与返工闭环",
        disabled: !firstEpisodeId,
        matchPrefixes: [`/projects/${projectId}/episodes/`],
      },
      {
        id: "export",
        href: firstEpisodeId ? `/projects/${projectId}/episodes/${firstEpisodeId}/export` : undefined,
        label: "导出",
        description: "单集版本与交付记录",
        disabled: !firstEpisodeId,
        matchPrefixes: [`/projects/${projectId}/episodes/`],
      },
    ];
  }, [project, projectId]);

  return (
    <ProjectWorkspaceContext.Provider value={{ projectId, project, loading, error, refresh }}>
      <ProjectCopilotProvider>
        <div className="flex flex-col gap-4">

          {/* ============================================================
              PROJECT HEADER — cyberpunk panel with neon accents
              ============================================================ */}
          <section
            className="border border-line/60 bg-panel px-5 py-4 relative overflow-hidden"
            style={{ boxShadow: "0 0 30px rgba(0,240,255,0.04)" }}
          >
            {/* Neon top accent */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-mint/40 to-transparent" />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 flex items-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-gray-500 transition hover:text-mint shrink-0"
                >
                  <IconArrowLeft size={14} stroke={2.5} />
                  返回
                </Link>

                <div className="h-5 w-px bg-line/60" />

                <div className="flex items-center gap-2 min-w-0">
                  <h1
                    className="text-lg font-bold tracking-tight text-gray-100 truncate"
                    style={{ fontFamily: "var(--font-mono), monospace" }}
                  >
                    {project ? project.name : `项目 #${projectId}`}
                  </h1>
                  {project ? <StatusPill value={project.currentStage} tone="blue" /> : null}
                  {project ? <StatusPill value={project.status} tone="purple" /> : null}
                </div>
              </div>

              <Button size="sm" variant="outline" onClick={refresh} className="shrink-0">
                <IconRefresh size={14} stroke={2} />
                刷新
              </Button>
            </div>

            {project ? (
              <div className="mt-3 space-y-3">
                <KeyValueGrid
                  items={[
                    { label: "题材", value: project.genre || "未填写" },
                    { label: "目标平台", value: project.targetPlatform || "未填写" },
                    { label: "计划集数", value: String(project.episodeCountPlanned || 0) },
                    { label: "角色数量", value: String(project.characters.length) },
                    { label: "场景数量", value: String(project.scenes.length) },
                    { label: "任务数量", value: String(project.tasks.length) },
                  ]}
                />

                {/* Stage navigation */}
                <div
                  className="px-3 py-2.5 border border-line/40"
                  style={{ background: "rgba(10,10,24,0.4)" }}
                >
                  <ProjectStageNav items={navItems} />
                </div>
              </div>
            ) : null}

            {/* Bottom accent */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-line/60 to-transparent" />
          </section>

          {/* Error display */}
          {error ? (
            <div
              className="border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400"
              style={{ clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)" }}
            >
              <span className="text-red-400 font-bold mr-2">[ERR]</span>
              {error}
            </div>
          ) : null}

          {/* Loading or content */}
          {loading && !project ? (
            <SectionCard title="正在加载" description="正在读取项目数据，请稍候。">
              <div className="flex items-center gap-3 py-4">
                <span className="h-3 w-3 bg-mint animate-pulse" style={{ clipPath: "polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px)" }} />
                <span className="text-[12px] tracking-wider text-gray-500">项目详情加载中...</span>
              </div>
            </SectionCard>
          ) : (
            children
          )}

          {/* Floating task drawer — available when project is loaded */}
          {project ? (
            <RecentTasksDrawer
              tasks={project.tasks}
              activeCount={project.tasks.filter((t) => t.status === "queued" || t.status === "running").length}
              refresh={refresh}
            />
          ) : null}
        </div>
      </ProjectCopilotProvider>
    </ProjectWorkspaceContext.Provider>
  );
}
