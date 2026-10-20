import { createFileRoute } from "@tanstack/react-router";
import { CalendarX } from "lucide-react";
import { useApi } from "@/lib/api";
import { meta } from "@/lib/meta";
import { PageHeader, Panel, QueryState } from "@/components/kit";

export const Route = createFileRoute("/market")({
  head: () => meta("Market Context", "Verified gold-related economic events: Fed, CPI, NFP and USD releases."),
  component: Market,
});

type Ev = { id: string; name: string; time: string; currency: string; importance?: string; actual?: string; forecast?: string; previous?: string; source: string };

function Market() {
  const q = useApi<{ configured: boolean; events: Ev[] }>("/market/events", "market", 300_000);
  return (
    <div className="space-y-4">
      <PageHeader title="News & Market Context" sub="Events affect volatility; they are not buy/sell signals." />
      <Panel title="Economic calendar">
        <QueryState q={q}>
          {!q.data?.configured || q.data.events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <CalendarX className="size-6" />
              <div className="font-medium text-foreground">No verified news source configured</div>
              <div className="max-w-md text-xs">Connect a licensed economic-calendar provider on the backend. No values are shown until then.</div>
            </div>
          ) : (
            <table className="num w-full text-xs">
              <thead className="label-xs"><tr>{["Time", "Event", "Ccy", "Impact", "Actual", "Fcst", "Prev", "Source"].map((h) => <th key={h} className="py-1 text-left">{h}</th>)}</tr></thead>
              <tbody>{q.data.events.map((e) => <tr key={e.id} className="border-t"><td className="py-1">{new Date(e.time).toLocaleString()}</td><td className="font-sans">{e.name}</td><td>{e.currency}</td><td>{e.importance ?? "—"}</td><td>{e.actual ?? "—"}</td><td>{e.forecast ?? "—"}</td><td>{e.previous ?? "—"}</td><td>{e.source}</td></tr>)}</tbody>
            </table>
          )}
        </QueryState>
      </Panel>
    </div>
  );
}
