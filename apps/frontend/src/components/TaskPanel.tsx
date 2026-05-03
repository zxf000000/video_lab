import { EmptyState, StatusBadge } from "./ui-legacy";

export default function TaskPanel({ tasks }: any) {
  return (
    <section className="rounded-lg border border-line bg-panel p-6 shadow-glow">
      <h3 className="text-xl font-semibold text-gray-100">任务状态</h3>
      <div className="mt-4 space-y-3">
        {tasks?.slice(0, 12).map((task: any) => (
          <div key={task.id} className="rounded-2xl border border-line bg-panel2 p-4">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-gray-100">{task.task_type}</strong>
              <StatusBadge status={task.status} className="uppercase tracking-[0.12em]" />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {task.shot_id ? `镜头 ${task.shot_id} · ` : ""}
              {task.updated_at}
            </p>
            {task.error_message ? <p className="mt-2 text-sm text-red-400">{task.error_message}</p> : null}
          </div>
        ))}
        {!tasks?.length ? <EmptyState text="还没有后台任务。" /> : null}
      </div>
    </section>
  );
}
