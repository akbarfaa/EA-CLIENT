import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { api, saveSettings } from "@/lib/api";
import { meta } from "@/lib/meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({
  head: () => meta("Login", "Sign in to the XAUUSDc trading observability terminal."),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [f, setF] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify(f) });
      saveSettings({ token: r.token, demo: false });
      nav({ to: "/" });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-md border bg-card p-6">
        <div><div className="num text-lg font-semibold text-gold">XAUUSDc</div><div className="label-xs">Observability Terminal</div></div>
        <Input placeholder="Username" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
        <Input type="password" placeholder="Password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        <Link to="/settings" className="block text-center text-xs text-muted-foreground hover:underline">Configure API URL</Link>
      </form>
    </div>
  );
}
