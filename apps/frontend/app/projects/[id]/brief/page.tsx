"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type { BriefProposal, CopilotProposal, ProjectDetail } from "@/src/api";
import { updateProjectBrief } from "@/src/api";
import { useProjectCopilotModule } from "@/src/components/copilot/ProjectCopilotContext";
import type { CopilotFieldDescriptor, CopilotModuleAdapter } from "@/src/components/copilot/types";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { KeyValueGrid, SectionCard } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

function toCsv(values: string[]) {
  return values.join(", ");
}

function parseCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

const BRIEF_FIELD_LABELS: CopilotFieldDescriptor[] = [
  { key: "logline", label: "一句话钩子" },
  { key: "targetAudience", label: "目标受众" },
  { key: "genreTags", label: "题材标签" },
  { key: "styleKeywords", label: "风格关键词" },
  { key: "worldRules", label: "世界规则" },
  { key: "mainConflict", label: "主冲突" },
  { key: "relationshipSummary", label: "人物关系" },
  { key: "reversalRules", label: "反转规则" },
  { key: "forbiddenRules", label: "禁忌项" },
];

function buildFormState(project: ProjectDetail) {
  return {
    logline: project.brief.logline ?? "",
    targetAudience: project.brief.targetAudience ?? "",
    genreTags: toCsv(project.brief.genreTags ?? []),
    styleKeywords: toCsv(project.brief.styleKeywords ?? []),
    worldRules: project.brief.worldRules ?? "",
    mainConflict: project.brief.mainConflict ?? "",
    relationshipSummary: project.brief.relationshipSummary ?? "",
    reversalRules: project.brief.reversalRules ?? "",
    forbiddenRules: project.brief.forbiddenRules ?? "",
    status: project.brief.status ?? "draft",
  };
}

export default function ProjectBriefPage() {
  const { project, refresh } = useProjectWorkspace();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => project ? buildFormState(project) : {
    logline: "",
    targetAudience: "",
    genreTags: "",
    styleKeywords: "",
    worldRules: "",
    mainConflict: "",
    relationshipSummary: "",
    reversalRules: "",
    forbiddenRules: "",
    status: "draft",
  });

  const currentProject = project;

  useEffect(() => {
    if (!currentProject) return;
    setForm(buildFormState(currentProject));
  }, [currentProject]);

  const briefAdapter = useMemo<CopilotModuleAdapter | null>(() => currentProject ? ({
    moduleType: "brief",
    title: "Brief",
    description: "从创意生成、改写或补全项目级 Brief。",
    buildContext: () => ({
      project_summary: {
        name: currentProject.name,
        genre: currentProject.genre,
        target_platform: currentProject.targetPlatform,
        episode_count_planned: currentProject.episodeCountPlanned,
      },
      current_brief: {
        logline: form.logline,
        target_audience: form.targetAudience,
        genre_tags: parseCsv(form.genreTags),
        style_keywords: parseCsv(form.styleKeywords),
        world_rules: form.worldRules,
        main_conflict: form.mainConflict,
        relationship_summary: form.relationshipSummary,
        reversal_rules: form.reversalRules,
        forbidden_rules: form.forbiddenRules,
        status: form.status,
      },
      locked_rules: {
        project_id: currentProject.id,
        project_name_editable: false,
      },
    }),
    renderContextSummary: () => (
      <KeyValueGrid
        items={[
          { label: "项目名", value: currentProject.name },
          { label: "题材", value: currentProject.genre || "未填写" },
          { label: "目标平台", value: currentProject.targetPlatform || "未填写" },
          { label: "计划集数", value: String(currentProject.episodeCountPlanned || 0) },
          { label: "当前受众", value: form.targetAudience || "未填写" },
          { label: "当前钩子", value: form.logline || "未填写" },
        ]}
      />
    ),
    getSupportedIntents: () => ["generate", "rewrite", "expand", "compress", "fill_missing"],
    getProposalFields: () => BRIEF_FIELD_LABELS,
    renderProposal: ({ proposal, selectedFields, toggleField }) => {
      const briefProposal = proposal as BriefProposal;
      return (
      <div className="grid gap-3">
        {BRIEF_FIELD_LABELS.map((field) => {
          const value = briefProposal[field.key as keyof BriefProposal];
          const checked = selectedFields.includes(field.key);
          return (
            <button
              key={field.key}
              type="button"
              onClick={() => toggleField(field.key)}
              className={`rounded-[20px] border px-4 py-3 text-left transition ${
                checked ? "border-[#6f67d8] bg-[#f3f1ff]" : "border-line bg-panel hover:border-[#c9c4ff]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">{field.label}</div>
                <div className={`text-[11px] ${checked ? "text-[#6f67d8]" : "text-slate-400"}`}>
                  {checked ? "已选中" : "点击选中"}
                </div>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {Array.isArray(value) ? value.join(", ") || "[]" : String(value ?? "") || "空"}
              </div>
            </button>
          );
        })}
      </div>
    );
    },
    applyProposal: (proposal: CopilotProposal, options: { mode: "all" | "fields"; fields: string[] }) => {
      const briefProposal = proposal as BriefProposal;
      const allowed = options.mode === "all" ? BRIEF_FIELD_LABELS.map((field) => field.key) : options.fields;
      setForm((prev) => {
        const next = { ...prev };
        for (const key of allowed) {
          if (key === "genreTags") next.genreTags = toCsv(briefProposal.genreTags);
          else if (key === "styleKeywords") next.styleKeywords = toCsv(briefProposal.styleKeywords);
          else if (key === "logline") next.logline = briefProposal.logline;
          else if (key === "targetAudience") next.targetAudience = briefProposal.targetAudience;
          else if (key === "worldRules") next.worldRules = briefProposal.worldRules;
          else if (key === "mainConflict") next.mainConflict = briefProposal.mainConflict;
          else if (key === "relationshipSummary") next.relationshipSummary = briefProposal.relationshipSummary;
          else if (key === "reversalRules") next.reversalRules = briefProposal.reversalRules;
          else if (key === "forbiddenRules") next.forbiddenRules = briefProposal.forbiddenRules;
        }
        return next;
      });
      toast.success(options.mode === "all" ? "Copilot 建议已回填到 Brief 表单" : "已按字段回填到 Brief 表单");
    },
  }) : null, [currentProject, form]);

  useProjectCopilotModule(briefAdapter);

  if (!currentProject) return null;
  const readyProject = currentProject;

  async function handleSave() {
    setSaving(true);
    try {
      await updateProjectBrief(readyProject.id, {
        logline: form.logline,
        targetAudience: form.targetAudience,
        genreTags: parseCsv(form.genreTags),
        styleKeywords: parseCsv(form.styleKeywords),
        worldRules: form.worldRules,
        mainConflict: form.mainConflict,
        relationshipSummary: form.relationshipSummary,
        reversalRules: form.reversalRules,
        forbiddenRules: form.forbiddenRules,
        status: form.status,
      });
      await refresh();
      toast.success("Brief 已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title="项目 Brief" description="先把项目级约束定义清楚，后续角色、场景、分集和镜头都会从这里读取。">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label className="mb-2 block text-xs text-slate-500">一句话钩子</Label>
          <Textarea className="min-h-[120px]" value={form.logline} onChange={(e) => setForm((prev) => ({ ...prev, logline: e.target.value }))} />
        </div>
        <div>
          <Label className="mb-2 block text-xs text-slate-500">目标受众</Label>
          <Input value={form.targetAudience} onChange={(e) => setForm((prev) => ({ ...prev, targetAudience: e.target.value }))} />
        </div>
        <div>
          <Label className="mb-2 block text-xs text-slate-500">状态</Label>
          <Input value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} />
        </div>
        <div>
          <Label className="mb-2 block text-xs text-slate-500">题材标签</Label>
          <Input value={form.genreTags} onChange={(e) => setForm((prev) => ({ ...prev, genreTags: e.target.value }))} placeholder="甜宠, 逆袭, 复仇" />
        </div>
        <div>
          <Label className="mb-2 block text-xs text-slate-500">风格关键词</Label>
          <Input value={form.styleKeywords} onChange={(e) => setForm((prev) => ({ ...prev, styleKeywords: e.target.value }))} placeholder="高饱和, 快节奏" />
        </div>
        <div className="md:col-span-2">
          <Label className="mb-2 block text-xs text-slate-500">世界规则</Label>
          <Textarea value={form.worldRules} onChange={(e) => setForm((prev) => ({ ...prev, worldRules: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <Label className="mb-2 block text-xs text-slate-500">主冲突</Label>
          <Textarea value={form.mainConflict} onChange={(e) => setForm((prev) => ({ ...prev, mainConflict: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <Label className="mb-2 block text-xs text-slate-500">人物关系</Label>
          <Textarea value={form.relationshipSummary} onChange={(e) => setForm((prev) => ({ ...prev, relationshipSummary: e.target.value }))} />
        </div>
        <div>
          <Label className="mb-2 block text-xs text-slate-500">反转规则</Label>
          <Textarea value={form.reversalRules} onChange={(e) => setForm((prev) => ({ ...prev, reversalRules: e.target.value }))} />
        </div>
        <div>
          <Label className="mb-2 block text-xs text-slate-500">禁忌项</Label>
          <Textarea value={form.forbiddenRules} onChange={(e) => setForm((prev) => ({ ...prev, forbiddenRules: e.target.value }))} />
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存 Brief"}
        </Button>
      </div>
    </SectionCard>
  );
}
