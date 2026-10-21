import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import type { Health } from "@/lib/demo";

export const fmt = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
export const signCls = (v: number | null | undefined) => (v == null ? "text-muted-foreground" : v > 0 ? "text-profit" : v < 0 ? "text-loss" : "");
export const ago = (iso?: string) => {
  if (!iso) return "never";
  const utcIso = iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`;
  const s = Math.round((Date.now() - new Date(utcIso).getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${Math.max(0, s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

export function Panel({ title, right, children, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-md border bg-card", className)}>
      {title && (
        <header className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="label-xs font-medium">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Metric({ label, value, basis, tone, unit }: { label: string; value: ReactNode; basis?: string; tone?: string; unit?: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2.5" title={basis}>
      <div className="label-xs">{label}</div>
      <div className={cn("num mt-1 text-lg font-semibold", tone)}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </div>
      {basis && <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{basis}</div>}
    </div>
  );
}

const SRC: Record<string, string> = {
  live: "border-profit/40 text-profit",
  delayed: "border-warn/40 text-warn",
  import: "border-chart-5/40 text-chart-5",
  backtest: "border-gold/40 text-gold",
  simulated: "border-warn/50 text-warn",
  unknown: "border-border text-muted-foreground",
};
export function SourceBadge({ source }: { source: string }) {
  return <span className={cn("num rounded-sm border px-1.5 py-0.5 text-[10px] uppercase", SRC[source] ?? SRC["unknown"])}>{source}</span>;
}

const H: Record<Health, string> = {
  healthy: "bg-profit", delayed: "bg-warn", stale: "bg-warn", offline: "bg-muted-foreground", error: "bg-loss", unknown: "bg-border",
};
export function HealthBadge({ h }: { h: Health }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize">
      <span className={cn("size-2 rounded-full", H[h])} />
      {h}
    </span>
  );
}

export function QueryState({ q, children, rows = 3 }: { q: { isLoading: boolean; error: unknown }; children: ReactNode; rows?: number }) {
  if (q.isLoading) return <div className="space-y-2">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;
  if (q.error) {
    const e = q.error as { code?: string; message?: string };
    return (
      <div className="flex items-start gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 text-warn" />
        <div>
          <div className="font-medium text-foreground">Data unavailable</div>
          <div className="num text-xs">{e.code ?? "ERROR"} — {e.message}</div>
          <div className="mt-1 text-xs">Check API URL & login in Settings, or enable Demo mode.</div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Notice({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "loss" | "muted" }) {
  const c = { warn: "border-warn/40 bg-warn/10", loss: "border-loss/40 bg-loss/10", muted: "bg-muted" }[tone];
  return <div className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-xs", c)}><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{children}</div>;
}

export const chartAxis = { stroke: "var(--muted-foreground)", fontSize: 10, tickLine: false, axisLine: false } as const;
export const tooltipStyle = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", fontSize: 11, borderRadius: 4 } };
