import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { Metric, Notice, PageHeader, Panel, QueryState, SourceBadge, ago, chartAxis, fmt, pct, signCls, tooltipStyle } from "@/components/kit";

export const Route = createFileRoute("/")({
  head: () => meta("Overview", "Account balance, equity, P/L, drawdown and telemetry status for XAUUSDc EAs."),
  component: Overview,
});

type Summary = ReturnType<typeof demo.summary>;
type Eq = ReturnType<typeof demo.equity>;
type Ev = ReturnType<typeof demo.events>[number];

function Overview() {
  const sq = useApi<Summary>("/accounts/default/summary", "summary", 3_000);
  const eq = useApi<Eq>("/accounts/default/performance?series=equity", "equity", 15_000);
  const hr = useApi<ReturnType<typeof demo.byHour>>("/accounts/default/performance?groupBy=hour", "byHour", 30_000);
  const logQ = useApi<Ev[]>("/telemetry/events?limit=40", "events", 3_000);
  const s = sq.data;
  const stale = s && Date.now() - new Date(s.lastTelemetry.endsWith("Z") || s.lastTelemetry.includes("+") ? s.lastTelemetry : `${s.lastTelemetry}Z`).getTime() > 600_000;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        sub={s ? `Account ${s.accountId} · ${s.currency}` : "Account summary"}
        right={s && <div className="flex items-center gap-2 text-xs text-muted-foreground"><SourceBadge source={s.source} />Last telemetry {ago(s.lastTelemetry)}</div>}
      />
      {stale && <Notice>Snapshot is stale — last update {ago(s!.lastTelemetry)}. Values may not reflect the current account.</Notice>}
      <QueryState q={sq} rows={4}>
        {s && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            <Metric label="Balance" value={fmt(s.balance)} basis="Latest snapshot" />
            <Metric label="Equity" value={fmt(s.equity)} basis="Latest snapshot" />
            <Metric label="Floating P/L" value={fmt(s.floating)} tone={signCls(s.floating)} basis="Open positions" />
            <Metric label="P/L Today" value={fmt(s.pnlToday)} tone={signCls(s.pnlToday)} basis="Realized, server day" />
            <Metric label="P/L Week" value={fmt(s.pnlWeek)} tone={signCls(s.pnlWeek)} basis="Realized, Mon–now" />
            <Metric label="P/L Month" value={fmt(s.pnlMonth)} tone={signCls(s.pnlMonth)} basis="Realized, MTD" />
            <Metric label="Daily DD" value={fmt(s.dailyDrawdownPct)} unit="%" basis="From day-start equity" />
            <Metric label="Open Risk" value={s.openRisk == null ? "Not calculable" : fmt(s.openRisk)} tone={s.openRisk == null ? "text-warn text-sm" : ""} basis={s.openRiskNote} />
            <Metric label="Margin" value={fmt(s.margin)} basis="Broker-reported" />
            <Metric label="Free Margin" value={fmt(s.freeMargin)} basis="Broker-reported" />
            <Metric label="Closed Trades" value={s.closedTrades} basis="Reconstructed positions" />
            <Metric label="Win Rate" value={pct(s.winRate)} basis={`n = ${s.closedTrades}`} />
            <Metric label="Profit Factor" value={fmt(s.profitFactor)} basis="Gross win / gross loss" />
            <Metric label="Expectancy" value={fmt(s.expectancy)} unit={s.currency} basis="Net per trade" />
          </div>
        )}
      </QueryState>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Balance & Equity" className="lg:col-span-2">
          <QueryState q={eq}>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={eq.data ?? []}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="t" {...chartAxis} />
                  <YAxis {...chartAxis} domain={["auto", "auto"]} width={50} />
                  <Tooltip {...tooltipStyle} />
                  <Line dataKey="balance" stroke="var(--chart-2)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  <Line dataKey="equity" stroke="var(--gold)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </QueryState>
        </Panel>
        <Panel title="Drawdown %">
          <QueryState q={eq}>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={eq.data ?? []}>
                  <XAxis dataKey="t" {...chartAxis} />
                  <YAxis {...chartAxis} width={36} />
                  <Tooltip {...tooltipStyle} />
                  <Area dataKey="dd" stroke="var(--loss)" fill="var(--loss)" fillOpacity={0.15} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </QueryState>
        </Panel>
        <Panel title="Daily Realized P/L" className="lg:col-span-2">
          <QueryState q={eq}>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={eq.data ?? []}>
                  <XAxis dataKey="t" {...chartAxis} />
                  <YAxis {...chartAxis} width={40} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="pnl" isAnimationActive={false}>
                    {eq.data?.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </QueryState>
        </Panel>
        <Panel title="P/L by Hour (server time)">
          <QueryState q={hr}>
            <div className="h-48">
              <ResponsiveContainer>
                <BarChart data={hr.data ?? []}>
                  <XAxis dataKey="h" {...chartAxis} />
                  <YAxis {...chartAxis} width={32} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="pnl" isAnimationActive={false}>
                    {hr.data?.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "var(--profit)" : "var(--loss)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </QueryState>
        </Panel>
      </div>

      <Panel
        title={
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              MT5 Experts Live Log Stream
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Realtime Telemetry</span>
          </div>
        }
      >
        <QueryState q={logQ} rows={4}>
          <div className="max-h-64 overflow-y-auto rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-100 shadow-inner space-y-1.5 border border-zinc-800">
            {(logQ.data ?? []).length === 0 ? (
              <p className="text-zinc-500 italic py-2">Menunggu stream log pertama dari MT5 VPS...</p>
            ) : (
              (logQ.data ?? []).map((e) => (
                <div key={e.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-zinc-500 shrink-0">[{new Date(e.t).toLocaleTimeString()}]</span>
                  <span className={`shrink-0 font-bold ${e.ea === "EA01" ? "text-cyan-400" : e.ea === "EA02" ? "text-amber-400" : "text-violet-400"}`}>[{e.ea}]</span>
                  <span className={`shrink-0 text-[10px] uppercase px-1 rounded ${e.status === "pass" ? "bg-emerald-950 text-emerald-300" : e.status === "skip" ? "bg-yellow-950 text-yellow-300" : e.status === "fail" || e.status === "error" ? "bg-rose-950 text-rose-300" : "bg-zinc-800 text-zinc-300"}`}>{e.type}</span>
                  <span className="text-zinc-200 break-all">{e.msg}</span>
                </div>
              ))
            )}
          </div>
        </QueryState>
      </Panel>

      {s && <p className="text-[11px] text-muted-foreground">Max observed drawdown: <span className="num">{fmt(s.maxDrawdownPct)}%</span>. Metrics exclude deposits, withdrawals and balance adjustments.</p>}
    </div>
  );
}
