"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { href: "/today", label: "今日", icon: "&#9776;" },
  { href: "/log", label: "ログ", icon: "&#128197;" },
  { href: "/templates", label: "ルーティン", icon: "&#128260;" },
  { href: "/settings", label: "設定", icon: "&#9881;" },
];

export default function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-navy-950">
      {/* Desktop Sidebar */}
      <aside className={`hidden flex-col border-r border-navy-700 bg-navy-900 transition-all duration-200 lg:flex ${sidebarCollapsed ? "w-16" : "w-60"}`}>
        <div className={`flex items-center ${sidebarCollapsed ? "justify-center p-4" : "justify-between p-6"}`}>
          {!sidebarCollapsed && (
            <h1 className="text-xl font-bold text-white">
              <span className="text-green-accent">t</span>askuma
            </h1>
          )}
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-navy-700 hover:text-white"
            title={sidebarCollapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {sidebarCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>
        <nav className={`flex-1 ${sidebarCollapsed ? "px-1" : "px-3"}`}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`mb-1 flex items-center rounded-lg text-sm font-medium transition ${
                sidebarCollapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3"
              } ${
                pathname === item.href
                  ? "bg-navy-700 text-green-accent"
                  : "text-gray-400 hover:bg-navy-800 hover:text-white"
              }`}
            >
              <span dangerouslySetInnerHTML={{ __html: item.icon }} />
              {!sidebarCollapsed && item.label}
            </Link>
          ))}
        </nav>
        {!sidebarCollapsed && (
          <div className="border-t border-navy-700 p-4">
            <p className="mb-2 truncate text-xs text-gray-500">{user.email}</p>
            <button
              onClick={handleSignOut}
              className="w-full rounded-lg border border-navy-600 py-2 text-sm text-gray-400 transition hover:bg-navy-800 hover:text-white"
            >
              ログアウト
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile Header */}
        <header className="flex items-center justify-between border-b border-navy-700 bg-navy-900 px-4 py-3 lg:hidden">
          <h1 className="text-lg font-bold text-white">
            <span className="text-green-accent">t</span>askuma
          </h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-gray-400"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="absolute right-0 top-0 h-full w-64 bg-navy-900 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <nav className="mt-12 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                      pathname === item.href
                        ? "bg-navy-700 text-green-accent"
                        : "text-gray-400 hover:bg-navy-800 hover:text-white"
                    }`}
                  >
                    <span dangerouslySetInnerHTML={{ __html: item.icon }} />
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-8 border-t border-navy-700 pt-4">
                <p className="mb-2 truncate text-xs text-gray-500">
                  {user.email}
                </p>
                <button
                  onClick={handleSignOut}
                  className="w-full rounded-lg border border-navy-600 py-2 text-sm text-gray-400 transition hover:bg-navy-800 hover:text-white"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto">{children}</main>

        {/* Mobile Bottom Nav */}
        <nav className="flex border-t border-navy-700 bg-navy-900 lg:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs transition ${
                pathname === item.href
                  ? "text-green-accent"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span
                className="text-lg"
                dangerouslySetInnerHTML={{ __html: item.icon }}
              />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
