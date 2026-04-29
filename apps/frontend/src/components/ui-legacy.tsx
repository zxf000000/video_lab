import React, { useEffect } from "react";
import { IconX } from "@tabler/icons-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "@/src/lib/utils";

interface ActionButtonProps {
  icon?: React.ComponentType<{ size?: number; stroke?: number }>;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: string;
  type?: "button" | "submit" | "reset";
  className?: string;
}

export function ActionButton({ icon: Icon, label, onClick, disabled = false, variant = "secondary", type = "button", className = "" }: ActionButtonProps) {
  return (
    <Button variant={variant as any} disabled={disabled} onClick={onClick} type={type} className={className}>
      {Icon && <Icon size={16} stroke={2} />}
      {label}
    </Button>
  );
}

interface EmptyStateProps {
  text: string;
}

export function EmptyState({ text }: EmptyStateProps) {
  return <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-slate-500">{text}</div>;
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const tones: Record<string, string> = {
    failed: "bg-rose-100 text-rose-600",
    error: "bg-rose-100 text-rose-600",
    succeeded: "bg-emerald-100 text-emerald-600",
    success: "bg-emerald-100 text-emerald-600",
    completed: "bg-emerald-100 text-emerald-600",
    shots_ready: "bg-emerald-100 text-emerald-700",
    story_ready: "bg-cyan-100 text-cyan-700",
    video_ready: "bg-emerald-100 text-emerald-700",
    frames_ready: "bg-cyan-100 text-cyan-700",
    prompt_updated: "bg-amber-100 text-amber-700",
    planned: "bg-slate-100 text-slate-500",
    draft: "bg-slate-100 text-slate-500",
    queued: "bg-[#f2efff] text-mint",
    running: "bg-[#f2efff] text-mint",
    generating_story: "bg-[#f2efff] text-mint",
    generating_characters: "bg-[#f2efff] text-mint",
    generating_scenes: "bg-[#f2efff] text-mint",
    splitting_shots: "bg-[#f2efff] text-mint",
  };

  return (
    <Badge className={cn(tones[status] || "bg-[#f2efff] text-mint", className)}>
      {status}
    </Badge>
  );
}

export function ComingSoonBadge() {
  return (
    <Badge className="bg-ember/20 text-ember">即将推出</Badge>
  );
}

interface ImageViewerProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
  useEffect(() => {
    if (!src) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <img
        src={src}
        alt={alt || ""}
        className="relative z-10 max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <IconX size={16} stroke={2} />
      </button>
    </div>
  );
}
