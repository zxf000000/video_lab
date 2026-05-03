"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react";
import { getProject, type ProjectDetail } from "@/src/api";
import { ProjectCopilotProvider } from "@/src/components/copilot/ProjectCopilotContext";
import { Button } from "@/src/components/ui/button";
import { ProjectWorkspaceContext } from "@/src/components/project/ProjectWorkspaceContext";
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
      { id: "prompts", href: `/projects/${projectId}/prompts`, label: "Prompt", description: "镜头提示词与版本入口", matchPrefixes: [`/projects/${projectId}/prompts`, `/projects/${projectId}/shots`] },
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
          <section className="rounded-lg border border-line bg-panel px-5 py-5 shadow-glow">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-gray-300">
                  <IconArrowLeft size={16} stroke={2} />
                  返回项目列表
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-100">{project ? project.name : `项目 #${projectId}`}</h1>
                  {project ? <StatusPill value={project.currentStage} tone="blue" /> : null}
                  {project ? <StatusPill value={project.status} tone="purple" /> : null}
                </div>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-400">
                  {project?.brief.logline || "正在加载项目概要。这里汇总项目约束、资产进度和后续生产入口。"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={refresh}>
                <IconRefresh size={16} stroke={2} />
                刷新
              </Button>
            </div>

            {project ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
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
                <div className="rounded-2xl bg-panel2 px-4 py-3">
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">流程导航</p>
                    <p className="mt-1 text-xs text-gray-500">按生产链路流转，当前阶段会以 tab 形式高亮显示。</p>
                  </div>
                  <ProjectStageNav items={navItems} />
                </div>
              </div>
            ) : null}
          </section>

          {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div> : null}

          {loading && !project ? (
            <SectionCard title="正在加载" description="正在读取项目数据，请稍候。">
              <div className="text-sm text-gray-500">项目详情加载中...</div>
            </SectionCard>
          ) : (
            children
          )}
        </div>
      </ProjectCopilotProvider>
    </ProjectWorkspaceContext.Provider>
  );
}
