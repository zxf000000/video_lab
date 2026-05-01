"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "react-toastify";
import { createEpisode, deleteEpisode, type Episode, updateEpisode } from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

type EpisodeFormState = {
  id?: number;
  episodeNo: number;
  title: string;
  summary: string;
  goal: string;
  coreConflict: string;
  openingHook: string;
  climax: string;
  endingHook: string;
  status: string;
};

const emptyForm: EpisodeFormState = {
  episodeNo: 1,
  title: "",
  summary: "",
  goal: "",
  coreConflict: "",
  openingHook: "",
  climax: "",
  endingHook: "",
  status: "draft",
};

function toForm(episode?: Episode): EpisodeFormState {
  if (!episode) return emptyForm;
  return {
    id: episode.id,
    episodeNo: episode.episodeNo,
    title: episode.title,
    summary: episode.summary,
    goal: episode.goal,
    coreConflict: episode.coreConflict,
    openingHook: episode.openingHook,
    climax: episode.climax,
    endingHook: episode.endingHook,
    status: episode.status,
  };
}

export default function EpisodesPage() {
  const { project, refresh } = useProjectWorkspace();
  const [editing, setEditing] = useState<EpisodeFormState | null>(null);
  const [saving, setSaving] = useState(false);

  if (!project) return null;
  const currentProject = project;

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await updateEpisode(editing.id, editing);
      } else {
        await createEpisode(currentProject.id, editing);
      }
      setEditing(null);
      await refresh();
      toast.success("分集已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(episode: Episode) {
    try {
      await deleteEpisode(episode.id);
      await refresh();
      toast.success("分集已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <SectionCard title="分集管理" description="分集是从项目级约束进入生产级对象的第一层。先稳住每集目标，再下钻到镜头。" action={<Button onClick={() => setEditing({ ...emptyForm, episodeNo: currentProject.episodes.length + 1 })}>新增分集</Button>}>
      {currentProject.episodes.length ? (
        <div className="grid gap-3">
          {currentProject.episodes.map((episode) => (
            <div key={episode.id} className="rounded-[24px] border border-line bg-panel2 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-slate-900">第 {episode.episodeNo} 集 · {episode.title || "未命名分集"}</h3>
                    <StatusPill value={episode.status} tone="purple" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{episode.summary || "未填写分集摘要"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/projects/${currentProject.id}/episodes/${episode.id}`} className="inline-flex rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-mint hover:text-mint">
                    详情
                  </Link>
                  <Link href={`/projects/${currentProject.id}/episodes/${episode.id}/shots`} className="inline-flex rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-mint hover:text-mint">
                    镜头
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(toForm(episode))}>
                    编辑
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(episode)}>
                    删除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="还没有分集" description="先创建分集，再进入镜头和 Prompt 生产。" action={<Button onClick={() => setEditing({ ...emptyForm, episodeNo: 1 })}>新增分集</Button>} />
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-3xl rounded-[28px] border border-line bg-panel p-0">
          <DialogHeader className="border-b border-line px-6 py-5">
            <DialogTitle>{editing?.id ? "编辑分集" : "新增分集"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <>
              <div className="grid gap-5 px-6 py-5 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">集数</Label>
                  <Input type="number" value={String(editing.episodeNo)} onChange={(e) => setEditing((prev) => prev ? { ...prev, episodeNo: Number(e.target.value || 1) } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">状态</Label>
                  <Input value={editing.status} onChange={(e) => setEditing((prev) => prev ? { ...prev, status: e.target.value } : prev)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-slate-500">标题</Label>
                  <Input value={editing.title} onChange={(e) => setEditing((prev) => prev ? { ...prev, title: e.target.value } : prev)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-slate-500">摘要</Label>
                  <Textarea value={editing.summary} onChange={(e) => setEditing((prev) => prev ? { ...prev, summary: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">目标</Label>
                  <Textarea value={editing.goal} onChange={(e) => setEditing((prev) => prev ? { ...prev, goal: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">核心冲突</Label>
                  <Textarea value={editing.coreConflict} onChange={(e) => setEditing((prev) => prev ? { ...prev, coreConflict: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">开场钩子</Label>
                  <Textarea value={editing.openingHook} onChange={(e) => setEditing((prev) => prev ? { ...prev, openingHook: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">高潮</Label>
                  <Textarea value={editing.climax} onChange={(e) => setEditing((prev) => prev ? { ...prev, climax: e.target.value } : prev)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-slate-500">集尾钩子</Label>
                  <Textarea value={editing.endingHook} onChange={(e) => setEditing((prev) => prev ? { ...prev, endingHook: e.target.value } : prev)} />
                </div>
              </div>
              <DialogFooter className="border-t border-line bg-panel2/60 px-6 py-4">
                <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                  取消
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "保存中..." : "保存分集"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
