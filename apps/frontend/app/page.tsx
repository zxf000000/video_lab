"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconArrowRight, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import { toast } from "react-toastify";
import type { ProjectSummary } from "@/src/api";
import { deleteProject, listProjects } from "@/src/api";
import CreateProjectDrawer from "@/src/components/CreateProjectDrawer";
import { EmptyState, SectionCard, StatCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { useConfirm } from "@/src/hooks/useConfirm";

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    refreshProjects();
  }, []);

  async function refreshProjects() {
    try {
      const payload = await listProjects();
      setProjects(payload.projects);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteProject(event: React.MouseEvent, projectId: number, name: string) {
    event.preventDefault();
    if (!(await confirm(`确定删除项目「${name}」？`))) return;
    try {
      await deleteProject(projectId);
      toast.success("项目已删除");
      refreshProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (projects.length > 0 && selectedIds.size === projects.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(projects.map((project) => project.id)));
  }

  async function handleBatchDelete() {
    const count = selectedIds.size;
    if (!count) return;
    if (!(await confirm(`确定删除选中的 ${count} 个项目？`))) return;
    for (const id of selectedIds) {
      try {
        await deleteProject(id);
      } catch {
        // Ignore per-item failures and refresh once after loop.
      }
    }
    setSelectedIds(new Set());
    refreshProjects();
  }

  const totalProjects = projects.length;
  const activeProjects = projects.filter((project) =>
    ["brief_ready", "assets_ready", "scripting_in_progress", "visual_generation_in_progress"].includes(project.currentStage),
  ).length;
  const exportReadyProjects = projects.filter((project) => project.currentStage === "export_ready").length;
  const averageEpisodes = totalProjects
    ? Math.round(projects.reduce((sum, project) => sum + project.episodeCountPlanned, 0) / totalProjects)
    : 0;

  return (
    <>
      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <div className="rounded-lg bg-gradient-to-r from-[#0a2a3a] to-[#1a0a2e] px-6 py-6 text-white shadow-glow border border-cyan-500/30">
          <p className="text-sm font-medium text-white/80">AI Short Drama Workspace</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight neon-text">把短剧生产流程变成可操作的工作台</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
            这里聚合项目、Brief、角色、场景、分集、镜头、Prompt、生成任务与审核导出，把 AI 短剧流水线落到一个后台里。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="inverted" size="sm" onClick={() => setDrawerOpen(true)}>
              <IconPlus size={16} stroke={2} />
              新建项目
            </Button>
            <Button variant="inverted" size="sm" onClick={refreshProjects}>
              <IconRefresh size={16} stroke={2} />
              刷新列表
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          <StatCard label="项目总数" value={String(totalProjects).padStart(2, "0")} meta="workspace projects" tone="purple" />
          <StatCard label="流程进行中" value={String(activeProjects).padStart(2, "0")} meta="active stages" tone="amber" />
          <StatCard label="可导出项目" value={String(exportReadyProjects).padStart(2, "0")} meta="export ready" tone="green" />
          <StatCard label="平均计划集数" value={String(averageEpisodes)} meta="planned episodes" tone="blue" />
        </div>
      </section>

      <SectionCard
        title="项目列表"
        description="按新 schema 浏览项目、平台、流程阶段和计划集数。"
        action={
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={refreshProjects}>
              <IconRefresh size={16} stroke={2} />
              刷新
            </Button>
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
              <IconPlus size={16} stroke={2} />
              新建项目
            </Button>
          </div>
        }
      >
        <div className="overflow-hidden rounded-lg border border-line bg-panel2">
          <div className="hidden grid-cols-[40px_1.3fr_1fr_1fr_140px_120px] gap-4 border-b border-line px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 lg:grid">
            <span className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-line accent-[#00f0ff] cursor-pointer"
                checked={projects.length > 0 && selectedIds.size === projects.length}
                ref={(el) => {
                  if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < projects.length;
                }}
                onChange={toggleSelectAll}
              />
            </span>
            <span>项目</span>
            <span>题材 / 平台</span>
            <span>流程阶段</span>
            <span>状态</span>
            <span>计划集数</span>
          </div>

          <div className="divide-y divide-line">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`grid gap-3 px-5 py-4 transition hover:bg-panel/5 lg:grid-cols-[40px_1.3fr_1fr_1fr_140px_120px] lg:items-center ${selectedIds.has(project.id) ? "bg-purple-500/10" : ""}`}
              >
                <span className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-line accent-[#00f0ff] cursor-pointer"
                    checked={selectedIds.has(project.id)}
                    onChange={() => toggleSelect(project.id)}
                  />
                </span>
                <Link href={`/projects/${project.id}`}>
                  <strong className="block truncate text-sm font-semibold text-gray-100">{project.name}</strong>
                  <span className="mt-1 block text-xs text-gray-500">#{project.id}</span>
                </Link>
                <div className="text-sm text-gray-500">
                  <div>{project.genre || "未填写题材"}</div>
                  <div className="mt-1 text-xs">{project.targetPlatform || "未填写平台"}</div>
                </div>
                <StatusPill value={project.currentStage} tone="blue" className="w-fit" />
                <StatusPill value={project.status} tone="purple" className="w-fit" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-300">{project.episodeCountPlanned}</span>
                  <div className="flex items-center gap-2">
                    <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-mint transition hover:text-mint/80">
                      进入
                      <IconArrowRight size={14} stroke={2} />
                    </Link>
                    <button
                      className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 transition hover:text-red-400"
                      onClick={(event) => handleDeleteProject(event, project.id, project.name)}
                    >
                      <IconTrash size={14} stroke={2} />
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {projects.length === 0 ? (
              <div className="p-6">
                <EmptyState title="还没有项目" description="先创建一个短剧项目，再进入 Brief、资产和分集生产流程。" action={<Button onClick={() => setDrawerOpen(true)}>新建项目</Button>} />
              </div>
            ) : null}
          </div>

          {selectedIds.size > 0 ? (
            <div className="flex items-center justify-between border-t border-line bg-panel px-5 py-3">
              <span className="text-sm text-gray-400">已选 {selectedIds.size} 项</span>
              <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                <IconTrash size={14} stroke={2} />
                批量删除
              </Button>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <ConfirmDialog />
      <CreateProjectDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          refreshProjects();
        }}
      />
    </>
  );
}
