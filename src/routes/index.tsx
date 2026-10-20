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

function Overview() {
  const sq = useApi<Summary>("/accounts/default/summary", "summary", 15_000);
  const eq = useApi<Eq>("/accounts/default/performance?series=equity", "equity");
  const hr = useApi<ReturnType<typeof demo.byHour>>("/accounts/default/performance?groupBy=hour", "byHour");
  const s = sq.data;
  const stale = s && Date.now() - new Date(s.lastTelemetry).getTime() > 60_000;

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
                <LineChart data={eq.data}>
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
                <AreaChart data={eq.data}>
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
                <BarChart data={eq.data}>
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
                <BarChart data={hr.data}>
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
      {s && <p className="text-[11px] text-muted-foreground">Max observed drawdown: <span className="num">{fmt(s.maxDrawdownPct)}%</span>. Metrics exclude deposits, withdrawals and balance adjustments.</p>}
    </div>
  );
}
