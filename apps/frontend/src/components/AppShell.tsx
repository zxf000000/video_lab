"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  IconVideo,
  IconLayoutDashboard,
  IconWand,
  IconSparkles,
  IconFileText,
  IconSettings,
  IconTrash,
  IconChevronLeft,
  IconChevronRight,
  IconMenu2,
} from "@tabler/icons-react";

// --- Navigation ---

const NAV_ITEMS = [
  { label: "项目", icon: IconLayoutDashboard, href: "/" },
  { label: "快速生成", icon: IconWand, href: "/generate-video" },
  { label: "Seedance", icon: IconSparkles, href: "/seedance2" },
  { label: "可灵 Kling", icon: IconSparkles, href: "/kling" },
  { label: "提示词", icon: IconFileText, href: "/prompts" },
  { label: "配置", icon: IconSettings, href: "/config" },
  { label: "回收站", icon: IconTrash, href: "/recycle-bin" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

// --- AppShell ---

const STORAGE_KEY = "sidebar_collapsed";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarWidth = collapsed ? "w-[72px]" : "w-[180px]";

  return (
    <div className="min-h-screen bg-ink text-slate-900">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 ${sidebarWidth} border-r border-line bg-panel py-4 shadow-glow transition-[width] duration-200 lg:flex lg:flex-col`}
        >
          <div className="flex items-center gap-3 px-4 pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mint text-white">
              <IconVideo size={18} stroke={2} />
            </div>
            {!collapsed && (
              <span className="text-sm font-semibold tracking-tight text-slate-900">
                Video Lab
              </span>
            )}
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-mint text-white"
                      : "text-slate-500 hover:bg-panel2 hover:text-slate-900"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={20} stroke={2} className="shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="px-3">
            <button
              onClick={toggleCollapsed}
              className="flex w-full items-center justify-center rounded-xl bg-panel2 py-2 text-slate-400 transition hover:text-slate-700"
            >
              {collapsed ? (
                <IconChevronRight size={18} stroke={2} />
              ) : (
                <IconChevronLeft size={18} stroke={2} />
              )}
            </button>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 h-full w-[240px] border-r border-line bg-panel p-4 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mint text-white">
                  <IconVideo size={18} stroke={2} />
                </div>
                <span className="text-sm font-semibold tracking-tight text-slate-900">
                  Video Lab
                </span>
              </div>
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "bg-mint text-white"
                          : "text-slate-500 hover:bg-panel2 hover:text-slate-900"
                      }`}
                    >
                      <Icon size={20} stroke={2} className="shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Global Header */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-panel/80 px-4 py-3 backdrop-blur-xl lg:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-panel2 hover:text-slate-900 lg:hidden"
            >
              <IconMenu2 size={20} stroke={2} />
            </button>
            <button
              onClick={toggleCollapsed}
              className="hidden h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-panel2 hover:text-slate-900 lg:flex"
            >
              {collapsed ? (
                <IconChevronRight size={18} stroke={2} />
              ) : (
                <IconChevronLeft size={18} stroke={2} />
              )}
            </button>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Video Lab
            </span>
          </header>

          {/* Page Content */}
          <main className="flex-1">
            <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-5 px-4 py-5 lg:px-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
