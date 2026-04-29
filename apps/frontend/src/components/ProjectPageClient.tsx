"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { getProject, regenerateProject } from "../api";
import ProjectHeader from "./ProjectHeader";
import StepIndicator from "./StepIndicator";
import ScriptTab from "./tabs/ScriptTab";
import ScreenplayTab from "./tabs/ScreenplayTab";
import BeatsTab from "./tabs/BeatsTab";
import CharactersTab from "./tabs/CharactersTab";
import StoryboardTab from "./tabs/StoryboardTab";
import TimelineTab from "./tabs/TimelineTab";
import { StatusBadge } from "./ui-legacy";

const TAB_DEFS = [
  { key: "overview", label: "总览" },
  { key: "script", label: "剧本" },
  { key: "screenplay", label: "剧本化" },
  { key: "beats", label: "节拍" },
  { key: "characters", label: "角色&场景" },
  { key: "storyboard", label: "分镜板" },
  { key: "timeline", label: "时间轴" },
];

const VALID_TABS = new Set(TAB_DEFS.map((t) => t.key));

export default function ProjectPageClient({ projectId, initialTab = "script" }: any) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [project, setProject] = useState<any>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState("");
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const rawTab = searchParams.get("tab");
    const nextTab = VALID_TABS.has(rawTab as string) ? rawTab : "overview";
    setActiveTab(nextTab);
  }, [searchParams]);

  useEffect(() => {
    if (!Number.isFinite(projectId)) {
      setError("Invalid project id");
      return undefined;
    }

    refreshProject();
    const timer = window.setInterval(() => refreshProject(true), 2500);
    return () => window.clearInterval(timer);
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    const prev = prevStatusRef.current;
    if (prev && prev !== project.status && project.status === "shots_ready") {
      toast.success("AI 剧本生成完成！");
    }
    prevStatusRef.current = project.status;
  }, [project?.status]);

  async function refreshProject(silent = false) {
    try {
      const payload = await getProject(projectId);
      setProject(payload.project);
      if (!silent) {
        setError("");
      }
    } catch (err: any) {
      if (!silent) {
        setError(String(err.message || err));
      }
    }
  }

  function runProjectAction(action: any, actionKey = "") {
    startTransition(async () => {
      setPendingAction(actionKey);
      try {
        await action(projectId);
        await refreshProject();
      } catch (err: any) {
        setError(String(err.message || err));
      } finally {
        setPendingAction("");
      }
    });
  }

  function handleStepClick(key: any) {
    setActiveTab(key);
    router.push(`/projects/${projectId}?tab=${key}`);
  }

  const shots = project?.shots || [];
  const tasks = project?.tasks || [];
  const framesReady = shots.filter((shot: any) => shot.status === "frames_ready" || shot.status === "video_ready").length;
  const videosReady = shots.filter((shot: any) => shot.status === "video_ready").length;
  const failedTasks = tasks.filter((task: any) => task.status === "failed");
  const latestTasks = tasks.slice(0, 5);
  const isRegeneratingProject =
    (isPending && pendingAction === "regenerate_project") ||
    tasks.some((task: any) => task.task_type === "create_project" && (task.status === "queued" || task.status === "running")) ||
    ["generating_story", "generating_screenplay", "generating_beats", "generating_characters", "generating_scenes", "splitting_shots"].includes(project?.status);

  return (
    <div className="min-h-screen bg-ink text-slate-900">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5 px-4 py-5 lg:px-6">
        <ProjectHeader
          project={project}
          title={project ? project.title : `项目 #${projectId}`}
          backHref="/"
          backLabel="返回项目首页"
          onRegenerate={(keepStory: boolean) => runProjectAction(() => regenerateProject(projectId, keepStory), "regenerate_project")}
          regenerating={isRegeneratingProject}
        />

        {error ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        {!project ? (
          <section className="rounded-[28px] border border-dashed border-line bg-panel p-8 text-slate-500 shadow-glow">
            正在加载项目数据...
          </section>
        ) : (
          <>
            <StepIndicator steps={TAB_DEFS} activeStep={activeTab} onStepClick={handleStepClick} />

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                {activeTab === "overview" && (
                  <OverviewSection project={project} shots={shots} framesReady={framesReady} videosReady={videosReady} failedTasks={failedTasks} />
                )}

                {activeTab === "script" && (
                  <ScriptTab
                    project={project}
                    isPending={isPending}
                    onRunAction={runProjectAction}
                  />
                )}

                {activeTab === "screenplay" && (
                  <ScreenplayTab
                    project={project}
                    isPending={isPending}
                    onRunAction={runProjectAction}
                  />
                )}

                {activeTab === "beats" && (
                  <BeatsTab
                    project={project}
                    isPending={isPending}
                    onRunAction={runProjectAction}
                  />
                )}

                {activeTab === "characters" && <CharactersTab project={project} onRefresh={refreshProject} />}

                {activeTab === "storyboard" && (
                  <StoryboardTab
                    project={project}
                    isPending={isPending}
                    pendingAction={pendingAction}
                    onRunAction={runProjectAction}
                    onRefresh={refreshProject}
                  />
                )}

                {activeTab === "timeline" && <TimelineTab project={project} />}
              </div>

              <aside className="sticky top-[140px] flex max-h-[calc(100vh-160px)] flex-col gap-5 overflow-y-auto">
                <SidebarPanel title="项目摘要">
                  <div className="space-y-3">
                    <SidebarItem label="当前状态" value={<StatusBadge status={project.status} />} />
                    <SidebarItem label="风格" value={project.style} />
                    <SidebarItem label="画面比例" value={project.aspect_ratio} />
                    <SidebarItem label="目标时长" value={`${project.target_duration}s`} />
                    <SidebarItem label="角色数量" value={String(project.characters?.length || 0)} />
                    <SidebarItem label="场景数量" value={String(project.scenes?.length || 0)} />
                  </div>
                </SidebarPanel>

                <SidebarPanel title="最近任务">
                  <div className="space-y-3">
                    {latestTasks.length ? latestTasks.map((task: any) => (
                      <div key={task.id} className="rounded-2xl border border-line bg-panel2 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-sm font-semibold text-slate-800">{task.task_type}</strong>
                          <StatusBadge status={task.status} className="px-2 py-1" />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {task.shot_id ? `镜头 ${task.shot_id} · ` : ""}
                          {formatTime(task.updated_at)}
                        </p>
                        {task.error_message ? <p className="mt-2 text-xs leading-5 text-rose-500">{task.error_message}</p> : null}
                      </div>
                    )) : (
                      <p className="text-sm text-slate-500">还没有后台任务。</p>
                    )}
                  </div>
                </SidebarPanel>
              </aside>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: any) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  return d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function OverviewSection({ project, shots, framesReady, videosReady, failedTasks }: any) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="grid gap-4">
      <div className="rounded-[28px] bg-gradient-to-r from-[#6f67d8] to-[#8b85f3] px-6 py-6 text-white shadow-glow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-white/80">Project Overview</p>
              <button
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80 transition hover:bg-white/20"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "收起" : "展开"}
              </button>
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{project.title}</h2>
            {expanded && (
              <>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">{project.story_prompt}</p>
                <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/80">
                  <span className="rounded-full bg-white/10 px-3 py-1">{project.style}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1">{project.aspect_ratio}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1">{project.target_duration}s target</span>
                </div>
              </>
            )}
          </div>
          <StatusBadge
            status={project.status}
            className="border border-white/20 bg-white/10 text-xs font-semibold uppercase tracking-[0.18em] text-white"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ProjectStatCard label="镜头总数" value={String(shots.length).padStart(2, "0")} meta="storyboard items" tone="purple" />
        <ProjectStatCard label="首尾帧完成" value={String(framesReady).padStart(2, "0")} meta="frames ready" tone="blue" />
        <ProjectStatCard label="视频完成" value={String(videosReady).padStart(2, "0")} meta="video ready" tone="green" />
        <ProjectStatCard label="失败任务" value={String(failedTasks.length).padStart(2, "0")} meta="needs attention" tone="amber" />
      </div>
    </section>
  );
}

function ProjectStatCard({ label, value, meta, tone = "purple" }: any) {
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

function SidebarPanel({ title, children }: any) {
  return (
    <section className="rounded-[28px] border border-line bg-panel p-5 shadow-glow">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SidebarItem({ label, value }: any) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-panel2 px-4 py-3">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {typeof value === "string" ? <span className="text-sm font-semibold text-slate-800">{value}</span> : value}
    </div>
  );
}
