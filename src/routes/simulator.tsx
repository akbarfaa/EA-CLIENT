import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { meta } from "@/lib/meta";
import { Metric, Notice, PageHeader, Panel, chartAxis, fmt, tooltipStyle } from "@/components/kit";
import { Input } from "@/components/ui/input";
import { monteCarlo } from "@/lib/sim";

export const Route = createFileRoute("/simulator")({
  head: () => meta("What-If Simulator", "Monte Carlo risk simulator: equity paths, drawdowns and losing streaks. Hypothetical only."),
  component: Sim,
});

function Sim() {
  const [p, setP] = useState({ balance: 10000, riskPct: 1, rr: 1.5, winRate: 45, trades: 200, costPct: 0.05, paths: 300 });
  const r = useMemo(() => monteCarlo(p), [p]);
  const field = (k: keyof typeof p, l: string) => (
    <label className="space-y-1"><span className="label-xs">{l}</span><Input type="number" className="h-8 text-xs" value={p[k]} onChange={(e) => setP({ ...p, [k]: +e.target.value })} /></label>
  );
  return (
    <div className="space-y-4">
      <PageHeader title="What-If Simulator" sub="Monte Carlo simulation (client-side). Hypothetical — not a forecast." />
      <Notice>SIMULATED. Assumes independent trades with fixed win rate and R:R; real results have serial correlation, slippage and regime changes.</Notice>
      <Panel title="Assumptions">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {field("balance", "Start balance")}{field("riskPct", "Risk / trade %")}{field("rr", "Reward:Risk")}{field("winRate", "Win rate %")}{field("trades", "Trades")}{field("costPct", "Cost / trade %")}{field("paths", "Paths")}
        </div>
      </Panel>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <Metric label="Median end" value={fmt(r.p50, 0)} />
        <Metric label="5th pct end" value={fmt(r.p5, 0)} tone="text-loss" />
        <Metric label="95th pct end" value={fmt(r.p95, 0)} tone="text-profit" />
        <Metric label="Median max DD" value={fmt(r.medDd, 1)} unit="%" />
        <Metric label="Worst streak (p95)" value={r.streak95} unit="losses" />
        <Metric label="P(−50%)" value={fmt(r.ruin * 100, 1)} unit="%" basis="Share of paths touching −50%" />
      </div>
      <Panel title="Sample equity paths (hypothetical)">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={r.chart}>
              <XAxis dataKey="i" {...chartAxis} />
              <YAxis {...chartAxis} width={56} />
              <Tooltip {...tooltipStyle} />
              {r.keys.map((k, i) => <Line key={k} dataKey={k} dot={false} stroke={i === 0 ? "var(--gold)" : "var(--chart-2)"} strokeOpacity={i === 0 ? 1 : 0.35} isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
