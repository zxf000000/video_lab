"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { listDeletedProjects, restoreProject, permanentDeleteProject, type DeletedProject } from "../../src/api";
import { ActionButton } from "../../src/components/ui-legacy";
import { useConfirm } from "../../src/hooks/useConfirm";
import { IconRefresh, IconRotateClockwise, IconTrash } from "@tabler/icons-react";

export default function RecycleBinPage() {
  const [projects, setProjects] = useState<DeletedProject[]>([]);
  const [error, setError] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    try {
      const payload = await listDeletedProjects();
      setProjects(payload.projects);
      setError("");
    } catch (err: unknown) {
      setError(String((err as Error).message || err));
    }
  }

  async function handleRestore(id: number, title: string) {
    try {
      await restoreProject(id);
      toast.success(`项目「${title}」已恢复`);
      refresh();
    } catch (err: unknown) {
      toast.error(String((err as Error).message || err));
    }
  }

  async function handlePermanentDelete(id: number, title: string) {
    if (!await confirm(`确定永久删除项目「${title}」？此操作不可恢复！`)) return;
    try {
      await permanentDeleteProject(id);
      toast.success("已永久删除");
      refresh();
    } catch (err: unknown) {
      toast.error(String((err as Error).message || err));
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel px-5 py-4 shadow-glow">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint">Recycle Bin</p>
          <h1 className="mt-1 text-lg font-semibold text-gray-100">回收站</h1>
          <p className="text-[11px] text-gray-500">已删除的项目可以在此恢复或永久删除。</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-line bg-panel p-6 shadow-glow">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">已删除项目</h2>
            <p className="mt-1 text-sm text-gray-500">共 {projects.length} 个已删除项目</p>
          </div>
          <ActionButton icon={IconRefresh} label="刷新" onClick={() => refresh()} />
        </div>

        <div className="overflow-hidden rounded-[22px] border border-line bg-panel2">
          <div className="hidden grid-cols-[1.2fr_2fr_160px_160px] gap-4 border-b border-line px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 lg:grid">
            <span>项目</span>
            <span>剧情需求</span>
            <span>删除时间</span>
            <span>操作</span>
          </div>

          <div className="divide-y divide-line">
            {projects.map((project) => (
              <div
                key={project.id}
                className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_2fr_160px_160px] lg:items-center"
              >
                <div>
                  <strong className="block truncate text-sm font-semibold text-gray-100">{project.title}</strong>
                  <span className="mt-1 block text-xs text-gray-500">#{project.id}</span>
                </div>
                <p className="truncate text-sm text-gray-500">{project.story_prompt}</p>
                <span className="text-xs text-gray-500">{project.deleted_at ? new Date(project.deleted_at).toLocaleString("zh-CN") : "-"}</span>
                <div className="flex items-center gap-3">
                  <button
                    className="inline-flex items-center gap-1 text-xs font-medium text-mint transition hover:text-mint/80"
                    onClick={() => handleRestore(project.id, project.title)}
                  >
                    <IconRotateClockwise size={14} stroke={2} />
                    恢复
                  </button>
                  <button
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 transition hover:text-red-400"
                    onClick={() => handlePermanentDelete(project.id, project.title)}
                  >
                    <IconTrash size={14} stroke={2} />
                    永久删除
                  </button>
                </div>
              </div>
            ))}

            {projects.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-500">
                回收站为空。
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <ConfirmDialog />
    </>
  );
}
