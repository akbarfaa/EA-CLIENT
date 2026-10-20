import { createFileRoute } from "@tanstack/react-router";
import { useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { Notice, PageHeader, Panel, QueryState, SourceBadge, fmt } from "@/components/kit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/research")({
  head: () => meta("Research Lab", "Backtest runs and strategy hypotheses with out-of-sample validation status."),
  component: Research,
});

function Research() {
  const q = useApi<ReturnType<typeof demo.research>>("/research/runs", "research");
  return (
    <div className="space-y-4">
      <PageHeader title="Strategy Research & Backtest Lab" sub="Backtests are hypotheses, not proof of edge." />
      <Notice tone="muted">Results without out-of-sample validation or with small samples should not be treated as evidence of profitability.</Notice>
      <Panel title="Backtest runs">
        <QueryState q={q}>
          <Table>
            <TableHeader><TableRow>{["Strategy", "Period", "Model", "Trades", "PF", "Max DD%", "Sharpe", "OOS", "Status", ""].map((h, i) => <TableHead key={i} className="label-xs">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody className="num text-xs">
              {q.data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-sans font-medium">{r.strategy}</TableCell><TableCell>{r.period}</TableCell><TableCell>{r.model}</TableCell>
                  <TableCell>{r.trades}</TableCell><TableCell>{fmt(r.pf)}</TableCell><TableCell>{fmt(r.maxDd)}</TableCell><TableCell>{fmt(r.sharpe)}</TableCell>
                  <TableCell>{r.oos ? "Yes" : "No"}</TableCell>
                  <TableCell className={r.status.includes("validated") ? "text-profit" : "text-warn"}>{r.status}</TableCell>
                  <TableCell><SourceBadge source="backtest" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueryState>
      </Panel>
    </div>
  );
}
