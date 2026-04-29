"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { listProjects, deleteProject, getConfig } from "../src/api";
import CreateProjectDrawer from "../src/components/CreateProjectDrawer";
import ChatDrawer from "../src/components/ChatDrawer";
import { ActionButton, StatusBadge } from "../src/components/ui-legacy";
import { useConfirm } from "../src/hooks/useConfirm";
import { IconPlus, IconRefresh, IconTrash, IconMessage, IconWand } from "@tabler/icons-react";

export default function HomePage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    refreshProjects();
    getConfig().then((data) => setConfig(data.config)).catch(() => {});
  }, []);

  async function refreshProjects() {
    try {
      const payload = await listProjects();
      setProjects(payload.projects);
      setError("");
    } catch (err: any) {
      setError(String(err.message || err));
    }
  }

  async function handleDeleteProject(e: any, projectId: any, title: any) {
    e.preventDefault();
    if (!await confirm(`确定将项目「${title}」移入回收站？`)) return;
    try {
      await deleteProject(projectId);
      toast.success("已移入回收站");
      refreshProjects();
    } catch (err: any) {
      toast.error(String(err.message || err));
    }
  }

  const totalProjects = projects.length;
  const readyProjects = projects.filter((project) => project.status === "shots_ready").length;
  const activeProjects = projects.filter((project) =>
    ["generating_story", "splitting_shots", "generating_frames", "generating_video"].includes(project.status)
  ).length;
  const averageDuration = totalProjects
    ? Math.round(projects.reduce((sum, project) => sum + (project.target_duration || 0), 0) / totalProjects)
    : 0;

  return (
    <>
      {config ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-line bg-panel px-5 py-3 text-xs text-slate-500 shadow-glow">
          <span>Text: <span className="font-medium text-slate-800">{config.text_model}</span></span>
          <span className="text-line">|</span>
          <span>Image: <span className="font-medium text-slate-800">{config.image_model}</span></span>
          <span className="text-line">|</span>
          <span>Video: <span className="font-medium text-slate-800">{config.video_model}</span></span>
          {config.has_api_key ? (
            <span className="ml-auto rounded-full bg-mint/10 px-3 py-1 text-mint">API: {config.api_key_masked}</span>
          ) : (
            <span className="ml-auto rounded-full bg-amber-100 px-3 py-1 text-amber-700">未配置 API Key</span>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <div className="rounded-[28px] bg-gradient-to-r from-[#6f67d8] to-[#8b85f3] px-6 py-6 text-white shadow-glow">
          <p className="text-sm font-medium text-white/80">Hello Admin</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">把视频实验台包装成产品后台</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
            这里聚合项目管理、剧情拆解、镜头生成和模型配置，让当前工作区更像一套可演示的 Admin 产品，而不是内部实验页面。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ActionButton icon={IconPlus} label="新建项目" onClick={() => setDrawerOpen(true)} variant="primary" />
            <ActionButton icon={IconMessage} label="对话式创建" onClick={() => setChatDrawerOpen(true)} variant="inverted" />
            <Link href="/generate-video">
              <ActionButton icon={IconWand} label="快速生成" variant="inverted" />
            </Link>
            <ActionButton icon={IconRefresh} label="刷新列表" onClick={() => refreshProjects()} variant="inverted" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          <StatCard label="项目总数" value={String(totalProjects).padStart(2, "0")} tone="purple" meta="Workspace projects" />
          <StatCard label="可用项目" value={String(readyProjects).padStart(2, "0")} tone="green" meta="shots_ready" />
          <StatCard label="运行中" value={String(activeProjects).padStart(2, "0")} tone="amber" meta="active pipelines" />
          <StatCard label="平均时长" value={`${averageDuration}s`} tone="blue" meta="target duration" />
        </div>
      </section>

      <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">项目列表</h2>
            <p className="mt-1 text-sm text-slate-500">按产品后台方式浏览当前视频项目、状态与目标时长。</p>
          </div>
          <div className="flex items-center gap-3">
            <ActionButton icon={IconRefresh} label="刷新" onClick={() => refreshProjects()} />
            <ActionButton icon={IconPlus} label="新建项目" onClick={() => setDrawerOpen(true)} variant="primary" />
          </div>
        </div>

        <div className="overflow-hidden rounded-[22px] border border-line bg-panel2">
          <div className="hidden grid-cols-[1.2fr_2fr_120px_120px_96px] gap-4 border-b border-line px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:grid">
            <span>项目</span>
            <span>剧情需求</span>
            <span>状态</span>
            <span>时长</span>
            <span>操作</span>
          </div>

          <div className="divide-y divide-line">
            {projects.map((project) => (
              <div
                key={project.id}
                className="grid gap-3 px-5 py-4 transition hover:bg-white/70 lg:grid-cols-[1.2fr_2fr_120px_120px_96px] lg:items-center"
              >
                <Link href={`/projects/${project.id}`}>
                  <strong className="block truncate text-sm font-semibold text-slate-900">{project.title}</strong>
                  <span className="mt-1 block text-xs text-slate-500">#{project.id}</span>
                </Link>
                <Link href={`/projects/${project.id}`} className="truncate text-sm text-slate-500">{project.story_prompt}</Link>
                <StatusBadge status={project.status} className="w-fit" />
                <span className="text-sm font-medium text-slate-700">{project.target_duration}s</span>
                <button
                  className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 transition hover:text-rose-600"
                  onClick={(e) => handleDeleteProject(e, project.id, project.title)}
                >
                  <IconTrash size={14} stroke={2} />
                  删除
                </button>
              </div>
            ))}

            {projects.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                还没有项目，点击右上角「+ 新建项目」开始创建。
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <ConfirmDialog />
      <CreateProjectDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          refreshProjects();
        }}
      />
      <ChatDrawer
        open={chatDrawerOpen}
        onClose={() => {
          setChatDrawerOpen(false);
          refreshProjects();
        }}
      />
    </>
  );
}

function StatCard({ label, value, meta, tone = "purple" }: { label: any; value: any; meta: any; tone?: string }) {
  const toneMap: Record<string, string> = {
    purple: "bg-[#f2efff] text-[#6f67d8]",
    green: "bg-[#eef8ef] text-[#53a56b]",
    amber: "bg-[#fff4e3] text-[#d6972f]",
    blue: "bg-[#eef4ff] text-[#4f79d8]",
  };

  return (
    <article className="rounded-[24px] border border-line bg-panel p-5 shadow-glow">
      <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${toneMap[tone] || toneMap.purple}`}>
        {label}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{meta}</p>
    </article>
  );
}
