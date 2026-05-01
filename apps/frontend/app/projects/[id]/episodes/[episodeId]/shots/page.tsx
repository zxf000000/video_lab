"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import { createShot, deleteShot, generateEpisodeBatch, generateShot, listShots, type Shot, updateShot } from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

type ShotFormState = {
  id?: number;
  sceneBlock: string;
  shotNo: number;
  visualGoal: string;
  characterIds: string;
  scenePresetId: string;
  shotSize: string;
  cameraAngle: string;
  composition: string;
  actionDescription: string;
  facialEmotion: string;
  cameraMotion: string;
  dialogueExcerpt: string;
  estimatedDurationMs: number;
  status: string;
};

const emptyForm: ShotFormState = {
  sceneBlock: "",
  shotNo: 1,
  visualGoal: "",
  characterIds: "",
  scenePresetId: "",
  shotSize: "",
  cameraAngle: "",
  composition: "",
  actionDescription: "",
  facialEmotion: "",
  cameraMotion: "",
  dialogueExcerpt: "",
  estimatedDurationMs: 3000,
  status: "draft",
};

function parseCsvNumbers(value: string) {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function toForm(shot?: Shot): ShotFormState {
  if (!shot) return emptyForm;
  return {
    id: shot.id,
    sceneBlock: shot.sceneBlock,
    shotNo: shot.shotNo,
    visualGoal: shot.visualGoal,
    characterIds: shot.characterIds.join(", "),
    scenePresetId: shot.scenePresetId ? String(shot.scenePresetId) : "",
    shotSize: shot.shotSize,
    cameraAngle: shot.cameraAngle,
    composition: shot.composition,
    actionDescription: shot.actionDescription,
    facialEmotion: shot.facialEmotion,
    cameraMotion: shot.cameraMotion,
    dialogueExcerpt: shot.dialogueExcerpt,
    estimatedDurationMs: shot.estimatedDurationMs,
    status: shot.status,
  };
}

export default function EpisodeShotsPage() {
  const params = useParams<{ id: string; episodeId: string }>();
  const { project } = useProjectWorkspace();
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ShotFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const episodeId = Number(params.episodeId);
  const episode = project?.episodes.find((item) => item.id === episodeId);

  async function refreshShots() {
    try {
      const payload = await listShots(episodeId);
      setShots(payload.shots);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshShots();
  }, [episodeId]);

  const sceneOptions = useMemo(() => project?.scenes ?? [], [project]);

  if (!project || !episode) return null;
  const currentProject = project;

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        sceneBlock: editing.sceneBlock,
        shotNo: editing.shotNo,
        visualGoal: editing.visualGoal,
        characterIds: parseCsvNumbers(editing.characterIds),
        scenePresetId: editing.scenePresetId ? Number(editing.scenePresetId) : null,
        shotSize: editing.shotSize,
        cameraAngle: editing.cameraAngle,
        composition: editing.composition,
        actionDescription: editing.actionDescription,
        facialEmotion: editing.facialEmotion,
        cameraMotion: editing.cameraMotion,
        dialogueExcerpt: editing.dialogueExcerpt,
        estimatedDurationMs: editing.estimatedDurationMs,
        status: editing.status,
      };
      if (editing.id) {
        await updateShot(editing.id, payload);
      } else {
        await createShot(episodeId, payload);
      }
      setEditing(null);
      await refreshShots();
      toast.success("镜头已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(shot: Shot) {
    try {
      await deleteShot(shot.id);
      await refreshShots();
      toast.success("镜头已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleGenerateShot(shot: Shot) {
    try {
      await generateShot(shot.id, {});
      toast.success(`已提交镜头 ${shot.shotNo} 的生成任务`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleBatchGenerate() {
    try {
      const payload = await generateEpisodeBatch(episodeId, {});
      toast.success(`已提交 ${payload.tasks.length} 个任务`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <SectionCard
      title={`第 ${episode.episodeNo} 集镜头列表`}
      description="镜头是视觉生产层的最小工作单元。这里负责结构、状态和进入 Prompt。"
      action={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleBatchGenerate}>
            批量生成
          </Button>
          <Button onClick={() => setEditing({ ...emptyForm, shotNo: shots.length + 1 })}>新增镜头</Button>
        </div>
      }
    >
      {loading ? (
        <div className="text-sm text-slate-500">镜头加载中...</div>
      ) : shots.length ? (
        <div className="grid gap-3">
          {shots.map((shot) => (
            <div key={shot.id} className="rounded-[24px] border border-line bg-panel2 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-slate-900">Shot {shot.shotNo}</h3>
                    <StatusPill value={shot.status} tone="purple" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{shot.visualGoal || "未填写镜头目标"}</p>
                  <p className="mt-2 text-xs text-slate-500">{shot.sceneBlock || "未填写场次块"} · {shot.estimatedDurationMs}ms</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/projects/${currentProject.id}/shots/${shot.id}/prompts`} className="inline-flex rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-mint hover:text-mint">
                    Prompt
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => handleGenerateShot(shot)}>
                    生成
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(toForm(shot))}>
                    编辑
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(shot)}>
                    删除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="还没有镜头" description="先新增镜头，再进入 Prompt 和生成任务环节。" action={<Button onClick={() => setEditing({ ...emptyForm, shotNo: 1 })}>新增镜头</Button>} />
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-4xl rounded-[28px] border border-line bg-panel p-0">
          <DialogHeader className="border-b border-line px-6 py-5">
            <DialogTitle>{editing?.id ? "编辑镜头" : "新增镜头"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <>
              <div className="grid gap-5 px-6 py-5 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">镜头号</Label>
                  <Input type="number" value={String(editing.shotNo)} onChange={(e) => setEditing((prev) => prev ? { ...prev, shotNo: Number(e.target.value || 1) } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">状态</Label>
                  <Input value={editing.status} onChange={(e) => setEditing((prev) => prev ? { ...prev, status: e.target.value } : prev)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-slate-500">场次块</Label>
                  <Input value={editing.sceneBlock} onChange={(e) => setEditing((prev) => prev ? { ...prev, sceneBlock: e.target.value } : prev)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-slate-500">镜头目标</Label>
                  <Textarea value={editing.visualGoal} onChange={(e) => setEditing((prev) => prev ? { ...prev, visualGoal: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">角色 ID 列表</Label>
                  <Input value={editing.characterIds} onChange={(e) => setEditing((prev) => prev ? { ...prev, characterIds: e.target.value } : prev)} placeholder="1, 2" />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">场景模板</Label>
                  <select
                    className="w-full rounded-xl border border-line bg-panel2 px-4 py-3 text-sm"
                    value={editing.scenePresetId}
                    onChange={(e) => setEditing((prev) => prev ? { ...prev, scenePresetId: e.target.value } : prev)}
                  >
                    <option value="">未绑定</option>
                    {sceneOptions.map((scene) => (
                      <option key={scene.id} value={scene.id}>{scene.name}</option>
                    ))}
                  </select>
                </div>
                <div><Label className="mb-2 block text-xs text-slate-500">景别</Label><Input value={editing.shotSize} onChange={(e) => setEditing((prev) => prev ? { ...prev, shotSize: e.target.value } : prev)} /></div>
                <div><Label className="mb-2 block text-xs text-slate-500">角度</Label><Input value={editing.cameraAngle} onChange={(e) => setEditing((prev) => prev ? { ...prev, cameraAngle: e.target.value } : prev)} /></div>
                <div><Label className="mb-2 block text-xs text-slate-500">构图</Label><Input value={editing.composition} onChange={(e) => setEditing((prev) => prev ? { ...prev, composition: e.target.value } : prev)} /></div>
                <div><Label className="mb-2 block text-xs text-slate-500">镜头时长(ms)</Label><Input type="number" value={String(editing.estimatedDurationMs)} onChange={(e) => setEditing((prev) => prev ? { ...prev, estimatedDurationMs: Number(e.target.value || 0) } : prev)} /></div>
                <div className="md:col-span-2"><Label className="mb-2 block text-xs text-slate-500">动作描述</Label><Textarea value={editing.actionDescription} onChange={(e) => setEditing((prev) => prev ? { ...prev, actionDescription: e.target.value } : prev)} /></div>
                <div><Label className="mb-2 block text-xs text-slate-500">表情 / 情绪</Label><Input value={editing.facialEmotion} onChange={(e) => setEditing((prev) => prev ? { ...prev, facialEmotion: e.target.value } : prev)} /></div>
                <div><Label className="mb-2 block text-xs text-slate-500">运镜</Label><Input value={editing.cameraMotion} onChange={(e) => setEditing((prev) => prev ? { ...prev, cameraMotion: e.target.value } : prev)} /></div>
                <div className="md:col-span-2"><Label className="mb-2 block text-xs text-slate-500">对白摘要</Label><Textarea value={editing.dialogueExcerpt} onChange={(e) => setEditing((prev) => prev ? { ...prev, dialogueExcerpt: e.target.value } : prev)} /></div>
              </div>
              <DialogFooter className="border-t border-line bg-panel2/60 px-6 py-4">
                <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                  取消
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "保存中..." : "保存镜头"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
