"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { createScene, deleteScene, type ScenePreset, updateScene } from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

type SceneFormState = {
  id?: number;
  name: string;
  sceneType: string;
  spaceDescription: string;
  lightingStyle: string;
  timeOfDay: string;
  weather: string;
  propList: string;
  status: string;
};

const emptyForm: SceneFormState = {
  name: "",
  sceneType: "",
  spaceDescription: "",
  lightingStyle: "",
  timeOfDay: "",
  weather: "",
  propList: "",
  status: "draft",
};

function parseCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function toForm(scene?: ScenePreset): SceneFormState {
  if (!scene) return emptyForm;
  return {
    id: scene.id,
    name: scene.name,
    sceneType: scene.sceneType,
    spaceDescription: scene.spaceDescription,
    lightingStyle: scene.lightingStyle,
    timeOfDay: scene.timeOfDay,
    weather: scene.weather,
    propList: scene.propList.join(", "),
    status: scene.status,
  };
}

export default function ScenesPage() {
  const { project, refresh } = useProjectWorkspace();
  const [editing, setEditing] = useState<SceneFormState | null>(null);
  const [saving, setSaving] = useState(false);

  if (!project) return null;
  const currentProject = project;

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        await updateScene(editing.id, currentProject.id, {
          name: editing.name,
          sceneType: editing.sceneType,
          spaceDescription: editing.spaceDescription,
          lightingStyle: editing.lightingStyle,
          timeOfDay: editing.timeOfDay,
          weather: editing.weather,
          propList: parseCsv(editing.propList),
          status: editing.status,
        });
      } else {
        await createScene(currentProject.id, {
          name: editing.name,
          sceneType: editing.sceneType,
          spaceDescription: editing.spaceDescription,
          lightingStyle: editing.lightingStyle,
          timeOfDay: editing.timeOfDay,
          weather: editing.weather,
          propList: parseCsv(editing.propList),
          status: editing.status,
        });
      }
      setEditing(null);
      await refresh();
      toast.success("场景已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(scene: ScenePreset) {
    try {
      await deleteScene(scene.id);
      await refresh();
      toast.success("场景已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <SectionCard title="场景模板" description="场景模板会被镜头、Prompt 和视觉生成反复复用。" action={<Button onClick={() => setEditing(emptyForm)}>新增场景</Button>}>
      {currentProject.scenes.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {currentProject.scenes.map((scene) => (
            <div key={scene.id} className="rounded-[24px] border border-line bg-panel2 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{scene.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{scene.sceneType || "未填写场景类型"}</p>
                </div>
                <StatusPill value={scene.status} tone="purple" />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{scene.spaceDescription || "未填写空间描述"}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {scene.propList.map((prop) => (
                  <span key={prop} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">{prop}</span>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(toForm(scene))}>
                  编辑
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(scene)}>
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="还没有场景模板" description="先沉淀高频场景，后续镜头和 Prompt 复用效率会更高。" action={<Button onClick={() => setEditing(emptyForm)}>新增场景</Button>} />
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl rounded-[28px] border border-line bg-panel p-0">
          <DialogHeader className="border-b border-line px-5 py-4">
            <DialogTitle>{editing?.id ? "编辑场景" : "新增场景"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <>
              <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">场景名</Label>
                  <Input value={editing.name} onChange={(e) => setEditing((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">场景类型</Label>
                  <Input value={editing.sceneType} onChange={(e) => setEditing((prev) => prev ? { ...prev, sceneType: e.target.value } : prev)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-slate-500">空间描述</Label>
                  <Textarea value={editing.spaceDescription} onChange={(e) => setEditing((prev) => prev ? { ...prev, spaceDescription: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">光线风格</Label>
                  <Input value={editing.lightingStyle} onChange={(e) => setEditing((prev) => prev ? { ...prev, lightingStyle: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">时间段</Label>
                  <Input value={editing.timeOfDay} onChange={(e) => setEditing((prev) => prev ? { ...prev, timeOfDay: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">天气</Label>
                  <Input value={editing.weather} onChange={(e) => setEditing((prev) => prev ? { ...prev, weather: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">道具列表</Label>
                  <Input value={editing.propList} onChange={(e) => setEditing((prev) => prev ? { ...prev, propList: e.target.value } : prev)} placeholder="门禁, 雨伞, 沙发" />
                </div>
              </div>
              <DialogFooter className="border-t border-line bg-panel2/60 px-5 py-3">
                <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                  取消
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "保存中..." : "保存场景"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
