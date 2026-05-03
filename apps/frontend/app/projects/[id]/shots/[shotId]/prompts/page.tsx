"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import { activateShotPrompt, createShotPrompt, generateShot, getShot, listShotPrompts, type Shot, type ShotPrompt, updateShotPromptVersion } from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

export default function ShotPromptsPage() {
  const params = useParams<{ shotId: string; id: string }>();
  const { project } = useProjectWorkspace();
  const [shot, setShot] = useState<Shot | null>(null);
  const [prompts, setPrompts] = useState<ShotPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [promptText, setPromptText] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [status, setStatus] = useState("draft");

  const shotId = Number(params.shotId);

  async function refresh() {
    try {
      const [shotPayload, promptsPayload] = await Promise.all([getShot(shotId), listShotPrompts(shotId)]);
      setShot(shotPayload.shot);
      setPrompts(promptsPayload.prompts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [shotId]);

  if (!project) return null;

  async function handleCreatePrompt() {
    try {
      await createShotPrompt(shotId, {
        promptText,
        negativePrompt,
        status,
        isActive: prompts.length === 0,
      });
      setPromptText("");
      setNegativePrompt("");
      setStatus("draft");
      await refresh();
      toast.success("Prompt 版本已创建");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleActivate(promptId: number) {
    try {
      await activateShotPrompt(promptId);
      await refresh();
      toast.success("Prompt 已激活");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleQuickUpdate(prompt: ShotPrompt) {
    try {
      await updateShotPromptVersion(prompt.id, { status: prompt.status });
      toast.success("Prompt 状态已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleGenerate(prompt: ShotPrompt) {
    try {
      await generateShot(shotId, { shotPromptId: prompt.id });
      toast.success("生成任务已提交");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid gap-5">
      <SectionCard title={shot ? `Shot ${shot.shotNo} Prompt` : "Prompt"} description="Prompt 版本是镜头生成的正式输入，激活后才会被任务读取。">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="mb-2 block text-xs text-gray-500">Prompt 文本</Label>
            <Textarea className="min-h-[140px]" value={promptText} onChange={(e) => setPromptText(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-gray-500">Negative Prompt</Label>
            <Textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-gray-500">状态</Label>
            <Input value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={handleCreatePrompt} disabled={!promptText.trim()}>
              新建 Prompt 版本
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Prompt 版本列表" description="为同一个镜头维护多版提示词，并激活其中一个参与生成。">
        {loading ? (
          <div className="text-sm text-gray-500">Prompt 加载中...</div>
        ) : prompts.length ? (
          <div className="grid gap-3">
            {prompts.map((prompt) => (
              <div key={prompt.id} className="rounded-lg border border-line bg-panel2 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-gray-100">Version {prompt.versionNo}</h3>
                      <StatusPill value={prompt.status} tone="purple" />
                      {prompt.isActive ? <StatusPill value="active" tone="green" /> : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-400 whitespace-pre-wrap">{prompt.promptText}</p>
                    {prompt.negativePrompt ? <p className="mt-3 text-xs text-gray-500">Negative: {prompt.negativePrompt}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!prompt.isActive ? (
                      <Button variant="secondary" size="sm" onClick={() => handleActivate(prompt.id)}>
                        激活
                      </Button>
                    ) : null}
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate(prompt)}>
                      生成
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleQuickUpdate(prompt)}>
                      刷新状态
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="还没有 Prompt 版本" description="先创建至少一个 Prompt 版本，再提交生成任务。" />
        )}
      </SectionCard>
    </div>
  );
}
