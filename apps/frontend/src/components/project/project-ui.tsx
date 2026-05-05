"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

/* ================================================================
   StatusPill — terminal-style status tag with neon dot
   ================================================================ */

const statusToneMap: Record<string, string> = {
  slate: "bg-gray-900/80 text-gray-400 border-gray-700/50",
  green: "bg-neon-green/5 text-neon-green border-neon-green/20",
  amber: "bg-neon-amber/5 text-neon-amber border-neon-amber/20",
  blue: "bg-mint/5 text-mint border-mint/20",
  purple: "bg-neon-magenta/5 text-neon-magenta border-neon-magenta/20",
};

const statusDotMap: Record<string, string> = {
  slate: "bg-gray-500",
  green: "bg-neon-green shadow-[0_0_6px_rgba(0,255,136,0.5)]",
  amber: "bg-neon-amber shadow-[0_0_6px_rgba(255,180,0,0.5)]",
  blue: "bg-mint shadow-[0_0_6px_rgba(0,240,255,0.5)]",
  purple: "bg-neon-magenta shadow-[0_0_6px_rgba(255,45,149,0.5)]",
};

export function StatusPill({
  value,
  tone = "slate",
  className,
}: {
  value: string;
  tone?: "slate" | "green" | "amber" | "blue" | "purple";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-3 py-1 text-[11px] font-semibold tracking-wider uppercase",
        statusToneMap[tone],
        className,
      )}
      style={{ clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)" }}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDotMap[tone])} />
      {value}
    </span>
  );
}

/* ================================================================
   SectionCard — cyberpunk panel with neon-top accent
   ================================================================ */

export function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className="rounded-none border border-line/60 bg-panel relative overflow-hidden"
      style={{ boxShadow: "0 0 30px rgba(0,240,255,0.04), inset 0 0 30px rgba(0,240,255,0.015)" }}
    >
      {/* Top neon accent bar */}
      <div className="h-px bg-gradient-to-r from-mint/0 via-mint/40 to-mint/0" />

      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold tracking-[0.12em] text-gray-100 flex items-center gap-2">
              <span className="text-mint/60">//</span>
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 text-[12px] leading-5 text-gray-500 tracking-wide">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
        {children}
      </div>

      {/* Bottom neon accent bar */}
      <div className="h-px bg-gradient-to-r from-mint/0 via-mint/20 to-mint/0" />
    </section>
  );
}

/* ================================================================
   StatCard — HUD data display with neon accent
   ================================================================ */

const statToneBorder: Record<string, string> = {
  purple: "border-neon-magenta/30",
  green: "border-neon-green/30",
  amber: "border-neon-amber/30",
  blue: "border-mint/30",
};

const statToneGlow: Record<string, string> = {
  purple: "shadow-glow-magenta",
  green: "shadow-glow-green",
  amber: "shadow-glow-amber",
  blue: "shadow-glow",
};

const statToneAccent: Record<string, string> = {
  purple: "bg-neon-magenta",
  green: "bg-neon-green",
  amber: "bg-neon-amber",
  blue: "bg-mint",
};

export function StatCard({
  label,
  value,
  meta,
  tone = "purple",
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: "purple" | "green" | "amber" | "blue";
}) {
  return (
    <article
      className={cn(
        "border bg-panel/80 p-4 relative overflow-hidden",
        statToneBorder[tone],
        statToneGlow[tone],
      )}
      style={{ clipPath: "polygon(0 6px, 6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)" }}
    >
      {/* Accent line top-left */}
      <div className={cn("absolute top-0 left-0 h-[1px] w-8", statToneAccent[tone])} style={{ opacity: 0.6 }} />
      <div className={cn("absolute top-0 left-0 w-[1px] h-8", statToneAccent[tone])} style={{ opacity: 0.6 }} />

      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold tracking-[0.2em] text-gray-500 uppercase">{label}</span>
        <span className={cn("h-1.5 w-1.5 rounded-full", statToneAccent[tone])}
          style={{ boxShadow: `0 0 6px currentColor` }}
        />
      </div>

      <p
        className="text-4xl font-bold tracking-tight text-gray-100"
        style={{ fontFamily: "var(--font-mono), monospace" }}
      >
        {value}
      </p>

      {meta ? (
        <p className="mt-2 text-[10px] tracking-widest text-gray-600 uppercase">{meta}</p>
      ) : null}
    </article>
  );
}

/* ================================================================
   EmptyState — void with dashed border
   ================================================================ */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-line/60 bg-abyss/50 px-5 py-12 text-center">
      <div className="inline-flex items-center justify-center h-12 w-12 mb-4 bg-mint/5"
        style={{ clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)" }}>
        <span className="text-mint/40 text-xl">&lt;/&gt;</span>
      </div>
      <h3 className="text-sm font-bold tracking-wide text-gray-300">{title}</h3>
      <p className="mt-2 text-[12px] text-gray-600 tracking-wide">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ================================================================
   KeyValueGrid — terminal data display
   ================================================================ */

export function KeyValueGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="border border-line/40 bg-abyss/60 px-2.5 py-2"
          style={{ clipPath: "polygon(0 4px, 4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)" }}
        >
          <p className="text-[9px] font-semibold tracking-[0.15em] text-gray-600 uppercase">{item.label}</p>
          <div className="mt-1 text-sm font-bold text-gray-200" style={{ fontFamily: "var(--font-mono), monospace" }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   ProjectStageNav — cyberpunk step navigation
   ================================================================ */

type ProjectStageNavItem = {
  id: string;
  href?: string;
  label: string;
  description: string;
  disabled?: boolean;
  active?: boolean;
  matchPrefixes?: string[];
};

export function ProjectStageNav({ items }: { items: ProjectStageNavItem[] }) {
  const pathname = usePathname();
  const matchLengths = items.map((item) => {
    const matches = [item.href, ...(item.matchPrefixes ?? [])].filter(Boolean) as string[];
    let best = -1;
    for (const match of matches) {
      if (pathname === match || pathname.startsWith(match)) {
        best = Math.max(best, match.length);
      }
    }
    return best;
  });
  const strongestMatch = Math.max(...matchLengths, -1);

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => {
        const active = item.active ?? (matchLengths[index] > -1 && matchLengths[index] === strongestMatch);
        const className = cn(
          "group inline-flex min-w-0 flex-1 items-center gap-1.5 border px-2.5 py-1.5 transition-all duration-200 md:flex-none relative",
          active
            ? "border-mint/50 bg-mint/5 text-mint"
            : "border-line/40 bg-transparent text-gray-500",
          item.disabled
            ? "cursor-not-allowed opacity-40"
            : active
              ? "hover:border-mint/70 hover:bg-mint/8"
              : "hover:border-line hover:text-gray-300",
        );

        const content = (
          <>
            <span
              className={cn(
                "inline-flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-bold",
                active
                  ? "bg-mint text-void"
                  : "bg-panel2/60 text-gray-500 group-hover:text-gray-300",
              )}
              style={active ? { clipPath: "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)" } : undefined}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-semibold tracking-wide leading-4">
                {item.label}
              </span>
              <span
                className={cn(
                  "hidden text-[9px] leading-3 tracking-wider md:block",
                  active ? "text-mint/60" : "text-gray-600",
                )}
              >
                {item.description}
              </span>
            </span>
          </>
        );

        // Active indicator — top neon line
        const activeLine = active && (
          <div className="absolute top-0 left-1 right-1 h-px bg-gradient-to-r from-mint/0 via-mint to-mint/0" />
        );

        if (!item.href || item.disabled) {
          return (
            <div key={item.id} className={cn(className, "flex-col")} aria-disabled="true">
              {activeLine}
              <div className="flex items-center gap-1.5">{content}</div>
            </div>
          );
        }

        return (
          <Link key={item.id} href={item.href} className={className}>
            {activeLine}
            {content}
          </Link>
        );
      })}
    </div>
  );
}
