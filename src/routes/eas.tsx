import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { HealthBadge, PageHeader, Panel, QueryState, ago, fmt, pct, signCls } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getAsset, formatEaDisplayName } from "@/lib/ea-utils";

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


function Eas() {
  const q = useApi<E[]>("/eas", "eas", 3_000);
  const [sort, setSort] = useState<keyof E>("pf");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("ALL");
  const rows = [...(q.data ?? [])].sort((a, b) => (b[sort] as number) - (a[sort] as number));

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
          <div className="flex items-center rounded-sm border bg-card p-0.5 text-xs shadow-xs max-w-full overflow-x-auto no-scrollbar">
            {(
              [
                { id: "ALL", label: `All (${rows.length})`, full: `All EAs (${rows.length})` },
                { id: "XAU", label: `Gold (${rows.filter((r) => getAsset(r.name, r.strategy) === "XAU").length})`, full: `Gold (${rows.filter((r) => getAsset(r.name, r.strategy) === "XAU").length})` },
                { id: "BTC", label: `BTC (${rows.filter((r) => getAsset(r.name, r.strategy) === "BTC").length})`, full: `Bitcoin (${rows.filter((r) => getAsset(r.name, r.strategy) === "BTC").length})` },
                { id: "USOIL", label: `Oil (${rows.filter((r) => getAsset(r.name, r.strategy) === "USOIL").length})`, full: `Crude Oil (${rows.filter((r) => getAsset(r.name, r.strategy) === "USOIL").length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAssetFilter(tab.id)}
                className={cn(
                  "rounded-xs px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-medium transition-colors shrink-0 whitespace-nowrap",
                  assetFilter === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span className="sm:hidden">{tab.label}</span>
                <span className="hidden sm:inline">{tab.full}</span>
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
                const { code, cleanName } = formatEaDisplayName(e.id, e.name);
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-sans font-medium">
                        <span className="font-mono text-xs font-bold text-primary">{code}_</span>
                        <span>{cleanName}</span>
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
        {displayedRows.map((e) => {
          const { fullName } = formatEaDisplayName(e.id, e.name);
          return (
            <Panel key={e.id} title={`${fullName} — skipped / rejected entries`}>
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
          );
        })}
      </div>
    </div>
  );
}
