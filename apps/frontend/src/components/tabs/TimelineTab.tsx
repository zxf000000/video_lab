import Link from "next/link";

const BAR_COLORS = [
  "bg-mint/60",
  "bg-cyan-400/60",
  "bg-sky-400/60",
  "bg-violet-400/60",
  "bg-ember/60",
  "bg-rose-400/60",
];

export default function TimelineTab({ project }: any) {
  const shots = project.shots || [];
  const tasks = project.tasks || [];
  const totalDuration = shots.reduce((sum: number, s: any) => sum + (s.duration_seconds || 0), 0);
  const targetDuration = project.target_duration || totalDuration || 1;

  const frameTasks = tasks.filter((t: any) => t.task_type === "generate_shot_frames");
  const videoTasks = tasks.filter((t: any) => t.task_type === "generate_shot_video");

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">时间轴</h3>
            <p className="mt-1 text-sm text-slate-500">
              基于镜头时长的可视化序列预览
            </p>
          </div>
        </div>

        {shots.length > 0 ? (
          <>
            <div className="mt-6 flex h-16 gap-1 overflow-hidden rounded-[22px] border border-line bg-panel2">
              {shots.map((shot: any, i: number) => {
                const pct = ((shot.duration_seconds || 0) / targetDuration) * 100;
                return (
                  <Link
                    key={shot.id}
                    href={`/projects/${project.id}?tab=storyboard`}
                    className={`${BAR_COLORS[i % BAR_COLORS.length]} group relative flex items-center justify-center overflow-hidden rounded-xl transition hover:brightness-125`}
                    style={{ width: `${Math.max(pct, 4)}%` }}
                    title={`${shot.shot_title} · ${shot.duration_seconds}s`}
                  >
                    <span className="truncate px-1 text-xs font-medium text-slate-950/80">
                      {shot.shot_title}
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <SummaryCard label="总镜头数" value={`${shots.length} 个`} />
              <SummaryCard label="实际总时长" value={`${totalDuration}s`} />
              <SummaryCard label="目标时长" value={`${project.target_duration}s`} />
            </div>

            <div className="mt-4 space-y-2">
              {shots.map((shot: any, i: number) => {
                const shotFrameTasks = frameTasks.filter((t: any) => t.shot_id === shot.id);
                const shotVideoTasks = videoTasks.filter((t: any) => t.shot_id === shot.id);
                const failedTasks = [...shotFrameTasks, ...shotVideoTasks].filter((t: any) => t.status === "failed");

                return (
                  <div key={shot.id} className={`rounded-[22px] border bg-panel2 px-4 py-3 ${failedTasks.length > 0 ? "border-rose-200" : "border-line"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`} />
                      <span className="flex-1 truncate text-sm font-medium text-slate-800">{shot.shot_title}</span>
                      {shot.camera_movement && (
                        <span className="hidden text-xs text-slate-500 sm:inline">{shot.camera_movement}</span>
                      )}
                      <span className="text-xs text-slate-500">{shot.duration_seconds}s</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        shot.status === "video_ready"
                          ? "bg-emerald-100 text-emerald-700"
                          : shot.status === "frames_ready"
                            ? "bg-cyan-100 text-cyan-700"
                            : shot.status === "prompt_updated"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                      }`}>
                        {shot.status}
                      </span>
                    </div>
                    {failedTasks.length > 0 && (
                      <div className="mt-2 ml-5 space-y-1">
                        {failedTasks.map((t: any) => (
                          <p key={t.id} className="text-xs text-rose-500">
                            {t.task_type} 失败: {t.error_message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="mt-6 text-sm text-slate-500">还没有镜头数据。请先在剧本 Tab 生成剧情并拆分镜头。</p>
        )}
      </section>

      <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
        <h3 className="text-lg font-semibold text-slate-900">自动拼接 & 导出</h3>
        <p className="mt-2 text-sm text-slate-500">
          后续版本将支持镜头自动拼接、转场、字幕、背景音乐和旁白合成，最终导出 MP4 成片。
        </p>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: any) {
  return (
    <div className="rounded-[22px] border border-line bg-panel2 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
