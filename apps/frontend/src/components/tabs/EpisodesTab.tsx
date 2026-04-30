"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  createEpisode,
  deleteEpisode,
  generateEpisodeScreenplay,
  getEpisodeVersions,
  restoreEpisodeVersion,
  updateEpisode,
  updateEpisodeScreenplay,
} from "../../api";
import { ActionButton, EmptyState, StatusBadge } from "../ui-legacy";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { IconDeviceFloppy, IconEdit, IconHistory, IconPlayerPlay, IconPlus, IconRotateClockwise, IconSparkles, IconTrash, IconX } from "@tabler/icons-react";
import { useConfirm } from "../../hooks/useConfirm";
import TaskPanel from "../TaskPanel";
import RefineDrawer from "../RefineDrawer";

export default function EpisodesTab({ project, isPending, onRefresh }: any) {
  const episodes = project.episodes || [];
  const [selectedId, setSelectedId] = useState<number | null>(episodes[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [outlineSummary, setOutlineSummary] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [editingScript, setEditingScript] = useState(false);
  const [draftCn, setDraftCn] = useState("");
  const [draftEn, setDraftEn] = useState("");
  const [savingScript, setSavingScript] = useState(false);
  const [versions, setVersions] = useState<any[] | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    if (!episodes.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !episodes.some((episode: any) => episode.id === selectedId)) {
      setSelectedId(episodes[0].id);
    }
  }, [episodes, selectedId]);

  const selectedEpisode = useMemo(
    () => episodes.find((episode: any) => episode.id === selectedId) || null,
    [episodes, selectedId],
  );

  useEffect(() => {
    if (!selectedEpisode) {
      setTitle("");
      setOutlineSummary("");
      setDraftCn("");
      setDraftEn("");
      setEditingScript(false);
      setVersions(null);
      return;
    }
    setTitle(selectedEpisode.title || "");
    setOutlineSummary(selectedEpisode.outline_summary || "");
    setDraftCn(selectedEpisode.screenplay_content || "");
    setDraftEn(selectedEpisode.screenplay_content_en || "");
    setEditingScript(false);
    setVersions(null);
  }, [selectedEpisode?.id]);

  const episodeTasks = project.tasks?.filter((task: any) => task.task_type === "generate_episode_screenplay") || [];

  async function handleCreateEpisode() {
    setCreating(true);
    try {
      const nextNumber = (episodes[episodes.length - 1]?.episode_number || 0) + 1;
      await createEpisode(project.id, {
        episode_number: nextNumber,
        title: `第${nextNumber}集`,
        outline_summary: "",
      });
      await onRefresh();
      toast.success("分集已创建");
    } catch (err: any) {
      toast.error(String(err.message || err));
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveMeta() {
    if (!selectedEpisode) return;
    setSavingMeta(true);
    try {
      await updateEpisode(selectedEpisode.id, { title, outline_summary: outlineSummary });
      await onRefresh(true);
      toast.success("分集信息已保存");
    } catch (err: any) {
      toast.error(String(err.message || err));
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleDeleteEpisode() {
    if (!selectedEpisode) return;
    if (!await confirm("确定删除这一集吗？")) return;
    try {
      await deleteEpisode(selectedEpisode.id);
      await onRefresh();
      toast.success("分集已删除");
    } catch (err: any) {
      toast.error(String(err.message || err));
    }
  }

  async function handleGenerate() {
    if (!selectedEpisode) return;
    try {
      await generateEpisodeScreenplay(selectedEpisode.id);
      await onRefresh();
      toast.success("已提交本集剧本生成任务");
    } catch (err: any) {
      toast.error(String(err.message || err));
    }
  }

  async function handleSaveScreenplay() {
    if (!selectedEpisode) return;
    setSavingScript(true);
    try {
      await updateEpisodeScreenplay(selectedEpisode.id, draftCn, draftEn);
      setEditingScript(false);
      await onRefresh(true);
      toast.success("剧本已保存");
    } catch (err: any) {
      toast.error(String(err.message || err));
    } finally {
      setSavingScript(false);
    }
  }

  async function loadVersions() {
    if (!selectedEpisode) return;
    if (versions !== null) {
      setVersions(null);
      return;
    }
    setLoadingVersions(true);
    try {
      const payload = await getEpisodeVersions(selectedEpisode.id);
      setVersions(payload.versions || []);
    } catch (err: any) {
      toast.error(String(err.message || err));
    } finally {
      setLoadingVersions(false);
    }
  }

  async function handleRestore(versionId: number) {
    if (!selectedEpisode) return;
    if (!await confirm("确定要回滚到此版本？")) return;
    setRestoringId(versionId);
    try {
      await restoreEpisodeVersion(selectedEpisode.id, versionId);
      await onRefresh(true);
      setVersions(null);
      toast.success("版本已回滚");
    } catch (err: any) {
      toast.error(String(err.message || err));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-line bg-panel p-5 shadow-glow">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-900">分集列表</h3>
            <ActionButton
              icon={IconPlus}
              disabled={creating}
              label={creating ? "创建中..." : "新增分集"}
              onClick={handleCreateEpisode}
            />
          </div>
          <div className="mt-4 space-y-3">
            {episodes.map((episode: any) => (
              <button
                key={episode.id}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  selectedId === episode.id ? "border-mint bg-mint/10" : "border-line bg-panel2 hover:border-mint/40"
                }`}
                onClick={() => setSelectedId(episode.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="truncate text-sm text-slate-900">
                    第{episode.episode_number}集 · {episode.title || "未命名分集"}
                  </strong>
                  <StatusBadge status={episode.status || "draft"} />
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">
                  {episode.outline_summary || "暂无本集大纲"}
                </p>
              </button>
            ))}
            {!episodes.length ? <EmptyState text="还没有分集。先新增一集，再根据大纲生成单集剧本。" /> : null}
          </div>
        </div>

        <div className="space-y-5">
          {!selectedEpisode ? (
            <section className="rounded-[28px] border border-dashed border-line bg-panel p-8 text-slate-500 shadow-glow">
              请选择或新增一个分集。
            </section>
          ) : (
            <>
              <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold text-slate-900">本集设定</h3>
                  <div className="flex flex-wrap gap-3">
                    <ActionButton icon={IconDeviceFloppy} disabled={savingMeta} label="保存设定" onClick={handleSaveMeta} />
                    <ActionButton icon={IconTrash} variant="ghost" label="删除本集" onClick={handleDeleteEpisode} />
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="mb-2 block text-xs text-slate-500">分集标题</label>
                    <Input value={title} onChange={(event: any) => setTitle(event.target.value)} className="rounded-2xl" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs text-slate-500">本集大纲</label>
                    <Textarea
                      value={outlineSummary}
                      onChange={(event: any) => setOutlineSummary(event.target.value)}
                      className="min-h-32 rounded-2xl"
                    />
                  </div>
                  <div className="rounded-2xl border border-dashed border-line bg-panel2 px-4 py-4 text-sm leading-6 text-slate-500">
                    单集生成会结合项目总大纲、角色卡和当前集概，只生成当前这一集，不影响其他分集。
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold text-slate-900">单集剧本</h3>
                  <div className="flex flex-wrap gap-3">
                    {editingScript ? (
                      <>
                        <ActionButton icon={IconDeviceFloppy} disabled={savingScript} label="保存剧本" onClick={handleSaveScreenplay} />
                        <ActionButton
                          icon={IconX}
                          disabled={savingScript}
                          label="取消"
                          onClick={() => {
                            setEditingScript(false);
                            setDraftCn(selectedEpisode.screenplay_content || "");
                            setDraftEn(selectedEpisode.screenplay_content_en || "");
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <ActionButton icon={IconEdit} disabled={isPending} label="编辑剧本" onClick={() => setEditingScript(true)} />
                        <ActionButton icon={IconPlayerPlay} disabled={isPending} label="生成本集剧本" onClick={handleGenerate} />
                        <ActionButton icon={IconSparkles} disabled={isPending || !selectedEpisode.screenplay_content} label="AI 调整" onClick={() => setRefineOpen(true)} />
                      </>
                    )}
                  </div>
                </div>

                {editingScript ? (
                  <div className="mt-4 grid gap-4">
                    <Textarea value={draftCn} onChange={(event: any) => setDraftCn(event.target.value)} className="min-h-80 rounded-2xl" />
                    <Textarea value={draftEn} onChange={(event: any) => setDraftEn(event.target.value)} className="min-h-40 rounded-2xl" placeholder="英文版本（可选）" />
                  </div>
                ) : selectedEpisode.screenplay_content ? (
                  <pre className="mt-4 whitespace-pre-wrap rounded-3xl border border-line bg-panel2 p-5 text-sm leading-7 text-slate-700">
                    {selectedEpisode.screenplay_content}
                  </pre>
                ) : (
                  <EmptyState text="当前还没有本集剧本。先补充分集大纲，再点击「生成本集剧本」。" />
                )}
              </section>

              <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">本集版本历史</h3>
                  <ActionButton
                    icon={IconHistory}
                    disabled={loadingVersions}
                    label={versions !== null ? "收起" : "查看版本历史"}
                    onClick={loadVersions}
                  />
                </div>
                {versions !== null && (
                  <div className="mt-4 space-y-2">
                    {!versions.length ? (
                      <EmptyState text="暂无版本记录。" />
                    ) : (
                      versions.map((version: any) => (
                        <div key={version.id} className="flex items-center gap-3 rounded-xl bg-panel2/50 px-4 py-3">
                          <span className="text-xs font-medium text-slate-500">v{version.version}</span>
                          <span className="flex-1 truncate text-sm text-slate-700">
                            {(version.content || "").substring(0, 80)}...
                          </span>
                          <span className="text-xs text-slate-500">{version.created_at?.substring(0, 16)}</span>
                          <button
                            className="inline-flex items-center gap-1 text-xs text-mint hover:underline disabled:opacity-50"
                            onClick={() => handleRestore(version.id)}
                            disabled={restoringId === version.id}
                          >
                            {restoringId === version.id ? "回滚中..." : <><IconRotateClockwise size={12} stroke={2} /> 回滚</>}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>

      {episodeTasks.length ? <TaskPanel tasks={episodeTasks} /> : null}
      <RefineDrawer
        open={refineOpen}
        onClose={() => setRefineOpen(false)}
        title="调整单集剧本"
        currentContent={selectedEpisode?.screenplay_content || ""}
        systemPromptKey="prompt_refine_screenplay_system"
        onApply={(newContent: string) => {
          if (!selectedEpisode) return;
          setDraftCn(newContent);
          updateEpisodeScreenplay(selectedEpisode.id, newContent, draftEn).then(() => {
            onRefresh(true);
          }).catch((err: any) => toast.error(String(err.message || err)));
        }}
      />
      <ConfirmDialog />
    </div>
  );
}
