import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, CircleDot, MinusCircle, XCircle } from "lucide-react";
import { useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { PageHeader, Panel, QueryState } from "@/components/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/diagnostics")({
  head: () => meta("EA Diagnostics", "Entry diagnostic timeline: why an EA entered, skipped or failed an order."),
  component: Diag,
});

type Ev = ReturnType<typeof demo.events>[number];
const ICON = { pass: [CheckCircle2, "text-profit"], fail: [XCircle, "text-loss"], error: [XCircle, "text-loss"], skip: [MinusCircle, "text-warn"], info: [CircleDot, "text-muted-foreground"] } as const;

function Diag() {
  const [ea, setEa] = useState("all");
  const q = useApi<Ev[]>(`/telemetry/events?limit=200${ea !== "all" ? `&ea=${ea}` : ""}`, "events", 5_000);
  const rows = (q.data ?? []).filter((e) => ea === "all" || e.ea === ea);
  return (
    <div className="space-y-4">
      <PageHeader
        title="EA Diagnostics"
        sub="Timeline reconstructed only from events the EA actually reports."
        right={<select value={ea} onChange={(e) => setEa(e.target.value)} className="rounded-sm border bg-card px-2 py-1 text-xs">{["all", "EA01", "EA02", "EA03"].map((x) => <option key={x}>{x}</option>)}</select>}
      />
      <Panel title="Event timeline">
        <QueryState q={q} rows={6}>
          <ol className="relative ml-2 border-l">
            {rows.map((e) => {
              const [I, c] = ICON[e.status as keyof typeof ICON] ?? ICON.info;
              return (
                <li key={e.id} className="relative pb-3 pl-5">
                  <I className={cn("absolute -left-[9px] top-0.5 size-4 bg-card", c)} />
                  <div className="flex flex-wrap items-baseline gap-x-3 text-xs">
                    <span className="num text-muted-foreground">{new Date(e.t).toLocaleTimeString()}</span>
                    <span className="num font-semibold">{e.ea}</span>
                    <span className="num rounded-sm bg-muted px-1 text-[10px]">{e.type}</span>
                  </div>
                  <div className="text-sm">{e.msg}</div>
                </li>
              );
            })}
          </ol>
        </QueryState>
      </Panel>
    </div>
  );
}
