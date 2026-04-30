"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { updateStory, getStoryVersions, restoreStoryVersion } from "../../api";
import { ActionButton, EmptyState } from "../ui-legacy";
import { Textarea } from "../ui/textarea";
import { useConfirm } from "../../hooks/useConfirm";
import { IconDeviceFloppy, IconX, IconEdit, IconHistory, IconRotateClockwise, IconSparkles } from "@tabler/icons-react";
import TaskPanel from "../TaskPanel";
import RefineDrawer from "../RefineDrawer";

export default function ScriptTab({ project, isPending, onRunAction }: any) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.story_content || "");
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<any>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringId, setRestoringId] = useState<any>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const storyTasks = project.tasks?.filter(
    (t: any) => t.task_type === "generate_story" || t.task_type === "generate_characters" || t.task_type === "pipeline"
  );

  function startEditing() {
    setDraft(project.story_content || "");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setDraft(project.story_content || "");
  }

  async function saveStory() {
    setSaving(true);
    try {
      await updateStory(project.id, draft);
      setEditing(false);
      await onRunAction(() => Promise.resolve());
    } finally {
      setSaving(false);
    }
  }

  async function loadVersions() {
    if (versions !== null) {
      setVersions(null);
      return;
    }
    setLoadingVersions(true);
    try {
      const data = await getStoryVersions(project.id);
      setVersions(data.versions);
    } finally {
      setLoadingVersions(false);
    }
  }

  async function handleRestore(versionId: any) {
    if (!await confirm("确定要回滚到此版本？")) return;
    setRestoringId(versionId);
    try {
      await restoreStoryVersion(project.id, versionId);
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
          <h3 className="text-xl font-semibold text-slate-900">项目大纲</h3>
          <div className="flex flex-wrap gap-3">
            {editing ? (
              <>
                <ActionButton icon={IconDeviceFloppy} disabled={saving} label="保存大纲" onClick={saveStory} />
                <ActionButton icon={IconX} disabled={saving} label="取消" onClick={cancelEditing} />
              </>
            ) : (
              <ActionButton icon={IconEdit} disabled={isPending} label="编辑剧情" onClick={startEditing} />
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

        {project.story_content ? (
          editing ? (
            <Textarea
              className="mt-4 min-h-64 rounded-3xl border-mint/20 p-5 leading-7"
              value={draft}
              onChange={(e: any) => setDraft(e.target.value)}
            />
          ) : (
            <pre className="mt-4 whitespace-pre-wrap rounded-3xl border border-line bg-panel2 p-5 text-sm leading-7 text-slate-700">
              {project.story_content}
            </pre>
          )
        ) : (
          <EmptyState text="暂无大纲内容，点击顶部栏的「重新生成」生成。" />
        )}

        {project.status === "prompt_updated" && (
          <p className="mt-3 text-xs text-amber-600">
            大纲已更新，建议重新生成角色卡或分集剧本。
          </p>
        )}
      </section>

      <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900">大纲版本历史</h3>
          <ActionButton
            icon={IconHistory}
            disabled={loadingVersions}
            label={versions !== null ? "收起版本历史" : "查看版本历史"}
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
                    {v.content.substring(0, 80)}...
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

      <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900">项目信息</h3>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem label="状态" value={project.status} />
          <InfoItem label="风格" value={project.style} />
          <InfoItem label="比例" value={project.aspect_ratio} />
          <InfoItem label="分集数量" value={String(project.episodes?.length || 0)} />
        </div>
      </section>

      {storyTasks?.length ? <TaskPanel tasks={storyTasks} /> : null}
      <RefineDrawer
        open={refineOpen}
        onClose={() => setRefineOpen(false)}
        title="调整大纲"
        currentContent={project.story_content || ""}
        systemPromptKey="prompt_refine_outline_system"
        onApply={(newContent: string) => {
          setDraft(newContent);
          updateStory(project.id, newContent).then(() => {
            onRunAction(() => Promise.resolve());
          }).catch((err: any) => toast.error(String(err.message || err)));
        }}
      />
      <ConfirmDialog />
    </div>
  );
}

function InfoItem({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-line bg-panel2 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
