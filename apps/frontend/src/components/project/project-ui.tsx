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
    <section className="rounded-[28px] border border-line bg-panel p-6 shadow-glow">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
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
};

export function ProjectStageNav({ items }: { items: ProjectStageNavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const active = item.active ?? (item.href ? pathname === item.href : false);
        const className = cn(
          "rounded-[24px] border px-4 py-4 transition",
          active ? "border-mint bg-mint/10 text-mint" : "border-line bg-panel",
          item.disabled ? "cursor-not-allowed opacity-50" : "hover:border-mint/40 hover:bg-white/80",
        );

        if (!item.href || item.disabled) {
          return (
            <div key={item.id} className={className} aria-disabled="true">
              <div className="text-sm font-semibold">{item.label}</div>
              <p className={cn("mt-1 text-xs", active ? "text-mint/80" : "text-slate-500")}>{item.description}</p>
            </div>
          );
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            className={className}
          >
            <div className="text-sm font-semibold">{item.label}</div>
            <p className={cn("mt-1 text-xs", active ? "text-mint/80" : "text-slate-500")}>{item.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
