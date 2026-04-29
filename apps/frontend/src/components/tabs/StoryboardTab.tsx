"use client";

import { useState } from "react";
import { generateAllFrames, generateAllVideos, addShot } from "../../api";
import { ActionButton, EmptyState } from "../ui-legacy";
import { IconPlus, IconPhoto, IconVideo } from "@tabler/icons-react";
import ShotCard from "../ShotCard";

export default function StoryboardTab({ project, isPending, pendingAction, onRunAction, onRefresh }: any) {
  const [adding, setAdding] = useState(false);
  const isGeneratingAllFrames = isPending && pendingAction === "generate_all_frames";
  const isGeneratingAllVideos = isPending && pendingAction === "generate_all_videos";
  const totalDuration = project.shots?.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0) || 0;

  async function handleAddShot() {
    setAdding(true);
    try {
      await addShot(project.id, {
        shot_title: "新镜头",
        shot_description: "请编辑镜头描述",
        shot_prompt: "请编辑镜头 Prompt",
        duration_seconds: 5,
      });
      await onRefresh();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="镜头数量" value={String(project.shots?.length || 0).padStart(2, "0")} meta="storyboard cards" />
            <MetricCard label="总时长" value={`${totalDuration}s`} meta="assembled duration" />
            <MetricCard label="已完成视频" value={String(project.shots?.filter((shot: any) => shot.status === "video_ready").length || 0).padStart(2, "0")} meta="video ready" />
          </div>

          <div className="rounded-[24px] border border-line bg-panel2 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Storyboard Actions</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <ActionButton icon={adding ? undefined : IconPlus} disabled={adding} label={adding ? "添加中..." : "添加镜头"} onClick={handleAddShot} />
              <ActionButton
                icon={isGeneratingAllFrames ? undefined : IconPhoto}
                disabled={isPending}
                label={isGeneratingAllFrames ? "批量生成首尾帧中..." : "一键生成全部首尾帧"}
                onClick={() => onRunAction(generateAllFrames, "generate_all_frames")}
              />
              <ActionButton
                icon={isGeneratingAllVideos ? undefined : IconVideo}
                disabled={isPending}
                label={isGeneratingAllVideos ? "批量生成视频中..." : "一键生成全部视频"}
                onClick={() => onRunAction(generateAllVideos, "generate_all_videos")}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-line bg-panel p-5 shadow-glow">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">分镜板</h3>
            <p className="mt-1 text-sm text-slate-500">逐镜头编辑 Prompt、生成素材并管理产物状态。</p>
          </div>
          <span className="rounded-full bg-[#f2efff] px-3 py-1 text-xs font-medium text-mint">
            {project.shots?.length || 0} Shots
          </span>
        </div>

        {project.shots?.map((shot: any) => (
          <ShotCard key={shot.id} shot={shot} onRefresh={onRefresh} projectId={project.id} tasks={project.tasks || []} />
        ))}
        {!project.shots?.length ? <EmptyState text="当前项目还没有镜头。点击顶部栏的「重新生成」生成。" /> : null}
      </section>
    </div>
  );
}

function MetricCard({ label, value, meta }: any) {
  return (
    <div className="rounded-[22px] border border-line bg-panel2 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{meta}</p>
    </div>
  );
}
