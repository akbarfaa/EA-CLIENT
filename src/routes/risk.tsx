import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { HealthBadge, Notice, PageHeader, Panel, QueryState, fmt } from "@/components/kit";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/risk")({
  head: () => meta("Risk Monitor", "Account-wide risk alerts: daily loss, drawdown, missing stops, stale EAs."),
  component: Risk,
});

function Risk() {
  const sq = useApi<ReturnType<typeof demo.summary>>("/accounts/default/summary", "summary", 15_000);
  const pq = useApi<ReturnType<typeof demo.positions>>("/accounts/default/positions", "positions", 15_000);
  const eq = useApi<ReturnType<typeof demo.eas>>("/eas", "eas", 15_000);
  const [th, setTh] = useState({ dailyLoss: 2, dd: 8, maxPos: 3 });
  const s = sq.data;
  const pos = pq.data ?? [];
  const checks = s ? [
    { label: "Daily drawdown", v: s.dailyDrawdownPct, max: th.dailyLoss, unit: "%" },
    { label: "Max drawdown", v: s.maxDrawdownPct, max: th.dd, unit: "%" },
    { label: "Open positions", v: pos.length, max: th.maxPos, unit: "" },
  ] : [];
  const breached = checks.filter((c) => c.v >= c.max);
  return (
    <div className="space-y-4">
      <PageHeader title="Risk Monitor" sub="Observational alerts. The dashboard cannot stop trading." />
      {breached.length > 0 && <Notice tone="loss">Threshold exceeded: {breached.map((b) => b.label).join(", ")}. Trading is NOT stopped by this alert.</Notice>}
      <QueryState q={sq}>
        <div className="grid gap-3 md:grid-cols-3">
          {checks.map((c) => (
            <Panel key={c.label} title={c.label}>
              <div className="num text-2xl font-semibold">{fmt(c.v, c.unit ? 2 : 0)}{c.unit}<span className="ml-2 text-xs text-muted-foreground">/ {c.max}{c.unit}</span></div>
              <Progress value={Math.min(100, (c.v / c.max) * 100)} className="mt-2 h-1.5" />
            </Panel>
          ))}
        </div>
      </QueryState>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Findings">
          <ul className="space-y-1.5 text-sm">
            {pos.filter((p) => p.sl == null).map((p) => <li key={p.ticket} className="text-loss">Ticket {p.ticket}: no stop loss — risk not calculable</li>)}
            {(eq.data ?? []).filter((e) => e.health !== "healthy").map((e) => <li key={e.id} className="flex gap-2">{e.name}: <HealthBadge h={e.health} /></li>)}
            {s?.openRisk == null && <li className="text-warn">Aggregate open risk: Not calculable</li>}
          </ul>
        </Panel>
        <Panel title="Warning thresholds">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {(Object.keys(th) as (keyof typeof th)[]).map((k) => (
              <label key={k} className="space-y-1"><span className="label-xs">{k}</span><Input type="number" className="h-8" value={th[k]} onChange={(e) => setTh({ ...th, [k]: +e.target.value })} /></label>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">EA daily-loss lock = enforced inside the EA. Dashboard alert = notification only. Broker restriction = enforced by the broker. These are different.</p>
        </Panel>
      </div>
    </div>
  );
}
