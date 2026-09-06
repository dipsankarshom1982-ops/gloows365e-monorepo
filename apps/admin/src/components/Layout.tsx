// PATH: apps/admin/src/components/Layout.tsx

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";
// Moderator Authorization audit, Phase 4 — this array used to be defined
// inline here. Extracted into lib/navigation.ts (a dependency-free data
// module) so lib/routePermissions.ts's route guard can share this EXACT
// same path -> permKey mapping without pulling this component's own
// dependencies (framer-motion, react-router-dom, and transitively
// AuthContext -> lib/firebase) into what should be a plain data lookup.
// See lib/navigation.ts's header for the full reasoning. No data changed
// — verbatim move.
import { NAV_GROUPS } from "../lib/navigation";

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user, logout, isSuperAdmin, permissions } = useAuth();

  const EXACT_MATCH_PATHS = ["/ads", "/contests", "/stories", "/skill-battles", "/banners", "/partners", "/badges", "/admins", "/students", "/subscriptions", "/courses", "/practice", "/quizzes", "/daily-streak-quiz"];

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    if (EXACT_MATCH_PATHS.includes(path)) return pathname === path;
    return pathname === path || pathname.startsWith(path + "/");
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <div>
              <p className="text-white font-bold text-sm">GLOOWS365E</p>
              <p className="text-slate-400 text-xs">Admin Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {NAV_GROUPS.map(({ section, items }) => {
            const visibleItems = items.filter(({ permKey }) =>
              hasPermission(isSuperAdmin, permissions, permKey)
            );
            if (!visibleItems.length) return null;
            return (
              <div key={section} className="mb-2">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1.5">
                  {section}
                </p>
                {visibleItems.map(({ path, label }) => (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                      isActive(path)
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 shrink-0">
          <p className="text-slate-400 text-xs truncate mb-2">{user?.email}</p>
          <button
            onClick={logout}
            className="w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}