"use client";

import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import { StatusBadge } from "./ui-legacy";

const GENERATION_TASK_TYPES = new Set(["pipeline", "generate_story", "generate_characters"]);

const GENERATION_STEPS = [
  { key: "submitted", label: "已提交", statuses: ["draft", "queued"] },
  { key: "story", label: "生成大纲", statuses: ["generating_story", "outline_ready"] },
  { key: "characters", label: "生成角色卡", statuses: ["generating_characters"] },
  { key: "done", label: "完成", statuses: ["project_ready"] },
];

const STATUS_TO_STEP = new Map(
  GENERATION_STEPS.flatMap((step, index) => step.statuses.map((status) => [status, index]))
);

export default function ProjectGenerationProgress({ project, compact = false }: any) {
  const tasks = project?.tasks || [];
  const activeTask = tasks.find(
    (task: any) => GENERATION_TASK_TYPES.has(task.task_type) && (task.status === "queued" || task.status === "running")
  );
  const failedTask = !activeTask && isFailureStatus(project?.status)
    ? tasks.find((task: any) => GENERATION_TASK_TYPES.has(task.task_type) && task.status === "failed")
    : null;
  const activeIndex = failedTask ? Math.max(0, STATUS_TO_STEP.get(project?.status) ?? 0) : getActiveIndex(project, activeTask);
  const isVisible = Boolean(failedTask || activeTask || isGenerationStatus(project?.status));

  if (!isVisible) return null;

  const activeStep = GENERATION_STEPS[activeIndex] || GENERATION_STEPS[0];

  if (compact) {
    return (
      <div className="mt-3 border-t border-line pt-3">
        <div className="grid grid-cols-4 gap-2">
          {GENERATION_STEPS.map((step, index) => {
            const state = getStepState(index, activeIndex, failedTask);
            return (
              <div key={step.key} className="min-w-0 rounded-xl bg-panel2/70 px-2 py-1.5">
                <div className={`h-1 w-full rounded-full ${stepTone(state)}`} />
                <p className={`mt-1 truncate text-center text-[10px] font-medium leading-3 ${state === "pending" ? "text-gray-500" : "text-gray-300"}`}>
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-panel px-5 py-4 shadow-glow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Project Generation</p>
          <h2 className="mt-1 text-base font-semibold text-gray-100">
            {failedTask ? "生成失败" : activeStep.label}
          </h2>
        </div>
        <StatusBadge status={failedTask ? "failed" : project.status} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {GENERATION_STEPS.map((step, index) => {
          const state = getStepState(index, activeIndex, failedTask);
          return (
            <div key={step.key} className="flex min-w-0 items-center gap-2 rounded-2xl border border-line bg-panel2 px-3 py-2">
              <StepIcon state={state} />
              <span className={`truncate text-xs font-medium ${state === "pending" ? "text-gray-500" : "text-gray-200"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {failedTask?.error_message ? (
        <p className="mt-3 text-sm leading-5 text-red-400">{failedTask.error_message}</p>
      ) : null}
    </section>
  );
}

function getActiveIndex(project: any, createTask: any) {
  if (createTask?.status === "queued") return 0;
  if (project?.status === "outline_ready") return 1;
  return STATUS_TO_STEP.get(project?.status) ?? 0;
}

function isGenerationStatus(status: any) {
  return STATUS_TO_STEP.has(status) && status !== "project_ready";
}

function isFailureStatus(status: any) {
  return status === "prompt_updated";
}

function getStepState(index: any, activeIndex: any, failedTask: any) {
  if (failedTask && index === activeIndex) return "failed";
  if (index < activeIndex) return "done";
  if (index === activeIndex) return "active";
  return "pending";
}

function StepIcon({ state }: any) {
  if (state === "done") {
    return <IconCheck size={15} stroke={2} className="shrink-0 text-emerald-400" />;
  }
  if (state === "failed") {
    return <IconX size={15} stroke={2} className="shrink-0 text-red-400" />;
  }
  if (state === "active") {
    return <IconLoader2 size={15} stroke={2} className="shrink-0 animate-spin text-mint" />;
  }
  return <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />;
}

function stepTone(state: any) {
  if (state === "done") return "bg-emerald-500/100";
  if (state === "failed") return "bg-rose-400";
  if (state === "active") return "bg-mint";
  return "bg-slate-300";
}
