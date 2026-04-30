"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { generateScreenplay, updateScreenplay, getScreenplayVersions, restoreScreenplayVersion } from "../../api";
import { ActionButton, EmptyState } from "../ui-legacy";
import { Textarea } from "../ui/textarea";
import { useConfirm } from "../../hooks/useConfirm";
import { IconDeviceFloppy, IconX, IconEdit, IconHistory, IconRotateClockwise, IconSparkles, IconLanguage, IconPlayerPlay } from "@tabler/icons-react";
import TaskPanel from "../TaskPanel";
import RefineDrawer from "../RefineDrawer";

export default function ScreenplayTab({ project, isPending, onRunAction }: any) {
  const [editing, setEditing] = useState(false);
  const [draftCn, setDraftCn] = useState(project.screenplay_content || "");
  const [draftEn, setDraftEn] = useState(project.screenplay_content_en || "");
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState<"cn" | "en">("cn");
  const [versions, setVersions] = useState<any>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringId, setRestoringId] = useState<any>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const screenplayTasks = project.tasks?.filter(
    (t: any) => t.task_type === "generate_screenplay" || t.task_type === "regenerate_from_stage"
  );

  const content = lang === "cn" ? project.screenplay_content : project.screenplay_content_en;
  const draft = lang === "cn" ? draftCn : draftEn;
  const setDraft = lang === "cn" ? setDraftCn : setDraftEn;

  function startEditing() {
    setDraftCn(project.screenplay_content || "");
    setDraftEn(project.screenplay_content_en || "");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setDraftCn(project.screenplay_content || "");
    setDraftEn(project.screenplay_content_en || "");
  }

  async function saveScreenplay() {
    setSaving(true);
    try {
      await updateScreenplay(project.id, draftCn, draftEn);
      setEditing(false);
      await onRunAction(() => Promise.resolve());
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await generateScreenplay(project.id);
      await onRunAction(() => Promise.resolve());
    } catch (err: any) {
      toast.error(String(err.message || err));
    } finally {
      setGenerating(false);
    }
  }

  async function loadVersions() {
    if (versions !== null) {
      setVersions(null);
      return;
    }
    setLoadingVersions(true);
    try {
      const data = await getScreenplayVersions(project.id);
      setVersions(data.versions);
    } finally {
      setLoadingVersions(false);
    }
  }

  async function handleRestore(versionId: any) {
    if (!await confirm("确定要回滚到此版本？")) return;
    setRestoringId(versionId);
    try {
      await restoreScreenplayVersion(project.id, versionId);
      setVersions(null);
      await onRunAction(() => Promise.resolve());
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900">剧本化文本</h3>
          <div className="flex flex-wrap gap-3">
            <button
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition ${lang === "cn" ? "bg-mint text-white" : "bg-panel2 text-slate-600 hover:text-slate-900"}`}
              onClick={() => setLang("cn")}
            >
              <IconLanguage size={14} stroke={2} /> 中文
            </button>
            <button
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition ${lang === "en" ? "bg-mint text-white" : "bg-panel2 text-slate-600 hover:text-slate-900"}`}
              onClick={() => setLang("en")}
            >
              <IconLanguage size={14} stroke={2} /> English
            </button>
            {editing ? (
              <>
                <ActionButton icon={IconDeviceFloppy} disabled={saving} label="保存" onClick={saveScreenplay} />
                <ActionButton icon={IconX} disabled={saving} label="取消" onClick={cancelEditing} />
              </>
            ) : (
              <>
                <ActionButton icon={IconEdit} disabled={isPending} label="编辑" onClick={startEditing} />
                <ActionButton icon={IconPlayerPlay} disabled={isPending || generating} label={generating ? "生成中..." : "AI 生成"} onClick={handleGenerate} />
              </>
            )}
            <button
              className="inline-flex items-center gap-1.5 rounded-full bg-panel2 px-4 py-2 text-xs font-medium text-slate-600 transition hover:text-slate-900"
              onClick={() => setRefineOpen(true)}
            >
              <IconSparkles size={14} stroke={2} />
              AI 调整
            </button>
          </div>
        </div>

        {content ? (
          editing ? (
            <Textarea
              className="mt-4 min-h-64 rounded-3xl border-mint/20 p-5 leading-7"
              value={draft}
              onChange={(e: any) => setDraft(e.target.value)}
            />
          ) : (
            <pre className="mt-4 whitespace-pre-wrap rounded-3xl border border-line bg-panel2 p-5 text-sm leading-7 text-slate-700">
              {content}
            </pre>
          )
        ) : (
          <EmptyState text={project.story_content ? "尚未生成剧本化文本，点击「AI 生成」开始。" : "请先生成剧情内容。"} />
        )}
      </section>

      <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900">版本历史</h3>
          <ActionButton
            icon={IconHistory}
            disabled={loadingVersions}
            label={versions !== null ? "收起" : "查看版本历史"}
            onClick={loadVersions}
          />
        </div>
        {versions !== null && (
          <div className="mt-4 space-y-2">
            {versions.length === 0 ? (
              <EmptyState text="暂无版本记录。" />
            ) : (
              versions.map((v: any) => (
                <div key={v.id} className="flex items-center gap-3 rounded-xl bg-panel2/50 px-4 py-3">
                  <span className="text-xs font-medium text-slate-500">v{v.version}</span>
                  <span className="flex-1 truncate text-sm text-slate-700">
                    {(v.content || "").substring(0, 80)}...
                  </span>
                  <span className="text-xs text-slate-500">{v.created_at?.substring(0, 16)}</span>
                  <button
                    className="inline-flex items-center gap-1 text-xs text-mint hover:underline disabled:opacity-50"
                    onClick={() => handleRestore(v.id)}
                    disabled={restoringId === v.id}
                  >
                    {restoringId === v.id ? "回滚中..." : <><IconRotateClockwise size={12} stroke={2} /> 回滚</>}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {screenplayTasks?.length ? <TaskPanel tasks={screenplayTasks} /> : null}
      <RefineDrawer
        open={refineOpen}
        onClose={() => setRefineOpen(false)}
        title="调整剧本化文本"
        currentContent={content || ""}
        systemPromptKey="prompt_refine_screenplay_system"
        onApply={(newContent: string) => {
          if (lang === "cn") setDraftCn(newContent);
          else setDraftEn(newContent);
          updateScreenplay(project.id, lang === "cn" ? newContent : draftCn, lang === "en" ? newContent : draftEn).then(() => {
            onRunAction(() => Promise.resolve());
          }).catch((err: any) => toast.error(String(err.message || err)));
        }}
      />
      <ConfirmDialog />
    </div>
  );
}
