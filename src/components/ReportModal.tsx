import { useState, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Download, Printer, X, FileText, CheckCircle2, ShieldCheck, TrendingUp, Layers, ChevronRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api";
import { demo } from "@/lib/demo";
import { fmt, pct, signCls } from "@/components/kit";
import { cn } from "@/lib/utils";
import { getAsset, formatEaDisplayName, getEaTimeframe, AssetType } from "@/lib/ea-utils";

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAsset?: AssetType | "ALL";
}

type Summary = ReturnType<typeof demo.summary>;
type EaItem = ReturnType<typeof demo.eas>[number];
type TradeItem = ReturnType<typeof demo.trades>[number];

interface TelemetryEventItem {
  id: string;
  t: string;
  ea: string;
  type: string;
  status: string;
  msg: string;
}

interface PositionItem {
  ticket: number;
  symbol: string;
  side: string;
  volume: number;
  entry: number;
  price: number;
  sl: number | null;
  tp: number;
  pnl: number;
  openedAt: string;
  ea: string;
  magic: number;
  riskToSl: number | null;
}

export function ReportModal({ open, onOpenChange, initialAsset = "ALL" }: ReportModalProps) {
  const [filterAsset, setFilterAsset] = useState<AssetType | "ALL">(initialAsset);
  const [includePositions, setIncludePositions] = useState(true);
  const [includeTrades, setIncludeTrades] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>("");

  const reportContainerRef = useRef<HTMLDivElement>(null);

  // Data queries
  const summaryQ = useApi<Summary>("/accounts/default/summary", "summary", 10_000);
  const easQ = useApi<EaItem[]>("/eas", "eas", 10_000);
  const positionsQ = useApi<PositionItem[]>("/accounts/default/positions", "positions", 10_000);
  const eventsQ = useApi<TelemetryEventItem[]>("/telemetry/events?limit=80", "events", 10_000);
  const tradesQ = useApi<TradeItem[]>("/trades?pageSize=15", "trades", 10_000);

  const s = summaryQ.data;
  const rawEas = easQ.data ?? [];
  const rawTrades = tradesQ.data ?? [];

  // Filter EAs based on selected Asset
  const filteredEas = rawEas.filter((e) => {
    const asset = getAsset(e.name, e.strategy);
    if (filterAsset === "ALL") return true;
    return asset === filterAsset;
  });

  // Reconstruct / filter active positions
  let activePositions: PositionItem[] = positionsQ.data ?? [];
  if (activePositions.length === 0 && eventsQ.data && eventsQ.data.length > 0) {
    const events = eventsQ.data;
    let latestAsk = 0;
    let latestBid = 0;
    const patrolEvt = events.find((e) => e.type === "patrol" && e.msg.includes("Ask:"));
    if (patrolEvt) {
      const askM = patrolEvt.msg.match(/Ask:\s*([\d.]+)/);
      const bidM = patrolEvt.msg.match(/Bid:\s*([\d.]+)/);
      if (askM && askM[1]) latestAsk = parseFloat(askM[1]);
      if (bidM && bidM[1]) latestBid = parseFloat(bidM[1]);
    }

    const seenEAs = new Set<string>();
    for (const evt of events) {
      if ((evt.type === "order" || evt.type === "order_entry") && evt.status === "pass") {
        const ea = evt.ea;
        if (seenEAs.has(ea)) continue;
        seenEAs.add(ea);

        const orderTime = new Date(evt.t).getTime();
        const hasClosed = events.some(
          (d) =>
            (d.type === "deal" || d.type === "deal_closed") &&
            d.ea === ea &&
            new Date(d.t).getTime() >= orderTime
        );
        if (hasClosed) continue;

        const sideM = evt.msg.match(/\|\s*(BUY|SELL)\s*\|/i);
        const lotsM = evt.msg.match(/Lots=([\d.]+)/i);
        const entryM = evt.msg.match(/Entry=([\d.]+)/i);
        const slM = evt.msg.match(/SL=([\d.]+)/i);
        const tpM = evt.msg.match(/TP=([\d.]+)/i);
        const ticketM = evt.msg.match(/Ticket=(\d+)/i) || evt.msg.match(/#(\d+)/);

        const side = sideM && sideM[1] ? sideM[1].toUpperCase() : "BUY";
        const entry = entryM && entryM[1] ? parseFloat(entryM[1]) : 0;
        const lots = lotsM && lotsM[1] ? parseFloat(lotsM[1]) : 0.01;
        const sl = slM && slM[1] ? parseFloat(slM[1]) : null;
        const tp = tpM && tpM[1] ? parseFloat(tpM[1]) : 0;
        const ticket = ticketM && ticketM[1] ? parseInt(ticketM[1]) : 1000 + Math.floor(Math.random() * 9000);

        let symbol = "XAUUSD";
        if (ea.includes("BTC")) symbol = "BTCUSD";
        if (ea.includes("USOIL") || ea.includes("OIL")) symbol = "USOIL";

        const currentPrice = side === "BUY" ? latestBid || entry : latestAsk || entry;
        const pnl = side === "BUY" ? (currentPrice - entry) * lots * 100 : (entry - currentPrice) * lots * 100;

        activePositions.push({
          ticket,
          symbol,
          side,
          volume: lots,
          entry,
          price: currentPrice,
          sl,
          tp,
          pnl,
          openedAt: evt.t,
          ea,
          magic: 0,
          riskToSl: null,
        });
      }
    }
  }

  // Filter positions & trades if asset is selected
  const filteredPositions = activePositions.filter((p) => {
    if (filterAsset === "ALL") return true;
    const sym = p.symbol.toUpperCase();
    if (filterAsset === "XAU") return sym.includes("XAU") || sym.includes("GOLD");
    if (filterAsset === "BTC") return sym.includes("BTC");
    if (filterAsset === "USOIL") return sym.includes("OIL") || sym.includes("CRUDE");
    return true;
  });

  const filteredTrades = rawTrades.filter((t) => {
    if (filterAsset === "ALL") return true;
    const tEa = t.ea.toUpperCase();
    if (filterAsset === "BTC") return tEa.includes("BTC");
    if (filterAsset === "USOIL") return tEa.includes("USOIL") || tEa.includes("OIL");
    return !tEa.includes("BTC") && !tEa.includes("USOIL");
  }).slice(0, 10);

  const reportDateStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const reportTimeStr = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Calculate totals
  const totalTradesCount = filteredEas.reduce((acc, curr) => acc + (curr.trades || 0), 0);
  const totalRealizedPnl = filteredEas.reduce((acc, curr) => acc + (curr.netPnl || 0), 0);
  const avgWinRate = filteredEas.length > 0
    ? filteredEas.reduce((acc, curr) => acc + (curr.winRate || 0), 0) / filteredEas.length
    : 0;

  // PDF Generation function
  const handleDownloadPdf = async () => {
    if (!reportContainerRef.current) return;
    setIsGenerating(true);
    setGenerationStep("Menyiapkan dokumen...");

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pages = reportContainerRef.current.querySelectorAll<HTMLElement>(".report-pdf-page");
      const totalPages = pages.length;

      for (let i = 0; i < totalPages; i++) {
        const pageEl = pages[i];
        if (!pageEl) continue;

        setGenerationStep(`Merender Halaman ${i + 1} dari ${totalPages}...`);

        const canvas = await html2canvas(pageEl, {
          scale: 2, // High resolution
          useCORS: true,
          logging: false,
          backgroundColor: "#0b0f19",
          windowWidth: 794,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 0) {
          pdf.addPage("a4", "portrait");
        }
        // A4 standard dimension: 210mm x 297mm
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      setGenerationStep("Menyimpan file PDF...");
      const filename = `Multi_Asset_Terminal_Report_${filterAsset}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
      setGenerationStep("");
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Gagal membuat file PDF. Silakan coba tombol Cetak / Browser PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-[#0e1320] border-[#1e293b] text-[#f8fafc]">
        {/* Modal Top Bar */}
        <DialogHeader className="p-4 border-b border-[#1e293b] bg-[#111827] flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-md bg-gradient-to-br from-amber-500/20 to-primary/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileText className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Download PDF Executive Report
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-normal">
                  Multi Asset Terminal
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Laporan komprehensif performa portofolio dan EA Leaderboard (tanpa log stream terminal).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={isGenerating}
              className="h-8 border-[#334155] bg-[#1e293b]/60 text-xs hover:bg-[#1e293b] text-gray-200"
            >
              <Printer className="size-3.5 mr-1 text-gray-400" />
              Cetak / Native PDF
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="h-8 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold text-xs shadow-md"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  {generationStep || "Membuat PDF..."}
                </>
              ) : (
                <>
                  <Download className="size-3.5 mr-1.5" />
                  Download PDF (.pdf)
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* Filter & Customization Toolbar */}
        <div className="px-5 py-2.5 bg-[#0a0e1a] border-b border-[#1e293b] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium">Filter Asset Suite:</span>
            <div className="flex items-center rounded bg-[#111827] border border-[#1e293b] p-0.5">
              {(
                [
                  { id: "ALL", label: "Semua Asset (14 EA)" },
                  { id: "XAU", label: "Gold / XAU (8)" },
                  { id: "BTC", label: "Bitcoin / BTC (3)" },
                  { id: "USOIL", label: "Oil / USOIL (3)" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterAsset(tab.id)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    filterAsset === tab.id
                      ? "bg-amber-500 text-black font-semibold shadow-xs"
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-gray-300">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={includePositions}
                onChange={(e) => setIncludePositions(e.target.checked)}
                className="rounded border-[#334155] bg-[#111827] text-amber-500 focus:ring-amber-500 size-3.5"
              />
              <span>Posisi Terbuka ({filteredPositions.length})</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={includeTrades}
                onChange={(e) => setIncludeTrades(e.target.checked)}
                className="rounded border-[#334155] bg-[#111827] text-amber-500 focus:ring-amber-500 size-3.5"
              />
              <span>Trade History ({filteredTrades.length})</span>
            </label>
          </div>
        </div>

        {/* Scrollable Report Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#060911] flex justify-center">
          <div
            ref={reportContainerRef}
            id="report-printable-area"
            className="flex flex-col gap-6"
            style={{ width: "794px" }}
          >
            {/* =========================================================================
                PAGE 1: EXECUTIVE PORTFOLIO SUMMARY & ACCOUNT KPIS
                ========================================================================= */}
            <div
              className="report-pdf-page bg-[#0b0f19] border border-[#1e293b] shadow-2xl p-7 flex flex-col justify-between text-[#f8fafc]"
              style={{
                width: "794px",
                height: "1123px",
                boxSizing: "border-box",
                pageBreakAfter: "always",
                breakAfter: "page",
              }}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-[#1e293b] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg text-black font-extrabold text-xl">
                      M
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-lg font-extrabold tracking-wider text-white uppercase">
                          Multi Asset Terminal
                        </h1>
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                          LIVE TELEMETRY
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 uppercase tracking-widest font-mono">
                        Executive Portfolio & Algorithmic Performance Report
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-[10px] font-mono text-gray-400 space-y-0.5">
                    <div>Akun: <span className="text-white font-semibold">{s ? s.accountId : "25001923"}</span> ({s ? s.currency : "USD"})</div>
                    <div>Broker: <span className="text-white">Exness Technologies Ltd</span></div>
                    <div>Dibuat: <span className="text-amber-400 font-semibold">{reportDateStr} · {reportTimeStr}</span></div>
                    <div>Filter: <span className="text-white font-semibold uppercase">{filterAsset === "ALL" ? "All Assets (14 EAs)" : `${filterAsset} Suite`}</span></div>
                  </div>
                </div>

                {/* 3 Pillars Overview Banner */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-amber-400" />
                        <span className="font-bold text-xs text-white">XAUUSD Suite</span>
                      </div>
                      <span className="font-mono text-[9px] font-semibold text-amber-400 bg-amber-500/10 px-1 rounded border border-amber-500/30">
                        8 EAs · M5
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">Spot Gold · Exness Cent/Standard</div>
                    <div className="text-[9px] text-gray-300 font-mono mt-1">VWAP · Liquidity Sweep · Reclaim</div>
                  </div>

                  <div className="rounded-md border border-orange-500/40 bg-orange-500/5 p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-orange-400" />
                        <span className="font-bold text-xs text-white">BTCUSD Suite</span>
                      </div>
                      <span className="font-mono text-[9px] font-semibold text-orange-400 bg-orange-500/10 px-1 rounded border border-orange-500/30">
                        3 EAs · M15
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">Bitcoin 24/7 Crypto Market</div>
                    <div className="text-[9px] text-gray-300 font-mono mt-1">Volatility Squeeze · Supertrend</div>
                  </div>

                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-400" />
                        <span className="font-bold text-xs text-white">USOIL Suite</span>
                      </div>
                      <span className="font-mono text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/30">
                        3 EAs · M15
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">WTI Crude Oil Commodity</div>
                    <div className="text-[9px] text-gray-300 font-mono mt-1">Asian Breakout · EIA Guard</div>
                  </div>
                </div>

                {/* Account Financial Metrics Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-[#1e293b] pb-1">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                      1. Ringkasan Finansial & Risiko Akun
                    </h2>
                    <span className="text-[10px] font-mono text-gray-400">Snapshot MT5 Live</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 font-mono">
                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">Balance Akun</div>
                      <div className="text-base font-bold text-white mt-0.5">{s ? fmt(s.balance) : "$0.00"}</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Saldo riil broker</div>
                    </div>

                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">Equity Akun</div>
                      <div className="text-base font-bold text-amber-400 mt-0.5">{s ? fmt(s.equity) : "$0.00"}</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Termasuk floating</div>
                    </div>

                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">Floating P/L</div>
                      <div className={cn("text-base font-bold mt-0.5", (s?.floating || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {s ? fmt(s.floating) : "$0.00"}
                      </div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Posisi aktif berjalan</div>
                    </div>

                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">Free Margin</div>
                      <div className="text-base font-bold text-white mt-0.5">{s ? fmt(s.freeMargin) : "$0.00"}</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Margin tersisa</div>
                    </div>

                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">P/L Hari Ini</div>
                      <div className={cn("text-sm font-bold mt-0.5", (s?.pnlToday || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {s ? fmt(s.pnlToday) : "$0.00"}
                      </div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Realized server day</div>
                    </div>

                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">P/L Minggu Ini</div>
                      <div className={cn("text-sm font-bold mt-0.5", (s?.pnlWeek || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {s ? fmt(s.pnlWeek) : "$0.00"}
                      </div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Realized Senin - skrg</div>
                    </div>

                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">P/L Bulan Ini</div>
                      <div className={cn("text-sm font-bold mt-0.5", (s?.pnlMonth || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {s ? fmt(s.pnlMonth) : "$0.00"}
                      </div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Realized MTD</div>
                    </div>

                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">Margin Digunakan</div>
                      <div className="text-sm font-bold text-white mt-0.5">{s ? fmt(s.margin) : "$0.00"}</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Broker margin</div>
                    </div>

                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">Win Rate Portofolio</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">{s ? pct(s.winRate) : "0.0%"}</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">{s ? s.closedTrades : 0} closed trades</div>
                    </div>

                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">Profit Factor</div>
                      <div className="text-sm font-bold text-amber-400 mt-0.5">{s ? fmt(s.profitFactor) : "0.00"}</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Gross Win / Gross Loss</div>
                    </div>

                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">Daily Drawdown %</div>
                      <div className="text-sm font-bold text-rose-400 mt-0.5">{s ? fmt(s.dailyDrawdownPct) : "0.00"}%</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Dari equity awal hari</div>
                    </div>

                    <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2">
                      <div className="text-[9px] text-gray-400 uppercase font-sans">Max Drawdown %</div>
                      <div className="text-sm font-bold text-rose-400 mt-0.5">{s ? fmt(s.maxDrawdownPct) : "0.00"}%</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Max drawdown teramati</div>
                    </div>
                  </div>
                </div>

                {/* Portfolio Status & Health Analysis */}
                <div className="rounded-md border border-[#1e293b] bg-[#111827] p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-[#1e293b] pb-1.5">
                    <span className="text-xs font-bold text-gray-200">2. Analisis Kesehatan & Paparan Risiko</span>
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="size-3" />
                      Algorithmic Safety Guard: ACTIVE
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                    <div className="bg-[#0b0f19] p-2 rounded border border-[#1e293b]">
                      <div className="text-[9px] text-gray-400 font-sans">Total EA Terpasang</div>
                      <div className="text-sm font-bold text-white mt-0.5">{rawEas.length || 14} Engines</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">8 XAU · 3 BTC · 3 USOIL</div>
                    </div>
                    <div className="bg-[#0b0f19] p-2 rounded border border-[#1e293b]">
                      <div className="text-[9px] text-gray-400 font-sans">Open Risk ke Stop Loss</div>
                      <div className="text-sm font-bold text-white mt-0.5">{s && s.openRisk != null ? fmt(s.openRisk) : "$0.00"}</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">{s?.openRiskNote || "Terkontrol per SL"}</div>
                    </div>
                    <div className="bg-[#0b0f19] p-2 rounded border border-[#1e293b]">
                      <div className="text-[9px] text-gray-400 font-sans">Expectancy Net / Trade</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">{s ? fmt(s.expectancy) : "$0.00"}</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">Rata-rata net per posisi</div>
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-400 italic">
                    Catatan Eksekutif: Seluruh Expert Advisor beroperasi dengan parameter Stop Loss mutlak dan pembatasan risiko harian (Daily Drawdown Cutoff 4%). Data di atas direkonstruksi langsung dari event deal broker MT5.
                  </p>
                </div>
              </div>

              {/* Page 1 Footer */}
              <div className="border-t border-[#1e293b] pt-2 flex items-center justify-between text-[9px] font-mono text-gray-500">
                <span>Multi Asset Terminal · Laporan Kuantitatif Rahasia</span>
                <span>Halaman 1 dari {includePositions || includeTrades ? "3" : "2"}</span>
                <span>ID Laporan: MAT-REP-{new Date().getTime().toString().slice(-6)}</span>
              </div>
            </div>

            {/* =========================================================================
                PAGE 2: EA LEADERBOARD (MENGGANTIKAN LOG STREAM TERMINAL)
                ========================================================================= */}
            <div
              className="report-pdf-page bg-[#0b0f19] border border-[#1e293b] shadow-2xl p-7 flex flex-col justify-between text-[#f8fafc]"
              style={{
                width: "794px",
                height: "1123px",
                boxSizing: "border-box",
                pageBreakAfter: "always",
                breakAfter: "page",
              }}
            >
              <div className="space-y-3.5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                  <div>
                    <h2 className="text-base font-extrabold tracking-wide text-white uppercase flex items-center gap-2">
                      EA Performance Leaderboard
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-normal">
                        {filterAsset === "ALL" ? "Semua 14 EA" : `${filterAsset} Suite`}
                      </span>
                    </h2>
                    <p className="text-[10px] text-gray-400 font-mono">
                      Data metrik performa individual setiap Expert Advisor (menggantikan stream terminal)
                    </p>
                  </div>
                  <div className="text-right text-[10px] font-mono text-gray-400">
                    <div>Total Trades: <span className="text-white font-bold">{totalTradesCount}</span></div>
                    <div>Net Realized: <span className={cn("font-bold", totalRealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>{fmt(totalRealizedPnl)}</span></div>
                  </div>
                </div>

                {/* Leaderboard Table */}
                <div className="rounded-md border border-[#1e293b] bg-[#111827] overflow-hidden">
                  <table className="w-full text-left text-[10px] font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-[#1e293b] bg-[#161f33] text-gray-400 font-sans uppercase text-[9px]">
                        <th className="py-2 px-2.5">Nama EA (Kode)</th>
                        <th className="py-2 px-1.5 text-center">Asset</th>
                        <th className="py-2 px-1.5 text-center">TF</th>
                        <th className="py-2 px-2 text-right">Trades</th>
                        <th className="py-2 px-2 text-right">Win Rate</th>
                        <th className="py-2 px-2.5 text-right">Net P/L</th>
                        <th className="py-2 px-2 text-right">PF</th>
                        <th className="py-2 px-2 text-right">Max DD</th>
                        <th className="py-2 px-2 text-center">L / S</th>
                        <th className="py-2 px-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]/70">
                      {filteredEas.map((e, idx) => {
                        const asset = getAsset(e.name, e.strategy);
                        const { code, cleanName } = formatEaDisplayName(e.id, e.name);
                        const tf = getEaTimeframe(asset);
                        const isWin = (e.netPnl || 0) >= 0;

                        return (
                          <tr key={e.id || idx} className="hover:bg-[#161f33]/40">
                            <td className="py-1.5 px-2.5">
                              <div className="flex items-center gap-1 font-sans">
                                <span className="font-mono text-amber-400 font-bold">{code}_</span>
                                <span className="text-white font-medium truncate max-w-[170px]">{cleanName}</span>
                              </div>
                            </td>
                            <td className="py-1.5 px-1.5 text-center">
                              <span
                                className={cn(
                                  "rounded px-1 py-0.2 text-[8px] font-bold uppercase",
                                  asset === "XAU" && "bg-amber-500/10 text-amber-400 border border-amber-500/30",
                                  asset === "BTC" && "bg-orange-500/10 text-orange-400 border border-orange-500/30",
                                  asset === "USOIL" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                )}
                              >
                                {asset}
                              </span>
                            </td>
                            <td className="py-1.5 px-1.5 text-center text-gray-400">{tf}</td>
                            <td className="py-1.5 px-2 text-right text-gray-200">{e.trades || 0}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-emerald-400">
                              {pct(e.winRate || 0)}
                            </td>
                            <td className={cn("py-1.5 px-2.5 text-right font-bold", isWin ? "text-emerald-400" : "text-rose-400")}>
                              {fmt(e.netPnl || 0)}
                            </td>
                            <td className="py-1.5 px-2 text-right text-amber-400 font-semibold">{fmt(e.pf || 0)}</td>
                            <td className="py-1.5 px-2 text-right text-rose-400">{fmt(e.maxDd || 0)}%</td>
                            <td className="py-1.5 px-2 text-center text-gray-400 text-[9px]">{e.longs || 0}/{e.shorts || 0}</td>
                            <td className="py-1.5 px-2 text-center">
                              <span className="inline-flex items-center gap-1 text-[8px] text-emerald-400 font-sans">
                                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Active
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Subtotals per Asset Suite */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase text-gray-300">
                    Rekapitulasi Performa Per Asset Suite:
                  </h3>
                  <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
                    {(
                      [
                        { id: "XAU", name: "Gold (XAUUSD)", color: "border-amber-500/40 text-amber-400" },
                        { id: "BTC", name: "Bitcoin (BTCUSD)", color: "border-orange-500/40 text-orange-400" },
                        { id: "USOIL", name: "Crude Oil (USOIL)", color: "border-emerald-500/40 text-emerald-400" },
                      ] as const
                    ).map((suite) => {
                      const suiteEas = rawEas.filter((e) => getAsset(e.name, e.strategy) === suite.id);
                      const trades = suiteEas.reduce((a, b) => a + (b.trades || 0), 0);
                      const pnl = suiteEas.reduce((a, b) => a + (b.netPnl || 0), 0);
                      const wr = suiteEas.length > 0 ? suiteEas.reduce((a, b) => a + (b.winRate || 0), 0) / suiteEas.length : 0;

                      return (
                        <div key={suite.id} className={cn("rounded border bg-[#111827] p-2.5 space-y-1", suite.color)}>
                          <div className="font-sans font-bold text-white text-xs">{suite.name}</div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-400">Total Net:</span>
                            <span className={cn("font-bold", pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>{fmt(pnl)}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-400">Avg Win Rate:</span>
                            <span className="text-emerald-400 font-bold">{pct(wr)}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-400">Total Deals:</span>
                            <span className="text-white">{trades} trades</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2.5 text-[10px] text-gray-400 leading-relaxed font-sans">
                  <span className="text-white font-semibold">Struktur Pengujian & Penamaan:</span> Seluruh EA dilengkapi kode prefix unik (<span className="text-amber-400 font-mono">EA01_</span> s/d <span className="text-amber-400 font-mono">EA07_</span>, serta versi pembaruan <span className="text-amber-400 font-mono">EA02V2_</span>) untuk memastikan integritas identifikasi magic number di terminal MetaTrader 5 tanpa tumpang-tindih kalkulasi deal.
                </div>
              </div>

              {/* Page 2 Footer */}
              <div className="border-t border-[#1e293b] pt-2 flex items-center justify-between text-[9px] font-mono text-gray-500">
                <span>Multi Asset Terminal · EA Leaderboard Data</span>
                <span>Halaman 2 dari {includePositions || includeTrades ? "3" : "2"}</span>
                <span>ID Laporan: MAT-REP-{new Date().getTime().toString().slice(-6)}</span>
              </div>
            </div>

            {/* =========================================================================
                PAGE 3: LIVE POSITIONS & TRADE HISTORY AUDIT (OPTIONAL / EXPANDED)
                ========================================================================= */}
            {(includePositions || includeTrades) && (
              <div
                className="report-pdf-page bg-[#0b0f19] border border-[#1e293b] shadow-2xl p-7 flex flex-col justify-between text-[#f8fafc]"
                style={{
                  width: "794px",
                  height: "1123px",
                  boxSizing: "border-box",
                  pageBreakAfter: "avoid",
                  breakAfter: "avoid",
                }}
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
                    <div>
                      <h2 className="text-base font-extrabold tracking-wide text-white uppercase">
                        Posisi Berjalan & Riwayat Eksekusi
                      </h2>
                      <p className="text-[10px] text-gray-400 font-mono">
                        Audit transparansi posisi pasar saat ini dan riwayat transaksi closed deals
                      </p>
                    </div>
                    <div className="text-right text-[10px] font-mono text-gray-400">
                      <div>Posisi Aktif: <span className="text-amber-400 font-bold">{filteredPositions.length}</span></div>
                      <div>Sample Riwayat: <span className="text-white font-bold">{filteredTrades.length}</span></div>
                    </div>
                  </div>

                  {/* Section A: Live Positions */}
                  {includePositions && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase text-gray-300">
                          1. Posisi Pasar Terbuka (Live Positions)
                        </h3>
                        <span className="text-[10px] font-mono text-gray-400">Total Floating: {s ? fmt(s.floating) : "$0.00"}</span>
                      </div>

                      {filteredPositions.length === 0 ? (
                        <div className="rounded-md border border-[#1e293b] bg-[#111827] p-3 text-center text-xs text-gray-400 font-sans italic">
                          Tidak ada posisi pasar yang sedang terbuka saat laporan dibuat. Semua EA berada dalam mode standby/patroli.
                        </div>
                      ) : (
                        <div className="rounded-md border border-[#1e293b] bg-[#111827] overflow-hidden">
                          <table className="w-full text-left text-[10px] font-mono border-collapse">
                            <thead>
                              <tr className="border-b border-[#1e293b] bg-[#161f33] text-gray-400 font-sans uppercase text-[9px]">
                                <th className="py-1.5 px-2">Ticket</th>
                                <th className="py-1.5 px-2">EA</th>
                                <th className="py-1.5 px-1.5 text-center">Symbol</th>
                                <th className="py-1.5 px-1.5 text-center">Side</th>
                                <th className="py-1.5 px-2 text-right">Lots</th>
                                <th className="py-1.5 px-2 text-right">Entry</th>
                                <th className="py-1.5 px-2 text-right">Price</th>
                                <th className="py-1.5 px-2 text-right">SL / TP</th>
                                <th className="py-1.5 px-2.5 text-right">Floating</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e293b]/70">
                              {filteredPositions.map((p) => (
                                <tr key={p.ticket}>
                                  <td className="py-1 px-2 text-gray-300">#{p.ticket}</td>
                                  <td className="py-1 px-2 font-bold text-amber-400">{p.ea}</td>
                                  <td className="py-1 px-1.5 text-center text-white">{p.symbol}</td>
                                  <td className="py-1 px-1.5 text-center">
                                    <span className={cn("px-1 py-0.2 rounded text-[8px] font-bold", p.side === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                                      {p.side}
                                    </span>
                                  </td>
                                  <td className="py-1 px-2 text-right text-gray-200">{p.volume}</td>
                                  <td className="py-1 px-2 text-right text-gray-200">{fmt(p.entry)}</td>
                                  <td className="py-1 px-2 text-right text-white font-bold">{fmt(p.price)}</td>
                                  <td className="py-1 px-2 text-right text-gray-400 text-[9px]">{p.sl ? fmt(p.sl) : "-"} / {p.tp ? fmt(p.tp) : "-"}</td>
                                  <td className={cn("py-1 px-2.5 text-right font-bold", p.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                    {fmt(p.pnl)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section B: Trade History Sample */}
                  {includeTrades && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase text-gray-300">
                          2. Riwayat Transaksi Closed Deals Terakhir
                        </h3>
                        <span className="text-[10px] font-mono text-gray-400">10 Transaksi Terakhir</span>
                      </div>

                      {filteredTrades.length === 0 ? (
                        <div className="rounded-md border border-[#1e293b] bg-[#111827] p-3 text-center text-xs text-gray-400 font-sans italic">
                          Belum ada data riwayat deal untuk filter ini.
                        </div>
                      ) : (
                        <div className="rounded-md border border-[#1e293b] bg-[#111827] overflow-hidden">
                          <table className="w-full text-left text-[10px] font-mono border-collapse">
                            <thead>
                              <tr className="border-b border-[#1e293b] bg-[#161f33] text-gray-400 font-sans uppercase text-[9px]">
                                <th className="py-1.5 px-2">Ticket</th>
                                <th className="py-1.5 px-2">EA</th>
                                <th className="py-1.5 px-1.5 text-center">Side</th>
                                <th className="py-1.5 px-2 text-right">Vol</th>
                                <th className="py-1.5 px-2 text-right">Entry</th>
                                <th className="py-1.5 px-2 text-right">Exit</th>
                                <th className="py-1.5 px-2 text-right">Gross</th>
                                <th className="py-1.5 px-2.5 text-right">Net P/L</th>
                                <th className="py-1.5 px-1.5 text-center">R</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e293b]/70">
                              {filteredTrades.map((t) => {
                                const isProfit = t.net >= 0;
                                return (
                                  <tr key={t.id}>
                                    <td className="py-1 px-2 text-gray-300">#{t.id}</td>
                                    <td className="py-1 px-2 font-bold text-amber-400">{t.ea}</td>
                                    <td className="py-1 px-1.5 text-center">
                                      <span className={cn("px-1 py-0.2 rounded text-[8px] font-bold", t.side === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                                        {t.side}
                                      </span>
                                    </td>
                                    <td className="py-1 px-2 text-right text-gray-200">{t.volume}</td>
                                    <td className="py-1 px-2 text-right text-gray-300">{fmt(t.entry)}</td>
                                    <td className="py-1 px-2 text-right text-gray-300">{fmt(t.exit)}</td>
                                    <td className="py-1 px-2 text-right text-gray-300">{fmt(t.gross)}</td>
                                    <td className={cn("py-1 px-2.5 text-right font-bold", isProfit ? "text-emerald-400" : "text-rose-400")}>
                                      {fmt(t.net)}
                                    </td>
                                    <td className="py-1 px-1.5 text-center text-gray-400">{t.r != null ? `${t.r.toFixed(1)}R` : "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section C: Compliance Disclaimer */}
                  <div className="rounded-md border border-[#1e293b] bg-[#111827] p-2.5 space-y-1 text-[9px] text-gray-400 leading-relaxed font-sans">
                    <div className="font-semibold text-white uppercase tracking-wider text-[10px]">
                      Pernyataan Risiko & Kepatuhan Algoritmik:
                    </div>
                    <p>
                      Laporan ini dibuat secara otomatis oleh sistem Multi Asset Terminal berdasarkan stream telemetri dan deal history broker MetaTrader 5 secara real-time. Performa masa lalu tidak menjamin hasil perdagangan di masa depan. Seluruh sistem trading kuantitatif ini dioperasikan dengan manajemen risiko terotomasi dan perlindungan modal ketat.
                    </p>
                  </div>
                </div>

                {/* Page 3 Footer */}
                <div className="border-t border-[#1e293b] pt-2 flex items-center justify-between text-[9px] font-mono text-gray-500">
                  <span>Multi Asset Terminal · Audit Transaksi & Posisi</span>
                  <span>Halaman 3 dari 3</span>
                  <span>ID Laporan: MAT-REP-{new Date().getTime().toString().slice(-6)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
