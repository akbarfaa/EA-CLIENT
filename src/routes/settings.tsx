import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, getSettings, saveSettings, type Settings } from "@/lib/api";
import { meta } from "@/lib/meta";
import { PageHeader, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/settings")({
  head: () => meta("Settings", "Configure the VPS API URL, session, timezone and demo mode."),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => setS(getSettings()), []);
  if (!s) return null;
  const save = () => { saveSettings(s); toast.success("Settings saved"); };
  const test = async () => {
    saveSettings({ ...s, demo: false });
    try { await api("/health"); toast.success("Backend reachable"); } catch (e) { toast.error(`Health check failed: ${(e as Error).message}`); }
    finally { saveSettings(s); }
  };
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Settings" />
      <Panel title="Backend connection">
        <div className="space-y-3 text-sm">
          <label className="block space-y-1"><span className="label-xs">API base URL (public)</span>
            <Input placeholder="https://api.your-domain.example" value={s.apiBase} onChange={(e) => setS({ ...s, apiBase: e.target.value })} /></label>
          <p className="text-[11px] text-muted-foreground">Requests go to <span className="num">{s.apiBase || "…"}/api/v1/*</span>. Never put secrets in VITE_* variables.</p>
          <div className="flex items-center justify-between rounded-sm border p-2">
            <div><div className="font-medium">Demo mode</div><div className="text-xs text-muted-foreground">Show clearly-labelled simulated data instead of calling the API.</div></div>
            <Switch checked={s.demo} onCheckedChange={(v) => setS({ ...s, demo: v })} />
          </div>
          <label className="block space-y-1"><span className="label-xs">Display timezone</span>
            <Input value={s.tz} onChange={(e) => setS({ ...s, tz: e.target.value })} /></label>
          <div className="flex gap-2">
            <Button onClick={save}>Save</Button>
            <Button variant="outline" onClick={test}>Test /health</Button>
            <Button variant="outline" asChild><Link to="/login">Login</Link></Button>
            {s.token && <Button variant="ghost" onClick={() => { saveSettings({ token: "" }); setS({ ...s, token: "" }); toast("Logged out"); }}>Logout</Button>}
          </div>
        </div>
      </Panel>
    </div>
  );
}
