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
  const eventsQ = useApi<TelemetryEventItem[]>("/telemetry/events?limit=80", "events", 3_000);
  const summaryQ = useApi<SummaryData>("/accounts/default/summary", "summary", 3_000);

  let rows: PositionRow[] = q.data ?? [];

  // Fallback / Hybrid: If backend positions table is empty, reconstruct from active order events!
  if (rows.length === 0 && eventsQ.data && eventsQ.data.length > 0) {
    const events = eventsQ.data;

    // 1. Get latest prices from patrol events
    let latestAsk = 0;
    let latestBid = 0;
    const patrolEvt = events.find((e) => e.type === "patrol" && e.msg.includes("Ask:"));
    if (patrolEvt) {
      const askM = patrolEvt.msg.match(/Ask:\s*([\d.]+)/);
      const bidM = patrolEvt.msg.match(/Bid:\s*([\d.]+)/);
      if (askM && askM[1]) latestAsk = parseFloat(askM[1]);
      if (bidM && bidM[1]) latestBid = parseFloat(bidM[1]);
    }

    // 2. Map magic numbers
    const magicMap: Record<string, number> = {
      EA01: 20240001,
      EA02: 20240002,
      EA02V2: 20240008,
      EA03: 20240003,
      EA04: 20240004,
      EA05: 20240005,
      EA06: 20240006,
      EA07: 20240007,
      EA01_BTC: 20250001,
      EA02_BTC: 20250002,
      EA03_BTC: 20250003,
      EA01_USOIL: 20260001,
      EA02_USOIL: 20260002,
      EA03_USOIL: 20260003,
    };

    // 3. Find active orders
    const reconstructed: PositionRow[] = [];
    const seenEAs = new Set<string>();

    for (const evt of events) {
      if ((evt.type === "order" || evt.type === "order_entry") && evt.status === "pass") {
        const ea = evt.ea;
        if (seenEAs.has(ea)) continue;
        seenEAs.add(ea);

        // Check if there is any deal/deal_closed event for this EA AFTER this order
        const orderTime = new Date(evt.t).getTime();
        const hasClosed = events.some(
          (d) =>
            (d.type === "deal" || d.type === "deal_closed") &&
            d.ea === ea &&
            new Date(d.t).getTime() >= orderTime
        );

        if (hasClosed) continue;

        // Parse order message
        const sideM = evt.msg.match(/\|\s*(BUY|SELL)\s*\|/i);
        const lotsM = evt.msg.match(/Lots=([\d.]+)/i);
        const entryM = evt.msg.match(/Entry=([\d.]+)/i);
        const slM = evt.msg.match(/SL=([\d.]+)/i);
        const tpM = evt.msg.match(/TP=([\d.]+)/i);

        const sideStr = sideM?.[1];
        const entryStr = entryM?.[1];

        if (sideStr && entryStr) {
          const side = sideStr.toUpperCase();
          const volume = lotsM && lotsM[1] ? parseFloat(lotsM[1]) : 0.01;
          const entry = parseFloat(entryStr);
          const sl = slM && slM[1] ? parseFloat(slM[1]) : null;
          const tp = tpM && tpM[1] ? parseFloat(tpM[1]) : 0;

          const currentPrice =
            side === "SELL"
              ? latestAsk || latestBid || entry
              : latestBid || latestAsk || entry;

          const eaUpper = (ea || "").toUpperCase();
          const sym = eaUpper.includes("BTC")
            ? "BTCUSDm"
            : eaUpper.includes("USOIL") || eaUpper.includes("OIL")
            ? "USOILm"
            : "XAUUSDm";

          const lotMultiplier = sym.includes("BTC") ? 1 : sym.includes("OIL") ? 100 : 100;

          // Use real account floating PnL if available or point diff
          const pnl =
            summaryQ.data && Math.abs(summaryQ.data.floating) > 0
              ? summaryQ.data.floating
              : side === "BUY"
              ? (currentPrice - entry) * volume * lotMultiplier
              : (entry - currentPrice) * volume * lotMultiplier;

          const riskToSl = sl ? Math.abs(entry - sl) * volume * lotMultiplier : null;

          // Stable ticket from event hash
          const hashNum = evt.id
            .split("")
            .reduce((acc, char) => acc + char.charCodeAt(0), 1000);
          const ticket = 5000000 + (hashNum % 900000);

          reconstructed.push({
            ticket,
            symbol: sym,
            side,
            volume,
            entry,
            price: currentPrice,
            sl,
            tp,
            pnl: Math.round(pnl * 100) / 100,
            openedAt: evt.t,
            ea,
            magic: magicMap[ea] || 20240001,
            riskToSl: riskToSl ? Math.round(riskToSl * 100) / 100 : null,
          });
        }
      }
    }

    if (reconstructed.length > 0) {
      rows = reconstructed;
    }
  }

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
