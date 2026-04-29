import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ApiBaseBadge from "./ApiBaseBadge";
import ProjectGenerationProgress from "./ProjectGenerationProgress";
import { IconArrowLeft, IconRefresh, IconChevronDown } from "@tabler/icons-react";

export default function ProjectHeader({
  project,
  title,
  backHref = "/",
  backLabel = "返回项目首页",
  onRegenerate,
  regenerating = false,
}: any) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  function handleRegenerate(keepStory: boolean) {
    setMenuOpen(false);
    onRegenerate?.(keepStory);
  }

  return (
    <header className="sticky top-5 z-10 rounded-[20px] border border-line bg-panel/80 px-4 py-3 shadow-glow backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-panel2 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900">
          <IconArrowLeft size={14} stroke={2} />
          {backLabel}
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
          {project ? (
            <p className="truncate text-xs text-slate-500">{project.story_prompt}</p>
          ) : null}
        </div>
        {onRegenerate ? (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-mint px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-mint2 disabled:cursor-not-allowed disabled:bg-slate-300"
              onClick={() => setMenuOpen((v) => !v)}
              disabled={!project || regenerating}
            >
              {regenerating ? null : <IconRefresh size={14} stroke={2} />}
              {regenerating ? "重新生成中..." : "重新生成"}
              {regenerating ? null : <IconChevronDown size={12} stroke={2} />}
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-panel shadow-lg">
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-panel2"
                  onClick={() => handleRegenerate(false)}
                >
                  <IconRefresh size={14} stroke={2} className="text-slate-400" />
                  <div>
                    <div className="font-medium">重新生成全部</div>
                    <div className="mt-0.5 text-xs text-slate-400">从剧情开始重新生成所有内容</div>
                  </div>
                </button>
                <button
                  className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-panel2"
                  onClick={() => handleRegenerate(true)}
                >
                  <IconRefresh size={14} stroke={2} className="text-mint" />
                  <div>
                    <div className="font-medium">保留剧情，重新生成后续</div>
                    <div className="mt-0.5 text-xs text-slate-400">保留当前剧情，从剧本化开始重新生成</div>
                  </div>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <ApiBaseBadge className="hidden shrink-0 rounded-full border border-line bg-panel2 px-3 py-1.5 text-[11px] font-medium text-slate-500 sm:inline" />
      </div>
      <ProjectGenerationProgress project={project} compact />
    </header>
  );
}
