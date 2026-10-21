import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { HealthBadge, PageHeader, Panel, QueryState, ago, fmt, pct, signCls } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/eas")({
  head: () => meta("EA Leaderboard", "Compare EA instances by P/L, profit factor, drawdown, sample size and health."),
  component: Eas,
});

type E = ReturnType<typeof demo.eas>[number];
const MIN_SAMPLE = 100;
const COLS: [keyof E, string][] = [["netPnl", "Net P/L"], ["floating", "Float"], ["trades", "Trades"], ["winRate", "Win%"], ["pf", "PF"], ["expectancy", "Exp."], ["avgWin", "Avg W"], ["avgLoss", "Avg L"], ["maxDd", "Max DD%"], ["avgR", "Avg R"], ["positions", "Pos"]];

function Eas() {
  const q = useApi<E[]>("/eas", "eas", 5_000);
  const [sort, setSort] = useState<keyof E>("pf");
  const rows = [...(q.data ?? [])].sort((a, b) => (b[sort] as number) - (a[sort] as number));
  return (
    <div className="space-y-4">
      <PageHeader title="EA Leaderboard" sub={`Results with fewer than ${MIN_SAMPLE} trades are labelled insufficient evidence.`} />
      <Panel title="Instances">
        <QueryState q={q}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="label-xs">EA</TableHead><TableHead className="label-xs">Health</TableHead>
                {COLS.map(([k, l]) => <TableHead key={k} className="label-xs cursor-pointer hover:text-foreground" onClick={() => setSort(k)}>{l}{sort === k && " ↓"}</TableHead>)}
                <TableHead className="label-xs">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="num text-xs">
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><div className="font-sans font-medium">{e.name} <span className="text-muted-foreground">v{e.version}</span></div><div className="font-sans text-[10px] text-muted-foreground">{e.strategy} · #{e.magic}</div></TableCell>
                  <TableCell><HealthBadge h={e.health} /><div className="text-[10px] text-muted-foreground">{ago(e.heartbeat)}</div></TableCell>
                  <TableCell className={signCls(e.netPnl)}>{fmt(e.netPnl)}</TableCell>
                  <TableCell className={signCls(e.floating)}>{fmt(e.floating)}</TableCell>
                  <TableCell>{e.trades}</TableCell><TableCell>{pct(e.winRate)}</TableCell><TableCell>{fmt(e.pf)}</TableCell>
                  <TableCell>{fmt(e.expectancy)}</TableCell><TableCell className="text-profit">{fmt(e.avgWin)}</TableCell><TableCell className="text-loss">{fmt(e.avgLoss)}</TableCell>
                  <TableCell>{fmt(e.maxDd)}</TableCell><TableCell>{fmt(e.avgR)}</TableCell><TableCell>{e.positions}</TableCell>
                  <TableCell>{e.trades < MIN_SAMPLE ? <span className="text-warn">Insufficient (n={e.trades})</span> : <span className="text-muted-foreground">n={e.trades}</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueryState>
      </Panel>
      <div className="grid gap-3 md:grid-cols-3">
        {rows.map((e) => (
          <Panel key={e.id} title={`${e.name} — skipped / rejected entries`}>
            <div className="space-y-1 text-xs">
              {Object.entries(e.skipped).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="num">{v}</span></div>)}
              <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">Long / Short</span><span className="num">{e.longs} / {e.shorts}</span></div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
