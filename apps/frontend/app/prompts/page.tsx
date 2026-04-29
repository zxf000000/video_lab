"use client";

import { useEffect, useState } from "react";
import { getPrompts, updatePrompts } from "../../src/api";
import { ActionButton, StatusBadge } from "../../src/components/ui-legacy";
import { Textarea } from "../../src/components/ui/textarea";
import { IconRestore, IconDeviceFloppy, IconCircleFilled } from "@tabler/icons-react";

const TABS = [
  {
    key: "generate_story",
    label: "剧情生成",
    desc: "根据项目题材、风格和时长，生成剧情段落",
    fields: [
      { key: "prompt_generate_story_system", label: "System Prompt", type: "system" },
      { key: "prompt_generate_story_user", label: "User Prompt", type: "user" },
    ],
  },
  {
    key: "expand_story_screenplay",
    label: "剧本化",
    desc: "将剧情段落整理成更结构化的剧本化文本",
    fields: [
      { key: "prompt_expand_story_screenplay_system", label: "System Prompt", type: "system" },
      { key: "prompt_expand_story_screenplay_user", label: "User Prompt", type: "user" },
    ],
  },
  {
    key: "expand_story_beats",
    label: "剧情细化",
    desc: "将剧本化文本展开为更适合拆镜头的 beat list",
    fields: [
      { key: "prompt_expand_story_beats_system", label: "System Prompt", type: "system" },
      { key: "prompt_expand_story_beats_user", label: "User Prompt", type: "user" },
    ],
  },
  {
    key: "split_shots",
    label: "拆镜头",
    desc: "将细化后的剧情 beats 拆分为多个镜头，输出 JSON 格式",
    fields: [
      { key: "prompt_split_shots_system", label: "System Prompt", type: "system" },
      { key: "prompt_split_shots_user", label: "User Prompt", type: "user" },
    ],
  },
  {
    key: "generate_characters",
    label: "角色提取",
    desc: "从剧情中提取角色信息",
    fields: [
      { key: "prompt_generate_characters_system", label: "System Prompt", type: "system" },
      { key: "prompt_generate_characters_user", label: "User Prompt", type: "user" },
    ],
  },
  {
    key: "generate_scenes",
    label: "场景提取",
    desc: "从剧情中提取场景信息",
    fields: [
      { key: "prompt_generate_scenes_system", label: "System Prompt", type: "system" },
      { key: "prompt_generate_scenes_user", label: "User Prompt", type: "user" },
    ],
  },
  {
    key: "generate_frame",
    label: "图片生成",
    desc: "生成镜头首帧/尾帧图片的提示词",
    fields: [
      { key: "prompt_generate_frame", label: "Image Prompt", type: "single" },
    ],
  },
  {
    key: "generate_video",
    label: "视频生成",
    desc: "生成视频片段的提示词",
    fields: [
      { key: "prompt_generate_video", label: "Video Prompt", type: "single" },
    ],
  },
  {
    key: "rewrite",
    label: "故事改写",
    desc: "将已有故事改写为新的剧本段落",
    fields: [
      { key: "prompt_rewrite_system", label: "System Prompt", type: "system" },
      { key: "prompt_rewrite_user", label: "User Prompt", type: "user" },
    ],
  },
];

export default function PromptsPage() {
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("generate_story");
  const [edited, setEdited] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getPrompts().then((res) => {
      setData(res);
      setEdited(res.prompts || {});
    }).catch(() => {});
  }, []);

  function handleSave() {
    setSaving(true);
    setMessage("");
    updatePrompts(edited)
      .then((res) => {
        setData(res);
        setEdited(res.prompts || {});
        setMessage("提示词已保存，即时生效。");
      })
      .catch(() => setMessage("保存失败"))
      .finally(() => setSaving(false));
  }

  function handleReset(tab: any) {
    if (!data?.defaults) return;
    const updated = { ...edited };
    tab.fields.forEach((f: any) => {
      updated[f.key] = data.defaults[f.key] || "";
    });
    setEdited(updated);
  }

  function isModified(key: any) {
    if (!data?.defaults) return false;
    return (edited[key] || "") !== (data.defaults[key] || "");
  }

  if (!data) {
    return (
      <p className="text-slate-500 text-sm">加载中...</p>
    );
  }

  const currentTab = TABS.find((t) => t.key === activeTab);
  const vars = data.vars?.[activeTab] || [];

  return (
    <>

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 rounded-[28px] border border-line bg-panel px-5 py-4 shadow-glow">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint">Prompt Console</p>
            <h1 className="mt-1 text-lg font-semibold text-slate-900">提示词配置</h1>
            <p className="text-[11px] text-slate-500">编辑各环节 AI 提示词，并让修改即时作用于项目生成链路。</p>
          </div>
          {message ? <StatusBadge status="saved" className="ml-auto bg-emerald-100 text-emerald-600" /> : null}
        </div>

        {message ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{message}</div>
        ) : null}

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto rounded-[24px] border border-line bg-panel px-3 py-3 shadow-glow">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            const hasCustom = tab.fields.some((f) => isModified(f.key));
            return (
              <button
                key={tab.key}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition ${
                  active
                    ? "bg-mint text-white shadow-[0_8px_20px_rgba(111,103,216,0.24)]"
                    : "bg-panel2 text-slate-500 hover:text-slate-900"
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {hasCustom ? <span className="ml-1 text-amber-400"><IconCircleFilled size={8} /></span> : null}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {currentTab && (
          <div className="flex flex-col gap-4">
            <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{currentTab.label}</h2>
                  <p className="mt-1 text-sm text-slate-500">{currentTab.desc}</p>
                </div>
                <StatusBadge status={activeTab} />
              </div>

              <div className="mt-5 grid gap-4">
                {currentTab.fields.map((field) => (
                  <section key={field.key} className="rounded-[24px] border border-line bg-panel2">
                    <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                      <span className="text-sm font-medium text-slate-800">{field.label}</span>
                      {isModified(field.key) ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] text-amber-700">
                          已修改
                        </span>
                      ) : null}
                    </div>
                    <Textarea
                      className="min-h-[160px] resize-y border-transparent bg-transparent px-4 py-4 font-mono text-xs leading-relaxed"
                      value={edited[field.key] || ""}
                      onChange={(e) => setEdited((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      spellCheck={false}
                    />
                  </section>
                ))}
              </div>

              {vars.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">可用变量：</span>
                  {vars.map((v: any) => (
                    <code
                      key={v}
                      className="cursor-pointer rounded-full bg-[#f2efff] px-2.5 py-1 font-mono text-[10px] text-mint transition hover:bg-mint/10"
                      title="点击复制"
                      onClick={() => navigator.clipboard?.writeText(`{${v}}`)}
                    >
                      {"{" + v + "}"}
                    </code>
                  ))}
                </div>
              )}

              <div className="mt-6 flex items-center gap-3">
                <ActionButton icon={IconRestore} label="重置为默认" onClick={() => handleReset(currentTab)} />
                <div className="ml-auto">
                  <ActionButton
                    icon={saving ? undefined : IconDeviceFloppy}
                    label={saving ? "保存中..." : "保存提示词"}
                    onClick={handleSave}
                    disabled={saving}
                    variant="primary"
                  />
                </div>
              </div>
            </section>
          </div>
        )}
    </>
  );
}
