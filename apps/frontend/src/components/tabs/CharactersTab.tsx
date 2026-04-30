"use client";

import { useState } from "react";
import { createCharacter, updateCharacter, deleteCharacter, lockCharacter, createScene, updateScene, deleteScene, generateCharacters, generateScenes, generateCharacterImage, generateSceneImage } from "../../api";
import { ActionButton, EmptyState, ImageViewer } from "../ui-legacy";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useConfirm } from "../../hooks/useConfirm";
import { IconWand, IconPlus, IconCheck, IconX, IconLock, IconLockOpen, IconEdit, IconTrash, IconPhoto, IconSparkles } from "@tabler/icons-react";
import RefineDrawer from "../RefineDrawer";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

function groupCharacters(chars: any[]) {
  const groups: Record<string, any[]> = {};
  for (const c of chars) {
    const baseName = c.name.replace(/[（(].*?[）)]/g, "").trim();
    if (!groups[baseName]) groups[baseName] = [];
    groups[baseName].push(c);
  }
  return Object.entries(groups);
}

export default function CharactersTab({ project, onRefresh }: any) {
  const [viewerSrc, setViewerSrc] = useState<any>(null);
  const [viewerAlt, setViewerAlt] = useState("");

  function openViewer(src: any, alt: any) {
    setViewerSrc(src);
    setViewerAlt(alt || "");
  }

  return (
    <div className="flex flex-col gap-6">
      <CharacterSection project={project} onRefresh={onRefresh} onPreview={openViewer} />
      <SceneSection project={project} onRefresh={onRefresh} onPreview={openViewer} />
      <ImageViewer src={viewerSrc} alt={viewerAlt} onClose={() => setViewerSrc(null)} />
    </div>
  );
}

function isTaskRunning(tasks: any[], taskType: any, matchParams?: any) {
  return tasks.some((t: any) => {
    if (t.task_type !== taskType || (t.status !== "queued" && t.status !== "running")) return false;
    if (!matchParams) return true;
    return Object.entries(matchParams).every(([k, v]) => String(t.params?.[k] ?? "") === String(v));
  });
}

function CharacterSection({ project, onRefresh, onPreview }: any) {
  const characters = project.characters || [];
  const tasks = project.tasks || [];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", appearance_prompt: "", personality_tags: "", voice_profile: "" });
  const [editingId, setEditingId] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, any>>({});
  const [deletingId, setDeletingId] = useState<any>(null);
  const [lockingId, setLockingId] = useState<any>(null);
  const [refineTarget, setRefineTarget] = useState<{ type: "character" | "scene"; id: any; content: string; label: string } | null>(null);
  const { confirm, ConfirmDialog: CharConfirmDialog } = useConfirm();

  const extracting = isTaskRunning(tasks, "generate_characters");
  const generatingCharIds = new Set(
    tasks.filter((t: any) => t.task_type === "generate_character_image" && (t.status === "queued" || t.status === "running") && t.params?.char_id)
      .map((t: any) => String(t.params.char_id))
  );

  async function handleExtract() {
    try {
      await generateCharacters(project.id);
    } catch (err) {
      // handled by caller
    }
  }

  async function handleGenerateImage(charId: any) {
    setImageErrors((prev) => { const n = { ...prev }; delete n[charId]; return n; });
    try {
      await generateCharacterImage(charId);
    } catch (err: any) {
      setImageErrors((prev) => ({ ...prev, [charId]: String(err.message || err) }));
      setTimeout(() => setImageErrors((prev) => { const n = { ...prev }; delete n[charId]; return n; }), 5000);
    }
  }

  function startEdit(char: any) {
    setEditingId(char.id);
    setForm({
      name: char.name,
      appearance_prompt: char.appearance_prompt,
      personality_tags: char.personality_tags,
      voice_profile: char.voice_profile,
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm({ name: "", appearance_prompt: "", personality_tags: "", voice_profile: "" });
    setShowForm(true);
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateCharacter(editingId, form);
      } else {
        await createCharacter(project.id, form);
      }
      setShowForm(false);
      setEditingId(null);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: any) {
    if (!await confirm("确定删除此角色？")) return;
    setDeletingId(id);
    try {
      await deleteCharacter(id);
      await onRefresh();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleLock(char: any) {
    setLockingId(char.id);
    try {
      await lockCharacter(char.id, !char.locked);
      await onRefresh();
    } finally {
      setLockingId(null);
    }
  }

  return (
    <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">角色列表</h3>
          <p className="mt-1 text-sm text-slate-500">维护角色设定、视觉提示词和声音信息，并生成角色参考图。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-mint/20 bg-mint/10 px-4 py-2 text-sm font-medium text-mint transition hover:bg-mint/15 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleExtract}
            disabled={extracting}
          >
            {extracting ? "角色提取中..." : <><IconWand size={14} stroke={2} /> AI 提取</>}
          </button>
          <ActionButton icon={saving ? undefined : IconPlus} disabled={saving} label={saving ? "保存中..." : "添加角色"} onClick={startCreate} />
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-[24px] border border-line bg-panel2 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">角色名称</label>
              <Input
                className="bg-panel px-3 py-2"
                type="text"
                value={form.name}
                onChange={(e: any) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="例：主角 或 主角（魔化）"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">性格标签</label>
              <Input
                className="bg-panel px-3 py-2"
                type="text"
                value={form.personality_tags}
                onChange={(e: any) => setForm((f) => ({ ...f, personality_tags: e.target.value }))}
                placeholder="例：勇敢、冷静"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs text-slate-500">外观描述</label>
            <Textarea
              className="bg-panel px-3 py-2"
              value={form.appearance_prompt}
              onChange={(e: any) => setForm((f) => ({ ...f, appearance_prompt: e.target.value }))}
              placeholder="描述角色的外观特征"
              rows={2}
            />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs text-slate-500">声音设定</label>
            <Input
              className="bg-panel px-3 py-2"
              type="text"
              value={form.voice_profile}
              onChange={(e: any) => setForm((f) => ({ ...f, voice_profile: e.target.value }))}
              placeholder="例：标准普通话"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (editingId ? "保存中..." : "创建中...") : <><IconCheck size={14} stroke={2} /> {editingId ? "保存修改" : "创建角色"}</>}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm text-slate-500 transition hover:text-slate-800"
              onClick={() => { setShowForm(false); setEditingId(null); }}
            >
              <IconX size={14} stroke={2} /> 取消
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {characters.length === 0 && !showForm ? (
          <EmptyState text="暂无角色。点击「添加角色」创建，或在剧情生成时自动提取。" />
        ) : (
          groupCharacters(characters).map(([baseName, variants]: [string, any[]]) => (
            <div key={baseName}>
              {variants.length > 1 && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">{baseName}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{variants.length} 个变体</span>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {variants.map((char: any) => (
                  <div key={char.id} className="flex gap-4 rounded-[24px] border border-line bg-panel2 p-4">
                    {char.image_path ? (
                      <img
                        src={`${API_BASE}/assets/${char.image_path}`}
                        alt={char.name}
                        className="h-20 w-20 shrink-0 cursor-zoom-in rounded-xl object-cover transition hover:opacity-80"
                        onClick={() => onPreview(`${API_BASE}/assets/${char.image_path}`, char.name)}
                      />
                    ) : (
                      <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${char.locked ? "bg-mint/20 text-mint" : "bg-panel text-slate-500"}`}>
                        {char.name[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-slate-900">{char.name}</strong>
                        {char.personality_tags && (
                          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-medium text-violet-700">
                            {char.personality_tags}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-start gap-1">
                        <p className="text-xs leading-relaxed text-slate-500">{char.appearance_prompt}</p>
                        <button
                          className="shrink-0 rounded-lg bg-panel2 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:text-mint"
                          onClick={() => setRefineTarget({ type: "character", id: char.id, content: char.appearance_prompt, label: char.name })}
                        >
                          <IconSparkles size={12} stroke={2} />
                        </button>
                      </div>
                      {char.voice_profile && (
                        <p className="mt-1 text-[11px] text-slate-600">声音：{char.voice_profile}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2">
                        <button
                          className={`inline-flex items-center gap-1 text-xs ${char.locked ? "text-mint" : "text-slate-500"} hover:underline disabled:opacity-50`}
                          onClick={() => handleToggleLock(char)}
                          disabled={lockingId === char.id}
                        >
                          {lockingId === char.id ? "处理中..." : char.locked ? <><IconLock size={12} stroke={2} /> 已锁定</> : <><IconLockOpen size={12} stroke={2} /> 锁定</>}
                        </button>
                        <button className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" onClick={() => startEdit(char)}>
                          <IconEdit size={12} stroke={2} /> 编辑
                        </button>
                        <button
                          className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 disabled:opacity-50"
                          onClick={() => handleDelete(char.id)}
                          disabled={deletingId === char.id}
                        >
                          {deletingId === char.id ? "删除中..." : <><IconTrash size={12} stroke={2} /> 删除</>}
                        </button>
                      </div>
                      <button
                        className="inline-flex items-center gap-1 rounded-full border border-mint/20 bg-mint/10 px-3 py-1.5 text-[11px] font-medium text-mint transition hover:bg-mint/15 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleGenerateImage(char.id)}
                        disabled={generatingCharIds.has(String(char.id))}
                      >
                        {generatingCharIds.has(String(char.id)) ? (char.image_path ? "重生成中..." : "生成图片中...") : <><IconPhoto size={12} stroke={2} /> {char.image_path ? "重新生成" : "生成图片"}</>}
                      </button>
                      {imageErrors[char.id] ? (
                        <span className="max-w-[200px] text-right text-[10px] leading-tight text-rose-500">{imageErrors[char.id]}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <CharConfirmDialog />
      <RefineDrawer
        open={!!refineTarget}
        onClose={() => setRefineTarget(null)}
        title={refineTarget ? `调整${refineTarget.type === "character" ? "角色" : "场景"}: ${refineTarget.label}` : ""}
        currentContent={refineTarget?.content || ""}
        systemPromptKey="prompt_refine_character_system"
        onApply={(newContent: string) => {
          if (!refineTarget) return;
          updateCharacter(refineTarget.id, { appearance_prompt: newContent }).then(() => onRefresh());
        }}
      />
    </section>
  );
}

function SceneSection({ project, onRefresh, onPreview }: any) {
  const scenes = project.scenes || [];
  const tasks = project.tasks || [];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", reference_image_path: "" });
  const [editingId, setEditingId] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, any>>({});
  const [deletingId, setDeletingId] = useState<any>(null);
  const [refineTarget, setRefineTarget] = useState<{ type: "character" | "scene"; id: any; content: string; label: string } | null>(null);
  const { confirm, ConfirmDialog: SceneConfirmDialog } = useConfirm();

  const extracting = isTaskRunning(tasks, "generate_scenes");
  const generatingSceneIds = new Set(
    tasks.filter((t: any) => t.task_type === "generate_scene_image" && (t.status === "queued" || t.status === "running") && t.params?.scene_id)
      .map((t: any) => String(t.params.scene_id))
  );

  async function handleExtract() {
    try {
      await generateScenes(project.id);
    } catch (err) {
      // handled by caller
    }
  }

  async function handleGenerateImage(sceneId: any) {
    setImageErrors((prev) => { const n = { ...prev }; delete n[sceneId]; return n; });
    try {
      await generateSceneImage(sceneId);
    } catch (err: any) {
      setImageErrors((prev) => ({ ...prev, [sceneId]: String(err.message || err) }));
      setTimeout(() => setImageErrors((prev) => { const n = { ...prev }; delete n[sceneId]; return n; }), 5000);
    }
  }

  function startEdit(scene: any) {
    setEditingId(scene.id);
    setForm({
      name: scene.name,
      description: scene.description,
      reference_image_path: scene.reference_image_path || "",
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm({ name: "", description: "", reference_image_path: "" });
    setShowForm(true);
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = { ...form, reference_image_path: form.reference_image_path || null };
      if (editingId) {
        await updateScene(editingId, data);
      } else {
        await createScene(project.id, data);
      }
      setShowForm(false);
      setEditingId(null);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: any) {
    if (!await confirm("确定删除此场景？")) return;
    setDeletingId(id);
    try {
      await deleteScene(id);
      await onRefresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">场景列表</h3>
          <p className="mt-1 text-sm text-slate-500">沉淀环境设定与参考图，为镜头生成提供稳定的场景上下文。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-mint/20 bg-mint/10 px-4 py-2 text-sm font-medium text-mint transition hover:bg-mint/15 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleExtract}
            disabled={extracting}
          >
            {extracting ? "场景提取中..." : <><IconWand size={14} stroke={2} /> AI 提取</>}
          </button>
          <ActionButton icon={saving ? undefined : IconPlus} disabled={saving} label={saving ? "保存中..." : "添加场景"} onClick={startCreate} />
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-[24px] border border-line bg-panel2 p-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">场景名称</label>
            <Input
              className="bg-panel px-3 py-2"
              type="text"
              value={form.name}
              onChange={(e: any) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例：城市夜景"
              required
            />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs text-slate-500">场景描述</label>
            <Textarea
              className="bg-panel px-3 py-2"
              value={form.description}
              onChange={(e: any) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="描述场景的环境、氛围"
              rows={2}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (editingId ? "保存中..." : "创建中...") : <><IconCheck size={14} stroke={2} /> {editingId ? "保存修改" : "创建场景"}</>}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm text-slate-500 transition hover:text-slate-800"
              onClick={() => { setShowForm(false); setEditingId(null); }}
            >
              <IconX size={14} stroke={2} /> 取消
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {scenes.length === 0 && !showForm ? (
          <EmptyState text="暂无场景。点击「添加场景」创建，或在剧情生成时自动提取。" />
        ) : (
          scenes.map((scene: any) => (
            <div key={scene.id} className="flex gap-4 rounded-[24px] border border-line bg-panel2 p-4">
              {scene.reference_image_path ? (
                <img
                  src={`${API_BASE}/assets/${scene.reference_image_path}`}
                  alt={scene.name}
                  className="h-20 w-28 shrink-0 cursor-zoom-in rounded-xl object-cover transition hover:opacity-80"
                  onClick={() => onPreview(`${API_BASE}/assets/${scene.reference_image_path}`, scene.name)}
                />
              ) : (
                <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-panel text-xs text-slate-500">
                  场景
                </div>
              )}
              <div className="min-w-0 flex-1">
                <strong className="text-sm text-slate-900">{scene.name}</strong>
                <div className="mt-1 flex items-start gap-1">
                  <p className="text-xs leading-relaxed text-slate-500">{scene.description}</p>
                  <button
                    className="shrink-0 rounded-lg bg-panel2 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:text-mint"
                    onClick={() => setRefineTarget({ type: "scene", id: scene.id, content: scene.description, label: scene.name })}
                  >
                    <IconSparkles size={12} stroke={2} />
                  </button>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <button className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" onClick={() => startEdit(scene)}>
                    <IconEdit size={12} stroke={2} /> 编辑
                  </button>
                  <button
                    className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 disabled:opacity-50"
                    onClick={() => handleDelete(scene.id)}
                    disabled={deletingId === scene.id}
                  >
                    {deletingId === scene.id ? "删除中..." : <><IconTrash size={12} stroke={2} /> 删除</>}
                  </button>
                </div>
                <button
                  className="inline-flex items-center gap-1 rounded-full border border-mint/20 bg-mint/10 px-3 py-1.5 text-[11px] font-medium text-mint transition hover:bg-mint/15 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleGenerateImage(scene.id)}
                  disabled={generatingSceneIds.has(String(scene.id))}
                >
                  {generatingSceneIds.has(String(scene.id)) ? (scene.reference_image_path ? "重生成中..." : "生成图片中...") : <><IconPhoto size={12} stroke={2} /> {scene.reference_image_path ? "重新生成" : "生成图片"}</>}
                </button>
                {imageErrors[scene.id] ? (
                  <span className="max-w-[200px] text-right text-[10px] leading-tight text-rose-500">{imageErrors[scene.id]}</span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
      <SceneConfirmDialog />
      <RefineDrawer
        open={!!refineTarget}
        onClose={() => setRefineTarget(null)}
        title={refineTarget ? `调整${refineTarget.type === "character" ? "角色" : "场景"}: ${refineTarget.label}` : ""}
        currentContent={refineTarget?.content || ""}
        systemPromptKey="prompt_refine_scene_system"
        onApply={(newContent: string) => {
          if (!refineTarget) return;
          updateScene(refineTarget.id, { description: newContent }).then(() => onRefresh());
        }}
      />
    </section>
  );
}
