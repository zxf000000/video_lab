"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getConfig, getModels, updateConfig, addModel, deleteModel,
  getSeedanceConfig, updateSeedanceConfig,
  getKlingConfig, updateKlingConfig,
  type AppConfig, type ModelItem,
} from "../../src/api";
import ApiBaseBadge from "../../src/components/ApiBaseBadge";
import { ActionButton, StatusBadge } from "../../src/components/ui-legacy";
import { Input } from "../../src/components/ui/input";
import { IconDeviceFloppy, IconPlus, IconX } from "@tabler/icons-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

async function getVendors() {
  const resp = await fetch(`${API_BASE}/api/models/vendors`);
  if (!resp.ok) throw new Error("Failed to load vendors");
  return resp.json();
}

type ConfigFormState = {
  text_model: string; image_model: string; video_model: string; voice_model: string;
  api_base: string; api_key: string;
};
type SdFormState = { seedance_api_base: string; seedance_api_key: string };
type KlingFormState = { kling_api_base: string; kling_access_key: string; kling_secret_key: string };
type VendorsData = Record<string, Record<string, ModelItem[]>>;
type ModelsData = Record<string, ModelItem[]>;

export default function ConfigPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [models, setModels] = useState<ModelsData | null>(null);
  const [vendors, setVendors] = useState<VendorsData | null>(null);
  const [form, setForm] = useState<ConfigFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Seedance 2.0
  const [sdForm, setSdForm] = useState<SdFormState | null>(null);
  const [sdSaving, setSdSaving] = useState(false);

  // Kling 可灵
  const [klingForm, setKlingForm] = useState<KlingFormState | null>(null);
  const [klingSaving, setKlingSaving] = useState(false);

  function sdSet(field: keyof SdFormState, value: string) {
    setSdForm((prev) => ({ ...prev!, [field]: value }));
  }

  function klingSet(field: keyof KlingFormState, value: string) {
    setKlingForm((prev) => ({ ...prev!, [field]: value }));
  }

  useEffect(() => { loadAll(); }, []);

  function loadAll() {
    Promise.all([getConfig(), getModels(), getVendors(), getSeedanceConfig(), getKlingConfig()])
      .then(([cfgRes, modelsRes, vendorsRes, sdRes, klingRes]) => {
        setConfig(cfgRes.config);
        setModels(modelsRes.models);
        setVendors(vendorsRes.vendors);
        setForm((prev) => prev || {
          text_model: cfgRes.config.text_model,
          image_model: cfgRes.config.image_model,
          video_model: cfgRes.config.video_model,
          voice_model: cfgRes.config.voice_model,
          api_base: cfgRes.config.api_base,
          api_key: "",
        });
        setSdForm((prev) => prev || {
          seedance_api_base: sdRes.config.seedance_api_base,
          seedance_api_key: "",
        });
        setKlingForm((prev) => prev || {
          kling_api_base: klingRes.config.kling_api_base,
          kling_access_key: "",
          kling_secret_key: "",
        });
      })
      .catch((err: unknown) => setError(String((err as Error).message || err)));
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage("");
    setError("");
    const payload: Record<string, string> = { ...form };
    if (!payload.api_key) delete payload.api_key;
    updateConfig(payload)
      .then((res) => {
        setConfig(res.config);
        setMessage("配置已保存，即时生效。");
        setForm((f) => ({ ...f!, api_key: "" }));
      })
      .catch((err: unknown) => setError(String((err as Error).message || err)))
      .finally(() => setSaving(false));
  }

  function set(field: keyof ConfigFormState, value: string) {
    setForm((f) => ({ ...f!, [field]: value }));
  }

  async function onSaveSeedance(e: React.FormEvent) {
    e.preventDefault();
    if (!sdForm) return;
    setSdSaving(true);
    try {
      const payload: Record<string, string> = { ...sdForm };
      if (!payload.seedance_api_key) delete payload.seedance_api_key;
      await updateSeedanceConfig(payload);
      toast.success("Seedance 配置已保存");
      setSdForm((prev) => ({ ...prev!, seedance_api_key: "" }));
    } catch (err: unknown) {
      toast.error(String((err as Error).message || err));
    } finally {
      setSdSaving(false);
    }
  }

  async function onSaveKling(e: React.FormEvent) {
    e.preventDefault();
    if (!klingForm) return;
    setKlingSaving(true);
    try {
      const payload: Record<string, string> = { ...klingForm };
      if (!payload.kling_access_key) delete payload.kling_access_key;
      if (!payload.kling_secret_key) delete payload.kling_secret_key;
      await updateKlingConfig(payload);
      toast.success("Kling 配置已保存");
      setKlingForm((prev) => ({ ...prev!, kling_access_key: "", kling_secret_key: "" }));
    } catch (err: unknown) {
      toast.error(String((err as Error).message || err));
    } finally {
      setKlingSaving(false);
    }
  }

  if (!form || !models || !vendors || !sdForm || !klingForm) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-gray-500 text-sm">加载中...</p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel px-5 py-4 shadow-glow">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint">Model Config</p>
          <h1 className="mt-1 text-lg font-semibold text-gray-100">模型配置</h1>
        </div>
        <ApiBaseBadge className="hidden rounded-full border border-line bg-panel2 px-3 py-1.5 text-[11px] font-medium text-gray-500 sm:inline" />
        {config ? (
          <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
            <span>{config.text_model}</span>
            <span className="text-line">·</span>
            <span>{config.image_model}</span>
            <span className="text-line">·</span>
            <span>{config.video_model}</span>
            {config.has_api_key ? (
              <span className="ml-1 rounded-full bg-mint/10 px-2 py-1 text-mint">{config.api_key_masked}</span>
            ) : (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-1 text-amber-700">未配置 Key</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        {/* Toast */}
        {message ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">{message}</div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        ) : null}

        <form className="flex flex-col gap-2" onSubmit={onSave}>

          {/* API Connection */}
          <section className="rounded-lg border border-line bg-panel px-5 py-5 shadow-glow">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">连接配置</h2>
                <p className="mt-1 text-sm text-gray-500">设置 API 地址、密钥，以及当前工作区默认使用的模型路由。</p>
              </div>
              <StatusBadge status={config?.has_api_key ? "connected" : "pending"} className={config?.has_api_key ? "bg-emerald-100 text-emerald-400" : "bg-amber-100 text-amber-700"} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] text-gray-500 w-16">API Base</span>
                <Input
                  className="min-w-0 flex-1 rounded-2xl px-3 py-2 font-mono text-xs"
                  value={form.api_base}
                  onChange={(e) => set("api_base", e.target.value)}
                  placeholder="https://api.chatfire.site"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] text-gray-500 w-16">API Key</span>
                <Input
                  type="password"
                  className="min-w-0 flex-1 rounded-2xl px-3 py-2 font-mono text-xs"
                  value={form.api_key}
                  onChange={(e) => set("api_key", e.target.value)}
                  placeholder={config?.has_api_key ? "已配置（留空保留）" : "sk-..."}
                />
              </label>
            </div>
          </section>

          {/* Model Sections — 2x2 grid */}
          <div className="grid gap-4 lg:grid-cols-2">
            <VendorModelSection
              title="文字模型"
              desc="剧情 / 拆镜头 / 角色"
              category="text"
              vendors={vendors}
              models={models.text || []}
              value={form.text_model}
              onChange={(v) => set("text_model", v)}
            />
            <VendorModelSection
              title="图片模型"
              desc="首尾帧生成"
              category="image"
              vendors={vendors}
              models={models.image || []}
              value={form.image_model}
              onChange={(v) => set("image_model", v)}
            />
            <VendorModelSection
              title="视频模型"
              desc="视频片段生成"
              category="video"
              vendors={vendors}
              models={models.video || []}
              value={form.video_model}
              onChange={(v) => set("video_model", v)}
            />
            <VendorModelSection
              title="音频模型"
              desc="语音合成 / 音乐生成"
              category="voice"
              vendors={vendors}
              models={models.voice || []}
              value={form.voice_model}
              onChange={(v) => set("voice_model", v)}
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <ActionButton icon={saving ? undefined : IconDeviceFloppy} label={saving ? "保存中..." : "保存配置"} disabled={saving} type="submit" variant="primary" />
            </div>
            <p className="hidden text-[11px] text-gray-500 sm:block">
              环境变量优先级最高 · 数据库存储 · 即时生效
            </p>
          </div>
        </form>

        {/* Seedance 2.0 配置 */}
        <form onSubmit={onSaveSeedance} className="flex flex-col gap-5">
          <section className="rounded-lg border border-line bg-panel px-5 py-5 shadow-glow">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-100">Seedance 2.0 配置</h2>
              <p className="mt-1 text-sm text-gray-500">基于火山引擎 Ark 平台的视频生成服务（画质、时长等参数在生成页面设置）</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] text-gray-500 w-16">API Base</span>
                <Input
                  className="min-w-0 flex-1 rounded-2xl px-3 py-2 font-mono text-xs"
                  value={sdForm.seedance_api_base}
                  onChange={(e) => sdSet("seedance_api_base", e.target.value)}
                  placeholder="https://ark.cn-beijing.volces.com/api/v3"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] text-gray-500 w-16">API Key</span>
                <Input
                  type="password"
                  className="min-w-0 flex-1 rounded-2xl px-3 py-2 font-mono text-xs"
                  value={sdForm.seedance_api_key}
                  onChange={(e) => sdSet("seedance_api_key", e.target.value)}
                  placeholder="已配置（留空保留）"
                />
              </label>
            </div>
          </section>
          <div className="flex items-center gap-3">
            <ActionButton icon={sdSaving ? undefined : IconDeviceFloppy} label={sdSaving ? "保存中..." : "保存 Seedance 配置"} disabled={sdSaving} type="submit" variant="primary" />
          </div>
        </form>

        {/* Kling 可灵 配置 */}
        <form onSubmit={onSaveKling} className="flex flex-col gap-5">
          <section className="rounded-lg border border-line bg-panel px-5 py-5 shadow-glow">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-100">Kling 可灵配置</h2>
              <p className="mt-1 text-sm text-gray-500">基于快手可灵 API 的视频/图片生成服务，使用 JWT 认证（画质、模型等参数在生成页面设置）</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] text-gray-500 w-16">API Base</span>
                <Input
                  className="min-w-0 flex-1 rounded-2xl px-3 py-2 font-mono text-xs"
                  value={klingForm.kling_api_base}
                  onChange={(e) => klingSet("kling_api_base", e.target.value)}
                  placeholder="https://api-beijing.klingai.com"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] text-gray-500 w-16">Access Key</span>
                <Input
                  type="password"
                  className="min-w-0 flex-1 rounded-2xl px-3 py-2 font-mono text-xs"
                  value={klingForm.kling_access_key}
                  onChange={(e) => klingSet("kling_access_key", e.target.value)}
                  placeholder="已配置（留空保留）"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] text-gray-500 w-16">Secret Key</span>
                <Input
                  type="password"
                  className="min-w-0 flex-1 rounded-2xl px-3 py-2 font-mono text-xs"
                  value={klingForm.kling_secret_key}
                  onChange={(e) => klingSet("kling_secret_key", e.target.value)}
                  placeholder="已配置（留空保留）"
                />
              </label>
            </div>
          </section>
          <div className="flex items-center gap-3">
            <ActionButton icon={klingSaving ? undefined : IconDeviceFloppy} label={klingSaving ? "保存中..." : "保存 Kling 配置"} disabled={klingSaving} type="submit" variant="primary" />
          </div>
        </form>
      </div>
    </>
  );
}

/* ── Vendor → Model Section ──────────────────────────────────── */

function VendorModelSection({ title, desc, category, vendors, models: modelList, value, onChange }: {
  title: string;
  desc: string;
  category: string;
  vendors: VendorsData;
  models: ModelItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");

  // Find which vendor the currently selected model belongs to
  const currentVendor = findVendorForModel(vendors, category, value);
  const activeVendor = selectedVendor || currentVendor;

  // Get models for the active vendor
  const vendorModels: ModelItem[] = activeVendor ? (vendors[activeVendor]?.[category] || []) : [];

  // Also show user-added models (not in any vendor list) under "自定义"
  const vendorIds = new Set<string>();
  Object.values(vendors).forEach((cats) => {
    (cats[category] || []).forEach((m) => vendorIds.add(m.id));
  });
  const customModels = modelList.filter((m) => !vendorIds.has(m.id));

  // Vendor list with models in this category
  const vendorNames = Object.entries(vendors)
    .filter(([, cats]) => (cats[category] || []).length > 0)
    .map(([name]) => name);

  function handleAdd(e?: React.KeyboardEvent | React.MouseEvent) {
    e?.preventDefault();
    if (!newId.trim()) return;
    addModel(category, newId.trim(), newLabel.trim() || newId.trim())
      .then(() => {
        setNewId("");
        setNewLabel("");
        setAdding(false);
        // Reload models
        getConfig().then(() => {});
      })
      .catch(() => {});
  }

  const selectedLabel = modelList.find((m) => m.id === value)?.label || value || "未选择";

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-glow">
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-gray-100">{title}</span>
          <span className="ml-1.5 text-[10px] text-gray-500">{desc}</span>
        </div>
        <span className="shrink-0 rounded-full bg-mint/10 px-2.5 py-1 text-[10px] font-medium text-mint max-w-[200px] truncate">
          {selectedLabel}
        </span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Vendor sidebar */}
        <div className="flex w-24 shrink-0 flex-col overflow-y-auto border-r border-line bg-panel2/60">
          {vendorNames.map((name) => {
            const isActive = activeVendor === name;
            const hasSelected = (vendors[name]?.[category] || []).some((m) => m.id === value);
            return (
              <button
                key={name}
                type="button"
                className={`truncate px-2 py-1 text-left text-[11px] transition ${
                  isActive
                    ? "bg-mint/10 text-mint font-medium"
                    : hasSelected
                      ? "text-mint/70 hover:bg-panel2"
                      : "text-gray-500 hover:bg-panel2 hover:text-gray-100"
                }`}
                onClick={() => setSelectedVendor(name)}
              >
                {name}
              </button>
            );
          })}
          {customModels.length > 0 ? (
            <button
              type="button"
              className={`truncate px-2 py-1 text-left text-[11px] transition ${
                activeVendor === "__custom"
                  ? "bg-mint/10 text-mint font-medium"
                  : "text-amber-600/70 hover:bg-panel2 hover:text-amber-700"
              }`}
              onClick={() => setSelectedVendor("__custom")}
            >
              自定义
            </button>
          ) : null}
        </div>

        {/* Model list */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            {(activeVendor === "__custom" ? customModels : vendorModels).map((m) => {
              const isSelected = value === m.id;
              const isCustom = !vendorIds.has(m.id);
              return (
                <div
                  key={m.id}
                  className={`group flex cursor-pointer items-center gap-1.5 px-2 py-1 text-xs transition ${
                    isSelected ? "bg-mint/10 text-mint" : "text-gray-400 hover:bg-panel2 hover:text-gray-100"
                  }`}
                  onClick={() => onChange(m.id)}
                >
                  <span className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border ${
                    isSelected ? "border-mint" : "border-slate-300"
                  }`}>
                    {isSelected ? <span className="h-1.5 w-1.5 rounded-full bg-mint" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.label}</span>
                  <span className="hidden truncate text-[10px] text-gray-500 sm:inline">{m.id}</span>
                  {isCustom ? (
                    <button
                      type="button"
                      className="hidden shrink-0 rounded p-0.5 text-[10px] text-gray-500 transition hover:bg-red-500/10 hover:text-red-400 group-hover:block"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteModel(category, m.id).catch(() => {});
                      }}
                    >
                      <IconX size={10} stroke={2} />
                    </button>
                  ) : null}
                </div>
              );
            })}
            {activeVendor && activeVendor !== "__custom" && vendorModels.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-gray-500">暂无模型</p>
            ) : null}
          </div>

          {/* Add custom */}
          <div className="border-t border-line">
            {!adding ? (
              <button
                type="button"
                className="w-full px-2 py-2 text-[10px] text-gray-500 transition hover:text-mint"
                onClick={() => setAdding(true)}
              >
                <IconPlus size={12} stroke={2} className="inline" /> 自定义模型
              </button>
            ) : (
              <div className="flex gap-1 p-1">
                <Input
                  className="min-w-0 flex-1 rounded-xl px-2 py-1 text-[10px] font-mono"
                  placeholder="模型 ID"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd(e)}
                  autoFocus
                />
                <Input
                  className="min-w-0 flex-1 rounded-xl px-2 py-1 text-[10px]"
                  placeholder="名称"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd(e)}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-xl bg-mint/10 px-2 py-1 text-[10px] text-mint disabled:opacity-30"
                  onClick={handleAdd}
                  disabled={!newId.trim()}
                >
                  <IconPlus size={12} stroke={2} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function findVendorForModel(vendors: VendorsData, category: string, modelId: string) {
  if (!modelId || !vendors) return null;
  for (const [name, cats] of Object.entries(vendors)) {
    if ((cats[category] || []).some((m) => m.id === modelId)) {
      return name;
    }
  }
  return null;
}
