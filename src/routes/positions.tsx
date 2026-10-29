import { createFileRoute } from "@tanstack/react-router";
import { useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { Notice, PageHeader, Panel, QueryState, ago, fmt, signCls } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/positions")({
  head: () => meta("Live Positions", "Open MT5 positions, stop-loss status, risk to SL and correlated exposure."),
  component: Positions,
});

export interface PositionRow {
  ticket: number;
  symbol: string;
  side: string;
  volume: number;
  entry: number;
  price: number;
  sl: number | null;
  tp: number;
  pnl: number;
  openedAt: string;
  ea: string;
  magic: number;
  riskToSl: number | null;
}

interface TelemetryEventItem {
  id: string;
  t: string;
  ea: string;
  type: string;
  status: string;
  msg: string;
}

interface SummaryData {
  floating: number;
  equity: number;
  balance: number;
}

function Positions() {
  const q = useApi<PositionRow[]>("/accounts/default/positions", "positions", 3_000);
  const rows: PositionRow[] = q.data ?? [];

  const noSl = rows.filter((r) => r.sl == null);
  const bySym = Object.entries(
    rows.reduce<Record<string, { lots: number; eas: Set<string>; dirs: Set<string> }>>((a, r) => {
      const k = r.symbol;
      a[k] ??= { lots: 0, eas: new Set(), dirs: new Set() };
      a[k].lots += r.side === "BUY" ? r.volume : -r.volume;
      a[k].eas.add(r.ea);
      a[k].dirs.add(r.side);
      return a;
    }, {})
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live Positions"
        sub="Read-only multi-asset monitoring. Observational only — no trade execution."
      />
      {noSl.length > 0 && (
        <Notice tone="loss">
          {noSl.length} position(s) without a confirmed stop loss — risk is NOT zero, it is not calculable.
        </Notice>
      )}
      {bySym
        .filter(([, v]) => v.eas.size > 1)
        .map(([k, v]) => (
          <Notice key={k}>
            Correlated exposure: {v.eas.size} sources ({[...v.eas].join(", ")}) hold {k} positions.
          </Notice>
        ))}
      <Panel title="Open positions">
        <QueryState q={q}>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open positions reported.</p>
          ) : (
            <Table className="min-w-[750px]">
              <TableHeader>
                <TableRow>
                  {["Ticket", "Symbol", "Side", "Vol", "Entry", "Price", "SL", "TP", "P/L", "Age", "EA / Magic", "Risk→SL"].map((h) => (
                    <TableHead key={h} className="label-xs whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="num text-xs">
                {rows.map((r) => {
                  const isGold = r.symbol.includes("XAU");
                  const isBtc = r.symbol.includes("BTC");
                  const isOil = r.symbol.includes("USOIL") || r.symbol.includes("OIL");

                  return (
                    <TableRow key={r.ticket}>
                      <TableCell>{r.ticket}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-sans font-medium">
                          <span className="num font-semibold">{r.symbol}</span>
                          {isGold && (
                            <span className="num rounded-xs border border-gold/40 bg-gold/10 px-1 py-0.2 text-[9px] font-semibold text-gold">
                              XAU
                            </span>
                          )}
                          {isBtc && (
                            <span className="num rounded-xs border border-amber-500/40 bg-amber-500/10 px-1 py-0.2 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                              BTC
                            </span>
                          )}
                          {isOil && (
                            <span className="num rounded-xs border border-emerald-500/40 bg-emerald-500/10 px-1 py-0.2 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                              USOIL
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={r.side === "BUY" ? "text-profit" : "text-loss"}>{r.side}</TableCell>
                      <TableCell>{r.volume}</TableCell>
                      <TableCell>{fmt(r.entry)}</TableCell>
                      <TableCell>{fmt(r.price)}</TableCell>
                      <TableCell className={r.sl == null ? "text-loss" : ""}>
                        {r.sl == null ? "NONE" : fmt(r.sl)}
                      </TableCell>
                      <TableCell>{fmt(r.tp)}</TableCell>
                      <TableCell className={signCls(r.pnl)}>{fmt(r.pnl)}</TableCell>
                      <TableCell>{ago(r.openedAt)}</TableCell>
                      <TableCell>{r.ea} / {r.magic}</TableCell>
                      <TableCell className={r.riskToSl == null ? "text-warn" : ""}>
                        {r.riskToSl == null ? "Not calculable" : fmt(r.riskToSl)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </Panel>
      <Panel title="Exposure by symbol">
        <div className="grid gap-2 sm:grid-cols-3">
          {bySym.map(([k, v]) => {
            const isGold = k.includes("XAU");
            const isBtc = k.includes("BTC");
            const isOil = k.includes("USOIL") || k.includes("OIL");

            return (
              <div
                key={k}
                className={cn(
                  "rounded-sm border p-2.5 text-xs bg-card transition-all",
                  isGold && "border-gold/30 hover:border-gold/50",
                  isBtc && "border-amber-500/30 hover:border-amber-500/50",
                  isOil && "border-emerald-500/30 hover:border-emerald-500/50"
                )}
              >
                <div className="flex items-center justify-between font-medium">
                  <span className="font-semibold text-foreground">{k}</span>
                  {isGold && <span className="size-2 rounded-full bg-gold" />}
                  {isBtc && <span className="size-2 rounded-full bg-amber-500" />}
                  {isOil && <span className="size-2 rounded-full bg-emerald-500" />}
                </div>
                <div className="num mt-1.5 text-muted-foreground">
                  Net lots <span className="font-semibold text-foreground">{fmt(v.lots)}</span> · {[...v.dirs].join("/")} · {v.eas.size} source(s)
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
