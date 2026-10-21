import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, BarChart3, Bot, CalendarClock, FlaskConical, Gauge, History, Layers, Settings, ShieldAlert, Sigma, Upload, Moon, Sun, LogIn } from "lucide-react";
import { getSettings } from "@/lib/api";
import { cn } from "@/lib/utils";

import { NotificationManager } from "./NotificationManager";

const NAV = [
  { to: "/", id: "Ringkasan", en: "Overview", icon: Gauge },
  { to: "/positions", id: "Posisi Live", en: "Live Positions", icon: Layers },
  { to: "/eas", id: "Papan EA", en: "EA Leaderboard", icon: BarChart3 },
  { to: "/diagnostics", id: "Diagnostik EA", en: "EA Diagnostics", icon: Activity },
  { to: "/trades", id: "Riwayat Trade", en: "Trade History", icon: History },
  { to: "/risk", id: "Risiko", en: "Risk Monitor", icon: ShieldAlert },
  { to: "/imports", id: "Impor CSV", en: "Imports", icon: Upload },
  { to: "/research", id: "Lab Riset", en: "Research Lab", icon: FlaskConical },
  { to: "/simulator", id: "Simulator", en: "Simulator", icon: Sigma },
  { to: "/advisor", id: "AI Advisor", en: "AI Advisor", icon: Bot },
  { to: "/market", id: "Konteks Pasar", en: "Market Context", icon: CalendarClock },
  { to: "/settings", id: "Pengaturan", en: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [dark, setDark] = useState(true);
  const [lang, setLang] = useState<"id" | "en">("id");
  const [s, setS] = useState({ demo: true, apiBase: "", token: "" });

  useEffect(() => {
    const d = localStorage.getItem("xau.theme") !== "light";
    setDark(d);
    setLang((localStorage.getItem("xau.lang") as "id" | "en") || "id");
    const sync = () => setS(getSettings());
    sync();
    window.addEventListener("xau-settings", sync);
    return () => window.removeEventListener("xau-settings", sync);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  if (path === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 border-b px-4 py-3">
          <img src="/logo.svg" alt="EA Advisor" className="size-8 rounded-sm object-contain" />
          <div>
            <div className="num text-sm font-semibold text-gold">XAUUSDc</div>
            <div className="label-xs">Observability Terminal</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={cn("flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent", path === n.to && "bg-sidebar-accent text-sidebar-accent-foreground font-medium")}>
              <n.icon className="size-4" />
              {n[lang]}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3 text-[10px] text-muted-foreground">Observational only — no trade execution.</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-11 items-center gap-3 border-b bg-background/95 px-4">
          <Link to="/" className="flex items-center gap-2 md:hidden">
            <img src="/logo.svg" alt="EA Advisor" className="size-6 object-contain" />
          </Link>
          <select className="rounded-sm border bg-card px-2 py-1 text-xs md:hidden" value={path} onChange={(e) => (window.location.href = e.target.value)}>
            {NAV.map((n) => <option key={n.to} value={n.to}>{n[lang]}</option>)}
          </select>
          {s.demo ? (
            <span className="num rounded-sm border border-warn/50 bg-warn/10 px-2 py-0.5 text-[10px] uppercase text-warn">Demo — simulated data</span>
          ) : (
            <span className="num truncate text-[11px] text-muted-foreground">API: {s.apiBase || "not configured"}</span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <NotificationManager />
            <button className="rounded-sm px-2 py-1 text-xs hover:bg-accent" onClick={() => { const l = lang === "id" ? "en" : "id"; setLang(l); localStorage.setItem("xau.lang", l); }}>{lang.toUpperCase()}</button>
            <button aria-label="Toggle theme" className="rounded-sm p-1.5 hover:bg-accent" onClick={() => { setDark(!dark); localStorage.setItem("xau.theme", dark ? "light" : "dark"); }}>
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            {!s.demo && !s.token && <Link to="/login" className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs hover:bg-accent"><LogIn className="size-3.5" />Login</Link>}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
