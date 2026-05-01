"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { createProject } from "@/src/api";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

const defaultForm = {
  name: "",
  genre: "",
  targetPlatform: "",
  episodeCountPlanned: 30,
  logline: "",
  targetAudience: "",
  genreTags: "",
  styleKeywords: "",
};

function parseCommaList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function CreateProjectDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof typeof defaultForm>(key: K, value: (typeof defaultForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleDismiss() {
    if (submitting) return;
    setError("");
    setForm(defaultForm);
    onClose();
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError("项目名称不能为空");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = await createProject({
        name: form.name.trim(),
        genre: form.genre.trim(),
        targetPlatform: form.targetPlatform.trim(),
        episodeCountPlanned: Math.max(1, form.episodeCountPlanned || 30),
        logline: form.logline.trim(),
        targetAudience: form.targetAudience.trim(),
        genreTags: parseCommaList(form.genreTags),
        styleKeywords: parseCommaList(form.styleKeywords),
      });
      toast.success("项目已创建");
      handleDismiss();
      router.push(`/projects/${payload.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleDismiss()}>
      <DialogContent className="max-w-2xl rounded-[28px] border border-line bg-panel p-0" showCloseButton={!submitting}>
        <DialogHeader className="border-b border-line px-6 py-5">
          <DialogTitle>新建短剧项目</DialogTitle>
          <DialogDescription>
            按新的生产 schema 创建项目。项目会先进入 Brief 阶段，后续在详情页继续补充角色、场景和分集。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 px-6 py-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="mb-2 block text-xs text-slate-500">项目名称</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="例：归墟侯·都市逆袭版" />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-slate-500">题材</Label>
            <Input value={form.genre} onChange={(e) => update("genre", e.target.value)} placeholder="都市逆袭 / 古风复仇 / 悬疑" />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-slate-500">目标平台</Label>
            <Input value={form.targetPlatform} onChange={(e) => update("targetPlatform", e.target.value)} placeholder="抖音 / 快手 / 微信小程序" />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-slate-500">计划集数</Label>
            <Input type="number" value={String(form.episodeCountPlanned)} onChange={(e) => update("episodeCountPlanned", Number(e.target.value || 30))} placeholder="30" />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-slate-500">目标受众</Label>
            <Input value={form.targetAudience} onChange={(e) => update("targetAudience", e.target.value)} placeholder="女频爽剧 / 通勤刷剧用户" />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-2 block text-xs text-slate-500">一句话钩子</Label>
            <Textarea value={form.logline} onChange={(e) => update("logline", e.target.value)} placeholder="一句话说明这部剧的核心冲突和上头点" className="min-h-[110px]" />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-slate-500">题材标签</Label>
            <Input value={form.genreTags} onChange={(e) => update("genreTags", e.target.value)} placeholder="甜宠, 逆袭, 复仇" />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-slate-500">风格关键词</Label>
            <Input value={form.styleKeywords} onChange={(e) => update("styleKeywords", e.target.value)} placeholder="高饱和, 强反差, 快节奏" />
          </div>
          {error ? <div className="md:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}
        </div>

        <DialogFooter className="rounded-b-[28px] border-t border-line bg-panel2/60 px-6 py-4">
          <Button variant="secondary" onClick={handleDismiss} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "创建中..." : "创建项目"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
