"use client";

import { useEffect, useMemo, useState } from "react";
import { addEpisodeShot, generateAllEpisodeFrames, generateAllEpisodeVideos, generateEpisodeShots } from "../../api";
import { ActionButton, EmptyState } from "../ui-legacy";
import { IconPlus, IconPhoto, IconVideo, IconHierarchy } from "@tabler/icons-react";
import ShotCard from "../ShotCard";

export default function StoryboardTab({ project, isPending, pendingAction, onRunAction, onRefresh }: any) {
  const [adding, setAdding] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(project.episodes?.[0]?.id ?? null);

  useEffect(() => {
    const episodes = project.episodes || [];
    if (!episodes.length) {
      setSelectedEpisodeId(null);
      return;
    }
    if (!selectedEpisodeId || !episodes.some((episode: any) => episode.id === selectedEpisodeId)) {
      setSelectedEpisodeId(episodes[0].id);
    }
  }, [project.episodes, selectedEpisodeId]);

  const selectedEpisode = (project.episodes || []).find((episode: any) => episode.id === selectedEpisodeId) || null;
  const shots = useMemo(
    () => (project.shots || []).filter((shot: any) => shot.episode_id === selectedEpisodeId),
    [project.shots, selectedEpisodeId],
  );
  const isGeneratingAllFrames = isPending && pendingAction === "generate_all_episode_frames";
  const isGeneratingAllVideos = isPending && pendingAction === "generate_all_episode_videos";
  const isGeneratingShots = isPending && pendingAction === "generate_episode_shots";
  const totalDuration = shots.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);

  async function handleAddShot() {
    if (!selectedEpisodeId) return;
    setAdding(true);
    try {
      await addEpisodeShot(selectedEpisodeId, {
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
            <MetricCard label="镜头数量" value={String(shots.length).padStart(2, "0")} meta="storyboard cards" />
            <MetricCard label="总时长" value={`${totalDuration}s`} meta="assembled duration" />
            <MetricCard label="已完成视频" value={String(shots.filter((shot: any) => shot.status === "video_ready").length || 0).padStart(2, "0")} meta="video ready" />
          </div>

          <div className="rounded-[24px] border border-line bg-panel2 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Storyboard Actions</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <ActionButton
                icon={isGeneratingShots ? undefined : IconHierarchy}
                disabled={!selectedEpisodeId || isPending}
                label={isGeneratingShots ? "生成分镜中..." : "根据本集剧本生成分镜"}
                onClick={() => selectedEpisodeId && onRunAction(() => generateEpisodeShots(selectedEpisodeId), "generate_episode_shots")}
              />
              <ActionButton icon={adding ? undefined : IconPlus} disabled={adding} label={adding ? "添加中..." : "添加镜头"} onClick={handleAddShot} />
              <ActionButton
                icon={isGeneratingAllFrames ? undefined : IconPhoto}
                disabled={!selectedEpisodeId || isPending}
                label={isGeneratingAllFrames ? "批量生成首尾帧中..." : "一键生成全部首尾帧"}
                onClick={() => selectedEpisodeId && onRunAction(() => generateAllEpisodeFrames(selectedEpisodeId), "generate_all_episode_frames")}
              />
              <ActionButton
                icon={isGeneratingAllVideos ? undefined : IconVideo}
                disabled={!selectedEpisodeId || isPending}
                label={isGeneratingAllVideos ? "批量生成视频中..." : "一键生成全部视频"}
                onClick={() => selectedEpisodeId && onRunAction(() => generateAllEpisodeVideos(selectedEpisodeId), "generate_all_episode_videos")}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-line bg-panel p-5 shadow-glow">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">分镜板</h3>
            <p className="mt-1 text-sm text-slate-500">先选分集，再按本集剧本生成镜头并管理素材状态。</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="rounded-full border border-line bg-panel2 px-3 py-1.5 text-xs text-slate-700 outline-none"
              value={selectedEpisodeId ?? ""}
              onChange={(event) => setSelectedEpisodeId(Number(event.target.value))}
            >
              {(project.episodes || []).map((episode: any) => (
                <option key={episode.id} value={episode.id}>
                  第{episode.episode_number}集 · {episode.title}
                </option>
              ))}
            </select>
            <span className="rounded-full bg-[#f2efff] px-3 py-1 text-xs font-medium text-mint">
              {shots.length} Shots
            </span>
          </div>
        </div>

        {!selectedEpisode ? <EmptyState text="先创建分集并生成单集剧本，再开始生成分镜。" /> : null}
        {selectedEpisode && shots.map((shot: any) => (
          <ShotCard key={shot.id} shot={shot} onRefresh={onRefresh} projectId={project.id} tasks={project.tasks || []} />
        ))}
        {selectedEpisode && !shots.length ? <EmptyState text="当前分集还没有镜头。先点击「根据本集剧本生成分镜」。" /> : null}
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
