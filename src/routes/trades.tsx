import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useApi, useActiveAccount, type ActiveAccount } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { PageHeader, Panel, QueryState, SourceBadge, fmt, signCls } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRight, ArrowUpRight, FilterX } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trades")({
  head: () => meta("Trade History", "Searchable, paginated MT5 trade and deal history with net P/L, R-multiple and source."),
  component: Trades,
});

type TradeItem = ReturnType<typeof demo.trades>[number] & {
  accountId?: string | undefined;
};

const PAGE = 15;

interface FilterState {
  account: "auto" | ActiveAccount | "all";
  symbol: string;
  ea: string;
  side: string;
  outcome: string;
  reason: string;
  source: string;
  search: string;
}

function formatEAName(raw: string) {
  const clean = (raw || "UNKNOWN").trim();
  if (clean.startsWith("EA02V2")) return { code: "EA02V2", label: "Sweep Reclaim V2", color: "text-amber-400" };
  if (clean.startsWith("EA01_BTC")) return { code: "EA01-BTC", label: "Squeeze Breakout", color: "text-orange-400" };
  if (clean.startsWith("EA02_BTC")) return { code: "EA02-BTC", label: "Supertrend Adaptive", color: "text-orange-400" };
  if (clean.startsWith("EA03_BTC")) return { code: "EA03-BTC", label: "Sweep & Reclaim", color: "text-orange-400" };
  if (clean.startsWith("EA01_USOIL")) return { code: "EA01-OIL", label: "Asian Box London", color: "text-cyan-400" };
  if (clean.startsWith("EA02_USOIL")) return { code: "EA02-OIL", label: "VWAP Pullback", color: "text-cyan-400" };
  if (clean.startsWith("EA03_USOIL")) return { code: "EA03-OIL", label: "Donchian Expansion", color: "text-cyan-400" };
  if (clean.startsWith("EA_NEWS_TICKSPEED")) return { code: "NEWS-01", label: "Tick Speed Spike", color: "text-purple-400" };
  if (clean.startsWith("EA_NEWS_SPIKEHUNTER")) return { code: "NEWS-02", label: "Spike Hunter", color: "text-purple-400" };
  if (clean.startsWith("EA01")) return { code: "EA01", label: "Trend Pullback VWAP", color: "text-emerald-400" };
  if (clean.startsWith("EA02")) return { code: "EA02", label: "Liquidity Sweep", color: "text-blue-400" };
  if (clean.startsWith("EA03")) return { code: "EA03", label: "Volatility Breakout", color: "text-indigo-400" };
  if (clean.startsWith("EA04")) return { code: "EA04", label: "Institutional FVG", color: "text-violet-400" };
  if (clean.startsWith("EA05")) return { code: "EA05", label: "London Breakout", color: "text-rose-400" };
  if (clean.startsWith("EA06")) return { code: "EA06", label: "Asian Mean Reversion", color: "text-amber-400" };
  if (clean.startsWith("EA07")) return { code: "EA07", label: "Order Block OTE", color: "text-teal-400" };
  return { code: clean.slice(0, 8), label: clean.slice(8).replace(/^_+/, "") || "Strategy", color: "text-muted-foreground" };
}

function SymbolBadge({ symbol }: { symbol?: string | undefined }) {
  const s = (symbol || "XAUUSD").toUpperCase();
  if (s.includes("XAU") || s.includes("GOLD")) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/25">
        XAUUSD
      </span>
    );
  }
  if (s.includes("BTC")) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/25">
        BTCUSD
      </span>
    );
  }
  if (s.includes("OIL") || s.includes("WTI")) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
        USOIL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider bg-secondary text-secondary-foreground border">
      {s.replace(/m$|c$/i, "")}
    </span>
  );
}

function AccountBadge({ accountId }: { accountId?: string | undefined }) {
  const isReal = (accountId || "real").toLowerCase() === "real";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
        isReal
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
          : "bg-sky-500/10 text-sky-400 border-sky-500/25"
      )}
    >
      {isReal ? "REAL" : "DEMO"}
    </span>
  );
}

function Trades() {
  const globalActiveAcc = useActiveAccount();
  const [f, setF] = useState<FilterState>({
    account: "auto",
    symbol: "",
    ea: "",
    side: "",
    outcome: "",
    reason: "",
    source: "",
    search: "",
  });
  const [page, setPage] = useState(0);

  useEffect(() => {
    setF((prev) => ({ ...prev, account: "auto" }));
    setPage(0);
  }, [globalActiveAcc]);

  const effectiveAccount: ActiveAccount | "all" = f.account === "auto" ? globalActiveAcc : f.account;

  // Build query params targeting the selected account synchronously (zero 1-render lag)
  const qs = useMemo(() => {
    const params = new URLSearchParams();
    params.set("account_id", effectiveAccount);
    if (f.symbol) params.set("symbol", f.symbol);
    if (f.ea) params.set("ea", f.ea);
    params.set("limit", "1000");
    return params.toString();
  }, [effectiveAccount, f.symbol, f.ea]);

  const q = useApi<TradeItem[]>(`/trades?${qs}`, "trades", 10_000);

  // 1. Deduplicate by ID and unique deal signature to eliminate any duplicate MT5 deal logs
  const dedupedTrades = useMemo(() => {
    if (!q.data) return [];
    const seenIds = new Set<number>();
    const seenSignatures = new Set<string>();
    const list: TradeItem[] = [];

    for (const t of q.data) {
      if (seenIds.has(t.id)) continue;

      // Unique deal signature: account + symbol + side + volume + closedAt(minute precision) + net
      const closeKey = (t.closedAt || "").slice(0, 16);
      const sig = `${t.accountId || "real"}_${t.symbol}_${t.side}_${Number(t.volume).toFixed(2)}_${closeKey}_${Number(t.net).toFixed(2)}`;

      if (seenSignatures.has(sig)) continue;

      seenIds.add(t.id);
      seenSignatures.add(sig);
      list.push(t);
    }
    return list;
  }, [q.data]);

  // 2. Apply client filters
  const filtered = useMemo(() => {
    return dedupedTrades.filter((t) => {
      // Account filter
      if (effectiveAccount !== "all") {
        const itemAcc = (t.accountId || "real").toLowerCase();
        if (itemAcc !== effectiveAccount.toLowerCase()) return false;
      }

      // Symbol filter
      if (f.symbol) {
        const itemSym = (t.symbol || "").toUpperCase();
        if (!itemSym.includes(f.symbol.toUpperCase())) return false;
      }

      // EA filter
      if (f.ea) {
        const tEa = t.ea.toUpperCase();
        const fEa = f.ea.toUpperCase();
        const eaMatch =
          ["EA01", "EA02", "EA03"].includes(fEa)
            ? (tEa === fEa || (tEa.startsWith(fEa + "_") && !tEa.includes("_BTC") && !tEa.includes("_USOIL")))
            : (tEa === fEa || tEa.startsWith(fEa + "_") || tEa.includes(fEa));
        if (!eaMatch) return false;
      }

      // Side filter
      if (f.side && t.side !== f.side) return false;

      // Outcome filter
      if (f.outcome) {
        if (f.outcome === "win" && t.net <= 0) return false;
        if (f.outcome === "loss" && t.net > 0) return false;
      }

      // Exit reason filter
      if (f.reason) {
        const rUpper = (t.exitReason || "CLOSED").toUpperCase();
        if (rUpper !== f.reason.toUpperCase()) return false;
      }

      // Source filter
      if (f.source && t.source !== f.source) return false;

      // Search (Ticket ID)
      if (f.search && !String(t.id).includes(f.search.trim())) return false;

      return true;
    });
  }, [dedupedTrades, effectiveAccount, f]);

  // Quick summary stats for filtered trades
  const stats = useMemo(() => {
    const total = filtered.length;
    if (total === 0) return { total: 0, wins: 0, winRate: 0, netPnl: 0, totalLots: 0 };
    const wins = filtered.filter((t) => t.net > 0).length;
    const netPnl = filtered.reduce((acc, t) => acc + (t.net || 0), 0);
    const totalLots = filtered.reduce((acc, t) => acc + (t.volume || 0), 0);
    return {
      total,
      wins,
      winRate: (wins / total) * 100,
      netPnl,
      totalLots,
    };
  }, [filtered]);

  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const hasActiveFilters = Boolean(
    f.symbol || f.ea || f.side || f.outcome || f.reason || f.source || f.search || f.account !== "auto"
  );

  const resetFilters = () => {
    setF({
      account: "auto",
      symbol: "",
      ea: "",
      side: "",
      outcome: "",
      reason: "",
      source: "",
      search: "",
    });
    setPage(0);
  };

  const sel = (k: keyof typeof f, label: string, opts: { value: string; label: string }[]) => (
    <select
      value={f[k]}
      onChange={(e) => {
        setF({ ...f, [k]: e.target.value });
        setPage(0);
      }}
      className="h-8 rounded-sm border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">{label}: All</option>
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trade History"
        sub="Deduplicated, synchronized MT5 deal history with verified account isolation, asset labels, and dynamic R-multiples."
      />

      {/* Quick Summary Chips */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-md border bg-card p-2.5">
          <div className="label-xs text-muted-foreground">Total Trades</div>
          <div className="num mt-0.5 text-base font-semibold">{stats.total}</div>
        </div>
        <div className="rounded-md border bg-card p-2.5">
          <div className="label-xs text-muted-foreground">Win Rate</div>
          <div className="num mt-0.5 text-base font-semibold text-foreground">
            {stats.winRate.toFixed(1)}%{" "}
            <span className="text-[10px] font-normal text-muted-foreground">({stats.wins}/{stats.total})</span>
          </div>
        </div>
        <div className="rounded-md border bg-card p-2.5">
          <div className="label-xs text-muted-foreground">Net Profit/Loss</div>
          <div className={cn("num mt-0.5 text-base font-semibold", signCls(stats.netPnl))}>
            {stats.netPnl >= 0 ? `+$${fmt(stats.netPnl)}` : `-$${fmt(Math.abs(stats.netPnl))}`}
          </div>
        </div>
        <div className="rounded-md border bg-card p-2.5">
          <div className="label-xs text-muted-foreground">Total Volume</div>
          <div className="num mt-0.5 text-base font-semibold text-foreground">
            {stats.totalLots.toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">Lots</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Ticket…"
          className="h-8 w-28 text-xs"
          value={f.search}
          onChange={(e) => {
            setF({ ...f, search: e.target.value });
            setPage(0);
          }}
        />

        <select
          value={effectiveAccount}
          onChange={(e) => {
            const val = e.target.value as ActiveAccount | "all";
            setF({ ...f, account: val === globalActiveAcc ? "auto" : val });
            setPage(0);
          }}
          className="h-8 rounded-sm border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="real">Real Account</option>
          <option value="demo">Demo Account</option>
          <option value="all">All Accounts</option>
        </select>

        {sel("symbol", "Pair", [
          { value: "XAUUSD", label: "XAUUSD (Gold)" },
          { value: "BTCUSD", label: "BTCUSD (Bitcoin)" },
          { value: "USOIL", label: "USOIL (Oil)" },
        ])}

        {sel("ea", "EA", [
          { value: "EA01", label: "EA01 (VWAP Pullback)" },
          { value: "EA02", label: "EA02 (Liquidity Sweep)" },
          { value: "EA02V2", label: "EA02V2 (Sweep Retrace)" },
          { value: "EA03", label: "EA03 (Vol Expansion)" },
          { value: "EA04", label: "EA04 (Institutional FVG)" },
          { value: "EA05", label: "EA05 (London Breakout)" },
          { value: "EA06", label: "EA06 (Asian Mean Rev)" },
          { value: "EA07", label: "EA07 (Order Block OTE)" },
          { value: "EA_NEWS_TICKSPEED", label: "NEWS TickSpeed" },
          { value: "EA_NEWS_SPIKEHUNTER", label: "NEWS SpikeHunter" },
          { value: "EA01_BTC", label: "EA01 BTC (Squeeze)" },
          { value: "EA02_BTC", label: "EA02 BTC (Supertrend)" },
          { value: "EA03_BTC", label: "EA03 BTC (Sweep)" },
          { value: "EA01_USOIL", label: "EA01 Oil (Asian Box)" },
          { value: "EA02_USOIL", label: "EA02 Oil (VWAP Pullback)" },
          { value: "EA03_USOIL", label: "EA03 Oil (Donchian)" },
        ])}

        {sel("side", "Side", [
          { value: "BUY", label: "BUY" },
          { value: "SELL", label: "SELL" },
        ])}

        {sel("outcome", "Outcome", [
          { value: "win", label: "Win" },
          { value: "loss", label: "Loss" },
        ])}

        {sel("reason", "Close Type", [
          { value: "MANUAL", label: "Manual Close" },
          { value: "TP", label: "Take Profit (TP)" },
          { value: "SL", label: "Stop Loss (SL)" },
          { value: "BE", label: "Break Even (BE)" },
        ])}

        {sel("source", "Source", [
          { value: "live", label: "Live" },
          { value: "import", label: "Import" },
        ])}

        {hasActiveFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={resetFilters}
            className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <FilterX className="size-3.5" />
            Reset
          </Button>
        )}
      </div>

      {/* Main Table */}
      <Panel>
        <QueryState q={q} rows={8}>
          <div className="max-h-[65vh] max-w-full overflow-auto touch-pan-x">
            <Table className="min-w-[980px]">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  {[
                    "Ticket",
                    "Account",
                    "Pair",
                    "EA Strategy",
                    "Side",
                    "Vol",
                    "Open",
                    "Close",
                    "Entry",
                    "Exit",
                    "SL",
                    "TP",
                    "Gross",
                    "Comm",
                    "Swap",
                    "Net P/L",
                    "R",
                    "Reason",
                    "Src",
                  ].map((h, i) => (
                    <TableHead key={i} className="label-xs whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody className="num text-xs">
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={19} className="h-28 text-center text-muted-foreground">
                      No trades found matching current filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((t) => {
                    const eaMeta = formatEAName(t.ea);
                    const isBuy = t.side === "BUY";
                    const isWin = t.net > 0;
                    const isLoss = t.net < 0;

                    return (
                      <TableRow key={t.id} className="hover:bg-muted/40 transition-colors">
                        {/* Ticket */}
                        <TableCell className="font-mono text-muted-foreground">{t.id}</TableCell>

                        {/* Account */}
                        <TableCell>
                          <AccountBadge accountId={t.accountId} />
                        </TableCell>

                        {/* Symbol */}
                        <TableCell>
                          <SymbolBadge symbol={t.symbol} />
                        </TableCell>

                        {/* EA Clean Identity */}
                        <TableCell>
                          <div className="flex flex-col min-w-[120px]" title={t.ea}>
                            <span className={cn("font-semibold text-xs", eaMeta.color)}>
                              {eaMeta.code}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {eaMeta.label}
                            </span>
                          </div>
                        </TableCell>

                        {/* Side */}
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 font-semibold",
                              isBuy ? "text-profit" : "text-loss"
                            )}
                          >
                            {isBuy ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                            {t.side}
                          </span>
                        </TableCell>

                        {/* Volume */}
                        <TableCell>{t.volume.toFixed(2)}</TableCell>

                        {/* Timestamps */}
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {t.openedAt ? t.openedAt.slice(5, 16).replace("T", " ") : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {t.closedAt ? t.closedAt.slice(5, 16).replace("T", " ") : "—"}
                        </TableCell>

                        {/* Prices */}
                        <TableCell>{fmt(t.entry)}</TableCell>
                        <TableCell>{fmt(t.exit)}</TableCell>
                        <TableCell className="text-muted-foreground">{fmt(t.sl)}</TableCell>
                        <TableCell className="text-muted-foreground">{fmt(t.tp)}</TableCell>

                        {/* Accounting Breakdown */}
                        <TableCell>{fmt(t.gross)}</TableCell>
                        <TableCell className="text-muted-foreground">{fmt(t.commission)}</TableCell>
                        <TableCell className="text-muted-foreground">{fmt(t.swap)}</TableCell>

                        {/* Net Profit / Loss */}
                        <TableCell
                          className={cn(
                            "font-semibold whitespace-nowrap",
                            signCls(t.net)
                          )}
                        >
                          {t.net > 0 ? `+${fmt(t.net)}` : fmt(t.net)}
                        </TableCell>

                        {/* Dynamic R-Multiple */}
                        <TableCell
                          className={cn(
                            "font-semibold whitespace-nowrap",
                            isWin ? "text-profit" : isLoss ? "text-loss" : "text-muted-foreground"
                          )}
                        >
                          {t.r != null && !Number.isNaN(t.r)
                            ? `${t.r > 0 ? `+${fmt(t.r)}` : fmt(t.r)}R`
                            : "—"}
                        </TableCell>

                        {/* Exit Reason */}
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border uppercase tracking-wider whitespace-nowrap",
                              t.exitReason === "MANUAL"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/35"
                                : t.exitReason === "TP"
                                ? "bg-profit/10 text-profit border-profit/25"
                                : t.exitReason === "SL"
                                ? "bg-loss/10 text-loss border-loss/25"
                                : t.exitReason === "BE"
                                ? "bg-sky-500/15 text-sky-400 border-sky-500/35"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {t.exitReason === "MANUAL" ? "MANUAL CLOSE" : t.exitReason || "CLOSED"}
                          </span>
                        </TableCell>

                        {/* Source */}
                        <TableCell>
                          <SourceBadge source={t.source || "live"} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination & Counter */}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filtered.length} trades
              {dedupedTrades.length !== filtered.length && ` (filtered from ${dedupedTrades.length})`} · page{" "}
              {page + 1} of {Math.max(1, Math.ceil(filtered.length / PAGE))}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(page + 1) * PAGE >= filtered.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </QueryState>
      </Panel>
    </div>
  );
}
