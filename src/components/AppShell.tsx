import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { Activity, BarChart3, Bot, CalendarClock, FlaskConical, Gauge, History, Layers, Settings, ShieldAlert, Sigma, Upload, Moon, Sun, LogIn, Loader2, RefreshCw } from "lucide-react";
import { getSettings, getActiveAccount, setActiveAccount, useActiveAccount, type ActiveAccount } from "@/lib/api";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: ["api"] });
  const [dark, setDark] = useState(true);
  const [lang, setLang] = useState<"id" | "en">("id");
  const [s, setS] = useState({ demo: false, apiBase: "", token: "" });
  const activeAcc = useActiveAccount();

  const handleSwitch = (target: ActiveAccount) => {
    setActiveAccount(target);
    queryClient.invalidateQueries({ queryKey: ["api"] });
  };

  useEffect(() => {
    const d = localStorage.getItem("xau.theme") !== "light";
    setDark(d);
    setLang((localStorage.getItem("xau.lang") as "id" | "en") || "id");
    const sync = () => setS(getSettings());
    sync();
    window.addEventListener("xau-settings", sync);

    return () => {
      window.removeEventListener("xau-settings", sync);
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  if (path === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 border-b px-4 py-3">
          <img src="/logo.svg" alt="EA Advisor" className="size-8 rounded-sm object-contain" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="num text-sm font-semibold text-gold">MULTI-ASSET</span>
              <span className="rounded-xs border border-border bg-muted/60 px-1 py-0.2 text-[9px] font-mono text-muted-foreground">3 PAIR</span>
            </div>
            <div className="label-xs text-[10px] text-muted-foreground">XAU · BTC · USOIL Suite</div>
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
      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-20 flex h-12 w-full max-w-full items-center justify-between gap-1.5 sm:gap-3 border-b bg-background/95 backdrop-blur px-2.5 sm:px-4">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/" className="flex items-center gap-1.5 shrink-0 md:hidden">
              <img src="/logo.svg" alt="EA Advisor" className="size-6 object-contain" />
            </Link>
            <select
              className="rounded-sm border bg-card px-1.5 py-1 text-xs md:hidden max-w-[110px] sm:max-w-[140px] truncate"
              value={path}
              onChange={(e) => navigate({ to: e.target.value })}
            >
              {NAV.map((n) => <option key={n.to} value={n.to}>{n[lang]}</option>)}
            </select>
          </div>

          {/* Account Switcher: Real vs Demo */}
          <div className="flex items-center rounded-sm border border-border bg-card p-0.5 text-xs shadow-xs shrink-0">
            <button
              type="button"
              onClick={() => handleSwitch("real")}
              className={cn(
                "flex items-center gap-1 sm:gap-1.5 rounded-xs px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-semibold transition-all cursor-pointer select-none",
                activeAcc === "real"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <span className={cn("size-1.5 sm:size-2 rounded-full", activeAcc === "real" ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40")} />
              <span>REAL<span className="hidden sm:inline"> ($100)</span></span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitch("demo")}
              className={cn(
                "flex items-center gap-1 sm:gap-1.5 rounded-xs px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-semibold transition-all cursor-pointer select-none",
                activeAcc === "demo"
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <span className={cn("size-1.5 sm:size-2 rounded-full", activeAcc === "demo" ? "bg-cyan-400 animate-pulse" : "bg-muted-foreground/40")} />
              <span>DEMO</span>
            </button>
            {isFetching > 0 && (
              <span title="Syncing data..." className="flex items-center px-0.5 sm:px-1 text-muted-foreground/60 animate-pulse">
                <Loader2 className="size-2.5 animate-spin" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Refresh data"
              title="Refresh / Sync Data"
              onClick={() => queryClient.invalidateQueries()}
              className="rounded-sm p-1 sm:p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <RefreshCw className={cn("size-3.5 sm:size-4", isFetching > 0 && "animate-spin text-primary")} />
            </button>
            <NotificationManager />
            <button className="rounded-sm px-1.5 py-0.5 sm:px-2 sm:py-1 text-[11px] sm:text-xs hover:bg-accent" onClick={() => { const l = lang === "id" ? "en" : "id"; setLang(l); localStorage.setItem("xau.lang", l); }}>{lang.toUpperCase()}</button>
            <button aria-label="Toggle theme" className="rounded-sm p-1 sm:p-1.5 hover:bg-accent" onClick={() => { setDark(!dark); localStorage.setItem("xau.theme", dark ? "light" : "dark"); }}>
              {dark ? <Sun className="size-3.5 sm:size-4" /> : <Moon className="size-3.5 sm:size-4" />}
            </button>
            {!s.demo && !s.token && <Link to="/login" className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 sm:px-2 sm:py-1 text-[11px] sm:text-xs hover:bg-accent"><LogIn className="size-3 sm:size-3.5" /><span className="hidden sm:inline">Login</span></Link>}
          </div>
        </header>
        <main className="flex-1 w-full max-w-full min-w-0 overflow-x-hidden p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
