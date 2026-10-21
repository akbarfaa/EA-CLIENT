import { createFileRoute } from "@tanstack/react-router";
import { useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { Notice, PageHeader, Panel, QueryState, ago, fmt, signCls } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/positions")({
  head: () => meta("Live Positions", "Open MT5 positions, stop-loss status, risk to SL and correlated exposure."),
  component: Positions,
});

type P = ReturnType<typeof demo.positions>;

function Positions() {
  const q = useApi<P>("/accounts/default/positions", "positions", 3_000);
  const rows = q.data ?? [];
  const noSl = rows.filter((r) => r.sl == null);
  const bySym = Object.entries(rows.reduce<Record<string, { lots: number; eas: Set<string>; dirs: Set<string> }>>((a, r) => {
    const k = r.symbol; a[k] ??= { lots: 0, eas: new Set(), dirs: new Set() };
    a[k].lots += r.side === "BUY" ? r.volume : -r.volume; a[k].eas.add(r.ea); a[k].dirs.add(r.side); return a;
  }, {}));
  return (
    <div className="space-y-4">
      <PageHeader title="Live Positions" sub="Read-only. No execution controls." />
      {noSl.length > 0 && <Notice tone="loss">{noSl.length} position(s) without a confirmed stop loss — risk is NOT zero, it is not calculable.</Notice>}
      {bySym.filter(([, v]) => v.eas.size > 1).map(([k, v]) => <Notice key={k}>Correlated exposure: {v.eas.size} sources ({[...v.eas].join(", ")}) hold {k} positions.</Notice>)}
      <Panel title="Open positions">
        <QueryState q={q}>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">No open positions reported.</p> : (
            <Table>
              <TableHeader><TableRow>{["Ticket", "Symbol", "Side", "Vol", "Entry", "Price", "SL", "TP", "P/L", "Age", "EA / Magic", "Risk→SL"].map((h) => <TableHead key={h} className="label-xs">{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody className="num text-xs">
                {rows.map((r) => (
                  <TableRow key={r.ticket}>
                    <TableCell>{r.ticket}</TableCell><TableCell>{r.symbol}</TableCell>
                    <TableCell className={r.side === "BUY" ? "text-profit" : "text-loss"}>{r.side}</TableCell>
                    <TableCell>{r.volume}</TableCell><TableCell>{fmt(r.entry)}</TableCell><TableCell>{fmt(r.price)}</TableCell>
                    <TableCell className={r.sl == null ? "text-loss" : ""}>{r.sl == null ? "NONE" : fmt(r.sl)}</TableCell>
                    <TableCell>{fmt(r.tp)}</TableCell>
                    <TableCell className={signCls(r.pnl)}>{fmt(r.pnl)}</TableCell>
                    <TableCell>{ago(r.openedAt)}</TableCell><TableCell>{r.ea} / {r.magic}</TableCell>
                    <TableCell className={r.riskToSl == null ? "text-warn" : ""}>{r.riskToSl == null ? "Not calculable" : fmt(r.riskToSl)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </Panel>
      <Panel title="Exposure by symbol">
        <div className="grid gap-2 sm:grid-cols-3">
          {bySym.map(([k, v]) => (
            <div key={k} className="rounded-sm border p-2 text-xs"><div className="font-medium">{k}</div><div className="num">Net lots {fmt(v.lots)} · {[...v.dirs].join("/")} · {v.eas.size} source(s)</div></div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
