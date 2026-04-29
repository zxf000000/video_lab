"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { generateShotFrames, generateShotVideo, getShot, updateShotPrompts } from "../../../../../src/api";
import AssetCard from "../../../../../src/components/AssetCard";
import ProjectHeader from "../../../../../src/components/ProjectHeader";
import { ActionButton, StatusBadge } from "../../../../../src/components/ui-legacy";
import { Textarea } from "../../../../../src/components/ui/textarea";
import { IconPhoto, IconVideo, IconRefresh } from "@tabler/icons-react";

function buildPromptFields(shot: any) {
  return {
    shot_prompt: shot?.shot_prompt || "",
    start_frame_prompt: shot?.start_frame_prompt || "",
    end_frame_prompt: shot?.end_frame_prompt || "",
    video_prompt: shot?.video_prompt || "",
  };
}

export default function ShotDetailPage({ params }: { params: any }) {
  const resolvedParams = use(params) as any;
  const projectId = Number(resolvedParams.id);
  const shotId = Number(resolvedParams.shotId);
  const [shot, setShot] = useState<any>(null);
  const [promptFields, setPromptFields] = useState(() => buildPromptFields(null));
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [saveError, setSaveError] = useState("");
  const lastSavedRef = useRef(JSON.stringify(buildPromptFields(null)));
  const saveRequestIdRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(shotId)) {
      setError("Invalid shot id");
      return;
    }
    refreshShot();
  }, [shotId]);

  async function refreshShot(silent = false) {
    try {
      const payload = await getShot(shotId);
      setShot(payload.shot);
      const nextFields = buildPromptFields(payload.shot);
      setPromptFields(nextFields);
      lastSavedRef.current = JSON.stringify(nextFields);
      setSaveState("saved");
      setSaveError("");
      if (!silent) {
        setError("");
      }
    } catch (err: any) {
      if (!silent) {
        setError(String(err.message || err));
      }
    }
  }

  useEffect(() => {
    if (!shot) return undefined;
    const serializedFields = JSON.stringify(promptFields);
    if (serializedFields === lastSavedRef.current) {
      return undefined;
    }
    setSaveState("dirty");
    const requestId = ++saveRequestIdRef.current;
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      setSaveError("");
      try {
        const payload = await updateShotPrompts(shotId, promptFields);
        if (requestId !== saveRequestIdRef.current) {
          return;
        }
        const savedShot = payload.shot;
        const savedFields = buildPromptFields(savedShot);
        lastSavedRef.current = JSON.stringify(savedFields);
        setShot(savedShot);
        setPromptFields((current) => (
          JSON.stringify(current) === serializedFields ? savedFields : current
        ));
        setSaveState("saved");
      } catch (err: any) {
        if (requestId !== saveRequestIdRef.current) {
          return;
        }
        setSaveState("error");
        setSaveError(String(err.message || err));
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [shot, shotId, promptFields]);

  async function run(action: any, actionKey: any) {
    setBusyAction(actionKey);
    try {
      await action(shotId);
      await refreshShot(true);
    } catch (err: any) {
      setError(String(err.message || err));
    } finally {
      setBusyAction("");
    }
  }

  async function handleRefresh() {
    setBusyAction("refresh");
    try {
      await refreshShot();
    } finally {
      setBusyAction("");
    }
  }

  const isBusy = Boolean(busyAction);
  const saveLabel = useMemo(() => {
    if (saveState === "saving") return "自动保存中...";
    if (saveState === "error") return "保存失败";
    if (saveState === "dirty") return "待保存";
    return "已自动保存";
  }, [saveState]);

  return (
    <div className="min-h-screen bg-ink text-slate-900">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5 px-4 py-5 lg:px-6">
        <ProjectHeader
          backHref={`/projects/${projectId}`}
          backLabel="返回项目详情"
          title={shot ? shot.shot_title : `镜头 #${shotId}`}
        />

        {error ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        {!shot ? (
          <section className="rounded-[28px] border border-dashed border-line bg-panel p-8 text-slate-500 shadow-glow">
            正在加载镜头数据...
          </section>
        ) : (
          <>
            <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
              <div className="rounded-[28px] bg-gradient-to-r from-[#6f67d8] to-[#8b85f3] px-6 py-6 text-white shadow-glow">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white/80">Shot Overview</p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight">{shot.shot_title}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">{shot.shot_description}</p>
                  </div>
                  <StatusBadge
                    status={shot.status}
                    className="border border-white/20 bg-white/10 text-xs font-semibold uppercase tracking-[0.18em] text-white"
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/80">
                  <span className="rounded-full bg-white/10 px-3 py-1">项目 #{shot.project_id}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1">{shot.duration_seconds}s 时长</span>
                  {shot.camera_movement ? <span className="rounded-full bg-white/10 px-3 py-1">{shot.camera_movement}</span> : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                <ShotStatCard label="镜头状态" value={shot.status} tone="purple" badge />
                <ShotStatCard
                  label="首尾帧"
                  value={shot.start_frame_url && shot.end_frame_url ? "已完成" : "待生成"}
                  tone="blue"
                />
                <ShotStatCard label="视频结果" value={shot.video_url ? "已完成" : "待生成"} tone="green" />
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">镜头 Prompt</h2>
                      <p className="mt-1 text-sm text-slate-500">首帧、尾帧和视频提示词都支持直接编辑并自动保存。</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${saveState === "error" ? "text-rose-500" : "text-slate-500"}`}>{saveLabel}</span>
                      <StatusBadge status={shot.status} />
                    </div>
                  </div>
                  <Textarea
                    className="mt-4 min-h-40 rounded-[24px]"
                    value={promptFields.shot_prompt}
                    onChange={(event) => setPromptFields((current) => ({ ...current, shot_prompt: event.target.value }))}
                  />
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <PromptField
                      label="首帧 Prompt"
                      value={promptFields.start_frame_prompt}
                      onChange={(value: any) => setPromptFields((current: any) => ({ ...current, start_frame_prompt: value }))}
                    />
                    <PromptField
                      label="尾帧 Prompt"
                      value={promptFields.end_frame_prompt}
                      onChange={(value: any) => setPromptFields((current: any) => ({ ...current, end_frame_prompt: value }))}
                    />
                  </div>
                  <div className="mt-4">
                    <PromptField
                      label="视频 Prompt"
                      value={promptFields.video_prompt}
                      onChange={(value: any) => setPromptFields((current: any) => ({ ...current, video_prompt: value }))}
                      minHeightClass="min-h-32"
                    />
                  </div>
                  {saveError ? <p className="mt-3 text-sm text-rose-500">{saveError}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <ActionButton
                      icon={busyAction === "generate_frames" ? undefined : IconPhoto}
                      disabled={isBusy}
                      label={busyAction === "generate_frames" ? "生成首尾帧中..." : "生成首尾帧"}
                      onClick={() => run(generateShotFrames, "generate_frames")}
                    />
                    <ActionButton
                      icon={busyAction === "generate_video" ? undefined : IconVideo}
                      disabled={isBusy}
                      label={busyAction === "generate_video" ? "生成视频中..." : "生成视频"}
                      onClick={() => run(generateShotVideo, "generate_video")}
                    />
                    <ActionButton
                      icon={busyAction === "refresh" ? undefined : IconRefresh}
                      disabled={isBusy}
                      label={busyAction === "refresh" ? "刷新中..." : "刷新镜头"}
                      onClick={handleRefresh}
                      variant="ghost"
                    />
                  </div>
                </section>

                <section className="grid gap-5 lg:grid-cols-3">
                  <AssetCard label="首帧" url={shot.start_frame_url} kind="image" />
                  <AssetCard label="尾帧" url={shot.end_frame_url} kind="image" />
                  <AssetCard label="视频结果" url={shot.video_url} kind="video" />
                </section>
              </div>

              <aside className="space-y-5">
                <section className="rounded-[28px] border border-line bg-panel p-5 shadow-glow">
                  <h3 className="text-base font-semibold text-slate-900">镜头摘要</h3>
                  <div className="mt-4 space-y-3">
                    <ShotMetaItem label="所属项目" value={`#${shot.project_id}`} />
                    <ShotMetaItem label="时长" value={`${shot.duration_seconds}s`} />
                    <ShotMetaItem label="镜头运动" value={shot.camera_movement || "未设置"} />
                    <ShotMetaItem label="首帧结果" value={shot.start_frame_url ? "已生成" : "未生成"} />
                    <ShotMetaItem label="尾帧结果" value={shot.end_frame_url ? "已生成" : "未生成"} />
                    <ShotMetaItem label="视频结果" value={shot.video_url ? "已生成" : "未生成"} />
                  </div>
                </section>

                <section className="rounded-[28px] border border-line bg-panel p-5 shadow-glow">
                  <h3 className="text-base font-semibold text-slate-900">使用建议</h3>
                  <div className="mt-4 space-y-3">
                    <p className="rounded-2xl bg-panel2 px-4 py-3 text-sm leading-6 text-slate-600">
                      先调整 Prompt 到稳定版本，再生成首尾帧，最后再触发视频生成，可以减少无效跑图。
                    </p>
                    <p className="rounded-2xl bg-panel2 px-4 py-3 text-sm leading-6 text-slate-600">
                      如果画面方向或动作不稳定，优先补充主体、环境、镜头运动和情绪信息。
                    </p>
                  </div>
                </section>
              </aside>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function ShotStatCard({ label, value, tone = "purple", badge = false }: { label: any; value: any; tone?: string; badge?: boolean }) {
  const toneMap: Record<string, string> = {
    purple: "bg-[#f2efff] text-[#6f67d8]",
    green: "bg-[#eef8ef] text-[#53a56b]",
    blue: "bg-[#eef4ff] text-[#4f79d8]",
  };

  return (
    <article className="rounded-[24px] border border-line bg-panel p-5 shadow-glow">
      <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${toneMap[tone] || toneMap.purple}`}>
        {label}
      </div>
      <div className="mt-4">
        {badge ? <StatusBadge status={value} /> : <p className="text-2xl font-semibold tracking-tight text-slate-900">{value}</p>}
      </div>
    </article>
  );
}

function ShotMetaItem({ label, value }: { label: any; value: any }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-panel2 px-4 py-3">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function PromptField({ label, value, onChange, minHeightClass = "min-h-28" }: { label: any; value: any; onChange: any; minHeightClass?: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <Textarea
        className={`${minHeightClass} rounded-[24px]`}
        value={value}
        placeholder={label === "视频 Prompt" ? "留空时默认跟随镜头 Prompt" : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
