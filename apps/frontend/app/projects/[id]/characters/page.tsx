"use client";

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { API_BASE, createCharacter, deleteCharacter, generateCharacterImage, type CharacterAsset, type CharacterCollectionProposal, type CharacterProposal, type CopilotProposal, updateCharacter } from "@/src/api";
import { useProjectCopilotModule } from "@/src/components/copilot/ProjectCopilotContext";
import type { CopilotFieldDescriptor, CopilotModuleAdapter } from "@/src/components/copilot/types";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, KeyValueGrid, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

type CharacterFormState = {
  id?: number;
  name: string;
  roleType: string;
  identitySummary: string;
  appearanceSummary: string;
  personalityTags: string;
  speechStyle: string;
  negativeConstraints: string;
  genderPresentation: string;
  ageRange: string;
  bodyType: string;
  faceFeatures: string;
  hairStyle: string;
  hairColor: string;
  eyeStyle: string;
  signatureExpression: string;
  signaturePose: string;
  clothingStyle: string;
  colorPalette: string;
  visualKeywords: string;
  negativeVisualConstraints: string;
  imagePrompt: string;
  negativePrompt: string;
  imagePath: string;
  status: string;
};

const emptyForm: CharacterFormState = {
  name: "",
  roleType: "",
  identitySummary: "",
  appearanceSummary: "",
  personalityTags: "",
  speechStyle: "",
  negativeConstraints: "",
  genderPresentation: "",
  ageRange: "",
  bodyType: "",
  faceFeatures: "",
  hairStyle: "",
  hairColor: "",
  eyeStyle: "",
  signatureExpression: "",
  signaturePose: "",
  clothingStyle: "",
  colorPalette: "",
  visualKeywords: "",
  negativeVisualConstraints: "",
  imagePrompt: "",
  negativePrompt: "",
  imagePath: "",
  status: "draft",
};

const CHARACTER_FIELD_LABELS: CopilotFieldDescriptor[] = [
  { key: "name", label: "角色名" },
  { key: "roleType", label: "角色类型" },
  { key: "appearanceSummary", label: "外观描述" },
  { key: "personalityTags", label: "性格标签" },
  { key: "speechStyle", label: "说话风格" },
  { key: "negativeConstraints", label: "负面约束" },
];

function proposalToForm(role: CharacterProposal, base?: CharacterFormState | null): CharacterFormState {
  const profile = role.characterProfile;
  const imageSpec = role.imageSpec;
  return {
    id: base?.id,
    name: profile.name,
    roleType: profile.roleType,
    identitySummary: profile.identitySummary,
    appearanceSummary: profile.appearanceSummary,
    personalityTags: profile.personalityTags.join(", "),
    speechStyle: profile.speechStyle,
    negativeConstraints: profile.negativeConstraints,
    genderPresentation: imageSpec.genderPresentation,
    ageRange: imageSpec.ageRange,
    bodyType: imageSpec.bodyType,
    faceFeatures: imageSpec.faceFeatures,
    hairStyle: imageSpec.hairStyle,
    hairColor: imageSpec.hairColor,
    eyeStyle: imageSpec.eyeStyle,
    signatureExpression: imageSpec.signatureExpression,
    signaturePose: imageSpec.signaturePose,
    clothingStyle: imageSpec.clothingStyle,
    colorPalette: imageSpec.colorPalette.join(", "),
    visualKeywords: imageSpec.visualKeywords.join(", "),
    negativeVisualConstraints: imageSpec.negativeVisualConstraints.join(", "),
    imagePrompt: imageSpec.imagePrompt,
    negativePrompt: imageSpec.negativePrompt,
    imagePath: base?.imagePath ?? "",
    status: base?.status ?? "draft",
  };
}

function applyVisualSpecToForm(base: CharacterFormState, role: CharacterProposal): CharacterFormState {
  const imageSpec = role.imageSpec;
  return {
    ...base,
    genderPresentation: imageSpec.genderPresentation,
    ageRange: imageSpec.ageRange,
    bodyType: imageSpec.bodyType,
    faceFeatures: imageSpec.faceFeatures,
    hairStyle: imageSpec.hairStyle,
    hairColor: imageSpec.hairColor,
    eyeStyle: imageSpec.eyeStyle,
    signatureExpression: imageSpec.signatureExpression,
    signaturePose: imageSpec.signaturePose,
    clothingStyle: imageSpec.clothingStyle,
    colorPalette: imageSpec.colorPalette.join(", "),
    visualKeywords: imageSpec.visualKeywords.join(", "),
    negativeVisualConstraints: imageSpec.negativeVisualConstraints.join(", "),
    imagePrompt: imageSpec.imagePrompt,
    negativePrompt: imageSpec.negativePrompt,
  };
}

function toForm(character?: CharacterAsset): CharacterFormState {
  if (!character) return emptyForm;
  const visualProfile = character.visualProfile ?? {};
  return {
    id: character.id,
    name: character.name,
    roleType: character.roleType,
    identitySummary: character.identitySummary,
    appearanceSummary: character.appearanceSummary,
    personalityTags: character.personalityTags.join(", "),
    speechStyle: character.speechStyle,
    negativeConstraints: character.negativeConstraints,
    genderPresentation: typeof visualProfile.genderPresentation === "string" ? visualProfile.genderPresentation : "",
    ageRange: typeof visualProfile.ageRange === "string" ? visualProfile.ageRange : "",
    bodyType: typeof visualProfile.bodyType === "string" ? visualProfile.bodyType : "",
    faceFeatures: typeof visualProfile.faceFeatures === "string" ? visualProfile.faceFeatures : "",
    hairStyle: typeof visualProfile.hairStyle === "string" ? visualProfile.hairStyle : "",
    hairColor: typeof visualProfile.hairColor === "string" ? visualProfile.hairColor : "",
    eyeStyle: typeof visualProfile.eyeStyle === "string" ? visualProfile.eyeStyle : "",
    signatureExpression: typeof visualProfile.signatureExpression === "string" ? visualProfile.signatureExpression : "",
    signaturePose: typeof visualProfile.signaturePose === "string" ? visualProfile.signaturePose : "",
    clothingStyle: typeof visualProfile.clothingStyle === "string" ? visualProfile.clothingStyle : "",
    colorPalette: Array.isArray(visualProfile.colorPalette) ? visualProfile.colorPalette.join(", ") : "",
    visualKeywords: Array.isArray(visualProfile.visualKeywords) ? visualProfile.visualKeywords.join(", ") : "",
    negativeVisualConstraints: Array.isArray(visualProfile.negativeVisualConstraints)
      ? visualProfile.negativeVisualConstraints.join(", ")
      : "",
    imagePrompt: character.imagePrompt,
    negativePrompt: character.negativePrompt,
    imagePath: character.imagePath,
    status: character.status,
  };
}

function parseCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function resolveAssetUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/assets/")) return `${API_BASE}${path}`;
  return `${API_BASE}/assets/${path}`;
}

function buildVisualProfile(form: CharacterFormState) {
  return {
    genderPresentation: form.genderPresentation,
    ageRange: form.ageRange,
    bodyType: form.bodyType,
    faceFeatures: form.faceFeatures,
    hairStyle: form.hairStyle,
    hairColor: form.hairColor,
    eyeStyle: form.eyeStyle,
    signatureExpression: form.signatureExpression,
    signaturePose: form.signaturePose,
    clothingStyle: form.clothingStyle,
    colorPalette: parseCsv(form.colorPalette),
    visualKeywords: parseCsv(form.visualKeywords),
    negativeVisualConstraints: parseCsv(form.negativeVisualConstraints),
  };
}

export default function CharactersPage() {
  const { project, refresh } = useProjectWorkspace();
  const [editing, setEditing] = useState<CharacterFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<number | "draft" | null>(null);
  const [creatingFromProposal, setCreatingFromProposal] = useState<string>("");

  const currentProject = project;
  const isVisualStage = editing !== null;

  const characterAdapter = useMemo<CopilotModuleAdapter | null>(() => {
    if (!currentProject) return null;
    return ({
    moduleType: "character",
    title: "角色",
    description: "先生成角色卡，再进入单角色视觉设定和角色图阶段。",
    entityId: editing?.id ?? null,
    composer: {
      inputLabel: editing ? "视觉设定目标" : "角色设计目标",
      inputPlaceholder: editing
        ? "例如：为这个角色补一版稳定的视觉设定，突出年龄感、脸部特征和服装风格。"
        : "例如：根据当前 Brief 生成这部短剧最关键的 5 个角色，覆盖主角、反派、盟友和关键配角。",
      emptyConversationTitle: editing ? "还没有视觉设定对话" : "还没有角色设计对话",
      emptyConversationDescription: editing
        ? "先选中一个角色，再让 Copilot 补视觉设定和出图 prompt。"
        : "输入一句角色设计目标，Copilot 会返回一组可加入角色库的候选角色。",
      intentLabels: editing
        ? {
            generate: "生成视觉设定",
            rewrite: "改写视觉方案",
            expand: "丰富视觉细节",
            compress: "收敛视觉方案",
            fill_missing: "补全视觉字段",
          }
        : {
            generate: "生成角色组",
            rewrite: "重构角色组",
            expand: "丰富角色组",
            compress: "收敛角色组",
            fill_missing: "补全角色组",
          },
    },
    proposalStyle: "custom",
    buildContext: () => ({
      current_mode: editing ? "single_refine" : "collection",
      generation_stage: editing ? "visual_refine" : "profile_collection",
      project_summary: {
        name: currentProject.name,
        genre: currentProject.genre,
        target_platform: currentProject.targetPlatform,
        episode_count_planned: currentProject.episodeCountPlanned,
      },
      brief_summary: {
        logline: currentProject.brief.logline,
        target_audience: currentProject.brief.targetAudience,
        genre_tags: currentProject.brief.genreTags,
        style_keywords: currentProject.brief.styleKeywords,
        world_rules: currentProject.brief.worldRules,
        main_conflict: currentProject.brief.mainConflict,
        relationship_summary: currentProject.brief.relationshipSummary,
        reversal_rules: currentProject.brief.reversalRules,
        forbidden_rules: currentProject.brief.forbiddenRules,
      },
      current_character: editing ? {
        character_profile: {
          name: editing.name,
          role_type: editing.roleType,
          identity_summary: editing.identitySummary,
          appearance_summary: editing.appearanceSummary,
          personality_tags: parseCsv(editing.personalityTags),
          speech_style: editing.speechStyle,
          negative_constraints: editing.negativeConstraints,
        },
        image_spec: {
          ...buildVisualProfile(editing),
          image_prompt: editing.imagePrompt,
          negative_prompt: editing.negativePrompt,
        },
        status: editing.status,
      } : null,
      existing_characters: currentProject.characters.map((character) => ({
        character_profile: {
          name: character.name,
          role_type: character.roleType,
          identity_summary: character.identitySummary,
          appearance_summary: character.appearanceSummary,
          personality_tags: character.personalityTags,
          speech_style: character.speechStyle,
        },
        image_spec: {
          ...(character.visualProfile ?? {}),
          image_prompt: character.imagePrompt,
          negative_prompt: character.negativePrompt,
        },
      })),
      locked_rules: {
        project_id: currentProject.id,
        must_follow_brief: true,
      },
    }),
    renderContextSummary: () => (
      <KeyValueGrid
        items={[
          { label: "项目名", value: currentProject.name },
          { label: "题材", value: currentProject.genre || "未填写" },
          { label: "当前钩子", value: currentProject.brief.logline || "未填写" },
          { label: "已有角色数", value: String(currentProject.characters.length) },
          { label: "当前阶段", value: editing ? "阶段二：视觉设定" : "阶段一：角色卡组" },
          { label: "当前编辑角色", value: editing?.name || "尚未进入单角色阶段" },
          { label: "主冲突", value: currentProject.brief.mainConflict || "未填写" },
        ]}
      />
    ),
    getSupportedIntents: () => ["generate", "rewrite", "expand", "compress", "fill_missing"],
    getProposalFields: () => CHARACTER_FIELD_LABELS,
    renderProposal: ({ proposal, selectedFields, toggleField }) => {
      const characterProposal = proposal as CharacterCollectionProposal;
      const roles = characterProposal.roles ?? [];
      return (
        <div className="space-y-4">
          <div className="rounded-[20px] border border-dashed border-line bg-panel2 px-4 py-3 text-sm text-slate-600">
            {editing
              ? "当前是阶段二：视觉设定模式。下面的建议只负责补齐单个角色的视觉设定和出图 prompt。"
              : `当前生成了 ${roles.length} 个候选角色。先确定角色卡，再逐个进入视觉设定阶段。`}
          </div>
          <div className="grid gap-3">
            {roles.map((role, index) => (
              <div key={`${role.characterProfile.name}-${index}`} className="rounded-[24px] border border-line bg-panel px-5 py-4">
                {(() => {
                  const profile = role.characterProfile;
                  const imageSpec = role.imageSpec;
                  return (
                    <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{profile.name || `候选角色 ${index + 1}`}</h3>
                    <p className="mt-1 text-sm text-slate-500">{profile.roleType || "未定义角色定位"}</p>
                  </div>
                  <span className="rounded-full bg-[#f2efff] px-3 py-1 text-[11px] font-semibold text-[#6f67d8]">
                    {editing ? "单角色方案" : `候选 ${index + 1}`}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-panel2 px-4 py-3">
                    <p className="text-xs font-medium text-slate-500">角色定位</p>
                    <p className="mt-2 text-sm text-slate-700">{profile.identitySummary || "未提供角色定位"}</p>
                  </div>
                  <div className="rounded-2xl bg-panel2 px-4 py-3">
                    <p className="text-xs font-medium text-slate-500">外观摘要</p>
                    <p className="mt-2 text-sm text-slate-700">{profile.appearanceSummary || "未提供外观描述"}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.personalityTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-panel2 px-3 py-1 text-xs text-slate-600">{tag}</span>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-panel2 px-4 py-3">
                    <p className="text-xs font-medium text-slate-500">说话风格</p>
                    <p className="mt-2 text-sm text-slate-700">{profile.speechStyle || "未填写"}</p>
                  </div>
                  <div className="rounded-2xl bg-panel2 px-4 py-3">
                    <p className="text-xs font-medium text-slate-500">负面约束</p>
                    <p className="mt-2 text-sm text-slate-700">{profile.negativeConstraints || "未填写"}</p>
                  </div>
                </div>
                {editing ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-line bg-white/70 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">视觉设定</p>
                      <span className="rounded-full bg-panel2 px-3 py-1 text-[11px] text-slate-600">
                        {imageSpec.genderPresentation || "未设定"} / {imageSpec.ageRange || "年龄未设定"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500">脸部与发型</p>
                        <p className="mt-2 text-sm text-slate-700">
                          {[imageSpec.faceFeatures, imageSpec.hairStyle, imageSpec.hairColor].filter(Boolean).join(" / ") || "未填写"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">姿态与服装</p>
                        <p className="mt-2 text-sm text-slate-700">
                          {[imageSpec.signatureExpression, imageSpec.signaturePose, imageSpec.clothingStyle].filter(Boolean).join(" / ") || "未填写"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {imageSpec.visualKeywords.map((tag) => (
                        <span key={tag} className="rounded-full bg-panel2 px-3 py-1 text-xs text-slate-600">{tag}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  {editing ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing((prev) => prev ? applyVisualSpecToForm(prev, role) : proposalToForm(role))}
                    >
                      回填视觉设定
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing(proposalToForm(role, emptyForm))}
                    >
                      载入编辑器并进入视觉设定
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={async () => {
                      const token = `${profile.name}-${index}`;
                      try {
                        setCreatingFromProposal(token);
                        await createCharacter(currentProject.id, {
                          name: profile.name,
                          roleType: profile.roleType,
                          identitySummary: profile.identitySummary,
                          appearanceSummary: profile.appearanceSummary,
                          personalityTags: profile.personalityTags,
                          speechStyle: profile.speechStyle,
                          negativeConstraints: profile.negativeConstraints,
                          status: "draft",
                        });
                        await refresh();
                        toast.success(`角色「${profile.name || `候选 ${index + 1}`}」已加入角色库`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : String(err));
                      } finally {
                        setCreatingFromProposal("");
                      }
                    }}
                    disabled={creatingFromProposal === `${profile.name}-${index}`}
                  >
                    {creatingFromProposal === `${profile.name}-${index}` ? "加入中..." : "加入角色库"}
                  </Button>
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      );
    },
    applyProposal: (proposal: CopilotProposal, options: { mode: "all" | "fields"; fields: string[] }) => {
      const characterProposal = (proposal as CharacterCollectionProposal).roles?.[0];
      if (!characterProposal) return;
      const allowed = options.mode === "all" ? CHARACTER_FIELD_LABELS.map((field) => field.key) : options.fields;
      setEditing((prev) => {
        const base = prev ?? { ...proposalToForm(characterProposal) };
        const next = { ...base };
        const profile = characterProposal.characterProfile;
        for (const key of allowed) {
          if (key === "name") next.name = profile.name;
          else if (key === "roleType") next.roleType = profile.roleType;
          else if (key === "appearanceSummary") next.appearanceSummary = profile.appearanceSummary;
          else if (key === "personalityTags") next.personalityTags = profile.personalityTags.join(", ");
          else if (key === "speechStyle") next.speechStyle = profile.speechStyle;
          else if (key === "negativeConstraints") next.negativeConstraints = profile.negativeConstraints;
        }
        return next;
      });
      toast.success(options.mode === "all" ? "Copilot 建议已回填到角色表单" : "已按字段回填到角色表单");
    },
    });
  }, [currentProject, editing]);

  useProjectCopilotModule(characterAdapter);

  if (!currentProject) return null;
  const readyProject = currentProject;

  async function persistCharacter(form: CharacterFormState) {
    const payload = {
      name: form.name,
      roleType: form.roleType,
      identitySummary: form.identitySummary,
      appearanceSummary: form.appearanceSummary,
      personalityTags: parseCsv(form.personalityTags),
      speechStyle: form.speechStyle,
      negativeConstraints: form.negativeConstraints,
      visualProfile: buildVisualProfile(form),
      imagePrompt: form.imagePrompt,
      negativePrompt: form.negativePrompt,
      imagePath: form.imagePath,
      status: form.status,
    };
    if (form.id) {
      const { character } = await updateCharacter(form.id, readyProject.id, payload);
      return character;
    }
    const { character } = await createCharacter(readyProject.id, payload);
    return character;
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await persistCharacter(editing);
      setEditing(null);
      await refresh();
      toast.success("角色已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateCharacterImage(target?: CharacterFormState | CharacterAsset | null) {
    const source = target ?? editing;
    if (!source) return;
    const token = "id" in source && source.id ? source.id : "draft";
    setGeneratingImage(token);
    try {
      let characterId = "id" in source ? source.id : undefined;
      if (!characterId) {
        const saved = await persistCharacter(source as CharacterFormState);
        characterId = saved.id;
        setEditing(toForm(saved));
      }
      const { character } = await generateCharacterImage(characterId);
      setEditing((prev) => (prev && prev.id === character.id) ? toForm(character) : prev);
      await refresh();
      toast.success("角色主图已生成并回填");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingImage(null);
    }
  }

  async function handleDelete(character: CharacterAsset) {
    try {
      await deleteCharacter(character.id);
      await refresh();
      toast.success("角色已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <SectionCard
      title="角色资产"
      description="角色卡是视觉生成和剧本一致性的关键事实源，先稳定角色，再扩剧情。"
      action={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(emptyForm)}>新增角色</Button>
          <Button onClick={() => setEditing(emptyForm)}>新增并用 Copilot 精修</Button>
        </div>
      }
    >
      {currentProject.characters.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {currentProject.characters.map((character) => (
            <div key={character.id} className="rounded-[24px] border border-line bg-panel2 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{character.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{character.roleType || "未填写角色类型"}</p>
                </div>
                <StatusPill value={character.status} tone="purple" />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{character.appearanceSummary || "未填写外观描述"}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {character.personalityTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">{tag}</span>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">角色定位</p>
                  <p className="mt-2 text-sm text-slate-700">{character.identitySummary || "未填写"}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">角色图片</p>
                  <p className="mt-2 text-sm text-slate-700">{character.imagePath ? "已有主图" : "尚未生成主图"}</p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(toForm(character))}>
                  编辑
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleGenerateCharacterImage(character)}
                  disabled={generatingImage === character.id}
                >
                  {generatingImage === character.id ? "生成中..." : (character.imagePath ? "重生成主图" : "生成角色图")}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(character)}>
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="还没有角色资产" description="先创建主角、反派和关键配角，后续分集和场景才能稳定生成。" action={<Button onClick={() => setEditing(emptyForm)}>新增角色</Button>} />
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col rounded-[28px] border border-line bg-panel p-0">
          <DialogHeader className="shrink-0 border-b border-line px-6 py-5">
            <DialogTitle>{editing?.id ? "编辑角色" : "新增角色"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="grid gap-5">
                <div className="rounded-[24px] border border-line bg-panel2/60 px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">基础角色卡</h3>
                  <p className="mt-1 text-xs text-slate-500">服务剧情大纲、台词和角色一致性。</p>
                  <div className="mt-4 grid gap-5 md:grid-cols-2">
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">角色名</Label>
                  <Input value={editing.name} onChange={(e) => setEditing((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">角色类型</Label>
                  <Input value={editing.roleType} onChange={(e) => setEditing((prev) => prev ? { ...prev, roleType: e.target.value } : prev)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-slate-500">角色定位</Label>
                  <Textarea value={editing.identitySummary} onChange={(e) => setEditing((prev) => prev ? { ...prev, identitySummary: e.target.value } : prev)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-slate-500">外观描述</Label>
                  <Textarea value={editing.appearanceSummary} onChange={(e) => setEditing((prev) => prev ? { ...prev, appearanceSummary: e.target.value } : prev)} />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">性格标签</Label>
                  <Input value={editing.personalityTags} onChange={(e) => setEditing((prev) => prev ? { ...prev, personalityTags: e.target.value } : prev)} placeholder="冷静, 阴狠, 傲慢" />
                </div>
                <div>
                  <Label className="mb-2 block text-xs text-slate-500">说话风格</Label>
                  <Input value={editing.speechStyle} onChange={(e) => setEditing((prev) => prev ? { ...prev, speechStyle: e.target.value } : prev)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block text-xs text-slate-500">负面约束</Label>
                  <Textarea value={editing.negativeConstraints} onChange={(e) => setEditing((prev) => prev ? { ...prev, negativeConstraints: e.target.value } : prev)} />
                </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-line bg-panel2/60 px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">视觉设定</h3>
                  <p className="mt-1 text-xs text-slate-500">服务后续角色图片生成和镜头人物一致性。</p>
                  <div className="mt-4 grid gap-5 md:grid-cols-2">
                    <div>
                      <Label className="mb-2 block text-xs text-slate-500">性别呈现</Label>
                      <Input value={editing.genderPresentation} onChange={(e) => setEditing((prev) => prev ? { ...prev, genderPresentation: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-slate-500">年龄区间</Label>
                      <Input value={editing.ageRange} onChange={(e) => setEditing((prev) => prev ? { ...prev, ageRange: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-slate-500">体型</Label>
                      <Input value={editing.bodyType} onChange={(e) => setEditing((prev) => prev ? { ...prev, bodyType: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-slate-500">眼神/眼型</Label>
                      <Input value={editing.eyeStyle} onChange={(e) => setEditing((prev) => prev ? { ...prev, eyeStyle: e.target.value } : prev)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-2 block text-xs text-slate-500">脸部特征</Label>
                      <Textarea value={editing.faceFeatures} onChange={(e) => setEditing((prev) => prev ? { ...prev, faceFeatures: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-slate-500">发型</Label>
                      <Input value={editing.hairStyle} onChange={(e) => setEditing((prev) => prev ? { ...prev, hairStyle: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-slate-500">发色</Label>
                      <Input value={editing.hairColor} onChange={(e) => setEditing((prev) => prev ? { ...prev, hairColor: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-slate-500">标志表情</Label>
                      <Input value={editing.signatureExpression} onChange={(e) => setEditing((prev) => prev ? { ...prev, signatureExpression: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-slate-500">标志姿态</Label>
                      <Input value={editing.signaturePose} onChange={(e) => setEditing((prev) => prev ? { ...prev, signaturePose: e.target.value } : prev)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-2 block text-xs text-slate-500">服装风格</Label>
                      <Textarea value={editing.clothingStyle} onChange={(e) => setEditing((prev) => prev ? { ...prev, clothingStyle: e.target.value } : prev)} />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-slate-500">色板</Label>
                      <Input value={editing.colorPalette} onChange={(e) => setEditing((prev) => prev ? { ...prev, colorPalette: e.target.value } : prev)} placeholder="black, charcoal, deep gold" />
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs text-slate-500">视觉关键词</Label>
                      <Input value={editing.visualKeywords} onChange={(e) => setEditing((prev) => prev ? { ...prev, visualKeywords: e.target.value } : prev)} placeholder="wealthy mystery man, restrained menace" />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-2 block text-xs text-slate-500">视觉负面约束</Label>
                      <Textarea value={editing.negativeVisualConstraints} onChange={(e) => setEditing((prev) => prev ? { ...prev, negativeVisualConstraints: e.target.value } : prev)} placeholder="no cartoon styling, no teenage appearance" />
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-line bg-panel2/60 px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">角色图片资产</h3>
                  <p className="mt-1 text-xs text-slate-500">当前先落视觉协议和展示区，后续这里接入批量出图与主图锁定。</p>
                  <div className="mt-4 grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-5">
                      <div>
                        <Label className="mb-2 block text-xs text-slate-500">标准出图 Prompt</Label>
                        <Textarea value={editing.imagePrompt} onChange={(e) => setEditing((prev) => prev ? { ...prev, imagePrompt: e.target.value } : prev)} className="min-h-[128px]" />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-slate-500">负面 Prompt</Label>
                        <Textarea value={editing.negativePrompt} onChange={(e) => setEditing((prev) => prev ? { ...prev, negativePrompt: e.target.value } : prev)} className="min-h-[96px]" />
                      </div>
                      <div>
                        <Label className="mb-2 block text-xs text-slate-500">当前主图路径</Label>
                        <Input value={editing.imagePath} onChange={(e) => setEditing((prev) => prev ? { ...prev, imagePath: e.target.value } : prev)} placeholder="后续由出图服务回填" />
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-dashed border-line bg-white/70 p-4">
                      {editing.imagePath ? (
                        <div className="space-y-3">
                          <div className="overflow-hidden rounded-[18px] border border-line bg-panel2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={resolveAssetUrl(editing.imagePath)} alt={editing.name || "角色图片"} className="h-[260px] w-full object-cover" />
                          </div>
                          <p className="text-xs text-slate-500">当前主图已锁定。后续这里可继续接“设为主图 / 基于主图微调 / 批量重生”。</p>
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-[18px] bg-panel2 px-5 text-center">
                          <p className="text-sm font-medium text-slate-700">还没有角色图片</p>
                          <p className="mt-2 text-xs leading-6 text-slate-500">
                            先用 Copilot 生成完整角色卡和视觉设定。
                            <br />
                            下一步这里会接“批量生成 4 张 / 设为主图 / 基于主图微调”。
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              </div>
              <DialogFooter className="shrink-0 border-t border-line bg-panel2/60 px-6 py-4">
                <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                  取消
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void handleGenerateCharacterImage()}
                  disabled={saving || generatingImage !== null}
                >
                  {generatingImage === "draft"
                    ? "保存并生成中..."
                    : generatingImage === editing?.id
                      ? "生成中..."
                      : (editing?.imagePath ? "保存并重生成主图" : "保存并生成角色图")}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "保存中..." : "保存角色"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
