import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { PageHeader, Panel, QueryState, SourceBadge, fmt, signCls } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/trades")({
  head: () => meta("Trade History", "Searchable, paginated MT5 trade and deal history with net P/L, R-multiple and source."),
  component: Trades,
});

type T = ReturnType<typeof demo.trades>[number];
const PAGE = 15;

function Trades() {
  const [f, setF] = useState({ ea: "", side: "", outcome: "", source: "", search: "" });
  const [page, setPage] = useState(0);
  const qs = new URLSearchParams(Object.entries({ ...f, page: String(page + 1), pageSize: String(PAGE) }).filter(([, v]) => v)).toString();
  const q = useApi<T[]>(`/trades?${qs}`, "trades", 10_000);
  const all = (q.data ?? []).filter((t) => (!f.ea || t.ea === f.ea) && (!f.side || t.side === f.side) && (!f.source || t.source === f.source) && (!f.outcome || (f.outcome === "win" ? t.net > 0 : t.net <= 0)) && (!f.search || String(t.id).includes(f.search)));
  const rows = all.slice(page * PAGE, page * PAGE + PAGE);
  const sel = (k: keyof typeof f, opts: string[]) => (
    <select value={f[k]} onChange={(e) => { setF({ ...f, [k]: e.target.value }); setPage(0); }} className="h-8 rounded-sm border bg-card px-2 text-xs">
      <option value="">{k}: all</option>{opts.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
  return (
    <div className="space-y-4">
      <PageHeader title="Trade History" sub="Positions reconstructed from deals; partial closes aggregated per position." />
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Ticket…" className="h-8 w-32 text-xs" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} />
        {sel("ea", [
          "EA01", "EA02", "EA03", "EA04", "EA05", "EA06", "EA07",
          "EA01_BTC", "EA02_BTC", "EA03_BTC",
          "EA01_USOIL", "EA02_USOIL", "EA03_USOIL"
        ])}{sel("side", ["BUY", "SELL"])}{sel("outcome", ["win", "loss"])}{sel("source", ["live", "import"])}
      </div>
      <Panel>
        <QueryState q={q} rows={8}>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card"><TableRow>{["Ticket", "EA", "Side", "Vol", "Open", "Close", "Entry", "Exit", "SL", "TP", "Gross", "Comm", "Swap", "Net", "R", "Exit", "Src"].map((h, i) => <TableHead key={i} className="label-xs">{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody className="num text-xs">
                {rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.id}</TableCell><TableCell>{t.ea}</TableCell>
                    <TableCell className={t.side === "BUY" ? "text-profit" : "text-loss"}>{t.side}</TableCell>
                    <TableCell>{t.volume}</TableCell>
                    <TableCell>{t.openedAt.slice(5, 16).replace("T", " ")}</TableCell><TableCell>{t.closedAt.slice(5, 16).replace("T", " ")}</TableCell>
                    <TableCell>{fmt(t.entry)}</TableCell><TableCell>{fmt(t.exit)}</TableCell><TableCell>{fmt(t.sl)}</TableCell><TableCell>{fmt(t.tp)}</TableCell>
                    <TableCell>{fmt(t.gross)}</TableCell><TableCell>{fmt(t.commission)}</TableCell><TableCell>{fmt(t.swap)}</TableCell>
                    <TableCell className={signCls(t.net)}>{fmt(t.net)}</TableCell><TableCell>{fmt(t.r)}</TableCell><TableCell>{t.exitReason}</TableCell>
                    <TableCell><SourceBadge source={t.source} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{all.length} trades · page {page + 1}/{Math.max(1, Math.ceil(all.length / PAGE))}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= all.length} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </QueryState>
      </Panel>
    </div>
  );
}
