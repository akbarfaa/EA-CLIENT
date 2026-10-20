import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send } from "lucide-react";
import { api, isDemo } from "@/lib/api";
import { meta } from "@/lib/meta";
import { Notice, PageHeader, Panel } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/advisor")({
  head: () => meta("AI Advisor", "AI analysis grounded in your platform data: post-mortems and research questions."),
  component: Advisor,
});

type Msg = { role: "user" | "assistant"; content: string };
const MODES = [["chat", "Chat"], ["postmortem", "Trade post-mortem"], ["research", "Research report"]] as const;

function Advisor() {
  const [mode, setMode] = useState<(typeof MODES)[number][0]>("chat");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!input.trim()) return;
    const next = [...msgs, { role: "user" as const, content: input }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const reply = isDemo()
        ? "Demo mode: the AI advisor runs on your backend (POST /api/v1/ai/" + mode + "). Configure the API in Settings to get answers grounded in your real trade data."
        : (await api<{ reply: string }>(`/ai/${mode}`, { method: "POST", body: JSON.stringify({ messages: next }) })).reply;
      setMsgs([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: `Error: ${(e as Error).message}` }]);
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="AI Trading Advisor" sub="Analysis only. No buy/sell signals, no execution." right={
        <div className="flex gap-1">{MODES.map(([k, l]) => <Button key={k} size="sm" variant={mode === k ? "default" : "outline"} onClick={() => setMode(k)}>{l}</Button>)}</div>
      } />
      <Notice tone="muted">Answers must cite platform data. Statements without evidence should be treated as hypotheses.</Notice>
      <Panel>
        <div className="mb-3 min-h-[40vh] space-y-3">
          {msgs.length === 0 && <p className="text-sm text-muted-foreground">Ask e.g. “Why did EA02 have so many rejected orders this week?”</p>}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "ml-auto max-w-[80%] rounded-md bg-secondary px-3 py-2 text-sm" : "max-w-[85%] rounded-md border px-3 py-2 text-sm whitespace-pre-wrap"}>{m.content}</div>
          ))}
          {busy && <p className="text-xs text-muted-foreground">Thinking…</p>}
        </div>
        <div className="flex gap-2">
          <Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask about your trades…" />
          <Button onClick={send} disabled={busy} aria-label="Send"><Send className="size-4" /></Button>
        </div>
      </Panel>
    </div>
  );
}
