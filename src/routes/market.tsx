import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Radio, 
  Flame, 
  Search, 
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { useApi } from "@/lib/api";
import { meta } from "@/lib/meta";
import { PageHeader, Panel, QueryState, SourceBadge } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/market")({
  head: () => meta("Konteks Pasar & Kalender Ekonomi", "Real-time High-Impact News Filter, Economic Calendar, and Macro Risk Monitoring for 14 Expert Advisors."),
  component: Market,
});

type Ev = { 
  id: string; 
  name: string; 
  time: string; 
  currency: string; 
  importance?: string; 
  impact?: string; 
  actual?: string; 
  forecast?: string; 
  previous?: string; 
  source: string;
};

type MarketResponse = {
  configured: boolean;
  safeToTrade?: boolean;
  nextEvent?: string;
  nextEventTime?: string;
  minutesToNextEvent?: number;
  activeRiskWindow?: boolean;
  events: Ev[];
};

export function Market() {
  // Real-time polling every 30 seconds for live macro monitoring
  const q = useApi<MarketResponse>("/market/events", "market", 30_000);
  const [filterType, setFilterType] = useState<"upcoming" | "all" | "past">("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [now, setNow] = useState(Date.now());

  // Local ticker for live countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const events = q.data?.events ?? [];

  // Categorize past vs upcoming based on time
  const categorizedEvents = useMemo(() => {
    const currentIso = new Date(now).toISOString();
    return events.map(e => {
      const eTime = e.time.endsWith("Z") || e.time.includes("+") ? e.time : `${e.time}Z`;
      const isPast = new Date(eTime).getTime() <= now;
      return { ...e, fullIso: eTime, isPast };
    });
  }, [events, now]);

  // Find next upcoming event
  const nextUpcoming = useMemo(() => {
    return categorizedEvents.find(e => !e.isPast);
  }, [categorizedEvents]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return categorizedEvents.filter(e => {
      if (filterType === "upcoming" && e.isPast) return false;
      if (filterType === "past" && !e.isPast) return false;
      if (searchQuery.trim()) {
        const qLower = searchQuery.toLowerCase();
        return e.name.toLowerCase().includes(qLower) || e.currency.toLowerCase().includes(qLower);
      }
      return true;
    });
  }, [categorizedEvents, filterType, searchQuery]);

  // Format countdown string
  const formatCountdown = (targetTime?: string) => {
    if (!targetTime) return "No upcoming event scheduled";
    const diffMs = new Date(targetTime).getTime() - now;
    if (diffMs <= 0) return "Releasing now / In buffer window";
    const diffSec = Math.floor(diffMs / 1000);
    const d = Math.floor(diffSec / 86400);
    const h = Math.floor((diffSec % 86400) / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m left`;
  };

  const isSafe = q.data?.safeToTrade ?? (nextUpcoming ? (new Date(nextUpcoming.fullIso).getTime() - now > 30 * 60 * 1000) : true);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Konteks Pasar & Kalender Makro Real-Time" 
        sub="Pusat intelijen makroekonomi terintegrasi. Memproteksi 14 EA dari spread melebar dan slippage saat rilis berita berdampak tinggi."
        right={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-profit/30 bg-profit/10 px-3 py-1 text-xs font-medium text-profit">
              <Radio className="size-3 animate-pulse" /> Live Telemetry Feed (30s)
            </span>
          </div>
        }
      />

      {/* Top Real-Time Status Banners */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Trading Regime Status */}
        <div className={cn(
          "relative overflow-hidden rounded-lg border p-4 transition-all",
          isSafe ? "border-profit/30 bg-profit/5" : "border-loss/40 bg-loss/10"
        )}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Regim Eksekusi EA
              </div>
              <div className="mt-1 flex items-center gap-2 text-base font-bold">
                {isSafe ? (
                  <>
                    <ShieldCheck className="size-5 text-profit" />
                    <span className="text-profit">SAFE REGIME ACTIVE</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-5 text-loss animate-pulse" />
                    <span className="text-loss">NEWS RISK BUFFER (PAUSED)</span>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {isSafe 
                  ? "Tidak ada berita USD High-Impact dalam radius ±30 menit. 14 EA aktif mengeksekusi sinyal teknikal."
                  : "Berada dalam jendela volatilitas berita tinggi. Pemicu entry ditahan untuk mencegah slippage & fakeout."}
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Next High-Impact Event */}
        <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Agenda Berita Terdekat
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="truncate text-base font-bold text-foreground">
              {nextUpcoming?.name ?? "Tidak ada rilis terdekat"}
            </div>
            <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
              HIGH IMPACT
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Clock className="size-3.5 text-gold" />
            <span className="font-semibold text-gold">
              {nextUpcoming ? formatCountdown(nextUpcoming.fullIso) : "—"}
            </span>
            <span className="text-muted-foreground">
              ({nextUpcoming ? new Date(nextUpcoming.fullIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"})
            </span>
          </div>
        </div>

        {/* Card 3: Protected Asset Pillars */}
        <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cakupan Portofolio Terproteksi
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded border border-gold/30 bg-gold/10 px-2 py-0.5 font-medium text-gold">
              🪙 XAUUSD (8 EA)
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 font-medium text-orange-400">
              ⚡ BTCUSD (3 EA)
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-medium text-cyan-400">
              🛢️ USOIL (3 EA)
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Filter berita otomatis sinkron ke file <code className="text-foreground">news_events.csv</code> di VPS.
          </p>
        </div>
      </div>

      {/* Main Economic Calendar Panel */}
      <Panel 
        title={
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-red-500" />
            <span>Kalender Rilis Berita High-Impact (Verified Feed)</span>
          </div>
        }
        right={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari event (CPI, FOMC, NFP)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-7 w-48 rounded-md border border-input bg-background/50 pl-8 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex rounded-md border p-0.5 text-xs">
              <button
                onClick={() => setFilterType("upcoming")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  filterType === "upcoming" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Upcoming ({categorizedEvents.filter(e => !e.isPast).length})
              </button>
              <button
                onClick={() => setFilterType("past")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  filterType === "past" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Recent Releases
              </button>
              <button
                onClick={() => setFilterType("all")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  filterType === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                All ({categorizedEvents.length})
              </button>
            </div>
          </div>
        }
      >
        <QueryState q={q}>
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <AlertTriangle className="size-7 text-muted-foreground" />
              <div className="font-medium text-foreground">Tidak ada event yang sesuai filter</div>
              <div className="text-xs">Coba ubah kata kunci pencarian atau ganti filter ke "All".</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="label-xs w-36">Waktu (Lokal)</TableHead>
                    <TableHead className="label-xs">Nama Event / Indikator Makro</TableHead>
                    <TableHead className="label-xs w-16">Mata Uang</TableHead>
                    <TableHead className="label-xs w-28">Impact Level</TableHead>
                    <TableHead className="label-xs w-24">Actual</TableHead>
                    <TableHead className="label-xs w-24">Forecast</TableHead>
                    <TableHead className="label-xs w-24">Previous</TableHead>
                    <TableHead className="label-xs w-36">Sumber Terverifikasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="num text-xs">
                  {filteredEvents.map((e) => {
                    const eventDate = new Date(e.fullIso);
                    const isUpcoming = !e.isPast;
                    return (
                      <TableRow key={e.id} className={cn("hover:bg-muted/40", isUpcoming ? "bg-card" : "opacity-85")}>
                        <TableCell className="font-mono text-[11px] whitespace-nowrap">
                          <div>{eventDate.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</div>
                          <div className="text-muted-foreground">
                            {eventDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </TableCell>
                        <TableCell className="font-sans font-medium">
                          <div className="flex items-center gap-2">
                            <span>{e.name}</span>
                            {isUpcoming && (
                              <span className="rounded bg-gold/15 px-1.5 py-0.2 text-[9px] font-semibold text-gold">
                                Upcoming
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-400">
                            {e.currency}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/20">
                            <Flame className="size-2.5 text-red-400" />
                            HIGH
                          </span>
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {e.actual ? (
                            <span className={cn(
                              e.forecast && e.actual > e.forecast ? "text-profit" : 
                              e.forecast && e.actual < e.forecast ? "text-loss" : "text-foreground"
                            )}>
                              {e.actual}
                            </span>
                          ) : (
                            <span className="text-[11px] italic text-muted-foreground">Pending</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">{e.forecast ?? "—"}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{e.previous ?? "—"}</TableCell>
                        <TableCell className="font-sans text-[11px]">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <SourceBadge source="live" />
                            <span className="truncate max-w-[120px]">{e.source}</span>
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
      </Panel>

      {/* Macro Impact Architecture Card */}
      <div className="rounded-lg border border-border bg-card/60 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-gold" />
          Bagaimana Filter Berita Bekerja di Portofolio EA Kita?
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-4 text-xs text-muted-foreground md:grid-cols-3">
          <div className="rounded border bg-background/50 p-3">
            <div className="font-semibold text-foreground">1. Proteksi Volatilitas & Slippage</div>
            <p className="mt-1">
              Saat berita High-Impact dirilis, spread XAUUSD bisa melonjak dari 15 pts ke 80+ pts dan harga bergerak ribuan points dalam hitungan detik. EA menahan eksekusi pada 30 menit sebelum dan sesudah rilis.
            </p>
          </div>
          <div className="rounded border bg-background/50 p-3">
            <div className="font-semibold text-foreground">2. Menjaga Winrate Model M5 & M15</div>
            <p className="mt-1">
              Strategi seperti EA02 Liquidity Sweep dan EA04 FVG membutuhkan struktur market yang bersih. Melompati lonjakan berita menghilangkan false breakout yang sering memicu Stop Loss.
            </p>
          </div>
          <div className="rounded border bg-background/50 p-3">
            <div className="font-semibold text-foreground">3. Otomasi Sepenuhnya di VPS</div>
            <p className="mt-1">
              Data kalender makro disinkronkan langsung ke file <code className="text-foreground">news_events.csv</code>. Setiap tick candle baru pada EA akan memeriksa jadwal rilis secara independen tanpa delay.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
