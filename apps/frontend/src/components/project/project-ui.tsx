"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

export function StatusPill({ value, tone = "slate", className }: { value: string; tone?: "slate" | "green" | "amber" | "blue" | "purple"; className?: string }) {
  const toneMap = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-violet-100 text-violet-700",
  };
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", toneMap[tone], className)}>{value}</span>;
}

export function SectionCard({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-line bg-panel p-4 shadow-glow">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-[13px] leading-5 text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, meta, tone = "purple" }: { label: string; value: string; meta?: string; tone?: "purple" | "green" | "amber" | "blue" }) {
  const toneMap = {
    purple: "bg-[#f2efff] text-[#6f67d8]",
    green: "bg-[#eef8ef] text-[#53a56b]",
    amber: "bg-[#fff4e3] text-[#d6972f]",
    blue: "bg-[#eef4ff] text-[#4f79d8]",
  };
  return (
    <article className="rounded-[24px] border border-line bg-panel p-5 shadow-glow">
      <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${toneMap[tone]}`}>{label}</div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {meta ? <p className="mt-2 text-xs text-slate-500">{meta}</p> : null}
    </article>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-[24px] border border-dashed border-line bg-panel2 px-5 py-10 text-center">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function KeyValueGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-panel2 px-4 py-3">
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <div className="mt-2 text-sm font-semibold text-slate-800">{item.value}</div>
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
          "group inline-flex min-w-[108px] flex-1 items-center gap-3 rounded-full border px-3 py-2 transition md:flex-none",
          active ? "border-mint bg-mint/10 text-mint shadow-[0_0_0_1px_rgba(112,209,179,0.18)]" : "border-line bg-panel text-slate-700",
          item.disabled ? "cursor-not-allowed opacity-50" : "hover:border-mint/40 hover:bg-white/80",
        );
        const content = (
          <>
            <span
              className={cn(
                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                active ? "bg-mint text-white" : "bg-panel2 text-slate-500 group-hover:text-slate-700",
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-5">{item.label}</span>
              <span className={cn("hidden text-[11px] leading-4 md:block", active ? "text-mint/80" : "text-slate-500")}>
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
