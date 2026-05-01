"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import { createReviewIssue, listReviewIssues, resolveReviewIssue, type ReviewIssue } from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

export default function EpisodeReviewPage() {
  const params = useParams<{ id: string; episodeId: string }>();
  const { project } = useProjectWorkspace();
  const [issues, setIssues] = useState<ReviewIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");

  const episodeId = Number(params.episodeId);
  const episode = project?.episodes.find((item) => item.id === episodeId);

  async function refreshIssues() {
    try {
      const payload = await listReviewIssues(episodeId);
      setIssues(payload.reviewIssues);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshIssues();
  }, [episodeId]);

  if (!project || !episode) return null;
  const currentProject = project;

  async function handleCreateIssue() {
    try {
      await createReviewIssue({
        projectId: currentProject.id,
        episodeId,
        issueType,
        description,
        severity,
      });
      setIssueType("");
      setDescription("");
      setSeverity("medium");
      await refreshIssues();
      toast.success("审核问题已创建");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleResolve(issueId: number) {
    try {
      await resolveReviewIssue(issueId);
      await refreshIssues();
      toast.success("审核问题已标记为已解决");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid gap-5">
      <SectionCard title={`第 ${episode.episodeNo} 集审核`} description="用结构化问题记录生成失败、漂移和返工方向。">
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <Label className="mb-2 block text-xs text-slate-500">问题类型</Label>
            <Input value={issueType} onChange={(e) => setIssueType(e.target.value)} placeholder="人脸漂移 / 情绪不对 / 镜头不稳" />
          </div>
          <div>
            <Label className="mb-2 block text-xs text-slate-500">严重程度</Label>
            <Input value={severity} onChange={(e) => setSeverity(e.target.value)} placeholder="medium" />
          </div>
          <div className="flex items-end">
            <Button onClick={handleCreateIssue} disabled={!issueType.trim()}>
              新增问题
            </Button>
          </div>
          <div className="md:col-span-3">
            <Label className="mb-2 block text-xs text-slate-500">问题描述</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[120px]" />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="问题列表" description="每个问题都会成为返工和版本迭代的输入。">
        {loading ? (
          <div className="text-sm text-slate-500">审核问题加载中...</div>
        ) : issues.length ? (
          <div className="grid gap-3">
            {issues.map((issue) => (
              <div key={issue.id} className="rounded-[24px] border border-line bg-panel2 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">{issue.issueType}</h3>
                      <StatusPill value={issue.severity} tone="amber" />
                      <StatusPill value={issue.resolutionStatus} tone={issue.resolutionStatus === "resolved" ? "green" : "purple"} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{issue.description || "无描述"}</p>
                  </div>
                  {issue.resolutionStatus !== "resolved" ? (
                    <Button variant="secondary" size="sm" onClick={() => handleResolve(issue.id)}>
                      标记已解决
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="还没有审核问题" description="当镜头或任务出现问题时，在这里记录并推动返工。" />
        )}
      </SectionCard>
    </div>
  );
}
