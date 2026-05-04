import React from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { cn } from "@/src/lib/utils";

type ActionButtonVariant = "default" | "primary" | "secondary" | "outline" | "ghost" | "inverted" | "destructive" | "link";

interface ActionButtonProps {
  icon?: React.ComponentType<{ size?: number; stroke?: number }>;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ActionButtonVariant;
  type?: "button" | "submit" | "reset";
  className?: string;
}

export function ActionButton({ icon: Icon, label, onClick, disabled = false, variant = "secondary", type = "button", className = "" }: ActionButtonProps) {
  return (
    <Button variant={variant} disabled={disabled} onClick={onClick} type={type} className={className}>
      {Icon && <Icon size={16} stroke={2} />}
      {label}
    </Button>
  );
}

interface EmptyStateProps {
  text: string;
}

export function EmptyState({ text }: EmptyStateProps) {
  return <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-gray-500">{text}</div>;
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const tones: Record<string, string> = {
    failed: "bg-red-500/10 text-red-400",
    error: "bg-red-500/10 text-red-400",
    succeeded: "bg-emerald-100 text-emerald-400",
    success: "bg-emerald-100 text-emerald-400",
    completed: "bg-emerald-100 text-emerald-400",
    shots_ready: "bg-emerald-100 text-emerald-700",
    outline_ready: "bg-cyan-100 text-cyan-700",
    project_ready: "bg-emerald-100 text-emerald-700",
    screenplay_ready: "bg-cyan-100 text-cyan-700",
    story_ready: "bg-cyan-100 text-cyan-700",
    video_ready: "bg-emerald-100 text-emerald-700",
    frames_ready: "bg-cyan-100 text-cyan-700",
    prompt_updated: "bg-amber-100 text-amber-700",
    planned: "bg-slate-100 text-gray-500",
    draft: "bg-slate-100 text-gray-500",
    queued: "bg-purple-500/10 text-mint",
    running: "bg-purple-500/10 text-mint",
    generating_story: "bg-purple-500/10 text-mint",
    generating_episode_screenplay: "bg-purple-500/10 text-mint",
    generating_characters: "bg-purple-500/10 text-mint",
    generating_scenes: "bg-purple-500/10 text-mint",
    splitting_shots: "bg-purple-500/10 text-mint",
  };

  return (
    <Badge className={cn(tones[status] || "bg-purple-500/10 text-mint", className)}>
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
  if (!src) return null;

  return (
    <Dialog open={!!src} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-[90vw] border-0 bg-transparent p-0 shadow-none ring-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>图片预览</DialogTitle>
          <DialogDescription>查看大图预览。</DialogDescription>
        </DialogHeader>
        <img
          src={src}
          alt={alt || ""}
          className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
        />
      </DialogContent>
    </Dialog>
  );
}
