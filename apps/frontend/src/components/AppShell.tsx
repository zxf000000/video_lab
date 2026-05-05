"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  IconVideo,
  IconLayoutDashboard,
  IconWand,
  IconSparkles,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconMenu2,
} from "@tabler/icons-react";

const NAV_ITEMS = [
  { label: "项目", icon: IconLayoutDashboard, href: "/" },
  { label: "快速生成", icon: IconWand, href: "/generate-video" },
  { label: "Seedance", icon: IconSparkles, href: "/seedance2" },
  { label: "可灵 Kling", icon: IconSparkles, href: "/kling" },
  { label: "配置", icon: IconSettings, href: "/config" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

const STORAGE_KEY = "sidebar_collapsed";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [time, setTime] = useState("");

  useEffect(() => {
    setTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const sidebarWidth = collapsed ? "w-[72px]" : "w-[200px]";

  return (
    <div className="min-h-screen bg-void text-gray-100">
      <div className="flex">

        {/* ============================================================
            DESKTOP SIDEBAR — cyberpunk vertical nav
            ============================================================ */}
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 ${sidebarWidth} bg-abyss/95 transition-[width] duration-200 lg:flex lg:flex-col relative`}
          style={{
            borderRight: "1px solid #1a1a38",
            boxShadow: "2px 0 15px rgba(0, 240, 255, 0.06), inset -1px 0 0 rgba(0, 240, 255, 0.08)",
          }}
        >
          {/* Top neon accent line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-mint/60 to-transparent" />

          {/* Brand */}
          <div className="flex items-center gap-3 px-4 pt-5 pb-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center relative"
              style={{
                background: "linear-gradient(135deg, rgba(0,240,255,0.15), rgba(255,45,149,0.1))",
                clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
              }}
            >
              <IconVideo size={18} stroke={2} className="text-mint" />
              {/* Live indicator dot */}
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-75 pulse-ring" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
              </span>
            </div>
            {!collapsed && (
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold tracking-[0.15em] text-gray-100 neon-text leading-tight">
                  AI DRAMA
                </span>
                <span className="text-[10px] font-semibold tracking-[0.25em] text-mint/60 leading-tight">
                  LAB
                </span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-line to-transparent" />

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5 px-3 pt-4">
            {NAV_ITEMS.map((item, i) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 relative ${
                    active
                      ? "text-mint"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                  style={active ? {
                    background: "linear-gradient(90deg, rgba(0,240,255,0.08) 0%, rgba(0,240,255,0.02) 100%)",
                    borderLeft: "2px solid #00f0ff",
                    boxShadow: "inset 0 0 20px rgba(0,240,255,0.03)",
                  } : {
                    borderLeft: "2px solid transparent",
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={20} stroke={2} className="shrink-0" />
                  {!collapsed && (
                    <span className="tracking-wide">{item.label}</span>
                  )}
                  {/* Active indicator dot for collapsed */}
                  {collapsed && active && (
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-mint shadow-glow" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="px-3 pb-4 space-y-3">
            {/* Status indicator */}
            {!collapsed && (
              <div className="mx-1 flex items-center gap-2 px-2 text-[10px] text-gray-600">
                <span className="h-1.5 w-1.5 rounded-full bg-neon-green shadow-[0_0_6px_rgba(0,255,136,0.5)]" />
                <span className="tracking-widest">SYS.ONLINE</span>
              </div>
            )}
            <button
              onClick={toggleCollapsed}
              className="flex w-full items-center justify-center py-2 text-gray-600 transition hover:text-mint/70"
              style={{
                background: "rgba(0,240,255,0.03)",
                border: "1px solid rgba(0,240,255,0.06)",
              }}
            >
              {collapsed ? <IconChevronRight size={16} stroke={2} /> : <IconChevronLeft size={16} stroke={2} />}
            </button>
          </div>
        </aside>

        {/* ============================================================
            MOBILE SIDEBAR OVERLAY
            ============================================================ */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside
              className="absolute left-0 top-0 h-full w-[260px] bg-abyss/98 p-5 flex flex-col gap-4"
              style={{
                borderRight: "1px solid #1a1a38",
                boxShadow: "4px 0 30px rgba(0,0,0,0.6)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,240,255,0.15), rgba(255,45,149,0.1))",
                    clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                  }}
                >
                  <IconVideo size={18} stroke={2} className="text-mint" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold tracking-[0.15em] text-gray-100 neon-text leading-tight">
                    AI DRAMA
                  </span>
                  <span className="text-[10px] font-semibold tracking-[0.25em] text-mint/60 leading-tight">LAB</span>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-line to-transparent" />

              <nav className="flex-1 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-3 text-sm font-medium transition ${
                        active
                          ? "text-mint"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                      style={active ? {
                        background: "linear-gradient(90deg, rgba(0,240,255,0.08) 0%, rgba(0,240,255,0.02) 100%)",
                        borderLeft: "2px solid #00f0ff",
                      } : {
                        borderLeft: "2px solid transparent",
                      }}
                    >
                      <Icon size={20} stroke={2} />
                      <span className="tracking-wide">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* ============================================================
            MAIN AREA
            ============================================================ */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Global Header */}
          <header
            className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 lg:px-6 backdrop-blur-xl"
            style={{
              background: "rgba(10,10,24,0.75)",
              borderBottom: "1px solid #1a1a38",
              boxShadow: "0 1px 20px rgba(0, 240, 255, 0.04)",
            }}
          >
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center text-gray-500 transition hover:text-mint lg:hidden"
            >
              <IconMenu2 size={20} stroke={2} />
            </button>
            <button
              onClick={toggleCollapsed}
              className="hidden h-9 w-9 items-center justify-center text-gray-600 transition hover:text-mint/70 lg:flex"
            >
              {collapsed ? <IconChevronRight size={16} stroke={2} /> : <IconChevronLeft size={16} stroke={2} />}
            </button>

            <div className="flex items-center gap-3">
              <span className="text-sm font-bold tracking-[0.15em] text-gray-200">
                AI DRAMA LAB
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-gray-600">
                <span className="h-1 w-1 rounded-full bg-neon-green shadow-[0_0_4px_rgba(0,255,136,0.4)]" />
                v2.0
              </span>
            </div>

            {/* Right accent */}
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden md:inline text-[10px] tracking-[0.15em] text-gray-600">
                {time}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_6px_rgba(0,240,255,0.4)]" />
            </div>
          </header>

          {/* Decorative scan line below header */}
          <div className="h-px bg-gradient-to-r from-transparent via-mint/20 to-transparent" />

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
