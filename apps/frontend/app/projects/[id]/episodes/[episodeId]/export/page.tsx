"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import { createEpisodeExport, listEpisodeExports, renderEpisodeExport, type EpisodeExport } from "@/src/api";
import { useProjectWorkspace } from "@/src/components/project/ProjectWorkspaceContext";
import { EmptyState, SectionCard, StatusPill } from "@/src/components/project/project-ui";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

export default function EpisodeExportPage() {
  const params = useParams<{ id: string; episodeId: string }>();
  const { project } = useProjectWorkspace();
  const [exportsList, setExportsList] = useState<EpisodeExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState("");
  const [exportUrl, setExportUrl] = useState("");

  const episodeId = Number(params.episodeId);
  const episode = project?.episodes.find((item) => item.id === episodeId);

  async function refreshExports() {
    try {
      const payload = await listEpisodeExports(episodeId);
      setExportsList(payload.exports);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshExports();
  }, [episodeId]);

  if (!project || !episode) return null;

  async function handleCreateExport() {
    try {
      await createEpisodeExport(episodeId, {});
      await refreshExports();
      toast.success("导出版本已创建");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRender(exportId: number) {
    try {
      await renderEpisodeExport(exportId, { previewUrl, exportUrl, status: "exported" });
      await refreshExports();
      toast.success("导出状态已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="grid gap-5">
      <SectionCard title={`第 ${episode.episodeNo} 集导出`} description="用导出版本记录单集交付、预览链接和成片链接。">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[240px] flex-1">
            <Label className="mb-2 block text-xs text-slate-500">预览链接</Label>
            <Input value={previewUrl} onChange={(e) => setPreviewUrl(e.target.value)} placeholder="/assets/preview.mp4" />
          </div>
          <div className="min-w-[240px] flex-1">
            <Label className="mb-2 block text-xs text-slate-500">导出链接</Label>
            <Input value={exportUrl} onChange={(e) => setExportUrl(e.target.value)} placeholder="/assets/final.mp4" />
          </div>
          <Button onClick={handleCreateExport}>新增导出版本</Button>
        </div>
      </SectionCard>

      <SectionCard title="导出版本列表" description="维护每一版单集交付物，记录版本号、状态和最终链接。">
        {loading ? (
          <div className="text-sm text-slate-500">导出版本加载中...</div>
        ) : exportsList.length ? (
          <div className="grid gap-3">
            {exportsList.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-line bg-panel2 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">Version {item.versionNo}</h3>
                      <StatusPill value={item.status} tone={item.status === "exported" ? "green" : "purple"} />
                    </div>
                    <div className="mt-3 text-sm leading-6 text-slate-600">
                      <p>Preview: {item.previewUrl || "未填写"}</p>
                      <p>Export: {item.exportUrl || "未填写"}</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => handleRender(item.id)}>
                    更新导出
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="还没有导出版本" description="当一集可以交付时，在这里创建导出版本并记录链接。" />
        )}
      </SectionCard>
    </div>
  );
}
