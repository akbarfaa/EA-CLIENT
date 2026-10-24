import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { api, isDemo, useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { meta } from "@/lib/meta";
import { PageHeader, Panel, QueryState } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/imports")({
  head: () => meta("Imports", "Import MT5 CSV history with header detection, preview, validation and duplicate checks."),
  component: Imports,
});

function Imports() {
  const q = useApi<ReturnType<typeof demo.imports>>("/imports", "imports");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const onFile = async (f?: File) => {
    if (!f) return;
    setFile(f);
    const text = await f.slice(0, 20000).text();
    const delim = text.includes("\t") ? "\t" : text.split("\n")[0]?.includes(";") ? ";" : ",";
    setPreview(text.split(/\r?\n/).filter(Boolean).slice(0, 8).map((l) => l.split(delim)));
  };
  const submit = async () => {
    if (!file) return;
    if (isDemo()) {
      toast.info("Demo mode: file not sent. Configure the API in Settings.");
      return;
    }
    try {
      const content = await file.text();
      await api("/imports", { method: "POST", body: JSON.stringify({ fileName: file.name, content }) });
      toast.success("Import submitted for validation");
      q.refetch();
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Historical Import" sub="Imported data is kept separate from live and backtest data." />
      <Panel title="1 · Select file & preview">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40">
          <Upload className="size-5" />{file ? file.name : "Choose an MT5 CSV export"}
          <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {preview.length > 0 && (
          <div className="mt-3 overflow-auto">
            <p className="label-xs mb-1">Detected header + first rows (local preview, nothing uploaded yet)</p>
            <table className="num w-full text-[11px]">
              <tbody>{preview.map((r, i) => <tr key={i} className={i === 0 ? "font-semibold" : "text-muted-foreground"}>{r.map((c, j) => <td key={j} className="border px-1.5 py-0.5">{c}</td>)}</tr>)}</tbody>
            </table>
            <Button size="sm" className="mt-3" onClick={submit}>Validate & import</Button>
          </div>
        )}
      </Panel>
      <Panel title="Import history">
        <QueryState q={q}>
          <Table>
            <TableHeader><TableRow>{["File", "Imported", "Type", "Range", "Parsed", "Accepted", "Rejected", "Dupes", "Status"].map((h) => <TableHead key={h} className="label-xs">{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody className="num text-xs">
              {q.data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-sans">{r.file}</TableCell><TableCell>{r.at.slice(0, 10)}</TableCell><TableCell>{r.type}</TableCell><TableCell>{r.range}</TableCell>
                  <TableCell>{r.parsed}</TableCell><TableCell className="text-profit">{r.accepted}</TableCell><TableCell className={r.rejected ? "text-loss" : ""}>{r.rejected}</TableCell><TableCell>{r.duplicates}</TableCell><TableCell>{r.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueryState>
      </Panel>
    </div>
  );
}
