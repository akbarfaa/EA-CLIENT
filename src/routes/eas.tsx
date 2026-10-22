import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { HealthBadge, PageHeader, Panel, QueryState, ago, fmt, pct, signCls } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/eas")({
  head: () => meta("EA Leaderboard", "Compare EA instances by P/L, profit factor, drawdown, sample size and health."),
  component: Eas,
});

type E = ReturnType<typeof demo.eas>[number];
type AssetFilter = "ALL" | "XAU" | "BTC" | "USOIL";
const MIN_SAMPLE = 100;
const COLS: [keyof E, string][] = [
  ["netPnl", "Net P/L"],
  ["floating", "Float"],
  ["trades", "Trades"],
  ["winRate", "Win%"],
  ["pf", "PF"],
  ["expectancy", "Exp."],
  ["avgWin", "Avg W"],
  ["avgLoss", "Avg L"],
  ["maxDd", "Max DD%"],
  ["avgR", "Avg R"],
  ["positions", "Pos"],
];

interface TelemetryEventItem {
  id: string;
  t: string;
  ea: string;
  type: string;
  status: string;
  msg: string;
}

const getAsset = (name: string, strategy: string = "") => {
  const str = (name + " " + strategy).toUpperCase();
  if (str.includes("BTC")) return "BTC";
  if (str.includes("USOIL") || str.includes("OIL") || str.includes("CRUDE")) return "USOIL";
  return "XAU";
};

function Eas() {
  const q = useApi<E[]>("/eas", "eas", 3_000);
  const eventsQ = useApi<TelemetryEventItem[]>("/telemetry/events?limit=100", "events", 3_000);
  const [sort, setSort] = useState<keyof E>("pf");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("ALL");

  const events = eventsQ.data ?? [];

  // Parse active orders and closed deals per EA from live telemetry events
  const closedDealsByEA: Record<string, { ticket: number; net: number; side: string }[]> = {};
  const activeOrdersByEA = new Set<string>();

  for (const evt of [...events].reverse()) {
    const eaTag = (evt.ea || "").toUpperCase();
    if (evt.type === "order" && evt.status === "pass") {
      activeOrdersByEA.add(eaTag);
    } else if (evt.type === "deal" || evt.type === "deal_closed") {
      activeOrdersByEA.delete(eaTag);

      const tMatch = evt.msg.match(/Ticket=(\d+)/);
      const netMatch = evt.msg.match(/Net=([+-]?[\d.]+)/);
      const sideMatch = evt.msg.match(/\b(BUY|SELL)\b/);
      if (tMatch?.[1] && netMatch?.[1]) {
        const ticketStr = tMatch[1];
        const netStr = netMatch[1];
        const sideStr = sideMatch?.[1] ?? "BUY";
        const eaDeals = closedDealsByEA[eaTag] ?? [];
        closedDealsByEA[eaTag] = eaDeals;
        const ticket = parseInt(ticketStr, 10);
        if (!eaDeals.some((d) => d.ticket === ticket)) {
          eaDeals.push({
            ticket,
            net: parseFloat(netStr),
            side: sideStr,
          });
        }
      }
    }
  }

  const rows = [...(q.data ?? [])].map((ea) => {
    // Pair-safe matching helper to prevent cross-asset collision (e.g. EA01 Gold vs EA01_BTC vs EA01_USOIL)
    const matchesEA = (tag: string) => {
      const t = tag.toUpperCase();
      const id = ea.id.toUpperCase();
      const name = ea.name.toUpperCase();
      if (t === id || t === name) return true;
      if (t.includes(name) || name.includes(t)) {
        if (id.includes("_BTC") && !t.includes("BTC")) return false;
        if (id.includes("_USOIL") && !t.includes("USOIL") && !t.includes("OIL")) return false;
        if (!id.includes("_BTC") && !id.includes("_USOIL") && (t.includes("BTC") || t.includes("USOIL") || t.includes("OIL"))) return false;
        return true;
      }
      return false;
    };

    const eaKey = Object.keys(closedDealsByEA).find((k) => matchesEA(k));
    const deals: { ticket: number; net: number; side: string }[] =
      (eaKey ? closedDealsByEA[eaKey] : undefined) ?? [];

    let netPnl = ea.netPnl;
    let trades = ea.trades;
    let winRate = ea.winRate;
    let pf = ea.pf;
    let avgWin = ea.avgWin;
    let avgLoss = ea.avgLoss;
    let expectancy = ea.expectancy;
    let longs = ea.longs;
    let shorts = ea.shorts;

    // If live events have closed trades that haven't been populated in backend table yet
    if (deals.length > 0 && trades < deals.length) {
      trades = deals.length;
      netPnl = deals.reduce((acc, d) => acc + d.net, 0);
      const wins = deals.filter((d) => d.net > 0);
      const losses = deals.filter((d) => d.net < 0);
      winRate = wins.length / trades;
      const grossW = wins.reduce((acc, d) => acc + d.net, 0);
      const grossL = Math.abs(losses.reduce((acc, d) => acc + d.net, 0));
      pf = grossL > 0 ? grossW / grossL : grossW > 0 ? 1.5 : 0;
      avgWin = wins.length > 0 ? grossW / wins.length : 0;
      avgLoss = losses.length > 0 ? -grossL / losses.length : 0;
      expectancy = netPnl / trades;
      longs = deals.filter((d) => d.side === "BUY").length;
      shorts = deals.filter((d) => d.side === "SELL").length;
    }

    // Determine accurate floating and positions
    const isActive = Array.from(activeOrdersByEA).some((k) => matchesEA(k));

    let positions = ea.positions;
    let floating = ea.floating;

    if (isActive) {
      positions = Math.max(positions, 1);
    } else if (ea.positions === 0) {
      positions = 0;
      floating = 0;
    }

    return {
      ...ea,
      netPnl,
      trades,
      winRate,
      pf,
      avgWin,
      avgLoss,
      expectancy,
      positions,
      floating,
      longs,
      shorts,
    };
  }).sort((a, b) => (b[sort] as number) - (a[sort] as number));

  const displayedRows = rows.filter((e) => {
    if (assetFilter === "ALL") return true;
    return getAsset(e.name, e.strategy) === assetFilter;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="EA Leaderboard"
        sub={`Multi-asset quantitative performance. Results with fewer than ${MIN_SAMPLE} trades are labelled insufficient evidence.`}
        right={
          <div className="flex items-center rounded-sm border bg-card p-0.5 text-xs shadow-xs">
            {(
              [
                { id: "ALL", label: `All EAs (${rows.length})` },
                { id: "XAU", label: `Gold (${rows.filter((r) => getAsset(r.name, r.strategy) === "XAU").length})` },
                { id: "BTC", label: `Bitcoin (${rows.filter((r) => getAsset(r.name, r.strategy) === "BTC").length})` },
                { id: "USOIL", label: `Crude Oil (${rows.filter((r) => getAsset(r.name, r.strategy) === "USOIL").length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAssetFilter(tab.id)}
                className={cn(
                  "rounded-xs px-2.5 py-1 text-xs font-medium transition-colors",
                  assetFilter === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />
      <Panel title={`Instances (${displayedRows.length} active)`}>
        <QueryState q={q}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="label-xs">EA</TableHead>
                <TableHead className="label-xs">Health</TableHead>
                {COLS.map(([k, l]) => (
                  <TableHead
                    key={k}
                    className="label-xs cursor-pointer hover:text-foreground"
                    onClick={() => setSort(k)}
                  >
                    {l}
                    {sort === k && " ↓"}
                  </TableHead>
                ))}
                <TableHead className="label-xs">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="num text-xs">
              {displayedRows.map((e) => {
                const asset = getAsset(e.name, e.strategy);
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-sans font-medium">
                        <span>{e.name}</span>
                        <span className="text-muted-foreground font-normal">v{e.version}</span>
                        {asset === "XAU" && (
                          <span className="num rounded-xs border border-gold/40 bg-gold/10 px-1 py-0.2 text-[9px] font-semibold text-gold">
                            XAU
                          </span>
                        )}
                        {asset === "BTC" && (
                          <span className="num rounded-xs border border-amber-500/40 bg-amber-500/10 px-1 py-0.2 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                            BTC
                          </span>
                        )}
                        {asset === "USOIL" && (
                          <span className="num rounded-xs border border-emerald-500/40 bg-emerald-500/10 px-1 py-0.2 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                            USOIL
                          </span>
                        )}
                      </div>
                      <div className="font-sans text-[10px] text-muted-foreground">
                        {e.strategy} · #{e.magic}
                      </div>
                    </TableCell>
                    <TableCell>
                      <HealthBadge h={e.health} />
                      <div className="text-[10px] text-muted-foreground">{ago(e.heartbeat)}</div>
                    </TableCell>
                    <TableCell className={signCls(e.netPnl)}>{fmt(e.netPnl)}</TableCell>
                    <TableCell className={signCls(e.floating)}>{fmt(e.floating)}</TableCell>
                    <TableCell>{e.trades}</TableCell>
                    <TableCell>{pct(e.winRate)}</TableCell>
                    <TableCell>{fmt(e.pf)}</TableCell>
                    <TableCell>{fmt(e.expectancy)}</TableCell>
                    <TableCell className="text-profit">{fmt(e.avgWin)}</TableCell>
                    <TableCell className="text-loss">{fmt(e.avgLoss)}</TableCell>
                    <TableCell>{fmt(e.maxDd)}</TableCell>
                    <TableCell>{fmt(e.avgR)}</TableCell>
                    <TableCell>{e.positions}</TableCell>
                    <TableCell>
                      {e.trades < MIN_SAMPLE ? (
                        <span className="text-warn">Insufficient (n={e.trades})</span>
                      ) : (
                        <span className="text-muted-foreground">n={e.trades}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </QueryState>
      </Panel>
      <div className="grid gap-3 md:grid-cols-3">
        {displayedRows.map((e) => (
          <Panel key={e.id} title={`${e.name} — skipped / rejected entries`}>
            <div className="space-y-1 text-xs">
              {Object.entries(e.skipped || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="num">{v}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">Long / Short</span>
                <span className="num">
                  {e.longs} / {e.shorts}
                </span>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
