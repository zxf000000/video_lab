"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconArrowRight, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import { toast } from "react-toastify";
import type { ProjectSummary } from "@/src/api";
import { deleteProject, deleteProjects, listProjects } from "@/src/api";
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
    try {
      const result = await deleteProjects(Array.from(selectedIds));
      toast.success(`已删除 ${result.deleted} 个项目`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
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
      {error ? (
        <div className="border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400"
          style={{ clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)" }}>
          <span className="text-red-400 font-bold mr-2">[ERR]</span>
          {error}
        </div>
      ) : null}

      {/* ============================================================
          HERO + STATS — two-column cyberpunk layout
          ============================================================ */}
      <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        {/* Hero panel */}
        <div
          className="px-6 py-7 text-white relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0a0a20 0%, #0d1028 30%, #0a0a20 60%, #100d24 100%)",
            border: "1px solid rgba(0,240,255,0.15)",
            boxShadow: "0 0 40px rgba(0,240,255,0.06), 0 0 80px rgba(255,45,149,0.03)",
            clipPath: "polygon(0 8px, 8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)",
          }}
        >
          {/* Atmospheric glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-mint/3 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-neon-magenta/3 blur-3xl pointer-events-none" />

          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-12 h-12">
            <div className="absolute top-0 left-0 w-8 h-[1.5px] bg-gradient-to-r from-mint to-transparent" />
            <div className="absolute top-0 left-0 h-8 w-[1.5px] bg-gradient-to-b from-mint to-transparent" />
          </div>
          <div className="absolute bottom-0 right-0 w-12 h-12">
            <div className="absolute bottom-0 right-0 w-8 h-[1.5px] bg-gradient-to-l from-neon-magenta to-transparent" />
            <div className="absolute bottom-0 right-0 h-8 w-[1.5px] bg-gradient-to-t from-neon-magenta to-transparent" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-bold tracking-[0.3em] text-mint/70">
                SYS.INITIALIZED
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-mint/20 to-transparent" />
            </div>

            <p className="text-xs tracking-[0.2em] text-gray-400 mb-1">AI SHORT DRAMA WORKSPACE</p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight leading-tight"
              style={{ fontFamily: "var(--font-mono), monospace" }}>
              <span className="neon-text">把短剧生产流程</span>
              <br />
              <span className="neon-text-magenta">变成可操作的工作台</span>
            </h2>

            <p className="mt-4 max-w-2xl text-[13px] leading-6 text-gray-400 tracking-wide">
              聚合项目、Brief、角色、场景、分集、镜头、Prompt、生成任务与审核导出，
              把 AI 短剧流水线落到一个后台里。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="sm" onClick={() => setDrawerOpen(true)}>
                <IconPlus size={15} stroke={2} />
                新建项目
              </Button>
              <Button variant="outline" size="sm" onClick={refreshProjects}>
                <IconRefresh size={15} stroke={2} />
                刷新列表
              </Button>
            </div>
          </div>
        </div>

        {/* Stat cards grid */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
          <StatCard label="项目总数" value={String(totalProjects).padStart(2, "0")} meta="workspace projects" tone="purple" />
          <StatCard label="流程进行中" value={String(activeProjects).padStart(2, "0")} meta="active stages" tone="amber" />
          <StatCard label="可导出项目" value={String(exportReadyProjects).padStart(2, "0")} meta="export ready" tone="green" />
          <StatCard label="平均计划集数" value={String(averageEpisodes)} meta="planned episodes" tone="blue" />
        </div>
      </section>

      {/* ============================================================
          PROJECT TABLE — terminal-inspired list
          ============================================================ */}
      <SectionCard
        title="项目列表"
        description="按新 schema 浏览项目、平台、流程阶段和计划集数。"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={refreshProjects}>
              <IconRefresh size={15} stroke={2} />
              刷新
            </Button>
            <Button size="sm" onClick={() => setDrawerOpen(true)}>
              <IconPlus size={15} stroke={2} />
              新建项目
            </Button>
          </div>
        }
      >
        <div className="overflow-hidden border border-line/60" style={{ background: "rgba(10,10,24,0.5)" }}>
          {/* Table header */}
          <div
            className="hidden grid-cols-[40px_1.3fr_1fr_1fr_140px_120px] gap-4 px-5 py-2.5 text-[10px] font-bold tracking-[0.18em] text-gray-600 uppercase lg:grid"
            style={{ background: "rgba(0,240,255,0.02)", borderBottom: "1px solid rgba(0,240,255,0.06)" }}
          >
            <span className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 border-line/60 bg-transparent cursor-pointer"
                style={{ accentColor: "#00f0ff" }}
                checked={projects.length > 0 && selectedIds.size === projects.length}
                ref={(el) => {
                  if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < projects.length;
                }}
                onChange={toggleSelectAll}
              />
            </span>
            <span>项目名称</span>
            <span>题材 / 平台</span>
            <span>流程阶段</span>
            <span>状态</span>
            <span>计划集数</span>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-line/40">
            {projects.map((project, i) => (
              <div
                key={project.id}
                className={`grid gap-3 px-5 py-4 transition-all duration-150 lg:grid-cols-[40px_1.3fr_1fr_1fr_140px_120px] lg:items-center ${
                  selectedIds.has(project.id)
                    ? "bg-neon-magenta/5"
                    : "hover:bg-mint/[0.02]"
                }`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 border-line/60 bg-transparent cursor-pointer"
                    style={{ accentColor: "#00f0ff" }}
                    checked={selectedIds.has(project.id)}
                    onChange={() => toggleSelect(project.id)}
                  />
                </span>

                <Link href={`/projects/${project.id}`} className="group">
                  <div className="flex items-center gap-2">
                    <strong className="block truncate text-sm font-bold text-gray-100 group-hover:text-mint transition-colors">
                      {project.name}
                    </strong>
                  </div>
                  <span className="mt-0.5 block text-[10px] tracking-wider text-gray-600">
                    ID:{String(project.id).padStart(4, "0")}
                  </span>
                </Link>

                <div className="text-[12px] text-gray-500">
                  <div className="tracking-wide">{project.genre || "未填写题材"}</div>
                  <div className="mt-0.5 text-[10px] text-gray-600">{project.targetPlatform || "未填写平台"}</div>
                </div>

                <StatusPill value={project.currentStage} tone="blue" className="w-fit" />
                <StatusPill value={project.status} tone="purple" className="w-fit" />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-gray-300" style={{ fontFamily: "var(--font-mono), monospace" }}>
                    {String(project.episodeCountPlanned).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-mint transition hover:text-mint/70"
                    >
                      进入
                      <IconArrowRight size={13} stroke={2.5} />
                    </Link>
                    <button
                      className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-red-400/70 transition hover:text-red-400"
                      onClick={(event) => handleDeleteProject(event, project.id, project.name)}
                    >
                      <IconTrash size={13} stroke={2} />
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {projects.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="还没有项目"
                  description="先创建一个短剧项目，再进入 Brief、资产和分集生产流程。"
                  action={<Button onClick={() => setDrawerOpen(true)}>新建项目</Button>}
                />
              </div>
            ) : null}
          </div>

          {/* Batch actions */}
          {selectedIds.size > 0 ? (
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{
                background: "rgba(255,45,149,0.04)",
                borderTop: "1px solid rgba(255,45,149,0.12)",
              }}
            >
              <span className="text-[11px] font-semibold tracking-wide text-neon-magenta">
                [已选 {selectedIds.size} 项]
              </span>
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
