"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react";
import { getProject, type ProjectDetail } from "@/src/api";
import { ProjectCopilotProvider } from "@/src/components/copilot/ProjectCopilotContext";
import ProjectCopilotShell from "@/src/components/copilot/ProjectCopilotShell";
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
      { id: "brief", href: `/projects/${projectId}/brief`, label: "Brief", description: "立项信息与创作约束" },
      { id: "characters", href: `/projects/${projectId}/characters`, label: "角色", description: "角色资产与语言风格" },
      { id: "scenes", href: `/projects/${projectId}/scenes`, label: "场景", description: "场景模板与视觉设定" },
      { id: "episodes", href: episodesHref, label: "分集", description: "分集结构与状态推进" },
      { id: "prompts", href: `/projects/${projectId}/prompts`, label: "Prompt", description: "镜头提示词与版本入口" },
      { id: "tasks", href: `/projects/${projectId}/tasks`, label: "任务", description: "生成任务与重试" },
      {
        id: "review",
        href: firstEpisodeId ? `/projects/${projectId}/episodes/${firstEpisodeId}/review` : undefined,
        label: "审核",
        description: "问题记录与返工闭环",
        disabled: !firstEpisodeId,
      },
      {
        id: "export",
        href: firstEpisodeId ? `/projects/${projectId}/episodes/${firstEpisodeId}/export` : undefined,
        label: "导出",
        description: "单集版本与交付记录",
        disabled: !firstEpisodeId,
      },
    ];
  }, [project, projectId]);

  return (
    <ProjectWorkspaceContext.Provider value={{ projectId, project, loading, error, refresh }}>
      <ProjectCopilotProvider>
        <div className="flex flex-col gap-5">
          <section className="rounded-[28px] bg-gradient-to-r from-[#6f67d8] to-[#8b85f3] px-6 py-6 text-white shadow-glow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/80 transition hover:text-white">
                  <IconArrowLeft size={16} stroke={2} />
                  返回项目列表
                </Link>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight">{project ? project.name : `项目 #${projectId}`}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">
                  {project?.brief.logline || "正在加载项目概要。这里汇总项目约束、资产进度和后续生产入口。"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {project ? <StatusPill value={project.currentStage} tone="blue" className="bg-white/10 text-white" /> : null}
                {project ? <StatusPill value={project.status} tone="purple" className="bg-white/10 text-white" /> : null}
                <ProjectCopilotShell />
                <Button variant="inverted" size="sm" onClick={refresh}>
                  <IconRefresh size={16} stroke={2} />
                  刷新
                </Button>
              </div>
            </div>
          </section>

          {error ? <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}

          {project ? (
            <SectionCard title="项目摘要" description="在进入子页面前，先确认这部短剧当前的项目状态和关键上下文。">
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
            </SectionCard>
          ) : null}

          <SectionCard title="流程导航" description="按新生产链路拆开的二级页面，从总览进入对应工作区。">
            <ProjectStageNav items={navItems} />
          </SectionCard>

          {loading && !project ? (
            <SectionCard title="正在加载" description="正在读取项目数据，请稍候。">
              <div className="text-sm text-slate-500">项目详情加载中...</div>
            </SectionCard>
          ) : (
            children
          )}
        </div>
      </ProjectCopilotProvider>
    </ProjectWorkspaceContext.Provider>
  );
}
