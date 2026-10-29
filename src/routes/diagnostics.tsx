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

const getEaColor = (eaName: string) => {
  const u = (eaName || "").toUpperCase();
  if (u === "EA01") return "text-chart-5";
  if (u === "EA02") return "text-gold";
  if (u === "EA03") return "text-chart-1";
  if (u === "EA04") return "text-emerald-600 dark:text-emerald-400";
  if (u === "EA05") return "text-cyan-600 dark:text-cyan-400";
  if (u === "EA06") return "text-purple-600 dark:text-purple-400";
  if (u === "EA07") return "text-rose-600 dark:text-rose-400";
  if (u.includes("BTC")) return "text-amber-600 dark:text-amber-400";
  if (u.includes("USOIL") || u.includes("OIL")) return "text-emerald-600 dark:text-emerald-400";
  return "text-foreground";
};

function Diag() {
  const [ea, setEa] = useState("all");
  const q = useApi<Ev[]>(`/telemetry/events?limit=200${ea !== "all" ? `&ea=${ea}` : ""}`, "events", 5_000);
  const rows = (q.data ?? []).filter((e) => ea === "all" || e.ea === ea);
  return (
    <div className="space-y-4">
      <PageHeader
        title="EA Diagnostics"
        sub="Timeline reconstructed only from events reported by MT5 telemetry modules."
        right={
          <select
            value={ea}
            onChange={(e) => setEa(e.target.value)}
            className="rounded-sm border bg-card px-2 py-1 text-xs text-foreground focus:outline-hidden"
          >
            <option value="all">All EAs (14)</option>
            <optgroup label="XAUUSD Suite">
              {["EA01", "EA02", "EA02V2", "EA03", "EA04", "EA05", "EA06", "EA07"].map((x) => (
                <option key={x} value={x}>{x} (Gold)</option>
              ))}
            </optgroup>
            <optgroup label="BTCUSD Suite">
              {["EA01_BTC", "EA02_BTC", "EA03_BTC"].map((x) => (
                <option key={x} value={x}>{x} (Bitcoin)</option>
              ))}
            </optgroup>
            <optgroup label="USOIL Suite">
              {["EA01_USOIL", "EA02_USOIL", "EA03_USOIL"].map((x) => (
                <option key={x} value={x}>{x} (Crude Oil)</option>
              ))}
            </optgroup>
          </select>
        }
      />
      <Panel title="Event timeline">
        <QueryState q={q} rows={6}>
          <ol className="relative ml-2 border-l border-border">
            {rows.map((e) => {
              const [I, c] = ICON[e.status as keyof typeof ICON] ?? ICON.info;
              return (
                <li key={e.id} className="relative pb-3 pl-5">
                  <I className={cn("absolute -left-[9px] top-0.5 size-4 bg-card", c)} />
                  <div className="flex flex-wrap items-baseline gap-x-3 text-xs">
                    <span className="num text-muted-foreground">{new Date(e.t).toLocaleTimeString()}</span>
                    <span className={cn("num font-bold", getEaColor(e.ea))}>[{e.ea}]</span>
                    <span className="num rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">{e.type}</span>
                  </div>
                  <div className="text-sm text-foreground mt-0.5 break-words break-all">{e.msg}</div>
                </li>
              );
            })}
          </ol>
        </QueryState>
      </Panel>
    </div>
  );
}
