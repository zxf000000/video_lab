"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

export function StatusPill({ value, tone = "slate", className }: { value: string; tone?: "slate" | "green" | "amber" | "blue" | "purple"; className?: string }) {
  const toneMap = {
    slate: "bg-gray-800 text-gray-300",
    green: "bg-emerald-500/100/15 text-emerald-400",
    amber: "bg-amber-500/15 text-amber-400",
    blue: "bg-cyan-500/15 text-cyan-400",
    purple: "bg-purple-500/15 text-purple-400",
  };
  return <span className={cn("inline-flex rounded-sm px-3 py-1 text-xs font-semibold", toneMap[tone], className)}>{value}</span>;
}

export function SectionCard({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4 shadow-glow">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-100">{title}</h2>
          {description ? <p className="mt-1 text-[13px] leading-5 text-gray-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, meta, tone = "purple" }: { label: string; value: string; meta?: string; tone?: "purple" | "green" | "amber" | "blue" }) {
  const toneMap = {
    purple: "bg-purple-500/10 text-purple-400",
    green: "bg-emerald-500/100/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    blue: "bg-cyan-500/10 text-cyan-400",
  };
  return (
    <article className="rounded-lg border border-line bg-panel p-5 shadow-glow">
      <div className={`inline-flex rounded-sm px-3 py-1 text-[11px] font-semibold ${toneMap[tone]}`}>{label}</div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-gray-100">{value}</p>
      {meta ? <p className="mt-2 text-xs text-gray-500">{meta}</p> : null}
    </article>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-panel2 px-5 py-10 text-center">
      <h3 className="text-base font-semibold text-gray-100">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function KeyValueGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-panel2 px-2.5 py-1.5">
          <p className="text-[10px] font-medium text-gray-500">{item.label}</p>
          <div className="text-sm font-semibold text-gray-200">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

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
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => {
        const active = item.active ?? (matchLengths[index] > -1 && matchLengths[index] === strongestMatch);
        const className = cn(
          "group inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-sm border px-2 py-1 transition md:flex-none",
          active ? "border-mint bg-mint/10 text-mint shadow-[0_0_0_1px_rgba(112,209,179,0.18)]" : "border-line bg-panel text-gray-400",
          item.disabled ? "cursor-not-allowed opacity-50" : "hover:border-mint/40 hover:bg-panel/5",
        );
        const content = (
          <>
            <span
              className={cn(
                "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-semibold",
                active ? "bg-mint text-gray-900" : "bg-panel2 text-gray-500 group-hover:text-gray-300",
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold leading-4">{item.label}</span>
              <span className={cn("hidden text-[10px] leading-3 md:block", active ? "text-mint/80" : "text-gray-500")}>
                {item.description}
              </span>
            </span>
          </>
        );

        if (!item.href || item.disabled) {
          return (
            <div key={item.id} className={className} aria-disabled="true">{content}</div>
          );
        }

        return (
          <Link key={item.id} href={item.href} className={className}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
